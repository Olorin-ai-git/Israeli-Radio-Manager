"""Playback control router."""

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()


class QueueItem(BaseModel):
    """Item to add to the playback queue."""
    content_id: str
    priority: int = 0


class VolumeUpdate(BaseModel):
    """Volume update request."""
    level: int  # 0-100


@router.get("/status")
async def get_playback_status(request: Request):
    """Get current playback status."""
    # TODO: Integrate with actual audio player service
    return {
        "state": "stopped",  # "playing", "paused", "stopped"
        "current_track": None,
        "position_seconds": 0,
        "duration_seconds": 0,
        "volume": 80,
        "queue_length": 0
    }


@router.get("/now-playing")
async def get_now_playing(request: Request):
    """Get currently playing track details."""
    # TODO: Integrate with actual audio player service
    return {
        "track": None,
        "started_at": None,
        "position_seconds": 0,
        "remaining_seconds": 0
    }


@router.get("/queue", response_model=List[dict])
async def get_queue(request: Request):
    """Get the current playback queue."""
    # TODO: Integrate with actual audio player service
    return []


@router.post("/play")
async def start_playback(request: Request, content_id: Optional[str] = None):
    """Start or resume playback."""
    # TODO: Integrate with actual audio player service
    if content_id:
        return {"message": f"Starting playback of {content_id}"}
    return {"message": "Resuming playback"}


@router.post("/pause")
async def pause_playback(request: Request):
    """Pause current playback."""
    # TODO: Integrate with actual audio player service
    return {"message": "Playback paused"}


@router.post("/stop")
async def stop_playback(request: Request):
    """Stop playback completely."""
    # TODO: Integrate with actual audio player service
    return {"message": "Playback stopped"}


@router.post("/skip")
async def skip_track(request: Request):
    """Skip to the next track in queue."""
    # TODO: Integrate with actual audio player service
    return {"message": "Skipped to next track"}


@router.post("/queue")
async def add_to_queue(request: Request, item: QueueItem):
    """Add a track to the playback queue."""
    # TODO: Integrate with actual audio player service
    return {"message": f"Added {item.content_id} to queue"}


@router.delete("/queue/{position}")
async def remove_from_queue(request: Request, position: int):
    """Remove a track from the queue by position."""
    # TODO: Integrate with actual audio player service
    return {"message": f"Removed item at position {position}"}


@router.post("/queue/clear")
async def clear_queue(request: Request):
    """Clear the playback queue."""
    # TODO: Integrate with actual audio player service
    return {"message": "Queue cleared"}


@router.post("/volume")
async def set_volume(request: Request, volume: VolumeUpdate):
    """Set playback volume."""
    if not 0 <= volume.level <= 100:
        raise HTTPException(status_code=400, detail="Volume must be 0-100")
    # TODO: Integrate with actual audio player service
    return {"message": f"Volume set to {volume.level}"}


@router.get("/history")
async def get_playback_history(
    request: Request,
    limit: int = 50
):
    """Get recent playback history."""
    db = request.app.state.db

    cursor = db.playback_logs.find().sort("started_at", -1).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items
