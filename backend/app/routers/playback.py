"""Playback control router."""

import logging
from typing import List, Optional
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from pydantic import BaseModel
from bson import ObjectId

router = APIRouter()

# In-memory queue storage (stores full content documents)
# This is the authoritative queue that persists across frontend refreshes
_playback_queue: List[dict] = []


def get_queue() -> List[dict]:
    """Get the current queue."""
    return _playback_queue


def add_to_queue(content: dict, position: int = None):
    """Add a content item to the queue.

    Args:
        content: Content item to add
        position: Optional position to insert at (None = append to end)
    """
    if position is not None and 0 <= position <= len(_playback_queue):
        _playback_queue.insert(position, content)
    else:
        _playback_queue.append(content)


def remove_from_queue(index: int) -> bool:
    """Remove an item from the queue by index."""
    if 0 <= index < len(_playback_queue):
        _playback_queue.pop(index)
        return True
    return False


def clear_queue_storage():
    """Clear the queue."""
    _playback_queue.clear()


def reorder_queue_storage(from_idx: int, to_idx: int) -> bool:
    """Reorder queue items."""
    if 0 <= from_idx < len(_playback_queue) and 0 <= to_idx < len(_playback_queue):
        item = _playback_queue.pop(from_idx)
        _playback_queue.insert(to_idx, item)
        return True
    return False


async def broadcast_playback_state(audio_player):
    """Broadcast current playback state to all connected clients."""
    from app.routers.websocket import broadcast_playback_update

    status = audio_player.get_status()
    await broadcast_playback_update(status)


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
async def get_queue_endpoint(request: Request):
    """Get the current playback queue."""
    return get_queue()


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

        # Broadcast playback state to connected clients
        await broadcast_playback_state(audio_player)

        return {"message": f"Now playing: {content.get('title')}", "content_id": content_id}
    else:
        # Resume playback
        success = await audio_player.resume()
        if success:
            # Broadcast state change
            await broadcast_playback_state(audio_player)
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
        # Broadcast state change
        await broadcast_playback_state(audio_player)
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
        # Broadcast state change
        await broadcast_playback_state(audio_player)
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
        # Broadcast state change
        await broadcast_playback_state(audio_player)
        return {"message": "Skipped to next track"}
    return {"message": "No track to skip"}


@router.post("/queue")
async def add_to_queue_endpoint(request: Request, item: QueueItem):
    """Add a track to the playback queue."""
    db = request.app.state.db
    from app.routers.websocket import broadcast_queue_update

    # Get content from database
    content = await db.content.find_one({"_id": ObjectId(item.content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Build queue item with all needed fields
    queue_item = {
        "_id": str(content["_id"]),
        "title": content.get("title", "Unknown"),
        "artist": content.get("artist"),
        "type": content.get("type", "song"),
        "duration_seconds": content.get("duration_seconds", 0),
        "genre": content.get("genre"),
        "metadata": content.get("metadata", {}),
        "batches": content.get("batches", [])
    }

    # Add to queue
    add_to_queue(queue_item)

    # Broadcast queue update to all clients
    await broadcast_queue_update(get_queue())

    return {
        "message": f"Added '{content.get('title')}' to queue",
        "queue_length": len(get_queue())
    }


@router.delete("/queue/{position}")
async def remove_from_queue_endpoint(request: Request, position: int):
    """Remove a track from the queue by position."""
    from app.routers.websocket import broadcast_queue_update

    success = remove_from_queue(position)
    if success:
        # Broadcast queue update to all clients
        await broadcast_queue_update(get_queue())
        return {
            "message": f"Removed item at position {position}",
            "queue_length": len(get_queue())
        }
    raise HTTPException(status_code=404, detail=f"No item at position {position}")


@router.post("/queue/clear")
async def clear_queue_endpoint(request: Request):
    """Clear the playback queue."""
    from app.routers.websocket import broadcast_queue_update

    clear_queue_storage()

    # Broadcast queue update to all clients
    await broadcast_queue_update(get_queue())

    return {"message": "Queue cleared"}


class QueueReorderRequest(BaseModel):
    """Request to reorder queue items."""
    from_index: int
    to_index: int


@router.post("/queue/reorder")
async def reorder_queue_endpoint(request: Request, reorder: QueueReorderRequest):
    """Reorder items in the queue."""
    from app.routers.websocket import broadcast_queue_update

    queue = get_queue()

    # Validate indices
    if not (0 <= reorder.from_index < len(queue) and 0 <= reorder.to_index < len(queue)):
        raise HTTPException(status_code=400, detail="Invalid queue indices")

    # Reorder the queue
    success = reorder_queue_storage(reorder.from_index, reorder.to_index)

    if success:
        # Broadcast queue update to all clients
        await broadcast_queue_update(get_queue())

        return {
            "message": "Queue reordered",
            "queue_length": len(get_queue())
        }

    raise HTTPException(status_code=400, detail="Failed to reorder queue")


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


@router.get("/stats")
async def get_playback_stats(request: Request):
    """Get playback statistics for the dashboard."""
    db = request.app.state.db

    # Get today's start time
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Count plays by type (today)
    pipeline = [
        {"$match": {"started_at": {"$gte": today}}},
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]

    stats_cursor = db.playback_logs.aggregate(pipeline)
    today_stats = {"song": 0, "show": 0, "commercial": 0}
    async for stat in stats_cursor:
        if stat["_id"] in today_stats:
            today_stats[stat["_id"]] = stat["count"]

    # Get total counts (all time)
    total_pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}}
    ]
    total_cursor = db.playback_logs.aggregate(total_pipeline)
    total_stats = {"song": 0, "show": 0, "commercial": 0}
    async for stat in total_cursor:
        if stat["_id"] in total_stats:
            total_stats[stat["_id"]] = stat["count"]

    return {
        "today": {
            "songs_played": today_stats["song"],
            "shows_aired": today_stats["show"],
            "commercials_played": today_stats["commercial"]
        },
        "total": {
            "songs_played": total_stats["song"],
            "shows_aired": total_stats["show"],
            "commercials_played": total_stats["commercial"]
        }
    }


@router.get("/cover/{content_id}")
async def get_album_cover(request: Request, content_id: str):
    """
    Get album cover art for a content item.
    Extracts embedded artwork from ID3 tags.
    """
    from io import BytesIO
    from mutagen import File as MutagenFile
    from mutagen.mp3 import MP3
    from mutagen.id3 import ID3

    db = request.app.state.db
    content_sync = request.app.state.content_sync

    # Find content in database
    content = await db.content.find_one({"_id": ObjectId(content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Get local file path
    local_path = None
    if content.get("local_cache_path"):
        local_path = Path(content["local_cache_path"])
        if not local_path.exists():
            local_path = None

    if not local_path:
        # Download if not cached
        local_path = await content_sync.download_for_playback(content_id)

    if not local_path or not local_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not available")

    # Extract album art
    try:
        # Try ID3 tags for MP3 files
        if str(local_path).lower().endswith('.mp3'):
            try:
                audio = ID3(str(local_path))
                # Look for APIC (Attached Picture) frames
                for tag in audio.keys():
                    if tag.startswith('APIC'):
                        apic = audio[tag]
                        return StreamingResponse(
                            BytesIO(apic.data),
                            media_type=apic.mime or "image/jpeg",
                            headers={"Cache-Control": "public, max-age=86400"}
                        )
            except Exception:
                pass

        # Try mutagen for other formats
        audio = MutagenFile(str(local_path))
        if audio is not None:
            # Check for pictures in various formats
            if hasattr(audio, 'pictures') and audio.pictures:
                pic = audio.pictures[0]
                return StreamingResponse(
                    BytesIO(pic.data),
                    media_type=pic.mime or "image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"}
                )

            # For MP4/M4A files
            if hasattr(audio, 'tags') and audio.tags:
                if 'covr' in audio.tags:
                    covers = audio.tags['covr']
                    if covers:
                        return StreamingResponse(
                            BytesIO(bytes(covers[0])),
                            media_type="image/jpeg",
                            headers={"Cache-Control": "public, max-age=86400"}
                        )

    except Exception as e:
        pass

    # No cover found
    raise HTTPException(status_code=404, detail="No album cover found")


# ==================== GCS Streaming Endpoints ====================

@router.get("/stream/gcs/{content_id}")
async def stream_from_gcs(request: Request, content_id: str):
    """
    Stream audio from Google Cloud Storage using signed URL redirect.

    This is the preferred streaming method - faster and more reliable than
    proxying through the backend.
    """
    db = request.app.state.db
    content_sync = request.app.state.content_sync

    # Find content in database
    content = await db.content.find_one({"_id": ObjectId(content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Check if content has GCS path
    gcs_path = content.get("gcs_path")
    if gcs_path:
        # Generate signed URL and redirect
        signed_url = content_sync.gcs.get_signed_url(gcs_path)
        if signed_url:
            return RedirectResponse(url=signed_url, status_code=302)

    # Fallback to traditional streaming if no GCS path
    return await stream_audio(request, content_id)


@router.get("/stream/signed/{content_id}")
async def get_signed_stream_url(request: Request, content_id: str):
    """
    Get a signed URL for streaming content directly from GCS.

    Returns the URL instead of redirecting - useful for preloading or
    when client needs the URL directly.
    """
    db = request.app.state.db
    content_sync = request.app.state.content_sync

    # Find content in database
    content = await db.content.find_one({"_id": ObjectId(content_id)})
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    gcs_path = content.get("gcs_path")
    if not gcs_path:
        raise HTTPException(status_code=404, detail="Content not available on GCS")

    signed_url = content_sync.gcs.get_signed_url(gcs_path)
    if not signed_url:
        raise HTTPException(status_code=500, detail="Failed to generate signed URL")

    return {
        "content_id": content_id,
        "title": content.get("title"),
        "url": signed_url,
        "expires_in_hours": 24
    }


# ==================== Emergency Playlist Endpoints ====================

@router.get("/emergency-playlist")
async def get_emergency_playlist(request: Request):
    """
    Get the emergency fallback playlist.

    Returns a list of pre-cached songs with signed URLs that can be used
    when normal playback fails.
    """
    content_sync = request.app.state.content_sync

    playlist = await content_sync.get_emergency_playlist()

    if not playlist:
        raise HTTPException(
            status_code=404,
            detail="Emergency playlist not configured. Run /api/playback/emergency-playlist/generate first."
        )

    return {
        "count": len(playlist),
        "songs": playlist
    }


@router.post("/emergency-playlist/generate")
async def generate_emergency_playlist(request: Request, count: int = 20):
    """
    Generate or refresh the emergency playlist.

    Selects random songs from the library and copies them to the
    emergency GCS folder for fast fallback access.
    """
    content_sync = request.app.state.content_sync

    stats = await content_sync.generate_emergency_playlist(count=count)

    return {
        "message": f"Generated emergency playlist with {stats['songs_copied']} songs",
        "stats": stats
    }


@router.get("/stream/emergency/{filename:path}")
async def stream_emergency_song(request: Request, filename: str):
    """
    Stream an emergency song from GCS through the backend.

    This proxies the request since the bucket isn't publicly accessible.
    """
    from urllib.parse import unquote

    content_sync = request.app.state.content_sync

    # Decode the filename (may be URL-encoded)
    decoded_filename = unquote(filename)

    # Construct the GCS path
    gcs_path = f"gs://{content_sync.gcs.bucket_name}/emergency/{decoded_filename}"

    # Download from GCS to memory and stream
    try:
        blob_path = f"emergency/{decoded_filename}"
        blob = content_sync.gcs.bucket.blob(blob_path)

        if not blob.exists():
            raise HTTPException(status_code=404, detail="Emergency song not found")

        # Download to memory
        content = blob.download_as_bytes()

        # Determine content type
        content_type = "audio/mpeg"
        if decoded_filename.endswith(".wav"):
            content_type = "audio/wav"
        elif decoded_filename.endswith(".ogg"):
            content_type = "audio/ogg"
        elif decoded_filename.endswith(".m4a"):
            content_type = "audio/mp4"

        return StreamingResponse(
            BytesIO(content),
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": f'inline; filename="{decoded_filename}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to stream emergency song {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to stream emergency song")


@router.post("/emergency-mode-activated")
async def report_emergency_mode(request: Request):
    """
    Report that emergency mode was activated due to playback failures.

    Called by the frontend when 5+ consecutive playback errors occur.
    Sends a CRITICAL notification to all channels.
    """
    from datetime import datetime
    from app.services.notifications import NotificationLevel

    notification_service = getattr(request.app.state, 'notification_service', None)

    if notification_service:
        await notification_service.send_notification(
            message=(
                "Emergency mode activated due to 5+ consecutive playback failures. "
                "The system is now playing from the backup playlist. "
                "Please check the streaming infrastructure immediately."
            ),
            title="CRITICAL: Emergency Mode Activated",
            level=NotificationLevel.CRITICAL,
            data={
                "event": "emergency_mode_activated",
                "timestamp": datetime.utcnow().isoformat()
            }
        )
        logger.warning("Emergency mode activated - notification sent")

    return {"status": "reported", "timestamp": datetime.utcnow().isoformat()}
