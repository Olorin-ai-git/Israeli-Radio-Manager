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
