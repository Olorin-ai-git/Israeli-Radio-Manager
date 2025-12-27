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


@router.post("/sync/start")
async def start_sync(request: Request, download_files: bool = False):
    """
    Start syncing content from Google Drive.

    Args:
        download_files: If True, download all audio files to local cache
    """
    content_sync = request.app.state.content_sync

    try:
        stats = await content_sync.sync_all(download_files=download_files)
        return {
            "message": "Sync completed",
            "stats": stats
        }
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )


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
