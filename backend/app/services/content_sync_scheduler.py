"""Content Sync Scheduler - periodically syncs content from Google Drive to GCS."""

import logging
import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.content_sync import ContentSyncService

logger = logging.getLogger(__name__)


class ContentSyncScheduler:
    """
    Background service that periodically syncs content from Google Drive to GCS.

    This ensures new content is automatically discovered and uploaded to GCS
    for reliable streaming.
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        content_sync: ContentSyncService,
        sync_interval: int = 3600,  # 1 hour in seconds
        enabled: bool = True
    ):
        self.db = db
        self.content_sync = content_sync
        self.sync_interval = sync_interval
        self.enabled = enabled
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_sync_result: Optional[dict] = None
        self._last_sync_time: Optional[str] = None

    async def start(self):
        """Start the periodic sync background task."""
        if not self.enabled:
            logger.info("Content sync scheduler is disabled")
            return

        if self._running:
            logger.warning("Content sync scheduler already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info(f"Content sync scheduler started (syncing every {self.sync_interval}s)")

    async def stop(self):
        """Stop the periodic sync background task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Content sync scheduler stopped")

    async def _run(self):
        """Main loop - run sync periodically."""
        while self._running:
            try:
                # Wait for the interval before first sync (let app fully start)
                await asyncio.sleep(60)  # Initial delay of 1 minute

                while self._running:
                    await self._do_sync()
                    await asyncio.sleep(self.sync_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in sync scheduler loop: {e}")
                await asyncio.sleep(60)  # Wait a minute before retrying

    async def _do_sync(self):
        """Execute a single sync operation."""
        from datetime import datetime

        logger.info("Starting scheduled content sync...")
        try:
            result = await self.content_sync.sync_all(download_files=False)
            self._last_sync_result = result
            self._last_sync_time = datetime.utcnow().isoformat()

            # Log summary
            gcs_uploaded = result.get('gcs_uploaded', 0)
            total_synced = result.get('total_synced', 0)
            logger.info(f"Scheduled sync completed: {total_synced} items synced, {gcs_uploaded} uploaded to GCS")

        except Exception as e:
            logger.error(f"Scheduled sync failed: {e}")
            self._last_sync_result = {"error": str(e)}
            self._last_sync_time = datetime.utcnow().isoformat()

    async def trigger_sync(self) -> dict:
        """Manually trigger a sync (called from API)."""
        from datetime import datetime

        logger.info("Manual sync triggered")
        try:
            result = await self.content_sync.sync_all(download_files=False)
            self._last_sync_result = result
            self._last_sync_time = datetime.utcnow().isoformat()
            return result
        except Exception as e:
            logger.error(f"Manual sync failed: {e}")
            error_result = {"error": str(e)}
            self._last_sync_result = error_result
            self._last_sync_time = datetime.utcnow().isoformat()
            return error_result

    def get_status(self) -> dict:
        """Get the current sync scheduler status."""
        return {
            "enabled": self.enabled,
            "running": self._running,
            "sync_interval_seconds": self.sync_interval,
            "last_sync_time": self._last_sync_time,
            "last_sync_result": self._last_sync_result
        }
