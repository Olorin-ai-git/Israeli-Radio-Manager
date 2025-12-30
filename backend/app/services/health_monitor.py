"""Health monitoring service for server metrics and alerting."""

import asyncio
import logging
import psutil
import platform
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class HealthMonitorService:
    """
    Background service that monitors server health metrics and sends alerts.

    Monitors:
    - CPU usage
    - Memory usage
    - Disk space
    - Network connections
    - Process uptime
    - Background service status
    """

    def __init__(
        self,
        notification_service=None,
        check_interval: int = 60,  # Check every minute
        cpu_threshold: float = 80.0,  # Alert at 80% CPU
        memory_threshold: float = 85.0,  # Alert at 85% memory
        disk_threshold: float = 90.0,  # Alert at 90% disk
        alert_cooldown_minutes: int = 30  # Don't spam alerts
    ):
        """
        Initialize health monitor.

        Args:
            notification_service: NotificationService for alerts
            check_interval: Seconds between health checks
            cpu_threshold: CPU usage percentage to trigger alert
            memory_threshold: Memory usage percentage to trigger alert
            disk_threshold: Disk usage percentage to trigger alert
            alert_cooldown_minutes: Minutes between repeated alerts for same issue
        """
        self.notifications = notification_service
        self.check_interval = check_interval
        self.cpu_threshold = cpu_threshold
        self.memory_threshold = memory_threshold
        self.disk_threshold = disk_threshold
        self.alert_cooldown = timedelta(minutes=alert_cooldown_minutes)

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._process = psutil.Process()
        self._start_time = datetime.utcnow()
        self._last_alerts: Dict[str, datetime] = {}

    async def start(self):
        """Start the health monitor background task."""
        if self._running:
            logger.warning("Health monitor already running")
            return

        self._running = True
        self._start_time = datetime.utcnow()
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"Health monitor started (checking every {self.check_interval}s)")

    async def stop(self):
        """Stop the health monitor."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Health monitor stopped")

    async def _monitor_loop(self):
        """Main monitoring loop."""
        while self._running:
            try:
                await self._check_health()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitor loop: {e}")
                await asyncio.sleep(self.check_interval)

    async def _check_health(self):
        """Check all health metrics and send alerts if needed."""
        metrics = self.get_metrics()

        # Check CPU usage
        if metrics["cpu"]["percent"] > self.cpu_threshold:
            await self._send_alert(
                "high_cpu",
                "WARNING",
                "High CPU Usage",
                f"CPU usage is {metrics['cpu']['percent']:.1f}% (threshold: {self.cpu_threshold}%)"
            )

        # Check memory usage
        if metrics["memory"]["percent"] > self.memory_threshold:
            await self._send_alert(
                "high_memory",
                "WARNING",
                "High Memory Usage",
                f"Memory usage is {metrics['memory']['percent']:.1f}% ({metrics['memory']['used_gb']:.1f} GB / {metrics['memory']['total_gb']:.1f} GB)"
            )

        # Check disk usage
        if metrics["disk"]["percent"] > self.disk_threshold:
            await self._send_alert(
                "high_disk",
                "ERROR",
                "Critical: Disk Almost Full",
                f"Disk usage is {metrics['disk']['percent']:.1f}% ({metrics['disk']['used_gb']:.1f} GB / {metrics['disk']['total_gb']:.1f} GB)"
            )

    async def _send_alert(self, alert_key: str, level: str, title: str, message: str):
        """Send an alert with cooldown to prevent spam."""
        now = datetime.utcnow()

        # Check if we recently sent this alert
        if alert_key in self._last_alerts:
            last_alert_time = self._last_alerts[alert_key]
            if now - last_alert_time < self.alert_cooldown:
                return  # Skip, still in cooldown

        # Send the alert
        if self.notifications:
            try:
                await self.notifications.send_notification(
                    level=level,
                    title=title,
                    message=message
                )
                self._last_alerts[alert_key] = now
                logger.info(f"Sent health alert: {title}")
            except Exception as e:
                logger.error(f"Failed to send health alert: {e}")

    def get_metrics(self) -> Dict[str, Any]:
        """
        Get current health metrics.

        Returns:
            Dictionary with CPU, memory, disk, network, and uptime metrics
        """
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()

        # Memory metrics
        memory = psutil.virtual_memory()
        memory_gb_used = memory.used / (1024 ** 3)
        memory_gb_total = memory.total / (1024 ** 3)

        # Disk metrics (for root partition)
        disk = psutil.disk_usage('/')
        disk_gb_used = disk.used / (1024 ** 3)
        disk_gb_total = disk.total / (1024 ** 3)

        # Network connections
        connections = len(psutil.net_connections())

        # Process-specific metrics
        process_memory = self._process.memory_info()
        process_memory_mb = process_memory.rss / (1024 ** 2)
        process_cpu_percent = self._process.cpu_percent()

        # Uptime
        uptime_seconds = (datetime.utcnow() - self._start_time).total_seconds()
        uptime_hours = uptime_seconds / 3600

        # System info
        system_info = {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "hostname": platform.node(),
            "python_version": platform.python_version()
        }

        return {
            "timestamp": datetime.utcnow().isoformat(),
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "process_percent": process_cpu_percent
            },
            "memory": {
                "percent": memory.percent,
                "used_gb": memory_gb_used,
                "total_gb": memory_gb_total,
                "available_gb": memory.available / (1024 ** 3),
                "process_mb": process_memory_mb
            },
            "disk": {
                "percent": disk.percent,
                "used_gb": disk_gb_used,
                "total_gb": disk_gb_total,
                "free_gb": disk.free / (1024 ** 3)
            },
            "network": {
                "connections": connections
            },
            "uptime": {
                "seconds": uptime_seconds,
                "hours": uptime_hours,
                "start_time": self._start_time.isoformat()
            },
            "system": system_info,
            "status": self._get_overall_status(cpu_percent, memory.percent, disk.percent)
        }

    def _get_overall_status(self, cpu_percent: float, memory_percent: float, disk_percent: float) -> str:
        """Determine overall health status."""
        if disk_percent > self.disk_threshold:
            return "critical"
        elif cpu_percent > self.cpu_threshold or memory_percent > self.memory_threshold:
            return "warning"
        else:
            return "healthy"
