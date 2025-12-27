"""Auto Flows router for managing automated workflows."""

from datetime import datetime
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
    FlowExecutionLog
)

router = APIRouter()


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


@router.post("/", response_model=dict)
async def create_flow(request: Request, flow_data: FlowCreate):
    """Create a new auto flow."""
    db = request.app.state.db

    # Build flow document
    flow_doc = {
        "name": flow_data.name,
        "name_he": flow_data.name_he,
        "description": flow_data.description,
        "description_he": flow_data.description_he,
        "actions": [action.model_dump() for action in flow_data.actions],
        "trigger_type": flow_data.trigger_type.value,
        "schedule": flow_data.schedule.model_dump() if flow_data.schedule else None,
        "status": FlowStatus.ACTIVE.value,
        "priority": flow_data.priority,
        "loop": flow_data.loop,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "last_run": None,
        "run_count": 0
    }

    result = await db.flows.insert_one(flow_doc)
    flow_doc["_id"] = str(result.inserted_id)

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
    return serialize_flow(updated)


@router.delete("/{flow_id}")
async def delete_flow(request: Request, flow_id: str):
    """Delete a flow."""
    db = request.app.state.db

    try:
        result = await db.flows.delete_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Flow not found")

    return {"message": "Flow deleted", "flow_id": flow_id}


@router.post("/{flow_id}/toggle", response_model=dict)
async def toggle_flow_status(request: Request, flow_id: str):
    """Toggle flow between active and paused."""
    db = request.app.state.db

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

    await db.flows.update_one(
        {"_id": ObjectId(flow_id)},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Flow status changed to {new_status}", "status": new_status}


@router.post("/{flow_id}/run", response_model=dict)
async def run_flow(request: Request, flow_id: str):
    """Manually trigger a flow to run."""
    db = request.app.state.db
    audio_player = getattr(request.app.state, 'audio_player', None)

    try:
        flow = await db.flows.find_one({"_id": ObjectId(flow_id)})
    except:
        raise HTTPException(status_code=400, detail="Invalid flow ID")

    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")

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

    # Execute flow actions (simplified - in production this would be async/background)
    try:
        actions = flow.get("actions", [])
        actions_completed = 0

        for action in actions:
            action_type = action.get("action_type")

            if action_type == FlowActionType.PLAY_GENRE.value:
                # Queue songs from the genre
                genre = action.get("genre")
                if genre and audio_player:
                    # Get songs from this genre
                    songs = await db.content.find({
                        "type": "song",
                        "genre": genre,
                        "active": True
                    }).limit(10).to_list(10)

                    # Add to queue (in production, would respect duration_minutes)
                    for song in songs[:3]:  # Limit for now
                        from app.services.audio_player import TrackInfo
                        track = TrackInfo(
                            content_id=str(song["_id"]),
                            title=song.get("title", "Unknown"),
                            artist=song.get("artist"),
                            duration_seconds=song.get("duration_seconds", 0),
                            file_path=song.get("local_cache_path", "")
                        )
                        audio_player.add_to_queue(track)

            elif action_type == FlowActionType.PLAY_COMMERCIALS.value:
                count = action.get("commercial_count", 1)
                if audio_player:
                    commercials = await db.content.find({
                        "type": "commercial",
                        "active": True
                    }).limit(count).to_list(count)

                    for commercial in commercials:
                        from app.services.audio_player import TrackInfo
                        track = TrackInfo(
                            content_id=str(commercial["_id"]),
                            title=commercial.get("title", "Commercial"),
                            artist=None,
                            duration_seconds=commercial.get("duration_seconds", 0),
                            file_path=commercial.get("local_cache_path", "")
                        )
                        audio_player.add_to_queue(track, priority=10)  # High priority

            elif action_type == FlowActionType.SET_VOLUME.value:
                volume = action.get("volume_level", 80)
                if audio_player:
                    audio_player.set_volume(volume)

            actions_completed += 1

            # Update progress
            await db.flow_executions.update_one(
                {"_id": log_result.inserted_id},
                {"$set": {"actions_completed": actions_completed}}
            )

        # Mark as completed
        await db.flow_executions.update_one(
            {"_id": log_result.inserted_id},
            {
                "$set": {
                    "status": "completed",
                    "ended_at": datetime.utcnow(),
                    "actions_completed": actions_completed
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
            "actions_completed": actions_completed
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
    Parse a natural language description into a flow.

    Example: "play hasidi music between 8-10 am, then play 2 commercials, then play mizrahi music"
    """
    import re

    actions = []
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

    # Extract schedule from text
    schedule = None
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
