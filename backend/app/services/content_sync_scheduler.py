"""Content Sync Scheduler - periodically syncs content from Google Drive to GCS."""

import logging
import asyncio
from datetime import datetime
from typing import Optional, List, Dict, Any
from collections import deque

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.services.content_sync import ContentSyncService

logger = logging.getLogger(__name__)


class SyncProgress:
    """Tracks sync progress with rolling log."""

    def __init__(self, max_log_entries: int = 100):
        self.is_syncing = False
        self.current_phase = ""
        self.current_file = ""
        self.total_files = 0
        self.processed_files = 0
        self.uploaded_to_gcs = 0
        self.errors = 0
        self.start_time: Optional[datetime] = None
        self.log_entries: deque = deque(maxlen=max_log_entries)

    def start(self, phase: str = "Starting sync"):
        self.is_syncing = True
        self.current_phase = phase
        self.current_file = ""
        self.total_files = 0
        self.processed_files = 0
        self.uploaded_to_gcs = 0
        self.errors = 0
        self.start_time = datetime.utcnow()
        self.log("INFO", f"Sync started: {phase}")

    def set_total(self, total: int):
        self.total_files = total
        self.log("INFO", f"Found {total} files to process")

    def add_to_total(self, count: int):
        """Add to total files count (used when discovering files incrementally)."""
        self.total_files += count

    def set_phase(self, phase: str):
        self.current_phase = phase
        self.log("INFO", phase)

    def process_file(self, filename: str, action: str = "processing"):
        self.current_file = filename
        self.processed_files += 1
        self.log("FILE", f"{action}: {filename}")

    def file_uploaded_gcs(self, filename: str):
        self.uploaded_to_gcs += 1
        self.log("GCS", f"Uploaded to GCS: {filename}")

    def file_error(self, filename: str, error: str):
        self.errors += 1
        self.log("ERROR", f"Error with {filename}: {error}")

    def complete(self, message: str = "Sync complete"):
        self.is_syncing = False
        self.current_phase = "Complete"
        self.current_file = ""
        elapsed = (datetime.utcnow() - self.start_time).total_seconds() if self.start_time else 0
        self.log("INFO", f"{message} in {elapsed:.1f}s - Processed: {self.processed_files}, GCS uploads: {self.uploaded_to_gcs}, Errors: {self.errors}")

    def log(self, level: str, message: str):
        entry = {
            "time": datetime.utcnow().isoformat(),
            "level": level,
            "message": message
        }
        self.log_entries.append(entry)

    def get_progress(self) -> Dict[str, Any]:
        percent = (self.processed_files / self.total_files * 100) if self.total_files > 0 else 0
        elapsed = (datetime.utcnow() - self.start_time).total_seconds() if self.start_time and self.is_syncing else 0

        return {
            "is_syncing": self.is_syncing,
            "phase": self.current_phase,
            "current_file": self.current_file,
            "total_files": self.total_files,
            "processed_files": self.processed_files,
            "uploaded_to_gcs": self.uploaded_to_gcs,
            "errors": self.errors,
            "percent_complete": round(percent, 1),
            "elapsed_seconds": round(elapsed, 1),
            "log": list(self.log_entries)[-20:]  # Last 20 entries
        }


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
        self.progress = SyncProgress()

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
        """Execute a full sync: Drive discovery + GCS upload."""
        logger.info("Starting scheduled content sync...")
        self.progress.start("Starting scheduled sync")

        combined_result = {
            "drive_sync": {},
            "gcs_sync": {},
            "total_files_found": 0,
            "total_added": 0,
            "total_gcs_uploaded": 0,
            "errors": []
        }

        try:
            # Phase 1: Drive Sync - Discover new content
            self.progress.set_phase("Phase 1: Syncing from Google Drive...")
            self.progress.log("INFO", "Starting Drive sync - discovering new content")

            drive_result = await self.content_sync.sync_all(
                download_files=False,
                upload_to_gcs=False,  # We'll do GCS in phase 2
                progress_callback=self.progress
            )
            combined_result["drive_sync"] = drive_result
            combined_result["total_files_found"] = drive_result.get("files_found", 0)
            combined_result["total_added"] = drive_result.get("files_added", 0)

            self.progress.log("INFO", f"Drive sync complete: {drive_result.get('files_found', 0)} found, {drive_result.get('files_added', 0)} added")

            # Phase 2: GCS Sync - Upload pending content
            self.progress.set_phase("Phase 2: Uploading to GCS...")
            self.progress.log("INFO", "Starting GCS sync - uploading pending content")

            gcs_result = await self._sync_with_progress()
            combined_result["gcs_sync"] = gcs_result
            combined_result["total_gcs_uploaded"] = gcs_result.get("files_uploaded_gcs", 0)

            # Combine errors
            combined_result["errors"] = drive_result.get("errors", []) + gcs_result.get("errors", [])

            self._last_sync_result = combined_result
            self._last_sync_time = datetime.utcnow().isoformat()

            # Final summary
            summary = f"Sync complete: {combined_result['total_files_found']} found, {combined_result['total_added']} added, {combined_result['total_gcs_uploaded']} uploaded to GCS"
            self.progress.complete(summary)
            logger.info(f"Scheduled sync completed: {summary}")

        except Exception as e:
            logger.error(f"Scheduled sync failed: {e}")
            self.progress.log("ERROR", f"Sync failed: {str(e)}")
            self.progress.complete(f"Sync failed: {str(e)}")
            self._last_sync_result = {"error": str(e)}
            self._last_sync_time = datetime.utcnow().isoformat()

    async def _sync_with_progress(self) -> Dict[str, Any]:
        """Run sync with detailed progress tracking."""
        # First, get content that needs GCS upload
        self.progress.set_phase("Checking content needing GCS upload...")

        pending_cursor = self.db.content.find(
            {
                "active": True,
                "google_drive_id": {"$exists": True, "$ne": None},
                "$or": [{"gcs_path": None}, {"gcs_path": {"$exists": False}}, {"gcs_path": ""}]
            }
        )
        pending_items = await pending_cursor.to_list(None)
        self.progress.set_total(len(pending_items))

        if not pending_items:
            self.progress.log("INFO", "No content pending GCS upload")
            return {"files_found": 0, "files_uploaded_gcs": 0}

        self.progress.set_phase(f"Uploading {len(pending_items)} files to GCS...")

        stats = {
            "files_found": len(pending_items),
            "files_uploaded_gcs": 0,
            "errors": []
        }

        gcs = self.content_sync.gcs
        drive = self.content_sync.drive

        if not gcs.is_available:
            self.progress.log("ERROR", "GCS service not available")
            stats["errors"].append("GCS service not available")
            return stats

        for item in pending_items:
            filename = item.get("title") or item.get("google_drive_path") or "Unknown"
            drive_id = item.get("google_drive_id")
            content_type = item.get("type", "song")
            genre = item.get("genre")

            self.progress.process_file(filename, "Uploading")

            try:
                # Build GCS folder path
                if content_type == "song" and genre:
                    gcs_folder = f"songs/{genre}"
                else:
                    gcs_folder = f"{content_type}s"

                # Stream from Drive to GCS
                file_ext = item.get("google_drive_path", ".mp3").split(".")[-1]
                if not file_ext.startswith("."):
                    file_ext = f".{file_ext}"

                stream = drive.download_to_stream(drive_id)
                gcs_path = gcs.upload_from_stream(
                    stream=stream,
                    folder=gcs_folder,
                    filename=filename,
                    file_extension=file_ext,
                    metadata={"google_drive_id": drive_id}
                )

                if gcs_path:
                    # Update database
                    await self.db.content.update_one(
                        {"_id": item["_id"]},
                        {"$set": {"gcs_path": gcs_path, "updated_at": datetime.utcnow()}}
                    )
                    stats["files_uploaded_gcs"] += 1
                    self.progress.file_uploaded_gcs(filename)
                else:
                    self.progress.file_error(filename, "Upload returned no path")

            except Exception as e:
                error_msg = str(e)
                stats["errors"].append(f"{filename}: {error_msg}")
                self.progress.file_error(filename, error_msg)
                logger.error(f"Failed to upload {filename} to GCS: {e}")

        return stats

    async def trigger_sync(self) -> dict:
        """Manually trigger a sync (called from API)."""
        logger.info("Manual sync triggered")

        if self.progress.is_syncing:
            return {"error": "Sync already in progress", "progress": self.progress.get_progress()}

        self.progress.start("Manual sync triggered")

        try:
            result = await self._sync_with_progress()
            self._last_sync_result = result
            self._last_sync_time = datetime.utcnow().isoformat()
            self.progress.complete("Manual sync completed")
            return result
        except Exception as e:
            logger.error(f"Manual sync failed: {e}")
            error_result = {"error": str(e)}
            self._last_sync_result = error_result
            self._last_sync_time = datetime.utcnow().isoformat()
            self.progress.complete(f"Manual sync failed: {str(e)}")
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

    def get_progress(self) -> dict:
        """Get detailed sync progress."""
        return self.progress.get_progress()
