"""Commercial Scheduler Service - intelligent ad scheduling based on campaigns."""

import logging
from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.commercial_campaign import (
    CampaignStatus,
    slot_index_to_time,
    time_to_slot_index,
)

logger = logging.getLogger(__name__)


class CommercialSchedulerService:
    """
    Service that determines which commercials to play based on campaign schedules.

    Features:
    - Gets commercials for the current time slot based on active campaigns
    - Respects priority ordering (higher priority plays first)
    - Tracks plays to ensure scheduled counts are met
    - Provides preview of daily schedules
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        """
        Initialize the scheduler.

        Args:
            db: MongoDB database
        """
        self.db = db

    async def get_commercials_for_slot(
        self,
        target_datetime: Optional[datetime] = None,
        max_duration_seconds: Optional[int] = None,
        max_count: Optional[int] = None,
        include_campaign_types: Optional[List[str]] = None,
        exclude_campaign_types: Optional[List[str]] = None,
        bypass_play_limit: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Get commercials to play for the current (or specified) time slot.

        Algorithm:
        1. Determine current slot (day_of_week, slot_index) from datetime
        2. Find all active campaigns where:
           - today is within start_date/end_date range
           - schedule_grid has play_count > 0 for this slot
        3. Sort by priority (descending)
        4. For each campaign, check already-played counts for today
        5. Return content refs for campaigns that still need plays

        Args:
            target_datetime: When to check (defaults to now)
            max_duration_seconds: Cap total duration of returned commercials
            max_count: Cap number of commercials returned
            include_campaign_types: Only include these campaign types
            exclude_campaign_types: Exclude these campaign types
            bypass_play_limit: If True, ignore already-played counts (for manual triggers)

        Returns:
            List of content dicts ready for playback
        """
        if target_datetime is None:
            target_datetime = datetime.now()

        target_date = target_datetime.date()
        slot_date = target_date.isoformat()
        slot_index = time_to_slot_index(target_datetime.hour, target_datetime.minute)

        logger.debug(f"Getting commercials for slot {slot_index} ({slot_index_to_time(slot_index)}) on {slot_date}")

        # Find active campaigns for this date
        query = {
            "status": CampaignStatus.ACTIVE.value,
            "start_date": {"$lte": target_date.isoformat()},
            "end_date": {"$gte": target_date.isoformat()},
        }

        # Apply type filters
        if include_campaign_types:
            query["campaign_type"] = {"$in": include_campaign_types}
        elif exclude_campaign_types:
            query["campaign_type"] = {"$nin": exclude_campaign_types}

        cursor = self.db.commercial_campaigns.find(query).sort("priority", -1)

        commercials_to_play = []
        total_duration = 0

        async for campaign in cursor:
            campaign_id = str(campaign["_id"])

            # Check if this campaign has plays scheduled for this slot (by date)
            schedule_grid = campaign.get("schedule_grid", [])
            scheduled_plays = 0
            for slot in schedule_grid:
                if slot["slot_date"] == slot_date and slot["slot_index"] == slot_index:
                    scheduled_plays = slot["play_count"]
                    break

            if scheduled_plays == 0:
                continue

            # Check how many times already played today for this slot
            # (skip this check if bypassing play limit for manual triggers)
            if bypass_play_limit:
                remaining_plays = scheduled_plays
            else:
                already_played = await self.db.commercial_play_logs.count_documents({
                    "campaign_id": campaign_id,
                    "slot_date": target_date.isoformat(),
                    "slot_index": slot_index,
                })

                remaining_plays = scheduled_plays - already_played
                if remaining_plays <= 0:
                    continue

            # Get content for this campaign
            content_refs = campaign.get("content_refs", [])
            if not content_refs:
                logger.warning(f"Campaign {campaign['name']} has no content")
                continue

            # Add ALL commercials for the campaign, repeated by remaining_plays
            # play_count means "play all campaign commercials this many times"
            hit_cap = False
            for play_num in range(remaining_plays):
                for content_ref in content_refs:
                    # Resolve content
                    content = await self._resolve_content_ref(content_ref)
                    if not content:
                        continue

                    # Check duration cap
                    content_duration = content.get("duration_seconds", 30)
                    if max_duration_seconds and total_duration + content_duration > max_duration_seconds:
                        logger.debug(f"Stopping: would exceed max duration of {max_duration_seconds}s")
                        hit_cap = True
                        break

                    # Add to results
                    commercials_to_play.append({
                        "campaign_id": campaign_id,
                        "campaign_name": campaign.get("name", "Unknown"),
                        "campaign_type": campaign.get("campaign_type", ""),
                        "priority": campaign.get("priority", 5),
                        "content": content,
                        "slot_index": slot_index,
                        "slot_date": slot_date,
                    })

                    total_duration += content_duration

                    # Check count cap
                    if max_count and len(commercials_to_play) >= max_count:
                        logger.debug(f"Reached max count of {max_count}")
                        hit_cap = True
                        break

                if hit_cap:
                    break

            # Check if we've hit caps
            if max_count and len(commercials_to_play) >= max_count:
                break
            if max_duration_seconds and total_duration >= max_duration_seconds:
                break

        logger.info(f"Found {len(commercials_to_play)} commercials for slot {slot_index_to_time(slot_index)}")
        return commercials_to_play

    async def _resolve_content_ref(self, content_ref: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Resolve a content reference to actual content.

        Args:
            content_ref: Content reference with content_id or file info

        Returns:
            Content dict ready for playback, or None if not found
        """
        # Library content
        if content_ref.get("content_id"):
            try:
                content = await self.db.content.find_one({
                    "_id": ObjectId(content_ref["content_id"]),
                    "active": True,
                })
                if content:
                    content["_id"] = str(content["_id"])
                    return content
            except Exception as e:
                logger.error(f"Error resolving content_id: {e}")
                return None

        # Campaign-specific file
        if content_ref.get("file_google_drive_id") or content_ref.get("file_local_path"):
            return {
                "_id": f"campaign_file_{content_ref.get('file_google_drive_id', '')}",
                "type": "commercial",
                "title": content_ref.get("file_title", "Campaign Commercial"),
                "duration_seconds": content_ref.get("file_duration_seconds", 30),
                "google_drive_id": content_ref.get("file_google_drive_id"),
                "local_cache_path": content_ref.get("file_local_path"),
            }

        return None

    async def record_play(
        self,
        campaign_id: str,
        content_id: str,
        slot_index: int,
        slot_date: str,
        triggered_by: str = "scheduler",
        flow_id: Optional[str] = None,
    ) -> str:
        """
        Record a commercial playback in the logs.

        Args:
            campaign_id: ID of the campaign
            content_id: ID of the content played
            slot_index: Time slot index (0-47)
            slot_date: Date string (YYYY-MM-DD)
            triggered_by: What triggered the playback
            flow_id: Optional flow ID if triggered by a flow

        Returns:
            ID of the created log entry
        """
        log_entry = {
            "campaign_id": campaign_id,
            "content_id": content_id,
            "played_at": datetime.utcnow(),
            "slot_date": slot_date,
            "slot_index": slot_index,
            "triggered_by": triggered_by,
            "flow_id": flow_id,
        }

        result = await self.db.commercial_play_logs.insert_one(log_entry)
        logger.info(f"Recorded commercial play for campaign {campaign_id}")
        return str(result.inserted_id)

    async def get_daily_preview(
        self,
        target_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        """
        Generate a preview of what commercials will play on a given date.

        Args:
            target_date: Date to preview (defaults to today)

        Returns:
            Preview dict with slots and scheduled commercials
        """
        if target_date is None:
            target_date = date.today()

        slot_date_str = target_date.isoformat()
        day_of_week = (target_date.weekday() + 1) % 7

        # Find all active campaigns for this date
        query = {
            "status": CampaignStatus.ACTIVE.value,
            "start_date": {"$lte": slot_date_str},
            "end_date": {"$gte": slot_date_str},
        }

        cursor = self.db.commercial_campaigns.find(query).sort("priority", -1)

        # Build slots map
        slots_map: Dict[int, List[Dict[str, Any]]] = {}

        async for campaign in cursor:
            campaign_id = str(campaign["_id"])
            campaign_name = campaign.get("name", "Unknown")
            campaign_type = campaign.get("campaign_type", "")
            priority = campaign.get("priority", 5)
            content_refs = campaign.get("content_refs", [])

            # Get schedule grid for this specific date
            grid = campaign.get("schedule_grid", [])
            for slot in grid:
                if slot["slot_date"] == slot_date_str and slot["play_count"] > 0:
                    slot_idx = slot["slot_index"]
                    if slot_idx not in slots_map:
                        slots_map[slot_idx] = []

                    slots_map[slot_idx].append({
                        "campaign_id": campaign_id,
                        "name": campaign_name,
                        "campaign_type": campaign_type,
                        "priority": priority,
                        "play_count": slot["play_count"],
                        "content_count": len(content_refs),
                    })

        # Convert to sorted list
        slots = []
        for slot_idx in sorted(slots_map.keys()):
            # Sort by priority (highest first)
            commercials = sorted(slots_map[slot_idx], key=lambda x: -x["priority"])
            slots.append({
                "slot_index": slot_idx,
                "time": slot_index_to_time(slot_idx),
                "commercials": commercials,
            })

        return {
            "date": slot_date_str,
            "day_of_week": day_of_week,
            "total_slots": len(slots),
            "total_campaigns": len(set(c["campaign_id"] for s in slots for c in s["commercials"])),
            "slots": slots,
        }

    async def get_remaining_plays_for_slot(
        self,
        campaign_id: str,
        target_date: date,
        slot_index: int,
    ) -> int:
        """
        Check how many more times a campaign should play in a slot.

        Args:
            campaign_id: ID of the campaign
            target_date: Date to check
            slot_index: Time slot index (0-47)

        Returns:
            Number of remaining plays needed
        """
        try:
            campaign = await self.db.commercial_campaigns.find_one({
                "_id": ObjectId(campaign_id)
            })
        except Exception:
            return 0

        if not campaign:
            return 0

        slot_date_str = target_date.isoformat()

        # Find scheduled plays for this slot by date
        scheduled_plays = 0
        for slot in campaign.get("schedule_grid", []):
            if slot["slot_date"] == slot_date_str and slot["slot_index"] == slot_index:
                scheduled_plays = slot["play_count"]
                break

        # Count already played
        already_played = await self.db.commercial_play_logs.count_documents({
            "campaign_id": campaign_id,
            "slot_date": slot_date_str,
            "slot_index": slot_index,
        })

        return max(0, scheduled_plays - already_played)

    async def get_campaign_stats(self, campaign_id: str) -> Dict[str, Any]:
        """
        Get comprehensive stats for a campaign.

        Args:
            campaign_id: ID of the campaign

        Returns:
            Stats dict with play counts and scheduled info
        """
        try:
            campaign = await self.db.commercial_campaigns.find_one({
                "_id": ObjectId(campaign_id)
            })
        except Exception:
            return {"error": "Invalid campaign ID"}

        if not campaign:
            return {"error": "Campaign not found"}

        today = date.today()
        today_str = today.isoformat()

        # Total plays ever
        total_plays = await self.db.commercial_play_logs.count_documents({
            "campaign_id": campaign_id
        })

        # Today's plays
        today_plays = await self.db.commercial_play_logs.count_documents({
            "campaign_id": campaign_id,
            "slot_date": today_str,
        })

        # Scheduled for today (by date)
        scheduled_today = 0
        for slot in campaign.get("schedule_grid", []):
            if slot["slot_date"] == today_str:
                scheduled_today += slot["play_count"]

        # Total scheduled (all dates in schedule grid)
        total_scheduled = sum(
            slot["play_count"] for slot in campaign.get("schedule_grid", [])
        )

        # Days active
        start_date = date.fromisoformat(campaign["start_date"])
        end_date = date.fromisoformat(campaign["end_date"])
        days_total = (end_date - start_date).days + 1
        days_elapsed = max(0, (today - start_date).days + 1)
        days_remaining = max(0, (end_date - today).days + 1)

        return {
            "campaign_id": campaign_id,
            "name": campaign["name"],
            "status": campaign["status"],
            "total_plays": total_plays,
            "plays_today": today_plays,
            "scheduled_today": scheduled_today,
            "remaining_today": max(0, scheduled_today - today_plays),
            "total_scheduled": total_scheduled,
            "content_count": len(campaign.get("content_refs", [])),
            "days_total": days_total,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "completion_rate": round(today_plays / scheduled_today * 100, 1) if scheduled_today > 0 else 0,
        }

    async def get_jingle_settings(self) -> Dict[str, Any]:
        """
        Get the global jingle settings for commercial playback.

        Returns:
            Dict with opening and closing jingle settings
        """
        settings = await self.db.settings.find_one({"type": "commercial_jingle"})
        if not settings:
            return {
                "use_opening_jingle": False,
                "opening_jingle_id": None,
                "use_closing_jingle": False,
                "closing_jingle_id": None,
                # Legacy support
                "use_jingle": False,
                "jingle_id": None,
            }
        return {
            "use_opening_jingle": settings.get("use_opening_jingle", settings.get("use_jingle", False)),
            "opening_jingle_id": settings.get("opening_jingle_id", settings.get("jingle_id")),
            "use_closing_jingle": settings.get("use_closing_jingle", settings.get("use_jingle", False)),
            "closing_jingle_id": settings.get("closing_jingle_id", settings.get("jingle_id")),
            # Legacy support
            "use_jingle": settings.get("use_jingle", False),
            "jingle_id": settings.get("jingle_id"),
        }

    async def save_jingle_settings(
        self,
        use_opening_jingle: bool,
        opening_jingle_id: Optional[str],
        use_closing_jingle: bool,
        closing_jingle_id: Optional[str]
    ) -> None:
        """
        Save the global jingle settings for commercial playback.

        Args:
            use_opening_jingle: Whether to add jingle before commercials
            opening_jingle_id: ID of the opening jingle
            use_closing_jingle: Whether to add jingle after commercials
            closing_jingle_id: ID of the closing jingle
        """
        await self.db.settings.update_one(
            {"type": "commercial_jingle"},
            {"$set": {
                "type": "commercial_jingle",
                "use_opening_jingle": use_opening_jingle,
                "opening_jingle_id": opening_jingle_id,
                "use_closing_jingle": use_closing_jingle,
                "closing_jingle_id": closing_jingle_id,
                "updated_at": datetime.utcnow(),
            }},
            upsert=True
        )

    async def get_jingle_content(self, jingle_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch jingle content by ID.

        Args:
            jingle_id: ID of the jingle

        Returns:
            Jingle content dict or None
        """
        try:
            jingle = await self.db.content.find_one({"_id": ObjectId(jingle_id)})
            if jingle:
                jingle["_id"] = str(jingle["_id"])
                return jingle
        except Exception as e:
            logger.warning(f"Failed to fetch jingle {jingle_id}: {e}")
        return None

    def wrap_with_jingles(
        self,
        commercials: List[Dict[str, Any]],
        opening_jingle: Optional[Dict[str, Any]] = None,
        closing_jingle: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Wrap a list of commercial queue items with optional opening and closing jingles.

        Args:
            commercials: List of commercial queue items
            opening_jingle: Jingle content to add before commercials (optional)
            closing_jingle: Jingle content to add after commercials (optional)

        Returns:
            List with optional jingles at start and end
        """
        if not commercials:
            return commercials

        result = []

        # Add opening jingle if provided
        if opening_jingle:
            result.append({
                "_id": opening_jingle["_id"],
                "title": opening_jingle.get("title", "Jingle"),
                "artist": opening_jingle.get("artist"),
                "type": "jingle",
                "duration_seconds": opening_jingle.get("duration_seconds", 5),
                "genre": opening_jingle.get("genre"),
                "metadata": opening_jingle.get("metadata", {}),
                "commercial_jingle": True,
                "jingle_position": "opening",
            })

        # Add commercials
        result.extend(commercials)

        # Add closing jingle if provided
        if closing_jingle:
            result.append({
                "_id": closing_jingle["_id"],
                "title": closing_jingle.get("title", "Jingle"),
                "artist": closing_jingle.get("artist"),
                "type": "jingle",
                "duration_seconds": closing_jingle.get("duration_seconds", 5),
                "genre": closing_jingle.get("genre"),
                "metadata": closing_jingle.get("metadata", {}),
                "commercial_jingle": True,
                "jingle_position": "closing",
            })

        return result


# Singleton instance
_scheduler_instance: Optional[CommercialSchedulerService] = None


def get_scheduler(db: AsyncIOMotorDatabase) -> CommercialSchedulerService:
    """Get or create the scheduler singleton."""
    global _scheduler_instance
    if _scheduler_instance is None:
        _scheduler_instance = CommercialSchedulerService(db)
    return _scheduler_instance
