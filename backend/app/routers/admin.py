"""Admin router with system configuration, storage management, and content administration endpoints."""

import logging
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from google.cloud import storage

from app.services.firebase_auth import firebase_auth
from app.services.google_drive import GoogleDriveService
from app.config import settings as env_settings

logger = logging.getLogger(__name__)


router = APIRouter()


# Sensitive environment variable keys that should be masked
SENSITIVE_KEYS = {
    "MONGODB_URI",
    "GOOGLE_CLIENT_SECRET",
    "ANTHROPIC_API_KEY",
    "TWILIO_AUTH_TOKEN",
    "VAPID_PRIVATE_KEY",
    "GOOGLE_SERVICE_ACCOUNT_FILE",
}


# ============================================================================
# Request/Response Models
# ============================================================================

class EnvConfigUpdate(BaseModel):
    """Request model for updating environment variables."""
    updates: Dict[str, str]


class BatchDeleteRequest(BaseModel):
    """Request model for batch delete operation."""
    content_ids: List[str]


class BatchMetadataUpdate(BaseModel):
    """Request model for batch metadata update."""
    content_ids: List[str]
    updates: Dict[str, Any]


class BatchGenreReassign(BaseModel):
    """Request model for batch genre reassignment."""
    content_ids: List[str]
    new_genre: str


# ============================================================================
# System Configuration Endpoints
# ============================================================================

@router.get("/config/env")
async def get_env_config(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
):
    """
    Get environment configuration organized by category.
    Sensitive keys are masked for security.
    """
    config = {
        "database": {
            "MONGODB_URI": "***masked***" if env_settings.mongodb_uri else None,
            "DATABASE_NAME": env_settings.mongodb_db,
        },
        "google": {
            "GOOGLE_SERVICE_ACCOUNT_FILE": env_settings.google_service_account_file,
            "GOOGLE_DRIVE_MUSIC_FOLDER_ID": env_settings.google_drive_music_folder_id,
            "GOOGLE_DRIVE_SHOWS_FOLDER_ID": env_settings.google_drive_shows_folder_id,
            "GOOGLE_DRIVE_COMMERCIALS_FOLDER_ID": env_settings.google_drive_commercials_folder_id,
            "GCS_BUCKET_NAME": env_settings.gcs_bucket_name,
        },
        "ai": {
            "ANTHROPIC_API_KEY": "***masked***" if env_settings.anthropic_api_key else None,
            "ANTHROPIC_MODEL": env_settings.anthropic_model,
        },
        "notifications": {
            "TWILIO_ACCOUNT_SID": env_settings.twilio_account_sid,
            "TWILIO_AUTH_TOKEN": "***masked***" if env_settings.twilio_auth_token else None,
            "TWILIO_PHONE_NUMBER": env_settings.twilio_phone_number,
            "VAPID_PRIVATE_KEY": "***masked***" if env_settings.vapid_private_key else None,
            "VAPID_PUBLIC_KEY": env_settings.vapid_public_key,
        },
        "system": {
            "ENVIRONMENT": env_settings.environment,
            "LOG_LEVEL": env_settings.log_level,
            "CACHE_DIR": env_settings.cache_dir,
        }
    }

    return config


@router.put("/config/env")
async def update_env_config(
    request: Request,
    update_request: EnvConfigUpdate,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, str]:
    """
    Update non-sensitive environment variables.
    Sensitive keys cannot be updated via this endpoint for security.
    """
    # Validate that no sensitive keys are being updated
    for key in update_request.updates.keys():
        if key in SENSITIVE_KEYS:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update sensitive key '{key}' via API"
            )

    # In production, you would update the .env file or configuration store
    # For now, this is a placeholder that would require system restart
    return {
        "status": "success",
        "message": "Configuration updated. Server restart required for changes to take effect.",
        "updated_keys": list(update_request.updates.keys())
    }


@router.get("/config/sensitive-keys")
async def get_sensitive_keys(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> List[str]:
    """Get list of environment variable keys that are considered sensitive."""
    return list(SENSITIVE_KEYS)


# ============================================================================
# Storage Management Endpoints
# ============================================================================

@router.get("/storage/stats")
async def get_storage_stats(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Get storage statistics across all three tiers:
    - Local cache
    - GCS bucket
    - Google Drive
    """
    stats = {
        "cache": {},
        "gcs": {},
        "drive": {}
    }

    # Local cache statistics
    cache_path = Path(env_settings.cache_dir)
    if cache_path.exists():
        total_size = 0
        file_count = 0
        for file in cache_path.rglob("*"):
            if file.is_file():
                total_size += file.stat().st_size
                file_count += 1

        stats["cache"] = {
            "size_bytes": total_size,
            "file_count": file_count,
            "path": str(cache_path)
        }
    else:
        stats["cache"] = {
            "size_bytes": 0,
            "file_count": 0,
            "path": str(cache_path),
            "exists": False
        }

    # GCS bucket statistics
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(env_settings.gcs_bucket_name)

        total_size = 0
        file_count = 0
        for blob in bucket.list_blobs():
            total_size += blob.size
            file_count += 1

        stats["gcs"] = {
            "size_bytes": total_size,
            "file_count": file_count,
            "bucket_name": env_settings.gcs_bucket_name
        }
    except Exception as e:
        stats["gcs"] = {
            "error": str(e),
            "bucket_name": env_settings.gcs_bucket_name
        }

    # Google Drive statistics - get from database (synced content)
    try:
        db = request.app.state.db
        content_sync = request.app.state.content_sync
        root_folder_id = content_sync.drive.root_folder_id if content_sync and content_sync.drive else None

        # Get stats from synced content in database
        pipeline = [
            {"$match": {"google_drive_id": {"$exists": True}}},
            {"$group": {
                "_id": None,
                "total_size": {"$sum": {"$ifNull": ["$file_size", 0]}},
                "file_count": {"$sum": 1}
            }}
        ]
        result = await db.content.aggregate(pipeline).to_list(1)

        if result:
            stats["drive"] = {
                "size_bytes": result[0].get("total_size", 0),
                "file_count": result[0].get("file_count", 0),
                "folder_id": root_folder_id or "Not configured",
                "source": "database (synced content)"
            }
        else:
            stats["drive"] = {
                "size_bytes": 0,
                "file_count": 0,
                "folder_id": root_folder_id or "Not configured",
                "source": "database (no synced content)"
            }

    except Exception as e:
        logger.error(f"Failed to get Google Drive statistics: {e}")
        stats["drive"] = {
            "error": str(e)
        }

    return stats


@router.post("/storage/cache/clear")
async def clear_cache(
    request: Request,
    keep_recent_days: Optional[int] = None,
    include_logs: bool = False,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Clear local cache directory and optionally log files.

    Args:
        keep_recent_days: If provided, keep files accessed within N days
        include_logs: If True, also delete log files (*.log)
    """
    cache_path = Path(env_settings.cache_dir)

    if not cache_path.exists():
        return {
            "status": "success",
            "message": "Cache directory does not exist",
            "files_deleted": 0,
            "bytes_freed": 0,
            "logs_deleted": 0
        }

    files_deleted = 0
    logs_deleted = 0
    bytes_freed = 0

    import time
    current_time = time.time()
    keep_threshold = keep_recent_days * 86400 if keep_recent_days else 0  # Convert days to seconds

    # Clear cache directory
    for file in cache_path.rglob("*"):
        if file.is_file():
            try:
                # Check if we should keep this file based on access time
                if keep_recent_days:
                    access_time = file.stat().st_atime
                    if (current_time - access_time) < keep_threshold:
                        continue

                # Delete the file
                file_size = file.stat().st_size
                file.unlink()
                files_deleted += 1
                bytes_freed += file_size
            except Exception as e:
                logger.error(f"Error deleting cache file {file}: {e}")

    # Clear log files if requested
    if include_logs:
        # Look for log files in common locations
        log_locations = [
            Path("."),  # Current directory
            Path("./logs"),
            Path("../logs"),
            Path("/var/log/israeli-radio"),
        ]

        for log_dir in log_locations:
            if not log_dir.exists():
                continue

            for log_file in log_dir.glob("*.log"):
                try:
                    # Check if we should keep this log based on access time
                    if keep_recent_days:
                        access_time = log_file.stat().st_atime
                        if (current_time - access_time) < keep_threshold:
                            continue

                    # Delete log file
                    file_size = log_file.stat().st_size
                    log_file.unlink()
                    logs_deleted += 1
                    bytes_freed += file_size
                    logger.info(f"Deleted log file: {log_file}")
                except Exception as e:
                    logger.error(f"Error deleting log file {log_file}: {e}")

    # Send notification about cache clear operation
    try:
        notification_service = request.app.state.notification_service
        if notification_service:
            bytes_freed_mb = bytes_freed / (1024 * 1024)
            message_parts = [f"Cleared {files_deleted} cache files"]
            if logs_deleted > 0:
                message_parts.append(f"{logs_deleted} log files")
            message_parts.append(f"freed {bytes_freed_mb:.2f} MB")

            await notification_service.send_notification(
                level="INFO",
                title="Cache & Logs Cleared" if include_logs else "Cache Cleared",
                message=", ".join(message_parts),
                user_email=user.get("email")
            )
    except Exception as e:
        logger.warning(f"Failed to send cache clear notification: {e}")

    return {
        "status": "success",
        "message": f"Cache cleared. Deleted {files_deleted} cache files" + (f" and {logs_deleted} log files" if logs_deleted > 0 else ""),
        "files_deleted": files_deleted,
        "logs_deleted": logs_deleted,
        "bytes_freed": bytes_freed
    }


@router.get("/storage/orphaned")
async def get_orphaned_files(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, List[str]]:
    """
    Find files in storage that are not referenced in the database.
    Returns lists of orphaned files in cache and GCS.
    """
    db = request.app.state.db

    orphaned = {
        "cache": [],
        "gcs": []
    }

    # Get all file paths from database
    content_collection = db["content"]
    db_files = set()
    async for doc in content_collection.find({}, {"file_path": 1, "gcs_path": 1}):
        if "file_path" in doc:
            db_files.add(doc["file_path"])
        if "gcs_path" in doc:
            db_files.add(doc["gcs_path"])

    # Check cache directory
    cache_path = Path(env_settings.cache_dir)
    if cache_path.exists():
        for file in cache_path.rglob("*"):
            if file.is_file():
                rel_path = str(file.relative_to(cache_path))
                if rel_path not in db_files:
                    orphaned["cache"].append(rel_path)

    # Check GCS bucket
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(env_settings.gcs_bucket_name)

        for blob in bucket.list_blobs():
            if blob.name not in db_files:
                orphaned["gcs"].append(blob.name)
    except Exception as e:
        orphaned["gcs_error"] = str(e)

    return orphaned


# ============================================================================
# Content Quality & Statistics Endpoints
# ============================================================================

@router.get("/content/quality-issues")
async def get_quality_issues(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, List[Dict]]:
    """
    Detect content quality issues:
    - Missing metadata (no artist, no genre)
    - Low audio quality (bitrate < 128kbps)
    - Short duration (< 30 seconds for songs)
    - Duplicate titles/artists
    """
    db = request.app.state.db
    content_collection = db["content"]

    issues = {
        "missing_metadata": [],
        "low_quality": [],
        "short_duration": [],
        "duplicates": []
    }

    # Find missing metadata
    missing_artist = await content_collection.find(
        {"type": "song", "$or": [{"artist": None}, {"artist": ""}]},
        {"_id": 1, "title": 1, "artist": 1}
    ).to_list(length=100)

    missing_genre = await content_collection.find(
        {"$or": [{"genre": None}, {"genre": ""}]},
        {"_id": 1, "title": 1, "genre": 1, "type": 1}
    ).to_list(length=100)

    issues["missing_metadata"] = missing_artist + missing_genre

    # Find low quality audio (bitrate < 128kbps)
    low_bitrate = await content_collection.find(
        {"bitrate": {"$lt": 128000}},
        {"_id": 1, "title": 1, "bitrate": 1}
    ).to_list(length=100)
    issues["low_quality"] = low_bitrate

    # Find short duration songs (< 30 seconds)
    short_songs = await content_collection.find(
        {"type": "song", "duration": {"$lt": 30}},
        {"_id": 1, "title": 1, "duration": 1}
    ).to_list(length=100)
    issues["short_duration"] = short_songs

    # Find potential duplicates (same title and artist)
    pipeline = [
        {"$match": {"type": "song"}},
        {"$group": {
            "_id": {"title": "$title", "artist": "$artist"},
            "count": {"$sum": 1},
            "ids": {"$push": "$_id"}
        }},
        {"$match": {"count": {"$gt": 1}}}
    ]
    duplicates = await content_collection.aggregate(pipeline).to_list(length=100)
    issues["duplicates"] = duplicates

    # Convert ObjectIds to strings for JSON serialization
    def convert_objectids(items: List[Dict]) -> List[Dict]:
        for item in items:
            if "_id" in item:
                item["_id"] = str(item["_id"])
            if "ids" in item:
                item["ids"] = [str(id) for id in item["ids"]]
        return items

    issues["missing_metadata"] = convert_objectids(issues["missing_metadata"])
    issues["low_quality"] = convert_objectids(issues["low_quality"])
    issues["short_duration"] = convert_objectids(issues["short_duration"])
    issues["duplicates"] = convert_objectids(issues["duplicates"])

    return issues


@router.get("/content/stats")
async def get_content_stats(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Get overall content statistics:
    - Total songs/shows/commercials
    - Content by genre
    - Average play count
    - Storage breakdown by type
    """
    db = request.app.state.db
    content_collection = db["content"]

    # Count by content type
    pipeline_by_type = [
        {"$group": {
            "_id": "$type",
            "count": {"$sum": 1},
            "total_duration": {"$sum": "$duration"},
            "avg_play_count": {"$avg": "$play_count"}
        }}
    ]
    by_type = await content_collection.aggregate(pipeline_by_type).to_list(length=100)

    # Count by genre
    pipeline_by_genre = [
        {"$match": {"genre": {"$ne": None}}},
        {"$group": {
            "_id": "$genre",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ]
    by_genre = await content_collection.aggregate(pipeline_by_genre).to_list(length=100)

    # Overall statistics
    total_content = await content_collection.count_documents({})
    total_songs = await content_collection.count_documents({"type": "song"})
    total_shows = await content_collection.count_documents({"type": "show"})
    total_commercials = await content_collection.count_documents({"type": "commercial"})

    # Get average play count
    avg_play_count_result = await content_collection.aggregate([
        {"$group": {"_id": None, "avg_play_count": {"$avg": "$play_count"}}}
    ]).to_list(length=1)
    avg_play_count = avg_play_count_result[0].get("avg_play_count", 0) if avg_play_count_result else 0

    return {
        "total_content": total_content,
        "by_type": {
            "songs": total_songs,
            "shows": total_shows,
            "commercials": total_commercials
        },
        "by_genre": by_genre,
        "breakdown_by_type": by_type,
        "avg_play_count": avg_play_count
    }


# ============================================================================
# Batch Operations Endpoints
# ============================================================================

@router.post("/content/batch/delete")
async def batch_delete_content(
    request: Request,
    delete_request: BatchDeleteRequest,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Hard delete multiple content items.
    Returns success count and error list.
    """
    from bson import ObjectId

    db = request.app.state.db
    content_collection = db["content"]
    success_count = 0
    errors = []

    for content_id in delete_request.content_ids:
        try:
            result = await content_collection.delete_one({"_id": ObjectId(content_id)})
            if result.deleted_count > 0:
                success_count += 1
            else:
                errors.append({
                    "id": content_id,
                    "error": "Content not found"
                })
        except Exception as e:
            errors.append({
                "id": content_id,
                "error": str(e)
            })

    return {
        "status": "completed",
        "success_count": success_count,
        "error_count": len(errors),
        "errors": errors
    }


@router.patch("/content/batch/metadata")
async def batch_update_metadata(
    request: Request,
    update_request: BatchMetadataUpdate,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Update metadata for multiple items.
    Returns updated count.
    """
    from bson import ObjectId

    db = request.app.state.db
    content_collection = db["content"]
    success_count = 0
    errors = []

    for content_id in update_request.content_ids:
        try:
            result = await content_collection.update_one(
                {"_id": ObjectId(content_id)},
                {"$set": update_request.updates}
            )
            if result.modified_count > 0:
                success_count += 1
        except Exception as e:
            errors.append({
                "id": content_id,
                "error": str(e)
            })

    return {
        "status": "completed",
        "updated_count": success_count,
        "error_count": len(errors),
        "errors": errors
    }


@router.post("/content/batch/reassign-genre")
async def batch_reassign_genre(
    request: Request,
    reassign_request: BatchGenreReassign,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Move content between genres.
    Returns updated count.
    """
    from bson import ObjectId

    db = request.app.state.db
    content_collection = db["content"]
    success_count = 0
    errors = []

    for content_id in reassign_request.content_ids:
        try:
            result = await content_collection.update_one(
                {"_id": ObjectId(content_id)},
                {"$set": {"genre": reassign_request.new_genre}}
            )
            if result.modified_count > 0:
                success_count += 1
        except Exception as e:
            errors.append({
                "id": content_id,
                "error": str(e)
            })

    return {
        "status": "completed",
        "updated_count": success_count,
        "new_genre": reassign_request.new_genre,
        "error_count": len(errors),
        "errors": errors
    }


# ============================================================================
# Server Health & Management Endpoints
# ============================================================================

@router.get("/server/health")
async def get_server_health(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, Any]:
    """
    Get comprehensive server health metrics.

    Returns:
        CPU, memory, disk, network, uptime, and system information
    """
    health_monitor = request.app.state.health_monitor
    if not health_monitor:
        raise HTTPException(status_code=503, detail="Health monitor not available")

    return health_monitor.get_metrics()


@router.post("/server/restart")
async def restart_server(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict[str, str]:
    """
    Initiate graceful server restart.

    Warning: This will restart the entire application server.
    All active connections will be terminated.
    """
    import signal
    import sys

    logger.warning(f"Server restart initiated by admin user: {user.get('email')}")

    # Send notification about restart
    try:
        notification_service = request.app.state.notification_service
        if notification_service:
            await notification_service.send_notification(
                level="WARNING",
                title="Server Restart Initiated",
                message=f"Admin {user.get('email')} initiated server restart",
                user_email=user.get("email")
            )
    except Exception as e:
        logger.warning(f"Failed to send restart notification: {e}")

    # Schedule the restart (give time to send response)
    import asyncio

    async def delayed_restart():
        await asyncio.sleep(2)  # Wait 2 seconds to send response
        logger.info("Executing server restart...")

        # Try graceful shutdown first
        try:
            # Signal the uvicorn server to restart
            # This sends SIGHUP which uvicorn interprets as reload
            import os
            os.kill(os.getpid(), signal.SIGHUP)
        except Exception as e:
            logger.error(f"Graceful restart failed, forcing restart: {e}")
            # Force restart as fallback
            os.execv(sys.executable, [sys.executable] + sys.argv)

    asyncio.create_task(delayed_restart())

    return {
        "status": "restarting",
        "message": "Server restart initiated. Server will be back online in ~10 seconds."
    }
