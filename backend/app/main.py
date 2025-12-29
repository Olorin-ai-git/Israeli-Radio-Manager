"""Israeli Radio Manager - FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient


from app.config import settings
from app.routers import content, schedule, playback, upload, agent, websocket, calendar, flows, settings as settings_router
from app.services.audio_player import AudioPlayerService
from app.services.notifications import NotificationService
from app.services.google_drive import GoogleDriveService
from app.services.content_sync import ContentSyncService
from app.services.google_calendar import GoogleCalendarService
from app.services.calendar_watcher import CalendarWatcherService
from app.services.gmail import GmailService
from app.services.email_watcher import EmailWatcherService
from app.services.metadata_refresher import MetadataRefresherService
from app.services.flow_monitor import FlowMonitorService
from app.services.playback_monitor import PlaybackMonitorService

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

    # Initialize Google Drive service with OAuth
    app.state.drive_service = GoogleDriveService(
        credentials_path=settings.google_credentials_file,
        token_path=settings.google_drive_token_file,
        service_account_file=settings.google_service_account_file,
        root_folder_id=settings.google_drive_root_folder_id,
        cache_dir=settings.cache_dir
    )
    # Authenticate Drive service (will trigger OAuth if needed)
    try:
        app.state.drive_service.authenticate()
        logger.info("Google Drive service initialized and authenticated")
    except Exception as e:
        logger.warning(f"Google Drive authentication failed: {e}. Drive features will be limited.")
        # Keep the service but it won't be able to download files

    # Initialize content sync service
    app.state.content_sync = ContentSyncService(
        db=app.state.db,
        drive_service=app.state.drive_service
    )
    logger.info("Content sync service initialized")

    # Initialize Google Calendar service
    app.state.calendar_service = GoogleCalendarService(
        credentials_file=settings.google_credentials_file,
        token_file=settings.google_token_file,
        calendar_id=settings.google_calendar_id
    )
    # Try to authenticate (may fail if no credentials)
    try:
        await app.state.calendar_service.authenticate()
        logger.info("Google Calendar service initialized and authenticated")
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
            drive_service=app.state.drive_service,
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
            drive_service=app.state.drive_service,
            orchestrator_agent=orchestrator,
            check_interval=60,  # Check every 60 seconds
            auto_approve_threshold=0.8  # Auto-approve if confidence > 80%
        )
        await app.state.email_watcher.start()
        logger.info("Email watcher started - monitoring for audio attachments")

    # Initialize and start metadata refresher (background task for periodic metadata updates)
    app.state.metadata_refresher = MetadataRefresherService(
        db=app.state.db,
        drive_service=app.state.drive_service,
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

    yield

    # Shutdown
    logger.info("Shutting down Israeli Radio Manager...")
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
    await db.content.create_index("google_drive_id", unique=True)
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

    # Settings collection (singleton)
    await db.settings.create_index("_id", unique=True)

    # Push subscriptions indexes
    await db.push_subscriptions.create_index("endpoint", unique=True)
    await db.push_subscriptions.create_index("created_at")

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
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Cannot use credentials with wildcard
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
