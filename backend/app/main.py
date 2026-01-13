"""Israeli Radio Manager - FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient


from app.config import settings
from app.routers import content, schedule, playback, upload, agent, websocket, calendar, flows, settings as settings_router, admin, users, voices, campaigns
from app.services.audio_player import AudioPlayerService
from app.services.chatterbox import ChatterboxService
from app.services.notifications import NotificationService
from app.services.content_sync import ContentSyncService
from app.services.google_calendar import GoogleCalendarService
from app.services.calendar_watcher import CalendarWatcherService
from app.services.gmail import GmailService
from app.services.email_watcher import EmailWatcherService
from app.services.metadata_refresher import MetadataRefresherService
from app.services.flow_monitor import FlowMonitorService
from app.services.playback_monitor import PlaybackMonitorService
from app.services.health_monitor import HealthMonitorService
from app.services.user_service import UserService

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown events."""
    # Startup
    logger.info("Starting Israeli Radio Manager...")

    # Connect to MongoDB
    app.state.mongo_client = AsyncIOMotorClient(settings.mongodb_uri)
    app.state.db = app.state.mongo_client[settings.mongodb_db]
    logger.info(f"Connected to MongoDB: {settings.mongodb_db}")

    # Initialize collections with indexes
    await init_database(app.state.db)

    # Initialize notification service
    app.state.notification_service = NotificationService(
        db=app.state.db,
        twilio_sid=settings.twilio_account_sid,
        twilio_token=settings.twilio_auth_token,
        twilio_phone=settings.twilio_phone_number,
        vapid_public_key=settings.vapid_public_key,
        vapid_private_key=settings.vapid_private_key,
        vapid_email=settings.vapid_claims_email,
        admin_email=settings.admin_email,
        admin_phone=settings.admin_phone
    )
    logger.info("Notification service initialized")

    # Initialize user service
    app.state.user_service = UserService(db=app.state.db)
    await app.state.user_service.ensure_admin_exists()
    logger.info("User service initialized")

    # Load saved admin contacts from database (override defaults)
    saved_settings = await app.state.db.settings.find_one({"_id": "app_settings"})
    if saved_settings and saved_settings.get("admin_contact"):
        contact = saved_settings["admin_contact"]
        if contact.get("email"):
            app.state.notification_service._admin_email = contact["email"]
        if contact.get("phone"):
            app.state.notification_service._admin_phone = contact["phone"]
        logger.info("Loaded admin contacts from database")

    # Initialize audio player
    app.state.audio_player = AudioPlayerService(cache_dir=settings.cache_dir)
    logger.info("Audio player service initialized")

    # Initialize content sync service (GCS only, no Google Drive)
    app.state.content_sync = ContentSyncService(
        db=app.state.db,
        drive_service=None  # Not using Google Drive anymore
    )
    logger.info("Content sync service initialized (GCS only)")

    # Initialize Google Calendar service
    app.state.calendar_service = GoogleCalendarService(
        credentials_file=settings.google_credentials_file,
        token_file=settings.google_token_file,
        calendar_id=settings.google_calendar_id,
        service_account_file=settings.google_service_account_file,
        timezone=settings.timezone
    )
    # Try to authenticate (may fail if no credentials)
    try:
        auth_success = await app.state.calendar_service.authenticate()
        if auth_success:
            logger.info("Google Calendar service initialized and authenticated")
        else:
            logger.warning("Google Calendar authentication returned False. Calendar features will be unavailable.")
            app.state.calendar_service = None
    except Exception as e:
        logger.warning(f"Google Calendar authentication failed: {e}. Calendar features will be unavailable.")
        app.state.calendar_service = None

    # Initialize and start calendar watcher (background task)
    app.state.calendar_watcher = None
    if app.state.calendar_service:
        app.state.calendar_watcher = CalendarWatcherService(
            db=app.state.db,
            calendar_service=app.state.calendar_service,
            audio_player=app.state.audio_player,
            drive_service=None,  # Not using Google Drive
            check_interval=15,  # Check every 15 seconds
            lookahead_minutes=2  # Look 2 minutes ahead
        )
        await app.state.calendar_watcher.start()
        logger.info("Calendar watcher started - monitoring scheduled events")

    # Initialize Gmail service
    app.state.gmail_service = None
    try:
        app.state.gmail_service = GmailService(
            credentials_path=settings.google_credentials_file,
            token_path=settings.google_gmail_token_file,
            download_dir=settings.cache_dir
        )
        logger.info("Gmail service initialized")
    except Exception as e:
        logger.warning(f"Gmail service initialization failed: {e}. Email watcher will be unavailable.")

    # Initialize and start email watcher (background task for auto-importing audio from email)
    app.state.email_watcher = None
    if app.state.gmail_service:
        # Import orchestrator for AI classification (optional)
        orchestrator = None
        try:
            from app.agent.orchestrator import OrchestratorAgent
            orchestrator = OrchestratorAgent(
                db=app.state.db,
                audio_player=app.state.audio_player,
                content_sync=app.state.content_sync,
                calendar_service=app.state.calendar_service
            )
        except Exception as e:
            logger.warning(f"Could not initialize orchestrator for email watcher: {e}")

        app.state.email_watcher = EmailWatcherService(
            db=app.state.db,
            gmail_service=app.state.gmail_service,
            drive_service=None,  # Not using Google Drive
            orchestrator_agent=orchestrator,
            check_interval=60,  # Check every 60 seconds
            auto_approve_threshold=0.8  # Auto-approve if confidence > 80%
        )
        await app.state.email_watcher.start()
        logger.info("Email watcher started - monitoring for audio attachments")

    # Initialize and start metadata refresher (background task for periodic metadata updates)
    app.state.metadata_refresher = MetadataRefresherService(
        db=app.state.db,
        drive_service=None,  # Not using Google Drive
        check_interval=3600  # Check every hour (3600 seconds)
    )
    await app.state.metadata_refresher.start()
    logger.info("Metadata refresher started - updating metadata every hour")

    # Initialize orchestrator agent for flow monitoring
    flow_orchestrator = None
    try:
        from app.agent.orchestrator import OrchestratorAgent
        flow_orchestrator = OrchestratorAgent(
            db=app.state.db,
            audio_player=app.state.audio_player,
            content_sync=app.state.content_sync,
            calendar_service=app.state.calendar_service
        )
    except Exception as e:
        logger.warning(f"Could not initialize orchestrator for flow monitor: {e}")

    # Initialize and start flow monitor (background task for real-time flow scheduling)
    app.state.flow_monitor = FlowMonitorService(
        db=app.state.db,
        audio_player=app.state.audio_player,
        orchestrator_agent=flow_orchestrator,
        check_interval=30  # Check every 30 seconds
    )
    await app.state.flow_monitor.start()
    logger.info("Flow monitor started - intelligent real-time flow scheduling")

    # Initialize and start playback monitor (background task for outage detection)
    app.state.playback_monitor = PlaybackMonitorService(
        db=app.state.db,
        notification_service=app.state.notification_service,
        check_interval=60,  # Check every 60 seconds
        outage_threshold_minutes=5,  # Alert if no playback for 5 minutes
        alert_cooldown_minutes=30  # Don't spam alerts
    )
    await app.state.playback_monitor.start()
    logger.info("Playback monitor started - detecting playback outages")

    # Initialize and start health monitor (background task for server health monitoring)
    app.state.health_monitor = HealthMonitorService(
        notification_service=app.state.notification_service,
        check_interval=60,  # Check every 60 seconds
        cpu_threshold=80.0,  # Alert at 80% CPU
        memory_threshold=85.0,  # Alert at 85% memory
        disk_threshold=90.0,  # Alert at 90% disk
        alert_cooldown_minutes=30  # Don't spam alerts
    )
    await app.state.health_monitor.start()
    logger.info("Health monitor started - monitoring server metrics")

    # Initialize Chatterbox TTS service
    app.state.chatterbox_service = None
    if settings.chatterbox_enabled:
        try:
            app.state.chatterbox_service = ChatterboxService(
                db=app.state.db,
                model_name=settings.chatterbox_model,
                device=settings.chatterbox_device,
                cache_dir=settings.chatterbox_cache_dir,
                gcs_service=getattr(app.state.content_sync, 'gcs_service', None)
            )
            initialized = await app.state.chatterbox_service.initialize()
            if initialized:
                logger.info(f"Chatterbox TTS service initialized (model={settings.chatterbox_model}, device={settings.chatterbox_device})")
            else:
                logger.warning("Chatterbox TTS initialization returned False. TTS features will be unavailable.")
                app.state.chatterbox_service = None
        except Exception as e:
            logger.warning(f"Chatterbox TTS initialization failed: {e}. TTS features will be unavailable.")
            app.state.chatterbox_service = None
    else:
        logger.info("Chatterbox TTS is disabled in settings")

    yield

    # Shutdown
    logger.info("Shutting down Israeli Radio Manager...")
    if hasattr(app.state, 'chatterbox_service') and app.state.chatterbox_service:
        await app.state.chatterbox_service.cleanup()
    if hasattr(app.state, 'health_monitor'):
        await app.state.health_monitor.stop()
    if hasattr(app.state, 'playback_monitor'):
        await app.state.playback_monitor.stop()
    if hasattr(app.state, 'flow_monitor'):
        await app.state.flow_monitor.stop()
    if hasattr(app.state, 'metadata_refresher'):
        await app.state.metadata_refresher.stop()
    if app.state.email_watcher:
        await app.state.email_watcher.stop()
    if app.state.calendar_watcher:
        await app.state.calendar_watcher.stop()
    if hasattr(app.state, 'audio_player'):
        app.state.audio_player.cleanup()
    app.state.mongo_client.close()


async def init_database(db):
    """Initialize database collections and indexes."""
    # Content collection indexes
    await db.content.create_index("type")
    await db.content.create_index("genre")
    await db.content.create_index("last_played")

    # Schedule collection indexes
    await db.schedules.create_index("day_of_week")
    await db.schedules.create_index([("start_time", 1), ("end_time", 1)])

    # Playback log indexes
    await db.playback_logs.create_index("started_at")
    await db.playback_logs.create_index("content_id")

    # Pending actions indexes
    await db.pending_actions.create_index("status")
    await db.pending_actions.create_index("expires_at")

    # Push subscriptions indexes
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index("created_at")

    # Users collection indexes
    await db.users.create_index("firebase_uid", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("role")
    await db.users.create_index("is_active")

    # Voice presets collection indexes
    await db.voice_presets.create_index("name", unique=True)
    await db.voice_presets.create_index("is_default")

    # Commercial campaigns collection indexes
    await db.commercial_campaigns.create_index([("status", 1), ("start_date", 1), ("end_date", 1)])
    await db.commercial_campaigns.create_index("priority")

    # Commercial play logs collection indexes
    await db.commercial_play_logs.create_index([("campaign_id", 1), ("slot_date", 1), ("slot_index", 1)])
    await db.commercial_play_logs.create_index("played_at")

    # Librarian audit reports collection indexes
    await db.audit_reports.create_index("audit_date")
    await db.audit_reports.create_index("status")
    await db.audit_reports.create_index("audit_type")
    await db.audit_reports.create_index([("audit_type", 1), ("audit_date", 1)])

    # Librarian actions collection indexes
    await db.librarian_actions.create_index("audit_id")
    await db.librarian_actions.create_index("content_id")
    await db.librarian_actions.create_index("timestamp")
    await db.librarian_actions.create_index("action_type")
    await db.librarian_actions.create_index([("audit_id", 1), ("action_type", 1)])
    await db.librarian_actions.create_index([("content_id", 1), ("timestamp", 1)])
    await db.librarian_actions.create_index("rolled_back")

    # Stream validation cache collection indexes
    await db.stream_validation_cache.create_index("stream_url")
    await db.stream_validation_cache.create_index("last_validated")
    await db.stream_validation_cache.create_index([("stream_url", 1), ("last_validated", 1)])
    await db.stream_validation_cache.create_index("expires_at")
    await db.stream_validation_cache.create_index("is_valid")

    # Classification verification cache collection indexes
    await db.classification_verification_cache.create_index("content_id")
    await db.classification_verification_cache.create_index([("content_id", 1), ("category_id", 1)])
    await db.classification_verification_cache.create_index("last_verified")
    await db.classification_verification_cache.create_index("expires_at")
    await db.classification_verification_cache.create_index("is_correct")

    # Backup collection indexes
    await db.backups.create_index("created_at")
    await db.backups.create_index("backup_type")
    await db.backups.create_index("backup_name", unique=True)
    await db.backups.create_index([("backup_type", 1), ("created_at", -1)])
    await db.backups.create_index("status")

    logger.info("Database indexes created")


# Create FastAPI application
app = FastAPI(
    title="Israeli Radio Manager",
    description="Management dashboard for Israeli Hebrew-speaking radio station",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://radio.olorin.ai",
        "https://demo.radio.olorin.ai",  # Demo site
        "https://israeli-radio-475c9.web.app",
        "https://israeli-radio-475c9.firebaseapp.com",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(content.router, prefix="/api/content", tags=["Content"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["Schedule"])
app.include_router(playback.router, prefix="/api/playback", tags=["Playback"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(agent.router, prefix="/api/agent", tags=["AI Agent"])
app.include_router(websocket.router, prefix="/ws", tags=["WebSocket"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(flows.router, prefix="/api/flows", tags=["Auto Flows"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(voices.router, prefix="/api/voices", tags=["TTS Voices"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "name": "Israeli Radio Manager",
        "version": "0.1.0",
        "status": "running"
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "environment": settings.environment,
        "agent_mode": settings.agent_mode
    }
