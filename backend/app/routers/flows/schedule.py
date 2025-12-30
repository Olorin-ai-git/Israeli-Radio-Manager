"""Schedule overlap checking for flows."""

import logging
from datetime import datetime, timedelta, time as dt_time, timezone
from typing import List

from bson import ObjectId

logger = logging.getLogger(__name__)


async def check_schedule_overlap(db, new_schedule: dict, exclude_flow_id: str = None) -> List[dict]:
    """
    Check if a schedule overlaps with any existing active flows.
    Returns a list of conflicting flows.
    """
    if not new_schedule:
        return []

    # Get all active scheduled flows (excluding the one being edited)
    query = {
        "trigger_type": "scheduled",
        "status": {"$in": ["active", "running"]},
        "schedule": {"$exists": True}
    }
    if exclude_flow_id:
        query["_id"] = {"$ne": ObjectId(exclude_flow_id)}

    existing_flows = await db.flows.find(query).to_list(None)

    new_recurrence = new_schedule.get("recurrence", "none")

    # Check if this is a datetime-based (one-time/multi-day) or time-based (recurring) schedule
    is_datetime_based = new_recurrence == "none"

    if is_datetime_based:
        return await _check_datetime_overlap(new_schedule, existing_flows)
    else:
        return await _check_recurring_overlap(new_schedule, existing_flows)


async def _check_datetime_overlap(new_schedule: dict, existing_flows: list) -> List[dict]:
    """Check overlap for datetime-based (one-time) schedules."""
    new_start_dt_str = new_schedule.get("start_datetime")
    new_end_dt_str = new_schedule.get("end_datetime")

    if not new_start_dt_str or not new_end_dt_str:
        return []

    new_start_dt = datetime.fromisoformat(new_start_dt_str.replace('Z', '+00:00'))
    new_end_dt = datetime.fromisoformat(new_end_dt_str.replace('Z', '+00:00'))

    conflicting_flows = []

    for flow in existing_flows:
        schedule = flow.get("schedule", {})
        existing_recurrence = schedule.get("recurrence", "none")

        if existing_recurrence == "none":
            # Both are one-time events - check datetime overlap
            existing_start_dt_str = schedule.get("start_datetime")
            existing_end_dt_str = schedule.get("end_datetime")

            if existing_start_dt_str and existing_end_dt_str:
                existing_start_dt = datetime.fromisoformat(existing_start_dt_str.replace('Z', '+00:00'))
                existing_end_dt = datetime.fromisoformat(existing_end_dt_str.replace('Z', '+00:00'))

                # Check datetime overlap
                if not (new_end_dt <= existing_start_dt or new_start_dt >= existing_end_dt):
                    conflicting_flows.append({
                        "_id": str(flow["_id"]),
                        "name": flow.get("name"),
                        "schedule": schedule
                    })
        else:
            # Existing is recurring, new is one-time
            conflict = _check_onetime_vs_recurring(
                new_start_dt, new_end_dt, schedule, flow
            )
            if conflict:
                conflicting_flows.append(conflict)

    return conflicting_flows


def _check_onetime_vs_recurring(
    new_start_dt: datetime,
    new_end_dt: datetime,
    existing_schedule: dict,
    flow: dict
) -> dict | None:
    """Check if a one-time event conflicts with a recurring schedule."""
    existing_days = set(existing_schedule.get("days_of_week", []))
    existing_start_time = existing_schedule.get("start_time")
    existing_end_time = existing_schedule.get("end_time")

    if not existing_days or not existing_start_time:
        return None

    # Check each day in the one-time event's range
    current_date = new_start_dt.date()
    end_date = new_end_dt.date()

    while current_date <= end_date:
        # Check if this day of week matches recurring schedule
        if current_date.weekday() in existing_days:
            existing_start_parts = existing_start_time.split(":")
            existing_start_combined = datetime.combine(
                current_date,
                dt_time(int(existing_start_parts[0]), int(existing_start_parts[1]))
            )

            if existing_end_time:
                existing_end_parts = existing_end_time.split(":")
                existing_end_combined = datetime.combine(
                    current_date,
                    dt_time(int(existing_end_parts[0]), int(existing_end_parts[1]))
                )
            else:
                existing_end_combined = datetime.combine(current_date, dt_time(23, 59, 59))

            # Make timezone aware if needed
            if new_start_dt.tzinfo:
                existing_start_combined = existing_start_combined.replace(tzinfo=new_start_dt.tzinfo)
                existing_end_combined = existing_end_combined.replace(tzinfo=new_end_dt.tzinfo)

            # Check if there's overlap on this day
            if not (new_end_dt <= existing_start_combined or new_start_dt >= existing_end_combined):
                return {
                    "_id": str(flow["_id"]),
                    "name": flow.get("name"),
                    "schedule": existing_schedule
                }

        current_date += timedelta(days=1)

    return None


async def _check_recurring_overlap(new_schedule: dict, existing_flows: list) -> List[dict]:
    """Check overlap for recurring schedules."""
    new_start = new_schedule.get("start_time")
    new_end = new_schedule.get("end_time")
    new_recurrence = new_schedule.get("recurrence", "weekly")
    new_days_of_week = set(new_schedule.get("days_of_week", []))
    new_day_of_month = new_schedule.get("day_of_month")
    new_month = new_schedule.get("month")

    if not new_start or not new_end:
        return []

    # Parse time strings to minutes for comparison
    def time_to_minutes(time_str):
        h, m = map(int, time_str.split(':'))
        return h * 60 + m

    new_start_min = time_to_minutes(new_start)
    new_end_min = time_to_minutes(new_end)

    # Handle overnight flows
    if new_end_min < new_start_min:
        new_end_min += 24 * 60

    conflicting_flows = []

    for flow in existing_flows:
        schedule = flow.get("schedule", {})
        existing_recurrence = schedule.get("recurrence", "none")

        # Check against one-time events
        if existing_recurrence == "none":
            conflict = _check_recurring_vs_onetime(
                new_start, new_end, new_days_of_week, schedule, flow
            )
            if conflict:
                conflicting_flows.append(conflict)
            continue

        existing_start = schedule.get("start_time")
        existing_end = schedule.get("end_time")
        existing_days_of_week = set(schedule.get("days_of_week", []))
        existing_day_of_month = schedule.get("day_of_month")
        existing_month = schedule.get("month")

        if not existing_start or not existing_end:
            continue

        existing_start_min = time_to_minutes(existing_start)
        existing_end_min = time_to_minutes(existing_end)

        if existing_end_min < existing_start_min:
            existing_end_min += 24 * 60

        # Check if time ranges overlap
        times_overlap = not (new_end_min <= existing_start_min or new_start_min >= existing_end_min)

        if not times_overlap:
            continue

        # Check if recurrence patterns overlap
        recurrence_overlaps = _check_recurrence_overlap(
            new_recurrence, new_days_of_week, new_day_of_month, new_month,
            existing_recurrence, existing_days_of_week, existing_day_of_month, existing_month
        )

        if recurrence_overlaps:
            conflicting_flows.append({
                "_id": str(flow["_id"]),
                "name": flow.get("name"),
                "schedule": schedule
            })

    return conflicting_flows


def _check_recurring_vs_onetime(
    new_start: str,
    new_end: str,
    new_days_of_week: set,
    existing_schedule: dict,
    flow: dict
) -> dict | None:
    """Check if a recurring schedule conflicts with a one-time event."""
    existing_start_dt_str = existing_schedule.get("start_datetime")
    existing_end_dt_str = existing_schedule.get("end_datetime")

    if not existing_start_dt_str or not existing_end_dt_str:
        return None

    existing_start_dt = datetime.fromisoformat(existing_start_dt_str.replace('Z', '+00:00'))
    existing_end_dt = datetime.fromisoformat(existing_end_dt_str.replace('Z', '+00:00'))

    # Check if any day in the one-time event matches our recurring days
    current_date = existing_start_dt.date()
    end_date = existing_end_dt.date()

    while current_date <= end_date:
        if current_date.weekday() in new_days_of_week:
            # This day matches - check if times overlap
            new_start_parts = new_start.split(":")
            new_start_combined = datetime.combine(
                current_date,
                dt_time(int(new_start_parts[0]), int(new_start_parts[1]))
            )

            if new_end:
                new_end_parts = new_end.split(":")
                new_end_combined = datetime.combine(
                    current_date,
                    dt_time(int(new_end_parts[0]), int(new_end_parts[1]))
                )
            else:
                new_end_combined = datetime.combine(current_date, dt_time(23, 59, 59))

            # Make timezone aware if needed
            if existing_start_dt.tzinfo:
                new_start_combined = new_start_combined.replace(tzinfo=existing_start_dt.tzinfo)
                new_end_combined = new_end_combined.replace(tzinfo=existing_end_dt.tzinfo)

            # Check overlap
            if not (existing_end_dt <= new_start_combined or existing_start_dt >= new_end_combined):
                return {
                    "_id": str(flow["_id"]),
                    "name": flow.get("name"),
                    "schedule": existing_schedule
                }

        current_date += timedelta(days=1)

    return None


def _check_recurrence_overlap(
    new_recurrence: str,
    new_days_of_week: set,
    new_day_of_month: int | None,
    new_month: int | None,
    existing_recurrence: str,
    existing_days_of_week: set,
    existing_day_of_month: int | None,
    existing_month: int | None
) -> bool:
    """Check if two recurrence patterns overlap."""
    # Daily recurrence always overlaps with daily
    if new_recurrence == "daily" and existing_recurrence == "daily":
        return True

    # Weekly: check if any days overlap
    if new_recurrence == "weekly" and existing_recurrence == "weekly":
        if new_days_of_week & existing_days_of_week:  # Intersection
            return True

    # Daily overlaps with weekly on all weekly days
    if (new_recurrence == "daily" and existing_recurrence == "weekly") or \
       (new_recurrence == "weekly" and existing_recurrence == "daily"):
        return True

    # Monthly: check if same day of month
    if new_recurrence == "monthly" and existing_recurrence == "monthly":
        if new_day_of_month == existing_day_of_month:
            return True

    # Yearly: check if same month and day
    if new_recurrence == "yearly" and existing_recurrence == "yearly":
        if new_month == existing_month and new_day_of_month == existing_day_of_month:
            return True

    return False
