"""Flow execution logic."""

import asyncio
import logging
import random
from datetime import datetime, timedelta

from bson import ObjectId

from app.models.flow import FlowActionType
from app.routers.websocket import broadcast_scheduled_playback, broadcast_queue_update, broadcast_announcement
from app.routers.playback import add_to_queue as add_to_backend_queue, get_queue as get_backend_queue
from app.services.flow_monitor import notify_playback_started

logger = logging.getLogger(__name__)


async def run_flow_actions(db, flow: dict, audio_player=None) -> int:
    """
    Execute flow actions. Returns the number of actions completed.
    This function can be called from both the run_flow endpoint and the calendar watcher.
    """
    actions = flow.get("actions", [])
    actions_completed = 0
    is_first_playback_action = True  # Only first action should use scheduled_playback (playNow)

    for idx, action in enumerate(actions):
        action_type = action.get("action_type")
        logger.info(f"Action {idx+1}/{len(actions)}: {action_type}, is_first_playback_action={is_first_playback_action}")

        if action_type == FlowActionType.PLAY_GENRE.value:
            first_action_done = await _execute_play_genre(
                db, action, is_first_playback_action, audio_player
            )
            if first_action_done:
                is_first_playback_action = False

        elif action_type == FlowActionType.PLAY_COMMERCIALS.value:
            first_action_done = await _execute_play_commercials(
                db, action, is_first_playback_action, audio_player
            )
            if first_action_done:
                is_first_playback_action = False

        elif action_type == FlowActionType.PLAY_CONTENT.value:
            first_action_done = await _execute_play_content(
                db, action, is_first_playback_action, audio_player
            )
            if first_action_done:
                is_first_playback_action = False

        elif action_type == FlowActionType.PLAY_SHOW.value:
            first_action_done = await _execute_play_show(
                db, action, is_first_playback_action, audio_player
            )
            if first_action_done:
                is_first_playback_action = False

        elif action_type == FlowActionType.SET_VOLUME.value:
            volume = action.get("volume_level", 80)
            logger.info(f"Setting volume to {volume}%")
            if audio_player:
                audio_player.set_volume(volume)

        elif action_type == FlowActionType.WAIT.value:
            await _execute_wait(action)

        elif action_type == FlowActionType.ANNOUNCEMENT.value:
            await _execute_announcement(db, action, audio_player)

        actions_completed += 1

    return actions_completed


async def _execute_play_genre(
    db, action: dict, is_first_playback_action: bool, audio_player=None
) -> bool:
    """Execute a play_genre action. Returns True if playback was triggered."""
    genre = action.get("genre")
    if not genre:
        return False

    # Get recently queued/played songs by checking last_played timestamp
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    # Get songs from this genre, excluding recently played
    query = {
        "type": "song",
        "active": True,
        "$or": [
            {"last_played": {"$lt": one_hour_ago}},
            {"last_played": None},
            {"last_played": {"$exists": False}}
        ]
    }
    if genre != "mixed":
        query["genre"] = genre

    songs = await db.content.find(query).to_list(100)

    # If not enough songs, fall back to all songs (excluding recently played)
    if len(songs) < 10:
        query_fallback = {
            "type": "song",
            "active": True,
            "$or": [
                {"last_played": {"$lt": one_hour_ago}},
                {"last_played": None},
                {"last_played": {"$exists": False}}
            ]
        }
        songs = await db.content.find(query_fallback).to_list(100)

    # If still not enough, just get any songs
    if len(songs) < 5:
        songs = await db.content.find({
            "type": "song",
            "active": True
        }).to_list(100)

    if not songs:
        return False

    # Determine how many songs to play
    song_count = action.get("song_count")
    duration_minutes = action.get("duration_minutes")
    description = action.get("description", "")

    # Try to extract song count from description if not explicitly set
    if not song_count and description:
        import re
        match = re.search(r'(\d+)\s*(?:songs?|שירים?)', description, re.IGNORECASE)
        if match:
            song_count = int(match.group(1))
            logger.info(f"Extracted song_count={song_count} from description: {description}")

    if song_count:
        num_songs = min(song_count, len(songs))
    elif duration_minutes:
        num_songs = min(max(1, duration_minutes // 4), len(songs))
    else:
        num_songs = min(10, len(songs))

    # Shuffle and select unique songs
    random.shuffle(songs)
    selected_songs = songs[:num_songs]

    # Update last_played for selected songs
    for song in selected_songs:
        await db.content.update_one(
            {"_id": song["_id"]},
            {"$set": {"last_played": datetime.utcnow()}}
        )

    if is_first_playback_action:
        # First action: broadcast first song for immediate playback
        first_song = selected_songs[0]
        content_data = {
            "_id": str(first_song["_id"]),
            "title": first_song.get("title", "Unknown"),
            "artist": first_song.get("artist"),
            "type": first_song.get("type", "song"),
            "duration_seconds": first_song.get("duration_seconds", 0),
            "genre": first_song.get("genre"),
            "metadata": first_song.get("metadata", {})
        }
        await broadcast_scheduled_playback(content_data)
        notify_playback_started(content_data, first_song.get("duration_seconds", 0))

        # Queue remaining songs at the TOP of the queue
        if len(selected_songs) > 1:
            for idx, song in enumerate(selected_songs[1:]):
                add_to_backend_queue(_song_to_queue_item(song), position=idx)
            await broadcast_queue_update(get_backend_queue())
    else:
        # Subsequent actions: insert all songs at TOP of queue
        for idx, song in enumerate(selected_songs):
            add_to_backend_queue(_song_to_queue_item(song), position=idx)
        await broadcast_queue_update(get_backend_queue())

    # Also add to VLC queue if available
    if audio_player:
        _add_songs_to_vlc(audio_player, selected_songs)

    return True


async def _execute_play_commercials(
    db, action: dict, is_first_playback_action: bool, audio_player=None
) -> bool:
    """Execute a play_commercials action. Returns True if playback was triggered."""
    # Get repeat count (safety limit: max 10)
    repeat_count = min(action.get("commercial_count") or 1, 10)
    batch_number = action.get("batch_number")
    description = action.get("description", "")

    # Try to extract batch number from description if not explicitly set
    if not batch_number and description:
        import re
        match = re.search(r'batch[_\-\s]?(\d+)', description, re.IGNORECASE)
        if match:
            batch_number = int(match.group(1))
            logger.info(f"Extracted batch_number={batch_number} from description: {description}")
        else:
            match = re.search(r'batch[_\-\s]?([A-Za-z])\b', description, re.IGNORECASE)
            if match:
                letter = match.group(1).upper()
                batch_number = ord(letter) - ord('A') + 1
                logger.info(f"Extracted batch_number={batch_number} (from letter) from description: {description}")

    content_id = action.get("content_id")
    logger.info(f"Playing commercials - repeat_count: {repeat_count}, batch_number: {batch_number}, content_id: {content_id}")

    # Fetch commercials
    if content_id and content_id.strip():
        commercials = await _fetch_specific_commercials(db, content_id)
    elif batch_number:
        commercials = await _fetch_batch_commercials(db, batch_number)
    else:
        commercials = await _fetch_all_commercials(db)

    # Repeat commercials
    all_commercials = []
    for _ in range(repeat_count):
        all_commercials.extend(commercials)

    logger.info(f"Total commercials to play (after batch repeat): {len(all_commercials)}")

    if not all_commercials:
        return False

    if is_first_playback_action:
        # First action: broadcast first commercial for immediate playback
        first_commercial = all_commercials[0]
        content_data = {
            "_id": str(first_commercial["_id"]),
            "title": first_commercial.get("title", "Commercial"),
            "artist": first_commercial.get("artist"),
            "type": "commercial",
            "duration_seconds": first_commercial.get("duration_seconds", 0),
            "genre": first_commercial.get("genre"),
            "metadata": first_commercial.get("metadata", {})
        }
        await broadcast_scheduled_playback(content_data)
        notify_playback_started(content_data, first_commercial.get("duration_seconds", 0))

        # Queue remaining commercials at the TOP of the queue
        if len(all_commercials) > 1:
            for idx, commercial in enumerate(all_commercials[1:]):
                add_to_backend_queue(_commercial_to_queue_item(commercial), position=idx)
            await broadcast_queue_update(get_backend_queue())
    else:
        # Subsequent actions: insert all commercials at TOP of queue
        for idx, commercial in enumerate(all_commercials):
            add_to_backend_queue(_commercial_to_queue_item(commercial), position=idx)
        await broadcast_queue_update(get_backend_queue())

    # Also add to VLC queue if available
    if audio_player:
        _add_commercials_to_vlc(audio_player, all_commercials)

    return True


async def _fetch_specific_commercials(db, content_id: str) -> list:
    """Fetch specific commercials by ID."""
    commercial_ids = [id.strip() for id in content_id.split(',') if id.strip()]
    logger.info(f"Fetching specific commercials: {commercial_ids}")
    commercials = []
    for commercial_id in commercial_ids:
        try:
            commercial = await db.content.find_one({
                "_id": ObjectId(commercial_id),
                "type": "commercial",
                "active": True
            })
            if commercial:
                commercials.append(commercial)
                logger.info(f"  Found commercial: {commercial.get('title')}")
        except Exception as e:
            logger.warning(f"  Failed to fetch commercial {commercial_id}: {e}")
    return commercials


async def _fetch_batch_commercials(db, batch_number: int) -> list:
    """Fetch commercials by batch number."""
    logger.info(f"Fetching commercials for batch {batch_number}")
    commercials = await db.content.find({
        "type": "commercial",
        "active": True,
        "batches": batch_number
    }).to_list(100)
    logger.info(f"  Found {len(commercials)} commercials in batch {batch_number}")
    return commercials


async def _fetch_all_commercials(db) -> list:
    """Fetch all active commercials."""
    logger.info("Fetching all active commercials")
    commercials = await db.content.find({
        "type": "commercial",
        "active": True
    }).to_list(100)
    logger.info(f"  Found {len(commercials)} commercials")
    return commercials


def _song_to_queue_item(song: dict) -> dict:
    """Convert a song document to a queue item."""
    return {
        "_id": str(song["_id"]),
        "title": song.get("title", "Unknown"),
        "artist": song.get("artist"),
        "type": song.get("type", "song"),
        "duration_seconds": song.get("duration_seconds", 0),
        "genre": song.get("genre"),
        "metadata": song.get("metadata", {}),
        "batches": song.get("batches", [])
    }


def _commercial_to_queue_item(commercial: dict) -> dict:
    """Convert a commercial document to a queue item."""
    return {
        "_id": str(commercial["_id"]),
        "title": commercial.get("title", "Commercial"),
        "artist": commercial.get("artist"),
        "type": "commercial",
        "duration_seconds": commercial.get("duration_seconds", 0),
        "genre": commercial.get("genre"),
        "metadata": commercial.get("metadata", {}),
        "batches": commercial.get("batches", [])
    }


def _add_songs_to_vlc(audio_player, songs: list):
    """Add songs to VLC audio player queue."""
    from app.services.audio_player import TrackInfo
    for song in songs:
        track = TrackInfo(
            content_id=str(song["_id"]),
            title=song.get("title", "Unknown"),
            artist=song.get("artist"),
            duration_seconds=song.get("duration_seconds", 0),
            file_path=song.get("local_cache_path", ""),
            content_type="song"
        )
        audio_player.add_to_queue(track)


def _add_commercials_to_vlc(audio_player, commercials: list):
    """Add commercials to VLC audio player queue."""
    from app.services.audio_player import TrackInfo
    for commercial in commercials:
        track = TrackInfo(
            content_id=str(commercial["_id"]),
            title=commercial.get("title", "Commercial"),
            artist=None,
            duration_seconds=commercial.get("duration_seconds", 0),
            file_path=commercial.get("local_cache_path", ""),
            content_type="commercial"
        )
        audio_player.add_to_queue(track)


# ============================================================================
# Play Content Action
# ============================================================================

async def _execute_play_content(
    db, action: dict, is_first_playback_action: bool, audio_player=None
) -> bool:
    """
    Execute a play_content action - plays specific content by ID.
    Returns True if playback was triggered.
    """
    content_id = action.get("content_id")
    content_title = action.get("content_title")

    if not content_id and not content_title:
        logger.warning("play_content action missing content_id and content_title")
        return False

    # Try to find content by ID first, then by title
    content = None
    if content_id:
        try:
            content = await db.content.find_one({
                "_id": ObjectId(content_id),
                "active": True
            })
        except Exception as e:
            logger.warning(f"Failed to fetch content by ID {content_id}: {e}")

    if not content and content_title:
        # Search by title (case-insensitive)
        content = await db.content.find_one({
            "title": {"$regex": f"^{content_title}$", "$options": "i"},
            "active": True
        })

    if not content:
        logger.warning(f"Content not found: id={content_id}, title={content_title}")
        return False

    logger.info(f"Playing content: {content.get('title')} (type: {content.get('type')})")

    # Update last_played
    await db.content.update_one(
        {"_id": content["_id"]},
        {"$set": {"last_played": datetime.utcnow()}}
    )

    # Build content data for broadcast
    content_data = {
        "_id": str(content["_id"]),
        "title": content.get("title", "Unknown"),
        "artist": content.get("artist"),
        "type": content.get("type", "song"),
        "duration_seconds": content.get("duration_seconds", 0),
        "genre": content.get("genre"),
        "metadata": content.get("metadata", {})
    }

    if is_first_playback_action:
        # Play immediately
        await broadcast_scheduled_playback(content_data)
        notify_playback_started(content_data, content.get("duration_seconds", 0))
    else:
        # Insert at TOP of queue
        add_to_backend_queue(_content_to_queue_item(content), position=0)
        await broadcast_queue_update(get_backend_queue())

    # Also add to VLC queue if available
    if audio_player:
        _add_content_to_vlc(audio_player, content)

    return True


# ============================================================================
# Play Show Action
# ============================================================================

async def _execute_play_show(
    db, action: dict, is_first_playback_action: bool, audio_player=None
) -> bool:
    """
    Execute a play_show action - plays a specific show by ID.
    Returns True if playback was triggered.
    """
    content_id = action.get("content_id")
    content_title = action.get("content_title")

    if not content_id and not content_title:
        logger.warning("play_show action missing content_id and content_title")
        return False

    # Try to find show by ID first, then by title
    show = None
    if content_id:
        try:
            show = await db.content.find_one({
                "_id": ObjectId(content_id),
                "type": "show",
                "active": True
            })
        except Exception as e:
            logger.warning(f"Failed to fetch show by ID {content_id}: {e}")

    if not show and content_title:
        # Search by title (case-insensitive)
        show = await db.content.find_one({
            "title": {"$regex": f"^{content_title}$", "$options": "i"},
            "type": "show",
            "active": True
        })

    # If still not found, try without type restriction (might be labeled differently)
    if not show and content_title:
        show = await db.content.find_one({
            "title": {"$regex": f"^{content_title}$", "$options": "i"},
            "active": True
        })

    if not show:
        logger.warning(f"Show not found: id={content_id}, title={content_title}")
        return False

    logger.info(f"Playing show: {show.get('title')} (duration: {show.get('duration_seconds', 0)}s)")

    # Update last_played
    await db.content.update_one(
        {"_id": show["_id"]},
        {"$set": {"last_played": datetime.utcnow()}}
    )

    # Build content data for broadcast
    content_data = {
        "_id": str(show["_id"]),
        "title": show.get("title", "Unknown Show"),
        "artist": show.get("artist"),
        "type": "show",
        "duration_seconds": show.get("duration_seconds", 0),
        "genre": show.get("genre"),
        "metadata": show.get("metadata", {})
    }

    if is_first_playback_action:
        # Play immediately
        await broadcast_scheduled_playback(content_data)
        notify_playback_started(content_data, show.get("duration_seconds", 0))
    else:
        # Insert at TOP of queue
        add_to_backend_queue(_content_to_queue_item(show), position=0)
        await broadcast_queue_update(get_backend_queue())

    # Also add to VLC queue if available
    if audio_player:
        _add_content_to_vlc(audio_player, show)

    return True


# ============================================================================
# Wait Action
# ============================================================================

async def _execute_wait(action: dict) -> None:
    """
    Execute a wait action - pauses flow execution for specified duration.
    """
    duration_minutes = action.get("duration_minutes", 0)

    if duration_minutes <= 0:
        logger.warning("wait action has no duration specified")
        return

    duration_seconds = duration_minutes * 60
    logger.info(f"Waiting for {duration_minutes} minutes ({duration_seconds} seconds)...")

    # Use asyncio.sleep for non-blocking wait
    await asyncio.sleep(duration_seconds)

    logger.info(f"Wait completed ({duration_minutes} minutes)")


# ============================================================================
# Announcement Action
# ============================================================================

async def _execute_announcement(db, action: dict, audio_player=None) -> None:
    """
    Execute an announcement action - broadcasts announcement text to clients.
    In a full implementation, this could integrate with TTS for audio playback.
    """
    announcement_text = action.get("announcement_text", "")

    if not announcement_text.strip():
        logger.warning("announcement action has no text")
        return

    logger.info(f"Broadcasting announcement: {announcement_text[:50]}...")

    # Broadcast announcement to connected clients via WebSocket
    await broadcast_announcement(announcement_text)

    # Log the announcement
    try:
        await db.announcements.insert_one({
            "text": announcement_text,
            "created_at": datetime.utcnow(),
            "source": "flow_action"
        })
    except Exception as e:
        logger.warning(f"Failed to log announcement: {e}")


# ============================================================================
# Additional Helper Functions
# ============================================================================

def _content_to_queue_item(content: dict) -> dict:
    """Convert a content document to a queue item."""
    return {
        "_id": str(content["_id"]),
        "title": content.get("title", "Unknown"),
        "artist": content.get("artist"),
        "type": content.get("type", "song"),
        "duration_seconds": content.get("duration_seconds", 0),
        "genre": content.get("genre"),
        "metadata": content.get("metadata", {}),
        "batches": content.get("batches", [])
    }


def _add_content_to_vlc(audio_player, content: dict):
    """Add content to VLC audio player queue."""
    from app.services.audio_player import TrackInfo
    track = TrackInfo(
        content_id=str(content["_id"]),
        title=content.get("title", "Unknown"),
        artist=content.get("artist"),
        duration_seconds=content.get("duration_seconds", 0),
        file_path=content.get("local_cache_path", ""),
        content_type=content.get("type", "song")
    )
    audio_player.add_to_queue(track)
