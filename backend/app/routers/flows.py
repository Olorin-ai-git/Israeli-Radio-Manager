"""Auto Flows router for managing automated workflows."""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from app.models.flow import (
    AutoFlow,
    FlowCreate,
    FlowUpdate,
    FlowStatus,
    FlowAction,
    FlowActionType,
    FlowExecutionLog,
    FlowTriggerType
)
from app.routers.websocket import broadcast_scheduled_playback, broadcast_queue_tracks, broadcast_queue_update
from app.routers.playback import add_to_queue as add_to_backend_queue, get_queue as get_backend_queue
from app.services.google_calendar import GoogleCalendarService
import random

logger = logging.getLogger(__name__)
router = APIRouter()

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


def serialize_flow(flow: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if flow:
        flow["_id"] = str(flow["_id"])
    return flow


@router.get("/", response_model=List[dict])
async def list_flows(
    request: Request,
    status: Optional[FlowStatus] = None,
    limit: int = 50
):
    """List all auto flows."""
    db = request.app.state.db

    query = {}
    if status:
        query["status"] = status.value

    cursor = db.flows.find(query).sort("priority", -1).limit(limit)

    flows = []
    async for flow in cursor:
        flows.append(serialize_flow(flow))

    return flows


@router.get("/active", response_model=List[dict])
async def list_active_flows(request: Request):
    """List only active flows that can run."""
    db = request.app.state.db

    cursor = db.flows.find({
        "status": {"$in": [FlowStatus.ACTIVE.value, FlowStatus.RUNNING.value]}
    }).sort("priority", -1)

    flows = []
    async for flow in cursor:
        flows.append(serialize_flow(flow))

    return flows


@router.get("/{flow_id}", response_model=dict)
async def get_flow(request: Request, flow_id: str):
    """Get a specific flow by ID."""
    db = request.app.state.db

    try:
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    return serialize_flow(flow)


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
        # Datetime-based schedule
        new_start_dt_str = new_schedule.get("start_datetime")
        new_end_dt_str = new_schedule.get("end_datetime")

        if not new_start_dt_str or not new_end_dt_str:
            return []

        from datetime import datetime as dt
        new_start_dt = dt.fromisoformat(new_start_dt_str.replace('Z', '+00:00'))
        new_end_dt = dt.fromisoformat(new_end_dt_str.replace('Z', '+00:00'))

        conflicting_flows = []

        for flow in existing_flows:
            schedule = flow.get("schedule", {})
            existing_recurrence = schedule.get("recurrence", "none")

            if existing_recurrence == "none":
                # Both are one-time events - check datetime overlap
                existing_start_dt_str = schedule.get("start_datetime")
                existing_end_dt_str = schedule.get("end_datetime")

                if existing_start_dt_str and existing_end_dt_str:
                    existing_start_dt = dt.fromisoformat(existing_start_dt_str.replace('Z', '+00:00'))
                    existing_end_dt = dt.fromisoformat(existing_end_dt_str.replace('Z', '+00:00'))

                    # Check datetime overlap
                    if not (new_end_dt <= existing_start_dt or new_start_dt >= existing_end_dt):
                        conflicting_flows.append({
                            "_id": str(flow["_id"]),
                            "name": flow.get("name"),
                            "schedule": schedule
                        })
            else:
                # Existing is recurring, new is one-time
                # Check if the one-time event falls within recurring event times
                # For simplicity, we'll check if any day in the one-time range matches
                # This is a conservative check
                pass  # TODO: Implement cross-type overlap detection if needed

        return conflicting_flows

    else:
        # Time-based recurring schedule
        new_start = new_schedule.get("start_time")
        new_end = new_schedule.get("end_time")
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

            # Skip one-time events when checking recurring
            if existing_recurrence == "none":
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

            # Now check if recurrence patterns overlap
            recurrence_overlaps = False

            # Daily recurrence always overlaps with daily
            if new_recurrence == "daily" and existing_recurrence == "daily":
                recurrence_overlaps = True

            # Weekly: check if any days overlap
            elif new_recurrence == "weekly" and existing_recurrence == "weekly":
                if new_days_of_week & existing_days_of_week:  # Intersection
                    recurrence_overlaps = True

            # Daily overlaps with weekly on all weekly days
            elif (new_recurrence == "daily" and existing_recurrence == "weekly") or \
                 (new_recurrence == "weekly" and existing_recurrence == "daily"):
                recurrence_overlaps = True

            # Monthly: check if same day of month
            elif new_recurrence == "monthly" and existing_recurrence == "monthly":
                if new_day_of_month == existing_day_of_month:
                    recurrence_overlaps = True

            # Yearly: check if same month and day
            elif new_recurrence == "yearly" and existing_recurrence == "yearly":
                if new_month == existing_month and new_day_of_month == existing_day_of_month:
                    recurrence_overlaps = True

            if recurrence_overlaps:
                conflicting_flows.append({
                    "_id": str(flow["_id"]),
                    "name": flow.get("name"),
                    "schedule": schedule
                })

        return conflicting_flows


@router.post("/", response_model=dict)
async def create_flow(request: Request, flow_data: FlowCreate):
    """Create a new auto flow."""
    db = request.app.state.db

    # Log incoming schedule data
    if flow_data.schedule:
        logger.info(f"Creating flow with schedule: start_time={flow_data.schedule.start_time}, end_time={flow_data.schedule.end_time}, recurrence={flow_data.schedule.recurrence}")

    # Check for schedule overlaps if this is a scheduled flow
    if flow_data.trigger_type == FlowTriggerType.SCHEDULED and flow_data.schedule:
        schedule_data = flow_data.schedule.model_dump()
        conflicts = await check_schedule_overlap(db, schedule_data)
        if conflicts:
            conflict_names = [f["name"] for f in conflicts]
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Schedule overlaps with existing flows",
                    "conflicting_flows": conflicts
                }
            )

    # Build flow document
    schedule_data = flow_data.schedule.model_dump() if flow_data.schedule else None

    flow_doc = {
        "name": flow_data.name,
        "name_he": flow_data.name_he,
        "description": flow_data.description,
        "description_he": flow_data.description_he,
        "actions": [action.model_dump() for action in flow_data.actions],
        "trigger_type": flow_data.trigger_type.value,
        "schedule": schedule_data,
        "status": FlowStatus.ACTIVE.value,
        "priority": flow_data.priority,
        "loop": flow_data.loop,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_run": None,
        "run_count": 0
    }

    result = await db.flows.insert_one(flow_doc)
    flow_id = str(result.inserted_id)
    flow_doc["_id"] = flow_id

    # If scheduled, create Google Calendar event
    if flow_data.trigger_type == FlowTriggerType.SCHEDULED and schedule_data:
        calendar_event_id = await sync_flow_to_calendar(
            flow_id=flow_id,
            flow_name=flow_data.name,
            flow_description=flow_data.description or "",
            schedule=schedule_data
        )
        if calendar_event_id:
            # Update flow with calendar event ID
            schedule_data["calendar_event_id"] = calendar_event_id
            await db.flows.update_one(
                {"_id": ObjectId(flow_id)},
                {"$set": {"schedule.calendar_event_id": calendar_event_id}}
            )
            flow_doc["schedule"] = schedule_data

    return flow_doc


@router.put("/{flow_id}", response_model=dict)
async def update_flow(request: Request, flow_id: str, update_data: FlowUpdate):
    """Update an existing flow."""
    db = request.app.state.db

    try:
        existing = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if not existing:
        raise HTTPException(status_code=404, detail="Flow not found")

    # Check for schedule overlaps if this is a scheduled flow
    if update_data.schedule is not None:
        new_trigger = update_data.trigger_type.value if update_data.trigger_type else existing.get("trigger_type")
        if new_trigger == "scheduled":
            schedule_data = update_data.schedule.model_dump()
            conflicts = await check_schedule_overlap(db, schedule_data, exclude_flow_id=flow_id)
            if conflicts:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "Schedule overlaps with existing flows",
                        "conflicting_flows": conflicts
                    }
                )

    # Build update document
    update_doc = {"updated_at": datetime.utcnow()}

    if update_data.name is not None:
        update_doc["name"] = update_data.name
    if update_data.name_he is not None:
        update_doc["name_he"] = update_data.name_he
    if update_data.description is not None:
        update_doc["description"] = update_data.description
    if update_data.description_he is not None:
        update_doc["description_he"] = update_data.description_he
    if update_data.actions is not None:
        update_doc["actions"] = [action.model_dump() for action in update_data.actions]
    if update_data.trigger_type is not None:
        update_doc["trigger_type"] = update_data.trigger_type.value
    if update_data.schedule is not None:
        update_doc["schedule"] = update_data.schedule.model_dump()
    if update_data.status is not None:
        update_doc["status"] = update_data.status.value
    if update_data.priority is not None:
        update_doc["priority"] = update_data.priority
    if update_data.loop is not None:
        update_doc["loop"] = update_data.loop

    await db.flows.update_one(
        {"_id": ObjectId(flow_id)},
        {"$set": update_doc}
    )

    updated = await db.flows.find_one({"_id": ObjectId(flow_id)})

    # Handle calendar sync for schedule changes
    new_trigger = update_data.trigger_type.value if update_data.trigger_type else existing.get("trigger_type")
    new_schedule = update_doc.get("schedule") or existing.get("schedule")
    existing_event_id = existing.get("schedule", {}).get("calendar_event_id") if existing.get("schedule") else None

    if new_trigger == "scheduled" and new_schedule:
        # If schedule changed, delete old event and create new one to ensure correct timezone
        if existing_event_id and update_data.schedule is not None:
            await delete_flow_calendar_event(existing_event_id)
            existing_event_id = None

        # Create or update calendar event
        calendar_event_id = await sync_flow_to_calendar(
            flow_id=flow_id,
            flow_name=update_doc.get("name", existing.get("name")),
            flow_description=update_doc.get("description", existing.get("description")) or "",
            schedule=new_schedule,
            existing_event_id=existing_event_id
        )
        if calendar_event_id:
            await db.flows.update_one(
                {"_id": ObjectId(flow_id)},
                {"$set": {"schedule.calendar_event_id": calendar_event_id}}
            )
            updated = await db.flows.find_one({"_id": ObjectId(flow_id)})
    elif new_trigger != "scheduled" and existing_event_id:
        # Trigger type changed from scheduled, delete calendar event
        await delete_flow_calendar_event(existing_event_id)
        await db.flows.update_one(
            {"_id": ObjectId(flow_id)},
            {"$unset": {"schedule.calendar_event_id": ""}}
        )

    return serialize_flow(updated)


@router.delete("/{flow_id}")
async def delete_flow(request: Request, flow_id: str):
    """Delete a flow."""
    db = request.app.state.db

    try:
        # Get flow first to check for calendar event
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")

        # Delete calendar event if exists
        schedule = flow.get("schedule")
        if schedule and schedule.get("calendar_event_id"):
            await delete_flow_calendar_event(schedule["calendar_event_id"])

        result = await db.flows.delete_one({"_id": ObjectId(flow_id)})
    except HTTPException:
        raise
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flow not found")

    return {"message": "Flow deleted", "flow_id": flow_id}


@router.post("/{flow_id}/toggle", response_model=dict)
async def toggle_flow_status(request: Request, flow_id: str):
    """Toggle flow between active and paused. Updates Google Calendar accordingly."""
    db = request.app.state.db
    calendar = request.app.state.google_calendar

    try:
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    current_status = flow.get("status", FlowStatus.ACTIVE.value)

    if current_status == FlowStatus.ACTIVE.value:
        new_status = FlowStatus.PAUSED.value
    elif current_status == FlowStatus.PAUSED.value:
        new_status = FlowStatus.ACTIVE.value
    else:
        new_status = FlowStatus.ACTIVE.value

    # Update database
    await db.flows.update_one(
        {"_id": ObjectId(flow_id)},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    # Update Google Calendar if flow is scheduled and has a calendar event ID
    calendar_event_id = flow.get("calendar_event_id")
    if calendar_event_id and flow.get("trigger_type") == "scheduled":
        try:
            if new_status == FlowStatus.PAUSED.value:
                # Delete the calendar event when paused
                await calendar.delete_event(calendar_event_id)
                logger.info(f"Deleted calendar event {calendar_event_id} for paused flow {flow_id}")

                # Remove calendar_event_id from flow
                await db.flows.update_one(
                    {"_id": ObjectId(flow_id)},
                    {"$unset": {"calendar_event_id": ""}}
                )
            else:
                # Re-create calendar event when re-enabled
                schedule = flow.get("schedule", {})
                if schedule:
                    event_data = await calendar.create_event(
                        title=f"Flow: {flow.get('name', 'Unnamed')}",
                        description=flow.get("description", ""),
                        start_time=schedule.get("start_time"),
                        end_time=schedule.get("end_time"),
                        recurrence=schedule.get("recurrence"),
                        days_of_week=schedule.get("days_of_week"),
                        day_of_month=schedule.get("day_of_month"),
                        month=schedule.get("month"),
                        metadata={"flow_id": str(flow_id), "type": "flow"}
                    )

                    if event_data:
                        # Store new calendar event ID
                        await db.flows.update_one(
                            {"_id": ObjectId(flow_id)},
                            {"$set": {"calendar_event_id": event_data["id"]}}
                        )
                        logger.info(f"Created calendar event {event_data['id']} for resumed flow {flow_id}")
        except Exception as e:
            logger.error(f"Failed to update calendar for flow {flow_id}: {e}")
            # Don't fail the toggle operation if calendar update fails

    return {"message": f"Flow status changed to {new_status}", "status": new_status}


@router.post("/{flow_id}/reset", response_model=dict)
async def reset_flow_status(request: Request, flow_id: str):
    """Reset a stuck flow status from 'running' to 'active'."""
    db = request.app.state.db

    flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    if flow.get("status") != "running":
        return {"message": "Flow is not in running state", "status": flow.get("status")}

    # Reset to active
    await db.flows.update_one(
        {"_id": ObjectId(flow_id)},
        {"$set": {"status": "active"}}
    )

    logger.info(f"Reset stuck flow {flow_id} from 'running' to 'active'")
    return {"message": "Flow status reset to active", "status": "active"}


@router.post("/resync-calendar")
async def resync_all_flows_to_calendar(request: Request):
    """Re-sync all active scheduled flows to Google Calendar."""
    db = request.app.state.db

    # Get all active scheduled flows
    flows = await db.flows.find({
        "trigger_type": "scheduled",
        "status": "active",
        "schedule": {"$exists": True}
    }).to_list(None)

    synced_count = 0
    errors = []

    for flow in flows:
        try:
            flow_id = str(flow["_id"])
            schedule = flow.get("schedule", {})
            existing_event_id = schedule.get("calendar_event_id")

            # Delete existing calendar event if it exists
            if existing_event_id:
                try:
                    calendar = GoogleCalendarService()
                    await calendar.authenticate()
                    await calendar.delete_event(existing_event_id)
                    logger.info(f"Deleted old calendar event {existing_event_id} for flow {flow_id}")
                except Exception as e:
                    logger.warning(f"Failed to delete old calendar event: {e}")

            # Create new calendar event with correct recurrence
            calendar_event_id = await sync_flow_to_calendar(
                flow_id=flow_id,
                flow_name=flow.get("name", "Unnamed Flow"),
                flow_description=flow.get("description", ""),
                schedule=schedule,
                existing_event_id=None  # Force create new event
            )

            if calendar_event_id:
                # Update flow with new calendar event ID
                await db.flows.update_one(
                    {"_id": ObjectId(flow_id)},
                    {"$set": {"schedule.calendar_event_id": calendar_event_id}}
                )
                synced_count += 1
                logger.info(f"Re-synced flow {flow_id} to calendar: {calendar_event_id}")
            else:
                errors.append(f"Failed to sync flow {flow.get('name')}")
        except Exception as e:
            logger.error(f"Error re-syncing flow {flow.get('name')}: {e}")
            errors.append(f"Error syncing {flow.get('name')}: {str(e)}")

    return {
        "message": f"Re-synced {synced_count} flows to calendar",
        "synced_count": synced_count,
        "total_flows": len(flows),
        "errors": errors
    }


async def run_flow_actions(db, flow: dict, audio_player=None) -> int:
    """
    Execute flow actions. Returns the number of actions completed.
    This function can be called from both the run_flow endpoint and the calendar watcher.
    """
    actions = flow.get("actions", [])
    actions_completed = 0
    is_first_playback_action = True  # Only first action should use scheduled_playback (playNow)

    for idx, action in enumerate(actions):
        action_type = action.get("action_type")
        logger.info(f"Action {idx+1}/{len(actions)}: {action_type}, is_first_playback_action={is_first_playback_action}")

        if action_type == FlowActionType.PLAY_GENRE.value:
            # Queue songs from the genre
            genre = action.get("genre")
            if genre:
                # Get recently queued/played songs by checking last_played timestamp
                one_hour_ago = datetime.utcnow() - timedelta(hours=1)

                # Get songs from this genre, excluding recently played
                query = {
                    "type": "song",
                    "active": True,
                    "$or": [
                        {"last_played": {"$lt": one_hour_ago}},
                        {"last_played": None},
                        {"last_played": {"$exists": False}}
                    ]
                }
                if genre != "mixed":
                    query["genre"] = genre

                songs = await db.content.find(query).to_list(100)

                # If not enough songs, fall back to all songs (excluding recently played)
                if len(songs) < 10:
                    query_fallback = {
                        "type": "song",
                        "active": True,
                        "$or": [
                            {"last_played": {"$lt": one_hour_ago}},
                            {"last_played": None},
                            {"last_played": {"$exists": False}}
                        ]
                    }
                    songs = await db.content.find(query_fallback).to_list(100)

                # If still not enough, just get any songs
                if len(songs) < 5:
                    songs = await db.content.find({
                        "type": "song",
                        "active": True
                    }).to_list(100)

                if songs:
                    # Determine how many songs to play
                    song_count = action.get("song_count")
                    duration_minutes = action.get("duration_minutes")
                    description = action.get("description", "")

                    # Try to extract song count from description if not explicitly set
                    if not song_count and description:
                        import re
                        # Match patterns like "play 2 songs", "2 songs", "play 3 שירים"
                        match = re.search(r'(\d+)\s*(?:songs?|שירים?)', description, re.IGNORECASE)
                        if match:
                            song_count = int(match.group(1))
                            logger.info(f"Extracted song_count={song_count} from description: {description}")

                    if song_count:
                        # Explicit song count
                        num_songs = min(song_count, len(songs))
                    elif duration_minutes:
                        # Calculate based on duration (assume ~4 min avg per song)
                        num_songs = min(max(1, duration_minutes // 4), len(songs))
                    else:
                        # Default to 10 songs
                        num_songs = min(10, len(songs))

                    # Shuffle and select unique songs
                    random.shuffle(songs)
                    selected_songs = songs[:num_songs]

                    # Update last_played for selected songs to avoid re-selection
                    for song in selected_songs:
                        await db.content.update_one(
                            {"_id": song["_id"]},
                            {"$set": {"last_played": datetime.utcnow()}}
                        )

                    if is_first_playback_action:
                        # First action: broadcast first song for immediate playback
                        first_song = selected_songs[0]
                        content_data = {
                            "_id": str(first_song["_id"]),
                            "title": first_song.get("title", "Unknown"),
                            "artist": first_song.get("artist"),
                            "type": first_song.get("type", "song"),
                            "duration_seconds": first_song.get("duration_seconds", 0),
                            "genre": first_song.get("genre"),
                            "metadata": first_song.get("metadata", {})
                        }
                        await broadcast_scheduled_playback(content_data)

                        # Queue remaining songs
                        if len(selected_songs) > 1:
                            for song in selected_songs[1:]:
                                add_to_backend_queue({
                                    "_id": str(song["_id"]),
                                    "title": song.get("title", "Unknown"),
                                    "artist": song.get("artist"),
                                    "type": song.get("type", "song"),
                                    "duration_seconds": song.get("duration_seconds", 0),
                                    "genre": song.get("genre"),
                                    "metadata": song.get("metadata", {}),
                                    "batches": song.get("batches", [])
                                })
                            await broadcast_queue_update(get_backend_queue())
                        is_first_playback_action = False
                    else:
                        # Subsequent actions: just queue all songs
                        for song in selected_songs:
                            add_to_backend_queue({
                                "_id": str(song["_id"]),
                                "title": song.get("title", "Unknown"),
                                "artist": song.get("artist"),
                                "type": song.get("type", "song"),
                                "duration_seconds": song.get("duration_seconds", 0),
                                "genre": song.get("genre"),
                                "metadata": song.get("metadata", {}),
                                "batches": song.get("batches", [])
                            })
                        await broadcast_queue_update(get_backend_queue())

                    # Also add to VLC queue if available
                    if audio_player:
                        for song in selected_songs:
                            from app.services.audio_player import TrackInfo
                            track = TrackInfo(
                                content_id=str(song["_id"]),
                                title=song.get("title", "Unknown"),
                                artist=song.get("artist"),
                                duration_seconds=song.get("duration_seconds", 0),
                                file_path=song.get("local_cache_path", ""),
                                content_type="song"
                            )
                            audio_player.add_to_queue(track)

        elif action_type == FlowActionType.PLAY_COMMERCIALS.value:
            # Get repeat count (how many times to play the commercial set)
            # Safety limit: max 10 repeats to prevent queue explosion
            repeat_count = min(action.get("commercial_count") or 1, 10)

            # Get batch number to filter by (1, 2, 3, etc.)
            batch_number = action.get("batch_number")
            description = action.get("description", "")

            # Try to extract batch number from description if not explicitly set
            if not batch_number and description:
                import re
                # Match patterns like "batch1", "batch-1", "batch 1", "batch-A", "Batch-B"
                match = re.search(r'batch[_\-\s]?(\d+)', description, re.IGNORECASE)
                if match:
                    batch_number = int(match.group(1))
                    logger.info(f"Extracted batch_number={batch_number} from description: {description}")
                else:
                    # Try letter patterns: "batch-A", "batch-B" -> 1, 2
                    match = re.search(r'batch[_\-\s]?([A-Za-z])\b', description, re.IGNORECASE)
                    if match:
                        letter = match.group(1).upper()
                        batch_number = ord(letter) - ord('A') + 1
                        logger.info(f"Extracted batch_number={batch_number} (from letter) from description: {description}")

            # Get specific commercial IDs if provided
            content_id = action.get("content_id")

            logger.info(f"Playing commercials - repeat_count: {repeat_count}, batch_number: {batch_number}, content_id: {content_id}")

            # Fetch commercials based on selection
            if content_id and content_id.strip():
                # Specific commercials selected (comma-separated IDs)
                commercial_ids = [id.strip() for id in content_id.split(',') if id.strip()]
                logger.info(f"Fetching specific commercials: {commercial_ids}")
                commercials = []
                for commercial_id in commercial_ids:
                    try:
                        commercial = await db.content.find_one({
                            "_id": ObjectId(commercial_id),
                            "type": "commercial",
                            "active": True
                        })
                        if commercial:
                            commercials.append(commercial)
                            logger.info(f"  Found commercial: {commercial.get('title')}")
                    except Exception as e:
                        logger.warning(f"  Failed to fetch commercial {commercial_id}: {e}")
            elif batch_number:
                # Filter by batch number - commercials have a "batches" array field
                logger.info(f"Fetching commercials for batch {batch_number}")
                commercials = await db.content.find({
                    "type": "commercial",
                    "active": True,
                    "batches": batch_number  # MongoDB matches if array contains value
                }).to_list(100)
                logger.info(f"  Found {len(commercials)} commercials in batch {batch_number}")
            else:
                # All commercials - get all active commercials
                logger.info("Fetching all active commercials")
                commercials = await db.content.find({
                    "type": "commercial",
                    "active": True
                }).to_list(100)
                logger.info(f"  Found {len(commercials)} commercials")

            # Repeat commercials for repeat count
            all_commercials = []
            for _ in range(repeat_count):
                all_commercials.extend(commercials)

            logger.info(f"Total commercials to play (after batch repeat): {len(all_commercials)}")

            if all_commercials:
                if is_first_playback_action:
                    # First action: broadcast first commercial for immediate playback
                    first_commercial = all_commercials[0]
                    content_data = {
                        "_id": str(first_commercial["_id"]),
                        "title": first_commercial.get("title", "Commercial"),
                        "artist": first_commercial.get("artist"),
                        "type": "commercial",
                        "duration_seconds": first_commercial.get("duration_seconds", 0),
                        "genre": first_commercial.get("genre"),
                        "metadata": first_commercial.get("metadata", {})
                    }
                    await broadcast_scheduled_playback(content_data)

                    # Queue remaining commercials
                    if len(all_commercials) > 1:
                        for commercial in all_commercials[1:]:
                            add_to_backend_queue({
                                "_id": str(commercial["_id"]),
                                "title": commercial.get("title", "Commercial"),
                                "artist": commercial.get("artist"),
                                "type": "commercial",
                                "duration_seconds": commercial.get("duration_seconds", 0),
                                "genre": commercial.get("genre"),
                                "metadata": commercial.get("metadata", {}),
                                "batches": commercial.get("batches", [])
                            })
                        await broadcast_queue_update(get_backend_queue())
                    is_first_playback_action = False
                else:
                    # Subsequent actions: just queue all commercials
                    for commercial in all_commercials:
                        add_to_backend_queue({
                            "_id": str(commercial["_id"]),
                            "title": commercial.get("title", "Commercial"),
                            "artist": commercial.get("artist"),
                            "type": "commercial",
                            "duration_seconds": commercial.get("duration_seconds", 0),
                            "genre": commercial.get("genre"),
                            "metadata": commercial.get("metadata", {}),
                            "batches": commercial.get("batches", [])
                        })
                    await broadcast_queue_update(get_backend_queue())

                # Also add to VLC queue if available
                if audio_player:
                    for commercial in all_commercials:
                        from app.services.audio_player import TrackInfo
                        track = TrackInfo(
                            content_id=str(commercial["_id"]),
                            title=commercial.get("title", "Commercial"),
                            artist=None,
                            duration_seconds=commercial.get("duration_seconds", 0),
                            file_path=commercial.get("local_cache_path", ""),
                            content_type="commercial"
                        )
                        audio_player.add_to_queue(track)  # Same priority as songs to preserve order

        elif action_type == FlowActionType.SET_VOLUME.value:
            volume = action.get("volume_level", 80)
            if audio_player:
                audio_player.set_volume(volume)

        actions_completed += 1

    return actions_completed


@router.post("/{flow_id}/run", response_model=dict)
async def run_flow(request: Request, flow_id: str):
    """Manually trigger a flow to run."""
    logger.info(f"=== RUN FLOW REQUESTED: {flow_id} ===")
    db = request.app.state.db
    audio_player = getattr(request.app.state, 'audio_player', None)

    try:
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

    # Log flow details for debugging
    logger.info(f"Flow name: {flow.get('name')}")
    logger.info(f"Flow description: {flow.get('description')}")
    logger.info(f"Flow actions: {flow.get('actions')}")

    # Create execution log
    execution_log = {
        "flow_id": flow_id,
        "flow_name": flow.get("name"),
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "status": "running",
        "actions_completed": 0,
        "total_actions": len(flow.get("actions", [])),
        "error_message": None,
        "triggered_by": "manual"
    }
    log_result = await db.flow_executions.insert_one(execution_log)
    execution_id = str(log_result.inserted_id)

    # Update flow status
    await db.flows.update_one(
        {"_id": ObjectId(flow_id)},
        {
            "$set": {"status": FlowStatus.RUNNING.value},
            "$inc": {"run_count": 1}
        }
    )

    # Execute flow actions
    try:
        # Check if flow should loop until end_time
        should_loop = flow.get("loop", False)
        end_time_str = flow.get("schedule", {}).get("end_time") if flow.get("schedule") else None

        total_actions_completed = 0
        loop_count = 0

        if should_loop and end_time_str:
            logger.info(f"Flow {flow_id} will loop until {end_time_str}")

            # Parse end time (datetime already imported at module level)
            end_hour, end_minute = map(int, end_time_str.split(':'))
            end_time = datetime.utcnow().replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)

            # If end time is earlier than current time, it's tomorrow
            if end_time < datetime.utcnow():
                end_time = end_time + timedelta(days=1)

            # Loop until end time
            while datetime.utcnow() < end_time:
                # Check queue size before adding more content
                queue_size = len(audio_player.get_queue()) if audio_player else 0

                # Only add more content if queue is running low (less than 5 items)
                if queue_size < 5:
                    loop_count += 1
                    logger.info(f"Flow {flow_id} - Loop iteration {loop_count} (queue has {queue_size} items)")

                    actions_completed = await run_flow_actions(db, flow, audio_player)
                    total_actions_completed += actions_completed
                else:
                    logger.debug(f"Flow {flow_id} - Queue has {queue_size} items, waiting...")

                # Delay between checks - longer when queue is full
                await asyncio.sleep(10 if queue_size >= 5 else 1)

                # Check if we've passed the end time
                if datetime.utcnow() >= end_time:
                    logger.info(f"Flow {flow_id} - Reached end time, stopping loop")
                    break

            logger.info(f"Flow {flow_id} - Completed {loop_count} loops with {total_actions_completed} total actions")
        else:
            # Single execution
            total_actions_completed = await run_flow_actions(db, flow, audio_player)

        # Mark as completed
        await db.flow_executions.update_one(
            {"_id": log_result.inserted_id},
            {
                "$set": {
                    "status": "completed",
                    "ended_at": datetime.utcnow(),
                    "actions_completed": total_actions_completed
                }
            }
        )

        # Update flow
        await db.flows.update_one(
            {"_id": ObjectId(flow_id)},
            {
                "$set": {
                    "status": FlowStatus.ACTIVE.value,
                    "last_run": datetime.utcnow()
                }
            }
        )

        return {
            "message": f"Flow '{flow.get('name')}' executed successfully",
            "execution_id": execution_id,
            "actions_completed": total_actions_completed
        }

    except Exception as e:
        # Mark as failed
        await db.flow_executions.update_one(
            {"_id": log_result.inserted_id},
            {
                "$set": {
                    "status": "failed",
                    "ended_at": datetime.utcnow(),
                    "error_message": str(e)
                }
            }
        )

        await db.flows.update_one(
            {"_id": ObjectId(flow_id)},
            {"$set": {"status": FlowStatus.ACTIVE.value}}
        )

        raise HTTPException(status_code=500, detail=f"Flow execution failed: {str(e)}")


@router.get("/{flow_id}/executions", response_model=List[dict])
async def get_flow_executions(request: Request, flow_id: str, limit: int = 20):
    """Get execution history for a flow."""
    db = request.app.state.db

    cursor = db.flow_executions.find(
        {"flow_id": flow_id}
    ).sort("started_at", -1).limit(limit)

    executions = []
    async for execution in cursor:
        execution["_id"] = str(execution["_id"])
        executions.append(execution)

    return executions


@router.post("/parse-natural", response_model=dict)
async def parse_natural_language_flow(request: Request, text: str):
    """
    Parse a natural language description into a flow using Claude AI.

    Example: "play hasidi music between 8-10 am, then play 2 commercials, then play mizrahi music"
    """
    import anthropic
    import json
    from app.config import settings

    # Use Claude API to parse the flow description
    actions = []

    if not settings.anthropic_api_key:
        logger.warning("ANTHROPIC_API_KEY not set, falling back to regex parsing")
        # Fall through to regex parsing below
    else:
        try:
            client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

            prompt = f"""Parse this radio flow description into structured actions. Return ONLY a JSON array of actions, no explanations.

Available action types:
- play_genre: Play music from a genre (hasidi, mizrahi, happy, israeli, pop, rock, mediterranean, classic, hebrew, all, mixed)
  * song_count: Exact number of songs to play (e.g., "play 1 song" -> song_count: 1, "play 5 songs" -> song_count: 5)
  * duration_minutes: Alternative to song_count - play songs for this duration (system calculates ~4 min/song)
  * If neither specified, defaults to 10 songs
- play_commercials: Play commercials. Support:
  * commercial_count: How many times to REPEAT the commercial set (default 1, max 10)
  * batch_number: (1, 2, 3, etc.) - refers to predefined commercial batches
  * To play ALL commercials once: set commercial_count to 1 or omit it (system fetches all active commercials)
  * If "Batch-1", "Batch-2" etc mentioned, set batch_number field
  * If "Play All Commercials" or "all commercial batches": generate MULTIPLE play_commercials actions, one for each batch (batch_number: 1, then batch_number: 2, then batch_number: 3)
- wait: Wait for a duration
- set_volume: Set volume level

Description: {text}

PARSING RULES:
1. If description mentions ALTERNATING patterns (e.g., "every 30 minutes", "on the hour do X, on the half-hour do Y"), create a sequence that can loop
2. For time-based patterns, create actions in the order they would execute in one cycle
3. Each commercial batch mention should be a SEPARATE action
4. IMPORTANT: After EVERY commercial action, add a music action to continue playing
5. If the last action is commercials, ALWAYS add a final music action so the loop is complete
6. If "repeat" or "loop" is mentioned, the flow should loop - still create the action sequence for one cycle

Examples:

Input: "Play 1 song, then all commercials, then continue playing music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "commercial_count": 1, "description": "Play all commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Input: "Play 3 happy songs, then 2 commercials, then mizrahi for 20 minutes"
Output:
[
  {{"action_type": "play_genre", "genre": "happy", "song_count": 3, "description": "Play 3 happy songs"}},
  {{"action_type": "play_commercials", "commercial_count": 2, "description": "Play 2 commercials"}},
  {{"action_type": "play_genre", "genre": "mizrahi", "duration_minutes": 20, "description": "Play mizrahi for 20 minutes"}}
]

Input: "Play music, every 30 min check time: on the hour play Batch-1 commercials, on half-hour play Batch-2 commercials, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Play music"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials (on the hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials (on half-hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}}
]

Input: "Play 1 song, then play all commercial batches, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 3, "description": "Play Batch-3 commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Now parse this description: {text}

Return the JSON array:"""

            response = client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )

            # Extract JSON from response
            response_text = response.content[0].text.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                lines = response_text.split("\n")
                response_text = "\n".join(lines[1:-1])
            if response_text.startswith("json"):
                response_text = response_text[4:].strip()

            actions = json.loads(response_text)
            logger.info(f"Claude parsed {len(actions)} actions from: {text}")

        except Exception as e:
            logger.error(f"Failed to parse with Claude: {e}")
            # Fall through to regex parsing below

    # Fallback to regex parsing if Claude failed or not configured
    if not actions:
        import re
        parts = re.split(r',\s*then\s*|,\s*אז\s*|,\s*ואז\s*', text, flags=re.IGNORECASE)

        # Genre mappings (Hebrew to English)
        genre_map = {
            "חסידי": "hasidi",
            "חסידית": "hasidi",
            "מזרחי": "mizrahi",
            "מזרחית": "mizrahi",
            "פופ": "pop",
            "רוק": "rock",
            "ים תיכוני": "mediterranean",
            "קלאסי": "classic",
            "עברי": "hebrew",
        }

        for part in parts:
            part = part.strip().lower()

            # Parse genre playback
            genre_match = re.search(
                r'(?:play|נגן|השמע)\s+(\w+)\s+(?:music|מוזיקה)?(?:\s+(?:between|from|בין|מ-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:-|to|עד)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|בבוקר|בערב)?)?(?:\s+for\s+(\d+)\s*(?:minutes?|min|דקות?))?',
                part
            )
            if genre_match:
                genre = genre_match.group(1)
                # Translate Hebrew genre
                genre = genre_map.get(genre, genre)

                start_hour = genre_match.group(2)
                end_hour = genre_match.group(4)
                duration = genre_match.group(6)

                action = {
                    "action_type": FlowActionType.PLAY_GENRE.value,
                    "genre": genre,
                    "description": f"Play {genre} music"
                }

                if duration:
                    action["duration_minutes"] = int(duration)
                elif start_hour and end_hour:
                    action["duration_minutes"] = (int(end_hour) - int(start_hour)) * 60

                actions.append(action)
                continue

            # Parse commercial playback
            commercial_match = re.search(
                r'(?:play|נגן|השמע)\s+(\d+)\s+(?:commercials?|פרסומות?|פרסומים?)',
                part
            )
            if commercial_match:
                count = int(commercial_match.group(1))
                actions.append({
                    "action_type": FlowActionType.PLAY_COMMERCIALS.value,
                    "commercial_count": count,
                    "description": f"Play {count} commercial(s)"
                })
                continue

            # Parse wait
            wait_match = re.search(
                r'(?:wait|חכה|המתן)\s+(\d+)\s*(?:minutes?|min|דקות?)',
                part
            )
            if wait_match:
                minutes = int(wait_match.group(1))
                actions.append({
                    "action_type": FlowActionType.WAIT.value,
                    "duration_minutes": minutes,
                    "description": f"Wait {minutes} minutes"
                })
                continue

            # Parse volume
            volume_match = re.search(
                r'(?:set\s+)?volume\s+(?:to\s+)?(\d+)|עוצמה\s+(\d+)',
                part
            )
            if volume_match:
                volume = int(volume_match.group(1) or volume_match.group(2))
                actions.append({
                    "action_type": FlowActionType.SET_VOLUME.value,
                    "volume_level": volume,
                    "description": f"Set volume to {volume}"
                })

    # Extract schedule from text (works for both Claude and regex parsing)
    schedule = None
    import re
    time_match = re.search(
        r'(?:between|from|at|בין|מ-?|ב-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|בבוקר)?(?:\s*(?:-|to|עד)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|בבוקר|בערב)?)?',
        text, re.IGNORECASE
    )
    if time_match:
        start_hour = int(time_match.group(1))
        start_min = int(time_match.group(2) or 0)
        schedule = {
            "start_time": f"{start_hour:02d}:{start_min:02d}",
            "days_of_week": [0, 1, 2, 3, 4, 5, 6]
        }
        if time_match.group(3):
            end_hour = int(time_match.group(3))
            end_min = int(time_match.group(4) or 0)
            schedule["end_time"] = f"{end_hour:02d}:{end_min:02d}"

    return {
        "parsed": True,
        "actions": actions,
        "schedule": schedule,
        "original_text": text
    }
