"""Calendar sync helpers for flows."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from app.services.google_calendar import GoogleCalendarService

logger = logging.getLogger(__name__)

# Day name mapping for recurrence rules
DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']


async def sync_flow_to_calendar(
    flow_id: str,
    flow_name: str,
    flow_description: str,
    schedule: dict,
    existing_event_id: str = None
) -> Optional[str]:
    """
    Create or update a Google Calendar event for a scheduled flow.
    Returns the calendar event ID.
    """
    try:
        calendar_service = GoogleCalendarService()
        await calendar_service.authenticate()

        recurrence_type = schedule.get("recurrence", "weekly")

        # Event summary with flow emoji
        summary = f"🔄 {flow_name}"

        # Event description
        description = f"Auto Flow: {flow_name}\n"
        if flow_description:
            description += f"\n{flow_description}\n"
        description += f"\nFlow ID: {flow_id}\nType: flow"

        if recurrence_type == "none":
            # One-time/multi-day event with datetime
            start_dt_str = schedule.get("start_datetime")
            end_dt_str = schedule.get("end_datetime")

            if not start_dt_str or not end_dt_str:
                logger.error("One-time flow missing start_datetime or end_datetime")
                return None

            start_dt = datetime.fromisoformat(start_dt_str.replace('Z', '+00:00'))
            end_dt = datetime.fromisoformat(end_dt_str.replace('Z', '+00:00'))

            if existing_event_id:
                try:
                    event = await calendar_service.update_event(
                        event_id=existing_event_id,
                        summary=summary,
                        start_time=start_dt,
                        end_time=end_dt,
                        description=description,
                        recurrence=None  # No recurrence for one-time events
                    )
                    logger.info(f"Updated calendar event for flow {flow_name}: {existing_event_id}")
                    return existing_event_id
                except Exception as e:
                    logger.warning(f"Failed to update event, creating new: {e}")

            event = await calendar_service.create_event(
                summary=summary,
                start_time=start_dt,
                end_time=end_dt,
                description=description,
                content_type="flow",
                content_id=flow_id,
                recurrence=None
            )

            event_id = event.get("id")
            logger.info(f"Created calendar event for one-time flow {flow_name}: {event_id}")
            return event_id

        else:
            # Recurring event with time of day
            start_time_str = schedule.get("start_time")
            end_time_str = schedule.get("end_time")
            recurrence_type = schedule.get("recurrence", "weekly")

            if not start_time_str or not end_time_str:
                logger.error("Recurring flow missing start_time or end_time")
                return None

            days_of_week = schedule.get("days_of_week", [0, 1, 2, 3, 4, 5, 6])
            day_of_month = schedule.get("day_of_month")
            month = schedule.get("month")

            # Calculate next occurrence
            now = datetime.now()
            hour, minute = map(int, start_time_str.split(":"))
            start_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

            # If time has passed today, start tomorrow
            if start_dt < now:
                start_dt += timedelta(days=1)

            # Find next valid day based on recurrence type
            if recurrence_type == "weekly":
                # Convert Sunday=0 to Python's Monday=0 format
                python_days = [(d + 6) % 7 for d in days_of_week]
                while start_dt.weekday() not in python_days:
                    start_dt += timedelta(days=1)
            elif recurrence_type == "monthly":
                # Find next occurrence of the day_of_month
                if day_of_month:
                    while start_dt.day != day_of_month:
                        start_dt += timedelta(days=1)
            elif recurrence_type == "yearly":
                # Find next occurrence of the month and day
                if month and day_of_month:
                    while start_dt.month != month or start_dt.day != day_of_month:
                        start_dt += timedelta(days=1)
            # For daily, no need to adjust - any day works

            # Calculate end time
            end_hour, end_minute = map(int, end_time_str.split(":"))
            end_dt = start_dt.replace(hour=end_hour, minute=end_minute)
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)

            # Build recurrence rule based on recurrence type
            recurrence = None
            if recurrence_type == "daily":
                recurrence = {
                    "frequency": "DAILY"
                }
            elif recurrence_type == "weekly":
                recurrence = {
                    "frequency": "WEEKLY",
                    "by_day": [DAY_NAMES[d] for d in days_of_week]
                }
            elif recurrence_type == "monthly":
                recurrence = {
                    "frequency": "MONTHLY",
                    "by_month_day": day_of_month
                }
            elif recurrence_type == "yearly":
                recurrence = {
                    "frequency": "YEARLY",
                    "by_month": month,
                    "by_month_day": day_of_month
                }

            if existing_event_id:
                try:
                    event = await calendar_service.update_event(
                        event_id=existing_event_id,
                        summary=summary,
                        start_time=start_dt,
                        end_time=end_dt,
                        description=description,
                        recurrence=recurrence
                    )
                    logger.info(f"Updated calendar event for flow {flow_name}: {existing_event_id}")
                    return existing_event_id
                except Exception as e:
                    logger.warning(f"Failed to update event, creating new: {e}")

            event = await calendar_service.create_event(
                summary=summary,
                start_time=start_dt,
                end_time=end_dt,
                description=description,
                content_type="flow",
                content_id=flow_id,
                recurrence=recurrence
            )

            event_id = event.get("id")
            logger.info(f"Created calendar event for recurring flow {flow_name}: {event_id}")
            return event_id

    except Exception as e:
        logger.error(f"Failed to sync flow to calendar: {e}")
        return None


async def delete_flow_calendar_event(event_id: str) -> bool:
    """Delete a calendar event for a flow."""
    try:
        calendar_service = GoogleCalendarService()
        await calendar_service.authenticate()
        await calendar_service.delete_event(event_id)
        logger.info(f"Deleted calendar event: {event_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete calendar event: {e}")
        return False
