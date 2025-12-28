"""Flow Monitor Service - intelligent real-time flow scheduling using AI agent."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)


class FlowMonitorService:
    """
    Background service that monitors active flows and uses the AI agent
    to make intelligent scheduling decisions in real-time.

    Key features:
    - Monitors active looping flows that are within their scheduled time window
    - Tracks elapsed playback time per flow
    - Checks clock for commercial insertion times (e.g., on the hour)
    - Uses AI agent to decide when to insert commercials or switch content
    - Ensures commercials play at actual clock times, not just queue positions
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        audio_player=None,
        orchestrator_agent=None,
        check_interval: int = 30,
    ):
        """
        Initialize flow monitor.

        Args:
            db: MongoDB database
            audio_player: AudioPlayerService instance
            orchestrator_agent: OrchestratorAgent for AI decisions
            check_interval: Seconds between checks (default 30)
        """
        self.db = db
        self.audio_player = audio_player
        self.orchestrator_agent = orchestrator_agent
        self.check_interval = check_interval

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._last_check: Optional[datetime] = None

        # Track flow state per flow
        # Key: flow_id, Value: { last_commercial_time, actions_played, etc. }
        self._flow_states: Dict[str, Dict[str, Any]] = {}

        # Track last commercial insertion times by batch
        self._last_commercial_by_batch: Dict[int, datetime] = {}

    async def start(self):
        """Start the flow monitor background task."""
        if self._running:
            logger.warning("Flow monitor already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        logger.info(f"Flow monitor started (checking every {self.check_interval}s)")

    async def stop(self):
        """Stop the flow monitor."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Flow monitor stopped")

    async def _monitor_loop(self):
        """Main monitoring loop - runs continuously."""
        while self._running:
            try:
                await self._check_active_flows()
                self._last_check = datetime.now()
            except Exception as e:
                logger.error(f"Error in flow monitor: {e}", exc_info=True)

            await asyncio.sleep(self.check_interval)

    async def _check_active_flows(self):
        """Check active looping flows and manage their scheduling."""
        now = datetime.now()
        current_time_str = now.strftime("%H:%M")
        current_day = now.weekday()
        # Convert Python weekday (0=Monday) to our format (0=Sunday)
        current_day_of_week = (current_day + 1) % 7

        # Find active flows that are looping and within their schedule window
        flows = await self.db.flows.find({
            "status": {"$in": ["active", "running"]},
            "loop": True,
            "schedule": {"$exists": True}
        }).to_list(None)

        for flow in flows:
            flow_id = str(flow["_id"])
            schedule = flow.get("schedule", {})

            # Check if flow is within its time window
            in_window = self._is_in_schedule_window(schedule, current_time_str, current_day_of_week, now)
            if not in_window:
                # Flow is outside its window, clean up state
                if flow_id in self._flow_states:
                    logger.info(f"Flow '{flow.get('name')}' exited schedule window, stopping monitoring")
                    del self._flow_states[flow_id]
                continue

            # Initialize flow state if needed
            if flow_id not in self._flow_states:
                self._flow_states[flow_id] = {
                    "started_at": now,
                    "last_action_time": None,
                    "actions_completed": 0,
                    "last_commercial_check": now,
                }
                logger.info(f"Started monitoring flow '{flow.get('name')}' ({flow_id})")

            # Check if it's time for commercial breaks
            await self._check_commercial_timing(flow, now)

    def _is_in_schedule_window(
        self,
        schedule: Dict[str, Any],
        current_time_str: str,
        current_day_of_week: int,
        now: datetime
    ) -> bool:
        """Check if current time is within the flow's schedule window."""
        recurrence = schedule.get("recurrence", "weekly")

        if recurrence == "none":
            # One-time event with full datetime
            start_dt_str = schedule.get("start_datetime")
            end_dt_str = schedule.get("end_datetime")

            if not start_dt_str or not end_dt_str:
                return False

            try:
                start_dt = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_dt_str.replace('Z', '+00:00'))

                # Make naive for comparison if needed
                if start_dt.tzinfo is not None:
                    start_dt = start_dt.replace(tzinfo=None)
                if end_dt.tzinfo is not None:
                    end_dt = end_dt.replace(tzinfo=None)

                return start_dt <= now <= end_dt
            except (ValueError, TypeError):
                return False
        else:
            # Recurring event with time of day
            start_time = schedule.get("start_time")
            end_time = schedule.get("end_time")
            days_of_week = schedule.get("days_of_week", [0, 1, 2, 3, 4, 5, 6])

            if not start_time or not end_time:
                return False

            # Check day of week (empty list means all days, especially for daily recurrence)
            if days_of_week and current_day_of_week not in days_of_week:
                return False

            # Check time window
            # Handle overnight schedules (e.g., 22:00 - 02:00)
            if end_time < start_time:
                # Overnight schedule
                return current_time_str >= start_time or current_time_str <= end_time
            else:
                return start_time <= current_time_str <= end_time

    async def _check_commercial_timing(self, flow: dict, now: datetime):
        """
        Check if it's time to insert commercials based on flow actions and clock.

        This analyzes the flow's actions to understand when commercials should play:
        - "on the hour" -> at XX:00
        - "on the half hour" -> at XX:30
        - "every 30 minutes" -> every 30 minutes from flow start
        - batch-specific timing based on action descriptions
        """
        flow_id = str(flow["_id"])
        flow_state = self._flow_states.get(flow_id, {})
        actions = flow.get("actions", [])

        current_minute = now.minute
        current_hour = now.hour

        for idx, action in enumerate(actions):
            action_type = action.get("action_type")
            if action_type != "play_commercials":
                continue

            description = (action.get("description") or "").lower()
            batch_number = action.get("batch_number")

            # Determine when this commercial action should trigger
            should_trigger = False
            trigger_reason = ""

            # Check for "on the hour" pattern
            if "on the hour" in description or "every hour" in description:
                # Trigger at XX:00 (with 2-minute window)
                if current_minute <= 2:
                    # Check if we already triggered this hour
                    last_hourly = self._last_commercial_by_batch.get(batch_number or 0)
                    if not last_hourly or (now - last_hourly).total_seconds() > 3000:  # 50 min buffer
                        should_trigger = True
                        trigger_reason = f"hourly commercial at {current_hour}:00"

            # Check for "on the half hour" pattern
            elif "half hour" in description or "half-hour" in description:
                # Trigger at XX:30 (with 2-minute window)
                if 28 <= current_minute <= 32:
                    last_half = self._last_commercial_by_batch.get(batch_number or 100)
                    if not last_half or (now - last_half).total_seconds() > 1500:  # 25 min buffer
                        should_trigger = True
                        trigger_reason = f"half-hour commercial at {current_hour}:30"

            # Check for "every X minutes" pattern
            elif "every" in description:
                import re
                match = re.search(r'every\s+(\d+)\s*(?:min|minutes?)', description)
                if match:
                    interval_minutes = int(match.group(1))
                    flow_start = flow_state.get("started_at", now)
                    elapsed = (now - flow_start).total_seconds() / 60

                    # Check if we've passed an interval boundary
                    last_interval = self._last_commercial_by_batch.get(batch_number or 200)
                    if not last_interval or (now - last_interval).total_seconds() > (interval_minutes - 2) * 60:
                        intervals_passed = int(elapsed / interval_minutes)
                        if intervals_passed > 0 and elapsed % interval_minutes < 2:
                            should_trigger = True
                            trigger_reason = f"interval commercial (every {interval_minutes} min)"

            if should_trigger:
                logger.info(f"Flow '{flow.get('name')}': Time to insert commercials - {trigger_reason}")
                await self._insert_commercials(flow, action, trigger_reason)

                # Record the insertion time
                self._last_commercial_by_batch[batch_number or 0] = now

    async def _insert_commercials(self, flow: dict, action: dict, reason: str):
        """
        Insert commercials into the queue at the appropriate position.

        If AI agent is available, ask for confirmation/decision.
        Otherwise, execute directly.
        """
        flow_name = flow.get("name", "Unknown Flow")
        batch_number = action.get("batch_number")
        commercial_count = action.get("commercial_count", 1)

        # Try AI agent first, fall back to direct execution if it fails
        if self.orchestrator_agent:
            try:
                # Create a chat message to ask the agent
                prompt = f"""Insert commercial break now for flow "{flow_name}".
Batch number: {batch_number if batch_number else 'all'}
Reason: {reason}

Execute INSERT_COMMERCIAL task with batch_number={batch_number}."""

                result = await self.orchestrator_agent.chat(prompt)
                response = result.get('response', '')
                logger.info(f"AI agent response for commercial insertion: {response[:200]}")

                # Check if agent successfully executed (look for success indicators)
                if 'commercial' in response.lower() and ('inserted' in response.lower() or 'added' in response.lower() or 'queued' in response.lower()):
                    logger.info("AI agent successfully inserted commercials")
                    return
                else:
                    logger.warning("AI agent did not confirm commercial insertion, falling back to direct execution")

            except Exception as e:
                logger.error(f"AI agent error, falling back to direct execution: {e}")

        # Direct execution without AI agent
        logger.info(f"Executing direct commercial insertion: batch={batch_number}, count={commercial_count}")
        await self._execute_commercial_insertion(batch_number, commercial_count)

    async def _execute_commercial_insertion(self, batch_number: Optional[int], repeat_count: int):
        """Execute commercial insertion directly."""
        from app.routers.playback import add_to_queue, get_queue
        from app.routers.websocket import broadcast_queue_update

        try:
            # Fetch commercials
            if batch_number:
                commercials = await self.db.content.find({
                    "type": "commercial",
                    "active": True,
                    "batches": batch_number
                }).to_list(100)
            else:
                commercials = await self.db.content.find({
                    "type": "commercial",
                    "active": True
                }).to_list(100)

            if not commercials:
                logger.warning(f"No commercials found for batch {batch_number}")
                return

            # Insert commercials at the front of the queue (priority position)
            logger.info(f"Inserting {len(commercials)} commercials (repeat: {repeat_count})")

            all_commercials = []
            repeat = repeat_count if repeat_count else 1
            for _ in range(min(repeat, 10)):  # Safety limit
                all_commercials.extend(commercials)

            # Add to the backend queue at high priority (front of queue)
            for idx, commercial in enumerate(all_commercials):
                # Insert at position idx to maintain order at front
                add_to_queue({
                    "_id": str(commercial["_id"]),
                    "title": commercial.get("title", "Commercial"),
                    "artist": commercial.get("artist"),
                    "type": "commercial",
                    "duration_seconds": commercial.get("duration_seconds", 0),
                    "genre": commercial.get("genre"),
                    "metadata": commercial.get("metadata", {}),
                    "batches": commercial.get("batches", [])
                }, position=idx)  # This will insert at front

            # Broadcast queue update
            await broadcast_queue_update(get_queue())

            # Log the insertion
            await self.db.playback_logs.insert_one({
                "type": "commercial_insertion",
                "batch_number": batch_number,
                "count": len(all_commercials),
                "triggered_by": "flow_monitor",
                "timestamp": datetime.utcnow()
            })

            logger.info(f"Successfully inserted {len(all_commercials)} commercials into queue")

        except Exception as e:
            logger.error(f"Failed to insert commercials: {e}", exc_info=True)

    def get_status(self) -> Dict[str, Any]:
        """Get monitor status."""
        return {
            "running": self._running,
            "last_check": self._last_check.isoformat() if self._last_check else None,
            "active_flows": len(self._flow_states),
            "flow_states": {
                fid: {
                    "started_at": state.get("started_at").isoformat() if state.get("started_at") else None,
                    "actions_completed": state.get("actions_completed", 0)
                }
                for fid, state in self._flow_states.items()
            },
            "check_interval": self.check_interval
        }
