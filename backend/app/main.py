"""Israeli Radio Manager - FastAPI Application Entry Point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.routers import content, schedule, playback, upload, agent, websocket

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

    # TODO: Initialize audio player
    # TODO: Initialize background workers
    # TODO: Initialize AI agent

    yield

    # Shutdown
    logger.info("Shutting down Israeli Radio Manager...")
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
