"""Content management router - CRUD for songs, shows, commercials."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from bson import ObjectId

from app.models.content import (
    Content,
    ContentCreate,
    ContentUpdate,
    ContentType
)
from app.utils.common import get_first

router = APIRouter()


@router.get("/", response_model=List[dict])
async def list_content(
    request: Request,
    content_type: Optional[ContentType] = None,
    genre: Optional[str] = None,
    active: Optional[bool] = True,
    limit: int = Query(default=1000, le=5000),
    offset: int = 0
):
    """List all content with optional filters."""
    db = request.app.state.db

    query = {}
    if content_type:
        query["type"] = content_type.value
    if genre:
        query["genre"] = genre
    if active is not None:
        query["active"] = active

    cursor = db.content.find(query).skip(offset).limit(limit)
    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/songs", response_model=List[dict])
async def list_songs(
    request: Request,
    genre: Optional[str] = None,
    limit: int = Query(default=1000, le=5000)
):
    """List all songs, optionally filtered by genre."""
    db = request.app.state.db

    query = {"type": ContentType.SONG.value, "active": True}
    if genre:
        query["genre"] = genre

    cursor = db.content.find(query).limit(limit)
    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/shows", response_model=List[dict])
async def list_shows(request: Request, limit: int = Query(default=1000, le=5000)):
    """List all shows."""
    db = request.app.state.db

    query = {"type": ContentType.SHOW.value, "active": True}
    cursor = db.content.find(query).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/commercials", response_model=List[dict])
async def list_commercials(request: Request, limit: int = Query(default=1000, le=5000)):
    """List all commercials."""
    db = request.app.state.db

    query = {"type": ContentType.COMMERCIAL.value, "active": True}
    cursor = db.content.find(query).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/jingles", response_model=List[dict])
async def list_jingles(request: Request, limit: int = Query(default=1000, le=5000)):
    """List all jingles."""
    db = request.app.state.db

    query = {"type": ContentType.JINGLE.value, "active": True}
    cursor = db.content.find(query).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/samples", response_model=List[dict])
async def list_samples(request: Request, limit: int = Query(default=1000, le=5000)):
    """List all samples."""
    db = request.app.state.db

    query = {"type": ContentType.SAMPLE.value, "active": True}
    cursor = db.content.find(query).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/newsflashes", response_model=List[dict])
async def list_newsflashes(request: Request, limit: int = Query(default=1000, le=5000)):
    """List all newsflashes."""
    db = request.app.state.db

    query = {"type": ContentType.NEWSFLASH.value, "active": True}
    cursor = db.content.find(query).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/genres", response_model=List[str])
async def list_genres(request: Request):
    """Get list of all unique genres."""
    db = request.app.state.db

    genres = await db.content.distinct("genre", {"type": ContentType.SONG.value})
    return [g for g in genres if g]


@router.get("/{content_id}", response_model=dict)
async def get_content(request: Request, content_id: str):
    """Get a specific content item by ID."""
    db = request.app.state.db

    item = await db.content.find_one({"_id": ObjectId(content_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Content not found")

    item["_id"] = str(item["_id"])
    return item


@router.post("/", response_model=dict)
async def create_content(request: Request, content: ContentCreate):
    """Create a new content item."""
    db = request.app.state.db

    # Check for duplicate google_drive_id
    existing = await db.content.find_one({"google_drive_id": content.google_drive_id})
    if existing:
        raise HTTPException(status_code=400, detail="Content with this Drive ID already exists")

    doc = content.model_dump()
    result = await db.content.insert_one(doc)

    doc["_id"] = str(result.inserted_id)
    return doc


@router.patch("/{content_id}", response_model=dict)
async def update_content(request: Request, content_id: str, update: ContentUpdate):
    """Update a content item."""
    db = request.app.state.db

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.content.update_one(
        {"_id": ObjectId(content_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")

    item = await db.content.find_one({"_id": ObjectId(content_id)})
    item["_id"] = str(item["_id"])
    return item


@router.delete("/{content_id}")
async def delete_content(request: Request, content_id: str, hard_delete: bool = False):
    """Delete a content item (soft delete by default)."""
    db = request.app.state.db

    if hard_delete:
        result = await db.content.delete_one({"_id": ObjectId(content_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Content not found")
        return {"message": "Content permanently deleted"}
    else:
        result = await db.content.update_one(
            {"_id": ObjectId(content_id)},
            {"$set": {"active": False}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Content not found")
        return {"message": "Content deactivated"}


@router.post("/batch-delete")
async def batch_delete_content(request: Request, ids: List[str], hard_delete: bool = True):
    """Delete multiple content items at once."""
    db = request.app.state.db

    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    object_ids = [ObjectId(id) for id in ids]

    if hard_delete:
        result = await db.content.delete_many({"_id": {"$in": object_ids}})
        return {
            "message": f"Permanently deleted {result.deleted_count} items",
            "deleted_count": result.deleted_count
        }
    else:
        result = await db.content.update_many(
            {"_id": {"$in": object_ids}},
            {"$set": {"active": False}}
        )
        return {
            "message": f"Deactivated {result.modified_count} items",
            "modified_count": result.modified_count
        }


# ==================== Google Drive Sync Endpoints ====================

@router.get("/sync/status")
async def get_sync_status(request: Request):
    """Get current sync status and content statistics."""
    content_sync = request.app.state.content_sync
    return await content_sync.get_sync_status()


@router.get("/sync/folders")
async def get_folder_structure(request: Request):
    """Get the Google Drive folder structure for debugging."""
    content_sync = request.app.state.content_sync
    structure = await content_sync.drive.get_folder_structure()
    return structure


@router.get("/sync/debug/{folder_name}")
async def debug_folder_files(request: Request, folder_name: str):
    """Debug: List all files in a specific folder from Google Drive."""
    content_sync = request.app.state.content_sync

    # Get folder structure to find the folder ID
    structure = await content_sync.drive.get_folder_structure()

    # Find the folder (case-insensitive)
    folder_info = None
    for name, info in structure.get("children", {}).items():
        if name.lower() == folder_name.lower():
            folder_info = info
            break

    if not folder_info:
        return {"error": f"Folder '{folder_name}' not found", "available": list(structure.get("children", {}).keys())}

    # List all audio files in the folder
    files = await content_sync.drive.list_audio_files(folder_info["id"])

    return {
        "folder_name": folder_name,
        "folder_id": folder_info["id"],
        "file_count": len(files),
        "files": [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "size": f.get("size"),
                "mimeType": f.get("mimeType")
            }
            for f in files
        ]
    }


@router.post("/sync/start")
async def start_sync(request: Request, download_files: bool = False):
    """
    Start syncing content from Google Drive.

    Args:
        download_files: If True, download all audio files to local cache

    Returns immediately while sync runs in background.
    """
    import asyncio
    import logging
    content_sync = request.app.state.content_sync
    notification_service = request.app.state.notification_service
    logger = logging.getLogger(__name__)

    # Get progress tracker from scheduler if available
    scheduler = getattr(request.app.state, 'content_sync_scheduler', None)
    progress = scheduler.progress if scheduler else None

    if progress and progress.is_syncing:
        return {
            "message": "Sync already in progress",
            "status": "running",
            "progress": progress.get_progress()
        }

    # Run sync in background with progress tracking
    async def run_sync():
        try:
            if progress:
                progress.start("Syncing from Google Drive")

            result = await content_sync.sync_all(
                download_files=download_files,
                progress_callback=progress
            )

            if progress:
                total = result.get('files_found', 0)
                added = result.get('files_added', 0)
                updated = result.get('files_updated', 0)
                progress.complete(f"Drive sync complete: {total} found, {added} added, {updated} updated")

            # Send success notification
            if notification_service:
                try:
                    await notification_service.send_notification(
                        level="INFO",
                        title="Sync Completed",
                        message=f"Synced {result.get('files_found', 0)} files from Google Drive"
                    )
                except Exception as e:
                    logger.warning(f"Failed to send sync success notification: {e}")

        except Exception as e:
            logger.error(f"Background sync error: {e}")

            if progress:
                progress.log("ERROR", f"Sync failed: {str(e)}")
                progress.complete(f"Drive sync failed: {str(e)}")

            # Send error notification
            if notification_service:
                try:
                    await notification_service.send_notification(
                        level="ERROR",
                        title="Sync Failed",
                        message=f"Google Drive sync failed: {str(e)}"
                    )
                except Exception as notif_err:
                    logger.warning(f"Failed to send sync error notification: {notif_err}")

    asyncio.create_task(run_sync())

    # Return immediately
    return {
        "message": "Sync started in background",
        "download_files": download_files,
        "status": "running"
    }


@router.post("/sync/download/{content_id}")
async def download_content(request: Request, content_id: str):
    """Download a specific content item from Google Drive to local cache."""
    content_sync = request.app.state.content_sync

    try:
        local_path = await content_sync.download_for_playback(content_id)
        if local_path:
            return {
                "message": "Download successful",
                "local_path": str(local_path)
            }
        else:
            raise HTTPException(status_code=404, detail="Content not found")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )


@router.post("/sync/refresh-metadata")
async def refresh_metadata(request: Request):
    """
    Refresh metadata for all content by downloading files and extracting ID3 tags.
    This updates artist, genre, duration, album, and year for all content.
    """
    import logging
    from pathlib import Path
    from datetime import datetime
    from mutagen import File as MutagenFile
    from mutagen.mp3 import MP3

    logger = logging.getLogger(__name__)
    db = request.app.state.db
    drive_service = request.app.state.drive_service

    stats = {
        "total": 0,
        "updated": 0,
        "skipped": 0,
        "errors": []
    }

    # Get all content
    cursor = db.content.find({"active": True})

    async for item in cursor:
        stats["total"] += 1
        content_id = str(item["_id"])
        filename = item.get("google_drive_path", "unknown")

        try:
            # Get or download file
            local_path = None
            if item.get("local_cache_path"):
                local_path = Path(item["local_cache_path"])
                if not local_path.exists():
                    local_path = None

            if not local_path:
                # Download from Drive
                drive_id = item.get("google_drive_id")
                if not drive_id:
                    stats["skipped"] += 1
                    continue

                local_path = await drive_service.download_file(drive_id, filename)
                if not local_path or not local_path.exists():
                    stats["errors"].append(f"{filename}: Download failed")
                    continue

            # Extract metadata
            audio = MutagenFile(str(local_path), easy=True)
            if audio is None:
                stats["skipped"] += 1
                continue

            # Build update document
            update_doc = {
                "local_cache_path": str(local_path),
                "updated_at": datetime.utcnow()
            }

            # Extract tags
            if hasattr(audio, 'get'):
                title = get_first(audio.get("title"))
                artist = get_first(audio.get("artist"))
                album = get_first(audio.get("album"))
                genre = get_first(audio.get("genre"))
                year_str = get_first(audio.get("date"))

                if title:
                    update_doc["title"] = title
                if artist:
                    update_doc["artist"] = artist
                if genre and not item.get("genre"):  # Don't override folder-based genre
                    update_doc["genre"] = genre

                # Update nested metadata
                metadata = item.get("metadata", {})
                if album:
                    metadata["album"] = album
                if year_str:
                    try:
                        metadata["year"] = int(year_str[:4])
                    except (ValueError, TypeError):
                        pass
                update_doc["metadata"] = metadata

            # Get duration
            if hasattr(audio, 'info') and audio.info:
                update_doc["duration_seconds"] = int(audio.info.length)

            # For MP3, try to get more accurate duration
            if str(local_path).lower().endswith('.mp3'):
                try:
                    mp3 = MP3(str(local_path))
                    update_doc["duration_seconds"] = int(mp3.info.length)
                except Exception:
                    pass

            # Update database
            await db.content.update_one(
                {"_id": item["_id"]},
                {"$set": update_doc}
            )
            stats["updated"] += 1
            logger.info(f"Updated metadata for: {filename}")

        except Exception as e:
            stats["errors"].append(f"{filename}: {str(e)}")
            logger.error(f"Error refreshing metadata for {filename}: {e}")

    return {
        "message": "Metadata refresh completed",
        "stats": stats
    }


@router.get("/sync/scheduler/status")
async def get_sync_scheduler_status(request: Request):
    """
    Get the status of the content sync scheduler.

    Returns scheduler state, last sync time, and results.
    """
    if not hasattr(request.app.state, 'content_sync_scheduler'):
        return {
            "enabled": False,
            "running": False,
            "error": "Sync scheduler not initialized"
        }

    scheduler = request.app.state.content_sync_scheduler
    status = scheduler.get_status()

    # Add detailed stats
    db = request.app.state.db

    # Total counts
    total_content = await db.content.count_documents({"active": True})
    with_drive_id = await db.content.count_documents({"active": True, "google_drive_id": {"$exists": True, "$ne": None}})
    with_gcs = await db.content.count_documents({"active": True, "gcs_path": {"$exists": True, "$ne": None}})

    # Breakdown by type
    type_pipeline = [
        {"$match": {"active": True}},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": 1},
            "with_drive": {"$sum": {"$cond": [{"$and": [{"$ne": ["$google_drive_id", None]}, {"$ne": ["$google_drive_id", ""]}]}, 1, 0]}},
            "with_gcs": {"$sum": {"$cond": [{"$and": [{"$ne": ["$gcs_path", None]}, {"$ne": ["$gcs_path", ""]}]}, 1, 0]}}
        }}
    ]
    type_stats = await db.content.aggregate(type_pipeline).to_list(100)
    by_type = {t["_id"]: {"total": t["total"], "with_drive": t["with_drive"], "with_gcs": t["with_gcs"]} for t in type_stats if t["_id"]}

    # Get sample of pending GCS uploads (first 10)
    pending_gcs_cursor = db.content.find(
        {"active": True, "google_drive_id": {"$exists": True, "$ne": None}, "$or": [{"gcs_path": None}, {"gcs_path": {"$exists": False}}]},
        {"title": 1, "type": 1, "google_drive_id": 1}
    ).limit(10)
    pending_gcs_items = await pending_gcs_cursor.to_list(10)
    pending_gcs_sample = [{"title": p.get("title", "Unknown"), "type": p.get("type", "unknown"), "id": str(p["_id"])} for p in pending_gcs_items]

    status["drive_stats"] = {
        "total_content": total_content,
        "with_drive_id": with_drive_id,
        "missing_drive_id": total_content - with_drive_id,
        "percent_synced": round((with_drive_id / total_content * 100) if total_content > 0 else 0, 1)
    }

    status["gcs_stats"] = {
        "total_content": total_content,
        "with_gcs_path": with_gcs,
        "pending_upload": total_content - with_gcs,
        "percent_synced": round((with_gcs / total_content * 100) if total_content > 0 else 0, 1),
        "pending_sample": pending_gcs_sample
    }

    status["by_type"] = by_type

    return status


@router.get("/sync/scheduler/progress")
async def get_sync_progress(request: Request):
    """
    Get detailed sync progress including rolling log.

    Use this for real-time sync monitoring.
    """
    if not hasattr(request.app.state, 'content_sync_scheduler'):
        return {
            "is_syncing": False,
            "error": "Sync scheduler not initialized"
        }

    scheduler = request.app.state.content_sync_scheduler
    return scheduler.get_progress()


@router.post("/sync/scheduler/trigger")
async def trigger_sync_scheduler(request: Request):
    """
    Manually trigger a content sync (GCS upload).

    This bypasses the scheduler interval and runs a sync immediately.
    """
    if not hasattr(request.app.state, 'content_sync_scheduler'):
        raise HTTPException(
            status_code=503,
            detail="Sync scheduler not initialized"
        )

    scheduler = request.app.state.content_sync_scheduler

    # Run sync in background
    import asyncio

    async def run_sync():
        await scheduler.trigger_sync()

    asyncio.create_task(run_sync())

    return {
        "message": "Sync triggered in background",
        "status": "running"
    }
