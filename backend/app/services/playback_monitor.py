"""Playback Monitor Service - detects extended playback outages and sends alerts."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class PlaybackMonitorService:
    """
    Background service that monitors playback health and alerts on extended outages.

    Key features:
    - Checks playback_logs for recent activity
    - Alerts if no playback detected for threshold period
    - Implements cooldown to prevent notification spam
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        notification_service=None,
        check_interval: int = 60,  # Check every 60 seconds
        outage_threshold_minutes: int = 5,  # Alert if no playback for 5 minutes
        alert_cooldown_minutes: int = 30,  # Don't spam alerts
    ):
        """
        Initialize playback monitor.

        Args:
            db: MongoDB database
            notification_service: NotificationService for sending alerts
            check_interval: Seconds between checks (default 60)
            outage_threshold_minutes: Minutes of no playback before alerting (default 5)
            alert_cooldown_minutes: Minutes between repeated alerts (default 30)
        """
        self.db = db
        self.notification_service = notification_service
        self.check_interval = check_interval
        self.outage_threshold = timedelta(minutes=outage_threshold_minutes)
        self.alert_cooldown = timedelta(minutes=alert_cooldown_minutes)

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_alert_time: Optional[datetime] = None

    async def start(self):
        """Start the playback monitor background task."""
        if self._running:
            logger.warning("Playback monitor already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(
            f"Playback monitor started (checking every {self.check_interval}s, "
            f"threshold: {self.outage_threshold.total_seconds() // 60} min)"
        )

    async def stop(self):
        """Stop the playback monitor."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Playback monitor stopped")

    async def _monitor_loop(self):
        """Main monitoring loop - runs continuously."""
        while self._running:
            try:
                await self._check_playback_health()
            except Exception as e:
                logger.error(f"Error in playback monitor: {e}", exc_info=True)

            await asyncio.sleep(self.check_interval)

    async def _check_playback_health(self):
        """Check if playback has been active recently."""
        threshold_time = datetime.utcnow() - self.outage_threshold

        # Check for recent playback logs
        recent_playback = await self.db.playback_logs.find_one(
            {"started_at": {"$gte": threshold_time}},
            sort=[("started_at", -1)]
        )

        if recent_playback:
            # Playback is healthy
            return

        # Check alert cooldown
        if self._last_alert_time:
            time_since_last_alert = datetime.utcnow() - self._last_alert_time
            if time_since_last_alert < self.alert_cooldown:
                # Still in cooldown period
                return

        # Send alert
        await self._send_outage_alert()

    async def _send_outage_alert(self):
        """Send a playback outage alert."""
        if not self.notification_service:
            logger.warning("No notification service configured for playback monitor")
            return

        from app.services.notifications import NotificationLevel

        threshold_minutes = int(self.outage_threshold.total_seconds() // 60)

        await self.notification_service.send_notification(
            message=(
                f"No playback activity detected for {threshold_minutes} minutes. "
                "The radio may be down. Please check the system immediately."
            ),
            title="CRITICAL: Playback Outage Detected",
            level=NotificationLevel.CRITICAL,
            data={
                "event": "playback_outage",
                "threshold_minutes": threshold_minutes,
                "timestamp": datetime.utcnow().isoformat()
            }
        )

        self._last_alert_time = datetime.utcnow()
        logger.warning(f"Playback outage alert sent (threshold: {threshold_minutes} min)")
