"""Scheduler Service for managing playback schedules."""

import logging
from datetime import datetime, time, timedelta
from typing import Optional, List, Dict, Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.content import ContentType
from app.models.schedule import ScheduleSlot, ScheduleConfig, GenreHourMapping

logger = logging.getLogger(__name__)


class SchedulerService:
    """
    Service for managing and querying playback schedules.

    Handles time slot rules, genre-hour mappings, and schedule conflicts.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._config: Optional[ScheduleConfig] = None

    async def get_config(self) -> ScheduleConfig:
        """Get or load schedule configuration."""
        if self._config is None:
            config_doc = await self.db.schedule_config.find_one({"_id": "default"})
            if config_doc:
                self._config = ScheduleConfig(**config_doc)
            else:
                self._config = ScheduleConfig()
        return self._config

    async def refresh_config(self):
        """Force reload of configuration."""
        self._config = None
        await self.get_config()

    async def get_current_slot(self) -> Optional[Dict[str, Any]]:
        """
        Get the currently active schedule slot.

        Returns:
            Active slot or None if no slot matches
        """
        now = datetime.now()
        current_time = now.strftime("%H:%M")
        current_day = now.weekday()

        # Find matching slots, sorted by priority
        cursor = self.db.schedules.find({
            "enabled": True,
            "start_time": {"$lte": current_time},
            "end_time": {"$gt": current_time},
            "$or": [
                {"day_of_week": "all"},
                {"day_of_week": {"$in": [current_day]}}
            ]
        }).sort("priority", -1)

        async for slot in cursor:
            slot["_id"] = str(slot["_id"])
            return slot

        return None

    async def get_slots_for_time(
        self,
        target_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get all slots active at a specific time.

        Args:
            target_time: The time to check

        Returns:
            List of matching slots
        """
        time_str = target_time.strftime("%H:%M")
        day = target_time.weekday()

        cursor = self.db.schedules.find({
            "enabled": True,
            "start_time": {"$lte": time_str},
            "end_time": {"$gt": time_str},
            "$or": [
                {"day_of_week": "all"},
                {"day_of_week": {"$in": [day]}}
            ]
        }).sort("priority", -1)

        slots = []
        async for slot in cursor:
            slot["_id"] = str(slot["_id"])
            slots.append(slot)

        return slots

    async def get_genre_for_hour(self, hour: int) -> Optional[str]:
        """
        Get the preferred genre for a specific hour.

        Args:
            hour: Hour of the day (0-23)

        Returns:
            Genre name or None
        """
        config = await self.get_config()

        for mapping in config.genre_hour_mappings:
            if mapping.hour == hour:
                # Return first genre (could be weighted random)
                return mapping.genres[0] if mapping.genres else None

        return None

    async def get_upcoming_slots(
        self,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get schedule slots for the upcoming hours.

        Args:
            hours: Number of hours to look ahead

        Returns:
            List of upcoming slots with calculated times
        """
        now = datetime.now()
        end_time = now + timedelta(hours=hours)
        upcoming = []

        # Get all enabled slots
        cursor = self.db.schedules.find({"enabled": True}).sort([
            ("priority", -1),
            ("start_time", 1)
        ])

        async for slot in cursor:
            slot["_id"] = str(slot["_id"])

            # Calculate next occurrence
            next_occurrence = self._calculate_next_occurrence(
                slot, now, end_time
            )
            if next_occurrence:
                slot["next_occurrence"] = next_occurrence.isoformat()
                upcoming.append(slot)

        # Sort by next occurrence
        upcoming.sort(key=lambda x: x.get("next_occurrence", ""))
        return upcoming

    def _calculate_next_occurrence(
        self,
        slot: dict,
        after: datetime,
        before: datetime
    ) -> Optional[datetime]:
        """Calculate the next occurrence of a slot."""
        start_time = datetime.strptime(slot["start_time"], "%H:%M").time()
        days = slot["day_of_week"]

        if days == "all":
            days = list(range(7))

        current = after
        while current < before:
            if current.weekday() in days:
                slot_start = datetime.combine(current.date(), start_time)
                if slot_start > after:
                    return slot_start
            current += timedelta(days=1)

        return None

    async def check_for_conflicts(
        self,
        new_slot: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Check if a new slot conflicts with existing slots.

        Args:
            new_slot: The slot to check

        Returns:
            List of conflicting slots
        """
        conflicts = []

        # Find overlapping time slots
        cursor = self.db.schedules.find({
            "enabled": True,
            "$or": [
                {
                    "start_time": {"$lt": new_slot["end_time"]},
                    "end_time": {"$gt": new_slot["start_time"]}
                }
            ]
        })

        async for existing in cursor:
            # Check day overlap
            new_days = new_slot.get("day_of_week", "all")
            existing_days = existing.get("day_of_week", "all")

            if new_days == "all" or existing_days == "all":
                has_day_overlap = True
            else:
                new_set = set(new_days) if isinstance(new_days, list) else {new_days}
                existing_set = set(existing_days) if isinstance(existing_days, list) else {existing_days}
                has_day_overlap = bool(new_set & existing_set)

            if has_day_overlap:
                existing["_id"] = str(existing["_id"])
                conflicts.append(existing)

        return conflicts

    async def should_play_commercial(self) -> bool:
        """
        Check if it's time for a commercial break.

        Returns:
            True if commercial should be inserted
        """
        config = await self.get_config()

        # Get last commercial play time from logs
        last_commercial = await self.db.playback_logs.find_one(
            {"content_type": ContentType.COMMERCIAL.value},
            sort=[("started_at", -1)]
        )

        if not last_commercial:
            return True

        last_time = last_commercial.get("started_at", datetime.min)
        elapsed = (datetime.utcnow() - last_time).total_seconds() / 60

        return elapsed >= config.commercial_interval_minutes

    async def get_content_type_for_now(self) -> ContentType:
        """
        Determine what type of content should play now.

        Returns:
            ContentType based on schedule and rules
        """
        # Check for commercial break
        if await self.should_play_commercial():
            return ContentType.COMMERCIAL

        # Check schedule slots
        current_slot = await self.get_current_slot()
        if current_slot:
            return ContentType(current_slot["content_type"])

        # Default to songs
        return ContentType.SONG
