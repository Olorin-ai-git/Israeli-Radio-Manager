"""Calendar Watcher Service - monitors calendar events and triggers playback."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Set, Dict, Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)


class CalendarWatcherService:
    """
    Background service that watches Google Calendar for scheduled events
    and triggers playback when event start time is reached.
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        calendar_service,
        audio_player,
        drive_service,
        check_interval: int = 15,
        lookahead_minutes: int = 5
    ):
        """
        Initialize calendar watcher.

        Args:
            db: MongoDB database
            calendar_service: GoogleCalendarService instance
            audio_player: AudioPlayerService instance
            drive_service: GoogleDriveService for downloading content
            check_interval: Seconds between checks (default 15)
            lookahead_minutes: Minutes to look ahead for events (default 5)
        """
        self.db = db
        self.calendar_service = calendar_service
        self.audio_player = audio_player
        self.drive_service = drive_service
        self.check_interval = check_interval
        self.lookahead_minutes = lookahead_minutes

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._triggered_events: Set[str] = set()  # Track already triggered event IDs
        self._last_check: Optional[datetime] = None

    async def start(self):
        """Start the calendar watcher background task."""
        if self._running:
            logger.warning("Calendar watcher already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        logger.info(f"Calendar watcher started (checking every {self.check_interval}s)")

    async def stop(self):
        """Stop the calendar watcher."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Calendar watcher stopped")

    async def _watch_loop(self):
        """Main watch loop - runs continuously."""
        while self._running:
            try:
                await self._check_upcoming_events()
                self._last_check = datetime.now()
            except Exception as e:
                logger.error(f"Error in calendar watcher: {e}", exc_info=True)

            await asyncio.sleep(self.check_interval)

    async def _check_upcoming_events(self):
        """Check for events that should be triggered now."""
        if not self.calendar_service:
            logger.debug("No calendar service available")
            return

        # Use UTC for Google Calendar API (it expects UTC times with "Z" suffix)
        now_utc = datetime.now(timezone.utc)
        lookahead_utc = now_utc + timedelta(minutes=self.lookahead_minutes)

        # Local time for logging and comparison
        now_local = datetime.now()

        logger.info(f"Checking for events between {now_utc.strftime('%H:%M:%S')} UTC and {lookahead_utc.strftime('%H:%M:%S')} UTC (local: {now_local.strftime('%H:%M:%S')})")

        try:
            # Get upcoming radio-managed events (use UTC times for API)
            events = await self.calendar_service.list_radio_events(
                time_min=now_utc - timedelta(seconds=30),  # Small buffer for timing
                time_max=lookahead_utc
            )

            logger.info(f"list_radio_events returned {len(events)} events")

            if events:
                logger.info(f"Found {len(events)} radio events in the next {self.lookahead_minutes} minutes")

            for event in events:
                event_id = event.get("id")
                if not event_id:
                    continue

                # Skip already triggered events
                if event_id in self._triggered_events:
                    continue

                # Parse event start time
                start_str = event.get("start", {}).get("dateTime")
                if not start_str:
                    continue

                # Parse ISO datetime (handle timezone)
                try:
                    # Remove timezone info for comparison (we compare local times)
                    start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    # Convert to local time
                    start_local = start_time.replace(tzinfo=None)
                    if start_time.tzinfo:
                        # Rough conversion - just compare times
                        start_local = datetime.fromisoformat(start_str[:19])
                except ValueError as e:
                    logger.warning(f"Failed to parse event time {start_str}: {e}")
                    continue

                # Check if it's time to trigger (within 30 second window)
                time_diff = (start_local - now_local).total_seconds()

                if -30 <= time_diff <= 30:
                    # Time to play!
                    await self._trigger_event(event)
                    self._triggered_events.add(event_id)

                    # Clean up old triggered events (keep last 100)
                    if len(self._triggered_events) > 100:
                        self._triggered_events = set(list(self._triggered_events)[-50:])

        except Exception as e:
            logger.error(f"Failed to check calendar events: {e}", exc_info=True)

    async def _trigger_event(self, event: Dict[str, Any]):
        """Trigger playback for a calendar event."""
        event_id = event.get("id")
        summary = event.get("summary", "Unknown")

        # Get content ID from extended properties
        ext_props = event.get("extendedProperties", {}).get("private", {})
        content_id = ext_props.get("radio_content_id")
        content_type = ext_props.get("radio_content_type", "song")

        logger.info(f"Triggering scheduled event: {summary} (content_id: {content_id}, type: {content_type})")

        if not content_id:
            logger.warning(f"Event {event_id} has no content_id, skipping")
            return

        # Handle flow type - run the flow
        if content_type == "flow":
            await self._trigger_flow(content_id, event_id)
            return

        try:
            # Get content from database
            content = await self.db.content.find_one({"_id": ObjectId(content_id)})
            if not content:
                logger.error(f"Content {content_id} not found in database")
                return

            # Ensure content is cached locally
            drive_id = content.get("google_drive_id")
            local_path = content.get("local_cache_path")

            if not local_path or not await self._file_exists(local_path):
                if drive_id:
                    logger.info(f"Downloading content from Google Drive: {content.get('title')}")
                    local_path = await self.drive_service.download_file(drive_id)

                    # Update cache path in database
                    await self.db.content.update_one(
                        {"_id": ObjectId(content_id)},
                        {"$set": {"local_cache_path": str(local_path)}}
                    )

            # Broadcast to frontend via WebSocket for browser playback
            from app.routers.websocket import broadcast_scheduled_playback
            content_data = {
                "_id": str(content["_id"]),
                "title": content.get("title"),
                "artist": content.get("artist"),
                "type": content.get("type"),
                "duration_seconds": content.get("duration_seconds"),
                "genre": content.get("genre"),
                "metadata": content.get("metadata", {}),
            }
            logger.info(f"Broadcasting scheduled playback to frontend: {content.get('title')}")
            await broadcast_scheduled_playback(content_data)

            # Log the playback
            await self.db.playback_logs.insert_one({
                "content_id": ObjectId(content_id),
                "type": content_type,
                "title": content.get("title"),
                "started_at": datetime.utcnow(),
                "triggered_by": "calendar",
                "calendar_event_id": event_id
            })

            # Update last_played on content
            await self.db.content.update_one(
                {"_id": ObjectId(content_id)},
                {
                    "$set": {"last_played": datetime.utcnow()},
                    "$inc": {"play_count": 1}
                }
            )

        except Exception as e:
            logger.error(f"Failed to trigger event {event_id}: {e}", exc_info=True)

    async def _trigger_flow(self, flow_id: str, calendar_event_id: str):
        """Trigger a scheduled flow."""
        try:
            # Get flow from database
            flow = await self.db.flows.find_one({"_id": ObjectId(flow_id)})
            if not flow:
                logger.error(f"Flow {flow_id} not found in database")
                return

            flow_name = flow.get("name", "Unknown Flow")
            logger.info(f"Triggering scheduled flow: {flow_name}")

            # Import flow execution logic
            from app.routers.flows import run_flow_actions

            # Execute flow actions
            await run_flow_actions(self.db, flow, self.audio_player)

            # Update flow last_run and run_count
            await self.db.flows.update_one(
                {"_id": ObjectId(flow_id)},
                {
                    "$set": {"last_run": datetime.utcnow()},
                    "$inc": {"run_count": 1}
                }
            )

            # Log the execution
            await self.db.flow_executions.insert_one({
                "flow_id": flow_id,
                "flow_name": flow_name,
                "started_at": datetime.utcnow(),
                "triggered_by": "calendar",
                "calendar_event_id": calendar_event_id,
                "status": "completed"
            })

            logger.info(f"Flow {flow_name} executed successfully via calendar trigger")

        except Exception as e:
            logger.error(f"Failed to trigger flow {flow_id}: {e}", exc_info=True)

    async def _file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        import os
        return os.path.exists(path)

    def get_status(self) -> Dict[str, Any]:
        """Get watcher status."""
        return {
            "running": self._running,
            "last_check": self._last_check.isoformat() if self._last_check else None,
            "triggered_count": len(self._triggered_events),
            "check_interval": self.check_interval
        }
