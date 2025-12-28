"""Google Calendar router for scheduling content."""

from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field

router = APIRouter()


class ScheduleEventRequest(BaseModel):
    """Request body for scheduling content to calendar."""
    content_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    description: Optional[str] = None
    recurrence: Optional[str] = None  # daily, weekly, monthly, yearly
    recurrence_count: Optional[int] = None
    recurrence_until: Optional[datetime] = None
    recurrence_days: Optional[List[str]] = None  # MO, TU, WE, etc.
    recurrence_interval: Optional[int] = 1
    reminder_minutes: Optional[int] = 30
    reminder_method: Optional[str] = "popup"  # popup, email, sms
    all_day: bool = False


class UpdateEventRequest(BaseModel):
    """Request body for updating a calendar event."""
    summary: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None


class CalendarEvent(BaseModel):
    """Calendar event response."""
    id: str
    summary: str
    start: datetime
    end: datetime
    description: Optional[str] = None
    content_id: Optional[str] = None
    content_type: Optional[str] = None
    html_link: Optional[str] = None


@router.get("/events", response_model=List[dict])
async def list_calendar_events(
    request: Request,
    days: int = Query(default=7, ge=1, le=365),
    content_type: Optional[str] = None
):
    """
    List upcoming calendar events.

    Args:
        days: Number of days ahead to list events (1-365)
        content_type: Filter by content type (song, commercial, show)
    """
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    time_min = datetime.now()
    time_max = time_min + timedelta(days=days)

    try:
        events = await calendar_service.list_radio_events(time_min, time_max)

        # Filter by content type if specified
        if content_type:
            events = [
                e for e in events
                if e.get("extendedProperties", {})
                    .get("private", {})
                    .get("radio_content_type") == content_type
            ]

        return events

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/today", response_model=List[dict])
async def get_today_schedule(request: Request):
    """Get today's scheduled content."""
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    try:
        events = await calendar_service.get_schedule_for_day(datetime.now())
        return events

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/day/{date}", response_model=List[dict])
async def get_day_schedule(request: Request, date: str):
    """
    Get scheduled content for a specific day.

    Args:
        date: Date in YYYY-MM-DD format
    """
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    try:
        target_date = datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    try:
        events = await calendar_service.get_schedule_for_day(target_date)
        return events

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/events/{event_id}", response_model=dict)
async def get_calendar_event(request: Request, event_id: str):
    """Get a specific calendar event by ID."""
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    try:
        event = await calendar_service.get_event(event_id)

        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        return event

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/events", response_model=dict)
async def create_calendar_event(request: Request, event_data: ScheduleEventRequest):
    """
    Schedule content to Google Calendar.

    Creates a calendar event for the specified content with all
    available options including recurrence, reminders, and more.
    """
    calendar_service = getattr(request.app.state, 'calendar_service', None)
    db = request.app.state.db

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    # Get the content
    from bson import ObjectId
    try:
        content = await db.content.find_one({"_id": ObjectId(event_data.content_id)})
    except:
        content = None

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Build recurrence settings
    recurrence = None
    if event_data.recurrence:
        recurrence = {
            "frequency": event_data.recurrence.upper(),
            "interval": event_data.recurrence_interval or 1
        }
        if event_data.recurrence_count:
            recurrence["count"] = event_data.recurrence_count
        if event_data.recurrence_until:
            recurrence["until"] = event_data.recurrence_until.isoformat()
        if event_data.recurrence_days:
            recurrence["by_day"] = event_data.recurrence_days

    # Build reminders
    reminders = None
    if event_data.reminder_minutes:
        reminders = [{
            "method": event_data.reminder_method or "popup",
            "minutes": event_data.reminder_minutes
        }]

    try:
        event = await calendar_service.schedule_content(
            content=content,
            start_time=event_data.start_time,
            end_time=event_data.end_time,
            recurrence=recurrence,
            reminders=reminders,
            description=event_data.description
        )

        return event

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/events/{event_id}", response_model=dict)
async def update_calendar_event(
    request: Request,
    event_id: str,
    update_data: UpdateEventRequest
):
    """Update a calendar event."""
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    update_params = {}
    if update_data.summary:
        update_params["summary"] = update_data.summary
    if update_data.description:
        update_params["description"] = update_data.description
    if update_data.start_time:
        update_params["start_time"] = update_data.start_time
    if update_data.end_time:
        update_params["end_time"] = update_data.end_time
    if update_data.all_day is not None:
        update_params["all_day"] = update_data.all_day

    if not update_params:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        event = await calendar_service.update_event(event_id, **update_params)
        return event

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/events/{event_id}")
async def delete_calendar_event(request: Request, event_id: str):
    """Delete a calendar event."""
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    try:
        success = await calendar_service.delete_event(event_id)

        if success:
            return {"message": "Event deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete event")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/week", response_model=dict)
async def get_week_schedule(
    request: Request,
    start_date: Optional[str] = None
):
    """
    Get schedule for a week, organized by day.

    Args:
        start_date: Start of week in YYYY-MM-DD format (defaults to today)

    Returns:
        Dict with days as keys and events as values
    """
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(
            status_code=503,
            detail="Google Calendar service not configured"
        )

    if start_date:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    # Add extra day buffer to account for timezone differences
    # Events in evening local time are stored as next day UTC
    end = start + timedelta(days=8)

    try:
        events = await calendar_service.list_radio_events(start, end)

        # Organize by day
        week_schedule = {}
        for i in range(7):
            day = start + timedelta(days=i)
            day_key = day.strftime("%Y-%m-%d")
            week_schedule[day_key] = {
                "date": day_key,
                "day_name": day.strftime("%A"),
                "day_name_he": ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][day.weekday()],
                "events": []
            }

        for event in events:
            start_str = event.get("start", {}).get("dateTime", event.get("start", {}).get("date", ""))
            if start_str:
                if "T" in start_str:
                    event_date = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                    # Convert to local time for correct day assignment
                    if event_date.tzinfo:
                        event_date = event_date.astimezone().replace(tzinfo=None)
                else:
                    event_date = datetime.strptime(start_str, "%Y-%m-%d")

                day_key = event_date.strftime("%Y-%m-%d")
                if day_key in week_schedule:
                    week_schedule[day_key]["events"].append(event)

        return week_schedule

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
