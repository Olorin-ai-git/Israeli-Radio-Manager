"""Metadata refresh service - periodically updates content metadata from audio files."""

import logging
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase
from mutagen import File as MutagenFile
from mutagen.mp3 import MP3

from app.services.google_drive import GoogleDriveService

logger = logging.getLogger(__name__)


class MetadataRefresherService:
    """
    Background service that periodically refreshes metadata for all content.

    Downloads audio files from Google Drive and extracts ID3 tags to update
    artist, title, album, genre, year, and duration information.
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        drive_service: GoogleDriveService,
        check_interval: int = 3600  # 1 hour in seconds
    ):
        self.db = db
        self.drive_service = drive_service
        self.check_interval = check_interval
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the metadata refresh background task."""
        if self._running:
            logger.warning("Metadata refresher already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info(f"Metadata refresher started (checking every {self.check_interval}s)")

    async def stop(self):
        """Stop the metadata refresh background task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Metadata refresher stopped")

    async def _run(self):
        """Main background loop."""
        while self._running:
            try:
                await self._refresh_metadata()
            except Exception as e:
                logger.error(f"Error in metadata refresh: {e}")

            # Wait for next check interval
            await asyncio.sleep(self.check_interval)

    async def _refresh_metadata(self):
        """Refresh metadata for all content."""
        logger.info("Starting periodic metadata refresh...")

        stats = {
            "total": 0,
            "updated": 0,
            "skipped": 0,
            "errors": []
        }

        # Get all active content
        cursor = self.db.content.find({"active": True})

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

                    local_path = await self.drive_service.download_file(drive_id, filename)
                    if not local_path or not local_path.exists():
                        stats["errors"].append(f"{filename}: Download failed")
                        continue

                # Extract metadata
                audio = MutagenFile(str(local_path), easy=True)
                if audio is None:
                    stats["skipped"] += 1
                    continue

                def get_first(value):
                    if isinstance(value, list) and value:
                        return value[0]
                    return value

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
                await self.db.content.update_one(
                    {"_id": item["_id"]},
                    {"$set": update_doc}
                )
                stats["updated"] += 1

            except Exception as e:
                stats["errors"].append(f"{filename}: {str(e)}")
                logger.error(f"Error refreshing metadata for {filename}: {e}")

        logger.info(f"Metadata refresh complete: updated {stats['updated']}/{stats['total']} items, {len(stats['errors'])} errors")

    def get_status(self) -> dict:
        """Get current status of the metadata refresher."""
        return {
            "running": self._running,
            "check_interval": self.check_interval,
        }
