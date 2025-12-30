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
    limit: int = Query(default=100, le=500),
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
    limit: int = Query(default=100, le=500)
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
async def list_shows(request: Request, limit: int = Query(default=50, le=200)):
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
async def list_commercials(request: Request, limit: int = Query(default=50, le=200)):
    """List all commercials."""
    db = request.app.state.db

    query = {"type": ContentType.COMMERCIAL.value, "active": True}
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

    # Run sync in background
    async def run_sync():
        try:
            result = await content_sync.sync_all(download_files=download_files)

            # Send success notification
            if notification_service:
                try:
                    await notification_service.send_notification(
                        level="INFO",
                        title="Sync Completed",
                        message=f"Synced {result.get('total_synced', 0)} files from Google Drive"
                    )
                except Exception as e:
                    logger.warning(f"Failed to send sync success notification: {e}")

        except Exception as e:
            logger.error(f"Background sync error: {e}")

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
