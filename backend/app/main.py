"""Israeli Radio Manager - FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.routers import content, schedule, playback, upload, agent, websocket, calendar, flows
from app.services.audio_player import AudioPlayerService
from app.services.google_drive import GoogleDriveService
from app.services.content_sync import ContentSyncService
from app.services.google_calendar import GoogleCalendarService
from app.services.calendar_watcher import CalendarWatcherService
from app.services.gmail import GmailService
from app.services.email_watcher import EmailWatcherService

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
            token_path="gmail_token.json",
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

    yield

    # Shutdown
    logger.info("Shutting down Israeli Radio Manager...")
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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
