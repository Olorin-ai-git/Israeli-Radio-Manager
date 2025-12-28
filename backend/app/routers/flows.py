"""Auto Flows router for managing automated workflows."""

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
from app.routers.websocket import broadcast_scheduled_playback, broadcast_queue_tracks
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

        # Parse schedule
        start_time_str = schedule.get("start_time", "09:00")
        end_time_str = schedule.get("end_time")
        days_of_week = schedule.get("days_of_week", [0, 1, 2, 3, 4, 5, 6])

        # Calculate next occurrence
        now = datetime.now()
        hour, minute = map(int, start_time_str.split(":"))
        start_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)

        # If time has passed today, start tomorrow
        if start_dt < now:
            start_dt += timedelta(days=1)

        # Find next valid day
        while start_dt.weekday() not in [(d + 6) % 7 for d in days_of_week]:  # Convert Sunday=0 to Python's Monday=0
            start_dt += timedelta(days=1)

        # Calculate end time
        if end_time_str:
            end_hour, end_minute = map(int, end_time_str.split(":"))
            end_dt = start_dt.replace(hour=end_hour, minute=end_minute)
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
        else:
            end_dt = start_dt + timedelta(hours=1)

        # Build recurrence rule as dict (GoogleCalendarService.create_event expects this format)
        recurrence = {
            "frequency": "WEEKLY",
            "by_day": [DAY_NAMES[d] for d in days_of_week]
        }

        # Event summary with flow emoji
        summary = f"🔄 {flow_name}"

        # Event description
        description = f"Auto Flow: {flow_name}\n"
        if flow_description:
            description += f"\n{flow_description}\n"
        description += f"\nFlow ID: {flow_id}\nType: flow"

        if existing_event_id:
            # Update existing event
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
                # Fall through to create new event

        # Create new event
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
        logger.info(f"Created calendar event for flow {flow_name}: {event_id}")
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


@router.post("/", response_model=dict)
async def create_flow(request: Request, flow_data: FlowCreate):
    """Create a new auto flow."""
    db = request.app.state.db

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


async def run_flow_actions(db, flow: dict, audio_player=None) -> int:
    """
    Execute flow actions. Returns the number of actions completed.
    This function can be called from both the run_flow endpoint and the calendar watcher.
    """
    actions = flow.get("actions", [])
    actions_completed = 0

    for action in actions:
        action_type = action.get("action_type")

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
                    # Shuffle and select unique songs
                    random.shuffle(songs)
                    selected_songs = songs[:min(10, len(songs))]

                    # Update last_played for selected songs to avoid re-selection
                    for song in selected_songs:
                        await db.content.update_one(
                            {"_id": song["_id"]},
                            {"$set": {"last_played": datetime.utcnow()}}
                        )

                    # Broadcast first song for immediate playback
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
                        queue_tracks = []
                        for song in selected_songs[1:]:
                            queue_tracks.append({
                                "_id": str(song["_id"]),
                                "title": song.get("title", "Unknown"),
                                "artist": song.get("artist"),
                                "type": song.get("type", "song"),
                                "duration_seconds": song.get("duration_seconds", 0),
                                "genre": song.get("genre"),
                                "metadata": song.get("metadata", {})
                            })
                        await broadcast_queue_tracks(queue_tracks)

                    # Also add to VLC queue if available
                    if audio_player:
                        for song in selected_songs:
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
            # Get batch number (how many times to play the commercial set)
            batch_count = action.get("commercial_count", 1)

            # Get specific commercial IDs if provided
            content_id = action.get("content_id")

            logger.info(f"Playing commercials - batch_count: {batch_count}, content_id: {content_id}")

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
            else:
                # All commercials - get all active commercials
                logger.info("Fetching all active commercials")
                commercials = await db.content.find({
                    "type": "commercial",
                    "active": True
                }).to_list(100)
                logger.info(f"  Found {len(commercials)} commercials")

            # Repeat commercials for batch count
            all_commercials = []
            for _ in range(batch_count):
                all_commercials.extend(commercials)

            logger.info(f"Total commercials to play (after batch repeat): {len(all_commercials)}")

            if all_commercials:
                # Broadcast first commercial for immediate playback
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
                    queue_tracks = []
                    for commercial in all_commercials[1:]:
                        queue_tracks.append({
                            "_id": str(commercial["_id"]),
                            "title": commercial.get("title", "Commercial"),
                            "artist": commercial.get("artist"),
                            "type": "commercial",
                            "duration_seconds": commercial.get("duration_seconds", 0),
                            "genre": commercial.get("genre"),
                            "metadata": commercial.get("metadata", {})
                        })
                    await broadcast_queue_tracks(queue_tracks)

                # Also add to VLC queue if available
                if audio_player:
                    for commercial in all_commercials:
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

    return actions_completed


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

    # Execute flow actions
    try:
        # Check if flow should loop until end_time
        should_loop = flow.get("loop", False)
        end_time_str = flow.get("schedule", {}).get("end_time") if flow.get("schedule") else None

        total_actions_completed = 0
        loop_count = 0

        if should_loop and end_time_str:
            logger.info(f"Flow {flow_id} will loop until {end_time_str}")

            # Parse end time
            from datetime import datetime, time as dt_time
            end_hour, end_minute = map(int, end_time_str.split(':'))
            end_time = datetime.utcnow().replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)

            # If end time is earlier than current time, it's tomorrow
            if end_time < datetime.utcnow():
                end_time = end_time + timedelta(days=1)

            # Loop until end time
            while datetime.utcnow() < end_time:
                loop_count += 1
                logger.info(f"Flow {flow_id} - Loop iteration {loop_count}")

                actions_completed = await run_flow_actions(db, flow, audio_player)
                total_actions_completed += actions_completed

                # Small delay between loops to avoid tight loop
                import asyncio
                await asyncio.sleep(1)

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
- play_commercials: Play commercials. Support:
  * Specific count: commercial_count (number)
  * Batch number: batch_number (1, 2, 3, etc.) - refers to predefined commercial batches
  * Use 999 for ALL commercials
  * If "Batch-1", "Batch-2" etc mentioned, set batch_number field
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

Input: "Play happy music, then 2 commercials, then mizrahi"
Output:
[
  {{"action_type": "play_genre", "genre": "happy", "duration_minutes": 30, "description": "Play happy music"}},
  {{"action_type": "play_commercials", "commercial_count": 2, "description": "Play 2 commercials"}},
  {{"action_type": "play_genre", "genre": "mizrahi", "duration_minutes": 30, "description": "Play mizrahi music"}}
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
