"""Playback control router."""

from typing import List, Optional
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from bson import ObjectId

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
    audio_player = getattr(request.app.state, 'audio_player', None)

    if audio_player:
        return audio_player.get_status()

    return {
        "state": "stopped",
        "current_track": None,
        "position_seconds": 0,
        "duration_seconds": 0,
        "volume": 80,
        "queue_length": 0
    }


@router.get("/now-playing")
async def get_now_playing(request: Request):
    """Get currently playing track details."""
    audio_player = getattr(request.app.state, 'audio_player', None)
    db = request.app.state.db

    if audio_player and audio_player.current_track:
        track = audio_player.current_track
        position = audio_player.position
        duration = track.duration_seconds

        # Get playback log for started_at time
        log = await db.playback_logs.find_one(
            {"content_id": ObjectId(track.content_id), "ended_at": None},
            sort=[("started_at", -1)]
        )

        return {
            "track": {
                "content_id": track.content_id,
                "title": track.title,
                "artist": track.artist,
                "duration_seconds": duration,
            },
            "started_at": log["started_at"].isoformat() if log else None,
            "position_seconds": position,
            "remaining_seconds": max(0, duration - position)
        }

    return {
        "track": None,
        "started_at": None,
        "position_seconds": 0,
        "remaining_seconds": 0
    }


@router.get("/queue", response_model=List[dict])
async def get_queue(request: Request):
    """Get the current playback queue."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if audio_player:
        queue_items = audio_player.get_queue()
        return [
            {
                "content_id": item.track.content_id,
                "title": item.track.title,
                "artist": item.track.artist,
                "duration_seconds": item.track.duration_seconds,
                "priority": item.priority
            }
            for item in queue_items
        ]

    return []


@router.post("/play")
async def start_playback(request: Request, content_id: Optional[str] = None):
    """Start or resume playback."""
    audio_player = getattr(request.app.state, 'audio_player', None)
    content_sync = getattr(request.app.state, 'content_sync', None)
    db = request.app.state.db

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    if content_id:
        # Get content from database
        content = await db.content.find_one({"_id": ObjectId(content_id)})
        if not content:
            raise HTTPException(status_code=404, detail="Content not found")

        # Download file if needed
        if content_sync:
            local_path = await content_sync.download_for_playback(content_id)
            if not local_path:
                raise HTTPException(status_code=500, detail="Failed to download audio file")
        else:
            local_path = content.get("local_cache_path")
            if not local_path:
                raise HTTPException(status_code=500, detail="Audio file not available")

        # Create track info and play
        from app.services.audio_player import TrackInfo
        track = TrackInfo(
            content_id=content_id,
            title=content.get("title", "Unknown"),
            artist=content.get("artist"),
            duration_seconds=content.get("duration_seconds", 0),
            file_path=str(local_path)
        )

        success = await audio_player.play(track)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to start playback")

        # Log playback
        await db.playback_logs.insert_one({
            "content_id": ObjectId(content_id),
            "title": content.get("title"),
            "type": content.get("type"),
            "started_at": datetime.utcnow(),
            "ended_at": None,
            "source": "api"
        })

        return {"message": f"Now playing: {content.get('title')}", "content_id": content_id}
    else:
        # Resume playback
        success = await audio_player.resume()
        if success:
            return {"message": "Playback resumed"}
        return {"message": "Nothing to resume"}


@router.post("/pause")
async def pause_playback(request: Request):
    """Pause current playback."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    success = await audio_player.pause()
    if success:
        return {"message": "Playback paused"}
    return {"message": "Nothing playing to pause"}


@router.post("/stop")
async def stop_playback(request: Request):
    """Stop playback completely."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    success = await audio_player.stop()
    if success:
        return {"message": "Playback stopped"}
    return {"message": "Nothing playing to stop"}


@router.post("/skip")
async def skip_track(request: Request):
    """Skip to the next track in queue."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    success = await audio_player.skip()
    if success:
        return {"message": "Skipped to next track"}
    return {"message": "No track to skip"}


@router.post("/queue")
async def add_to_queue(request: Request, item: QueueItem):
    """Add a track to the playback queue."""
    audio_player = getattr(request.app.state, 'audio_player', None)
    content_sync = getattr(request.app.state, 'content_sync', None)
    db = request.app.state.db

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    # Get content from database
    content = await db.content.find_one({"_id": ObjectId(item.content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Download file if needed
    if content_sync:
        local_path = await content_sync.download_for_playback(item.content_id)
        if not local_path:
            raise HTTPException(status_code=500, detail="Failed to download audio file")
    else:
        local_path = content.get("local_cache_path")
        if not local_path:
            raise HTTPException(status_code=500, detail="Audio file not available")

    # Create track info and add to queue
    from app.services.audio_player import TrackInfo
    track = TrackInfo(
        content_id=item.content_id,
        title=content.get("title", "Unknown"),
        artist=content.get("artist"),
        duration_seconds=content.get("duration_seconds", 0),
        file_path=str(local_path)
    )

    audio_player.add_to_queue(track, item.priority)
    return {
        "message": f"Added '{content.get('title')}' to queue",
        "queue_length": audio_player.queue_length
    }


@router.delete("/queue/{position}")
async def remove_from_queue(request: Request, position: int):
    """Remove a track from the queue by position."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    success = audio_player.remove_from_queue(position)
    if success:
        return {
            "message": f"Removed item at position {position}",
            "queue_length": audio_player.queue_length
        }
    raise HTTPException(status_code=404, detail=f"No item at position {position}")


@router.post("/queue/clear")
async def clear_queue(request: Request):
    """Clear the playback queue."""
    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    audio_player.clear_queue()
    return {"message": "Queue cleared"}


@router.post("/volume")
async def set_volume(request: Request, volume: VolumeUpdate):
    """Set playback volume."""
    if not 0 <= volume.level <= 100:
        raise HTTPException(status_code=400, detail="Volume must be 0-100")

    audio_player = getattr(request.app.state, 'audio_player', None)

    if not audio_player:
        raise HTTPException(status_code=503, detail="Audio player not available")

    success = audio_player.set_volume(volume.level)
    if success:
        return {"message": f"Volume set to {volume.level}", "level": volume.level}
    raise HTTPException(status_code=400, detail="Failed to set volume")


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
        if "content_id" in item and item["content_id"]:
            item["content_id"] = str(item["content_id"])
        if "started_at" in item and item["started_at"]:
            item["started_at"] = item["started_at"].isoformat()
        if "ended_at" in item and item["ended_at"]:
            item["ended_at"] = item["ended_at"].isoformat()
        items.append(item)

    return items


# ==================== Audio Streaming Endpoints ====================

@router.get("/stream/{content_id}")
async def stream_audio(request: Request, content_id: str):
    """
    Stream an audio file for browser playback.

    Returns the audio file with proper headers for HTML5 Audio.
    Downloads from Google Drive if not cached locally.
    """
    db = request.app.state.db
    content_sync = request.app.state.content_sync

    # Find content in database
    content = await db.content.find_one({"_id": ObjectId(content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Get or download the file
    local_path = await content_sync.download_for_playback(content_id)
    if not local_path or not local_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not available")

    # Determine MIME type
    suffix = local_path.suffix.lower()
    mime_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }
    media_type = mime_types.get(suffix, "audio/mpeg")

    # Return file with streaming support
    return FileResponse(
        path=str(local_path),
        media_type=media_type,
        filename=content.get("title", "audio") + suffix,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )


@router.get("/stream/by-name/{filename:path}")
async def stream_by_filename(request: Request, filename: str):
    """
    Stream an audio file by filename (for direct cache access).
    """
    from app.config import settings

    cache_dir = Path(settings.cache_dir)
    file_path = cache_dir / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found in cache")

    # Security check - ensure path is within cache dir
    try:
        file_path.resolve().relative_to(cache_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    suffix = file_path.suffix.lower()
    mime_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }
    media_type = mime_types.get(suffix, "audio/mpeg")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )


@router.post("/log-play/{content_id}")
async def log_playback_start(request: Request, content_id: str):
    """Log that a track started playing (called by frontend)."""
    db = request.app.state.db

    # Verify content exists
    content = await db.content.find_one({"_id": ObjectId(content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Log playback
    await db.playback_logs.insert_one({
        "content_id": ObjectId(content_id),
        "title": content.get("title"),
        "type": content.get("type"),
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "source": "browser"
    })

    # Update content play count and last_played
    await db.content.update_one(
        {"_id": ObjectId(content_id)},
        {
            "$inc": {"play_count": 1},
            "$set": {"last_played": datetime.utcnow()}
        }
    )

    return {"message": "Playback logged", "content_id": content_id}
