"""Audio Player Service using VLC for local playback."""

import logging
import asyncio
from typing import Optional, List, Callable
from dataclasses import dataclass, field
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
    Service for controlling audio playback through VLC.

    Plays audio through the local sound card for radio broadcast.
    """

    def __init__(self, cache_dir: str = "./cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._state = PlaybackState.STOPPED
        self._current_track: Optional[TrackInfo] = None
        self._queue: List[QueueItem] = []
        self._volume = 80  # 0-100
        self._position = 0  # Current position in seconds

        # VLC instance (initialized lazily)
        self._vlc_instance = None
        self._player = None

        # Callbacks
        self._on_track_end: Optional[Callable] = None
        self._on_error: Optional[Callable] = None

        # Background task for monitoring playback
        self._monitor_task: Optional[asyncio.Task] = None
        self._monitoring = False

    def _ensure_vlc(self):
        """Ensure VLC is initialized."""
        if self._vlc_instance is None:
            try:
                import vlc
                self._vlc_instance = vlc.Instance()
                self._player = self._vlc_instance.media_player_new()
                self._player.audio_set_volume(self._volume)
                logger.info("VLC player initialized")
            except ImportError:
                logger.error("python-vlc not installed")
                raise RuntimeError("VLC not available")
            except Exception as e:
                logger.error(f"Failed to initialize VLC: {e}")
                raise

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
        if self._player and self._state == PlaybackState.PLAYING:
            try:
                return self._player.get_time() // 1000
            except Exception:
                pass
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
        Start playing a specific track.

        Args:
            track: Track information with file path

        Returns:
            True if playback started successfully
        """
        try:
            self._ensure_vlc()

            import vlc

            # Create media from file path
            media = self._vlc_instance.media_new(track.file_path)
            self._player.set_media(media)

            # Start playback
            result = self._player.play()
            if result == -1:
                logger.error(f"Failed to play: {track.title}")
                return False

            self._current_track = track
            self._state = PlaybackState.PLAYING
            self._position = 0

            # Start monitoring for track end
            if not self._monitoring:
                self._start_monitoring()

            logger.info(f"Now playing: {track.title} by {track.artist}")
            return True

        except Exception as e:
            logger.error(f"Playback error: {e}")
            if self._on_error:
                self._on_error(e)
            return False

    async def pause(self) -> bool:
        """Pause current playback."""
        if self._player and self._state == PlaybackState.PLAYING:
            self._player.pause()
            self._state = PlaybackState.PAUSED
            self._position = self.position
            logger.info("Playback paused")
            return True
        return False

    async def resume(self) -> bool:
        """Resume paused playback."""
        if self._player and self._state == PlaybackState.PAUSED:
            self._player.play()
            self._state = PlaybackState.PLAYING
            logger.info("Playback resumed")
            return True
        return False

    async def stop(self) -> bool:
        """Stop playback completely."""
        if self._player:
            self._player.stop()
            self._state = PlaybackState.STOPPED
            self._current_track = None
            self._position = 0
            logger.info("Playback stopped")
            return True
        return False

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
        if self._player:
            self._player.audio_set_volume(level)
            logger.info(f"Volume set to {level}")

        return True

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

    def _start_monitoring(self):
        """Start background monitoring for track end."""
        if self._monitor_task is None or self._monitor_task.done():
            self._monitoring = True
            self._monitor_task = asyncio.create_task(self._monitor_playback())
            logger.debug("Started playback monitoring")

    async def _monitor_playback(self):
        """Monitor playback and auto-play next track when current ends."""
        while self._monitoring:
            try:
                if self._player and self._state == PlaybackState.PLAYING:
                    # Check if track has ended
                    import vlc
                    state = self._player.get_state()

                    if state == vlc.State.Ended:
                        logger.info(f"Track ended: {self._current_track.title if self._current_track else 'Unknown'}")

                        # Try to play next from queue
                        if self._queue:
                            next_item = self._queue.pop(0)
                            logger.info(f"Auto-playing next from queue: {next_item.track.title}")
                            await self.play(next_item.track)
                        else:
                            # No more tracks in queue
                            self._state = PlaybackState.STOPPED
                            self._current_track = None

                            # Trigger callback if set
                            if self._on_track_end:
                                try:
                                    if asyncio.iscoroutinefunction(self._on_track_end):
                                        await self._on_track_end()
                                    else:
                                        self._on_track_end()
                                except Exception as e:
                                    logger.error(f"Error in track_end callback: {e}")

                await asyncio.sleep(1)  # Check every second

            except Exception as e:
                logger.error(f"Error in playback monitoring: {e}")
                await asyncio.sleep(1)

    def _stop_monitoring(self):
        """Stop background monitoring."""
        self._monitoring = False
        if self._monitor_task:
            self._monitor_task.cancel()
        logger.debug("Stopped playback monitoring")

    def cleanup(self):
        """Clean up resources."""
        self._stop_monitoring()
        if self._player:
            self._player.stop()
            self._player.release()
        if self._vlc_instance:
            self._vlc_instance.release()
        logger.info("Audio player cleaned up")
