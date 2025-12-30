"""Auto Flows router for managing automated workflows."""

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from app.models.flow import (
    AutoFlow,
    FlowCreate,
    FlowUpdate,
    FlowStatus,
    FlowTriggerType
)
from app.services.google_calendar import GoogleCalendarService

from .calendar import sync_flow_to_calendar, delete_flow_calendar_event
from .schedule import check_schedule_overlap
from .execution import run_flow_actions
from .parser import parse_natural_language_flow

logger = logging.getLogger(__name__)
router = APIRouter()


def serialize_flow(flow: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if flow:
        flow["_id"] = str(flow["_id"])
    return flow


# ============================================================================
# List & Get Endpoints
# ============================================================================

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


# ============================================================================
# Create & Update Endpoints
# ============================================================================

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
        # If schedule changed, delete old event and create new one
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


# ============================================================================
# Status Control Endpoints
# ============================================================================

@router.post("/{flow_id}/toggle")
async def toggle_flow_status(request: Request, flow_id: str):
    """Toggle flow between active and paused. Updates Google Calendar accordingly."""
    db = request.app.state.db

    try:
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except Exception as e:
        logger.error(f"Invalid flow ID {flow_id}: {e}")
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

    try:
        # Update database
        await db.flows.update_one(
            {"_id": ObjectId(flow_id)},
            {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
        )

        # Update Google Calendar if flow is scheduled and has a calendar event ID
        schedule = flow.get("schedule", {})
        calendar_event_id = schedule.get("calendar_event_id") if schedule else None

        if calendar_event_id and flow.get("trigger_type") == "scheduled":
            try:
                if new_status == FlowStatus.PAUSED.value:
                    # Delete the calendar event when paused
                    await delete_flow_calendar_event(calendar_event_id)
                    logger.info(f"Deleted calendar event {calendar_event_id} for paused flow {flow_id}")

                    # Remove calendar_event_id from flow
                    await db.flows.update_one(
                        {"_id": ObjectId(flow_id)},
                        {"$unset": {"schedule.calendar_event_id": ""}}
                    )
                else:
                    # Re-create calendar event when re-enabled
                    if schedule:
                        new_event_id = await sync_flow_to_calendar(
                            flow_id=flow_id,
                            flow_name=flow.get("name", "Unnamed Flow"),
                            flow_description=flow.get("description", ""),
                            schedule=schedule
                        )

                        if new_event_id:
                            # Store new calendar event ID
                            await db.flows.update_one(
                                {"_id": ObjectId(flow_id)},
                                {"$set": {"schedule.calendar_event_id": new_event_id}}
                            )
                            logger.info(f"Created calendar event {new_event_id} for resumed flow {flow_id}")
            except Exception as e:
                logger.error(f"Failed to update calendar for flow {flow_id}: {e}")
                # Don't fail the toggle operation if calendar update fails

        return {"message": f"Flow status changed to {new_status}", "status": new_status}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle flow {flow_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to toggle flow: {str(e)}")


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


# ============================================================================
# Execution Endpoints
# ============================================================================

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

        if should_loop and end_time_str:
            # For looping flows: execute first batch immediately
            logger.info(f"Flow {flow_id} will loop until {end_time_str}")
            logger.info(f"Flow {flow_id} - Executing initial actions")
            initial_actions = await run_flow_actions(db, flow, audio_player)
            logger.info(f"Flow {flow_id} - Initial actions completed: {initial_actions}")

            # Mark execution as running (flow_monitor will continue it)
            await db.flow_executions.update_one(
                {"_id": log_result.inserted_id},
                {"$set": {"status": "running", "actions_completed": initial_actions}}
            )

            return {
                "message": f"Flow '{flow.get('name')}' started (looping until {end_time_str})",
                "execution_id": execution_id,
                "actions_completed": initial_actions,
                "status": "running"
            }
        else:
            # Single execution - run synchronously
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


# ============================================================================
# Calendar Sync Endpoints
# ============================================================================

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

            # Create new calendar event
            calendar_event_id = await sync_flow_to_calendar(
                flow_id=flow_id,
                flow_name=flow.get("name", "Unnamed Flow"),
                flow_description=flow.get("description", ""),
                schedule=schedule,
                existing_event_id=None
            )

            if calendar_event_id:
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


# ============================================================================
# Natural Language Parsing Endpoint
# ============================================================================

@router.post("/parse-natural", response_model=dict)
async def parse_natural_flow(request: Request, text: str):
    """
    Parse a natural language description into a flow using Claude AI.

    Example: "play hasidi music between 8-10 am, then play 2 commercials, then play mizrahi music"
    """
    return await parse_natural_language_flow(text)
