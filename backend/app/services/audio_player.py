"""Audio Player Service - State management for browser-based playback."""

import logging
from typing import Optional, List, Callable
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

logger = logging.getLogger(__name__)


class PlaybackState(str, Enum):
    """Current state of the audio player."""
    STOPPED = "stopped"
    PLAYING = "playing"
    PAUSED = "paused"


@dataclass
class TrackInfo:
    """Information about a track."""
    content_id: str
    title: str
    artist: Optional[str]
    duration_seconds: int
    file_path: str


@dataclass
class QueueItem:
    """Item in the playback queue."""
    track: TrackInfo
    priority: int = 0


class AudioPlayerService:
    """
    Service for tracking audio playback state.

    Actual playback happens in the browser via streaming endpoints.
    This service manages state, queue, and callbacks only.
    """

    def __init__(self, cache_dir: str = "./cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._state = PlaybackState.STOPPED
        self._current_track: Optional[TrackInfo] = None
        self._queue: List[QueueItem] = []
        self._volume = 80  # 0-100
        self._position = 0  # Current position in seconds

        # Callbacks
        self._on_track_end: Optional[Callable] = None
        self._on_error: Optional[Callable] = None

    @property
    def state(self) -> PlaybackState:
        """Get current playback state."""
        return self._state

    @property
    def current_track(self) -> Optional[TrackInfo]:
        """Get currently playing track."""
        return self._current_track

    @property
    def volume(self) -> int:
        """Get current volume level."""
        return self._volume

    @property
    def position(self) -> int:
        """Get current playback position in seconds."""
        return self._position

    @property
    def queue_length(self) -> int:
        """Get number of items in queue."""
        return len(self._queue)

    def set_on_track_end(self, callback: Callable):
        """Set callback for when a track ends."""
        self._on_track_end = callback

    def set_on_error(self, callback: Callable):
        """Set callback for playback errors."""
        self._on_error = callback

    async def play(self, track: TrackInfo) -> bool:
        """
        Mark a track as playing.

        Actual playback happens in browser via /api/playback/stream/{content_id}

        Args:
            track: Track information with file path

        Returns:
            True if state was updated successfully
        """
        try:
            self._current_track = track
            self._state = PlaybackState.PLAYING
            self._position = 0

            logger.info(f"Now playing: {track.title} by {track.artist}")
            return True

        except Exception as e:
            logger.error(f"Playback state update error: {e}")
            if self._on_error:
                self._on_error(e)
            return False

    async def pause(self) -> bool:
        """Pause current playback."""
        if self._state == PlaybackState.PLAYING:
            self._state = PlaybackState.PAUSED
            logger.info("Playback paused")
            return True
        return False

    async def resume(self) -> bool:
        """Resume paused playback."""
        if self._state == PlaybackState.PAUSED:
            self._state = PlaybackState.PLAYING
            logger.info("Playback resumed")
            return True
        return False

    async def stop(self) -> bool:
        """Stop playback completely."""
        self._state = PlaybackState.STOPPED
        self._current_track = None
        self._position = 0
        logger.info("Playback stopped")
        return True

    async def skip(self) -> bool:
        """Skip to next track in queue."""
        await self.stop()

        if self._queue:
            next_item = self._queue.pop(0)
            return await self.play(next_item.track)

        # Trigger callback for track end to get next track
        if self._on_track_end:
            self._on_track_end()

        return True

    def set_volume(self, level: int) -> bool:
        """
        Set volume level.

        Args:
            level: Volume 0-100

        Returns:
            True if volume was set
        """
        if not 0 <= level <= 100:
            return False

        self._volume = level
        logger.info(f"Volume set to {level}")

        return True

    def update_position(self, position_seconds: int):
        """
        Update current playback position.

        Called by frontend to sync position state.

        Args:
            position_seconds: Current position in seconds
        """
        self._position = position_seconds

    def add_to_queue(self, track: TrackInfo, priority: int = 0):
        """
        Add a track to the playback queue.

        Args:
            track: Track to add
            priority: Higher priority items play first
        """
        item = QueueItem(track=track, priority=priority)

        # Insert based on priority
        inserted = False
        for i, existing in enumerate(self._queue):
            if priority > existing.priority:
                self._queue.insert(i, item)
                inserted = True
                break

        if not inserted:
            self._queue.append(item)

        logger.info(f"Added to queue: {track.title} (priority: {priority})")

    def clear_queue(self):
        """Clear the playback queue."""
        self._queue = []
        logger.info("Queue cleared")

    def get_queue(self) -> List[QueueItem]:
        """Get the current queue."""
        return self._queue.copy()

    def remove_from_queue(self, position: int) -> bool:
        """Remove item from queue by position."""
        if 0 <= position < len(self._queue):
            removed = self._queue.pop(position)
            logger.info(f"Removed from queue: {removed.track.title}")
            return True
        return False

    def get_status(self) -> dict:
        """Get complete playback status."""
        return {
            "state": self._state.value,
            "current_track": {
                "content_id": self._current_track.content_id,
                "title": self._current_track.title,
                "artist": self._current_track.artist,
                "duration_seconds": self._current_track.duration_seconds,
            } if self._current_track else None,
            "position_seconds": self.position,
            "duration_seconds": self._current_track.duration_seconds if self._current_track else 0,
            "volume": self._volume,
            "queue_length": len(self._queue)
        }

    def cleanup(self):
        """Clean up resources."""
        logger.info("Audio player cleaned up")
