"""Commercial campaigns router - CRUD and scheduling for ad campaigns."""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from bson import ObjectId

from app.models.commercial_campaign import (
    CommercialCampaign,
    CampaignCreate,
    CampaignUpdate,
    CampaignStatus,
    ScheduleSlot,
    CampaignContentRef,
    DailyPreview,
    DailyPreviewSlot,
    slot_index_to_time,
    time_to_slot_index,
)

router = APIRouter()


# ==================== CRUD Endpoints ====================

@router.get("/", response_model=List[dict])
async def list_campaigns(
    request: Request,
    status: Optional[CampaignStatus] = None,
    active_on_date: Optional[date] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0
):
    """
    List all campaigns with optional filters.

    Args:
        status: Filter by campaign status
        active_on_date: Filter campaigns active on a specific date
        limit: Maximum number of results
        offset: Skip first N results
    """
    db = request.app.state.db

    query = {}
    if status:
        query["status"] = status.value
    if active_on_date:
        query["start_date"] = {"$lte": active_on_date.isoformat()}
        query["end_date"] = {"$gte": active_on_date.isoformat()}

    cursor = db.commercial_campaigns.find(query).sort([
        ("priority", -1),  # Higher priority first
        ("created_at", -1)
    ]).skip(offset).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/{campaign_id}", response_model=dict)
async def get_campaign(request: Request, campaign_id: str):
    """Get a specific campaign by ID."""
    db = request.app.state.db

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    item["_id"] = str(item["_id"])
    return item


@router.post("/", response_model=dict)
async def create_campaign(request: Request, campaign: CampaignCreate):
    """Create a new campaign."""
    db = request.app.state.db

    # Validate date range
    if campaign.end_date < campaign.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    doc = campaign.model_dump()
    doc["status"] = CampaignStatus.DRAFT.value
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()

    # Convert dates to strings for MongoDB
    doc["start_date"] = campaign.start_date.isoformat()
    doc["end_date"] = campaign.end_date.isoformat()

    result = await db.commercial_campaigns.insert_one(doc)

    doc["_id"] = str(result.inserted_id)
    return doc


@router.put("/{campaign_id}", response_model=dict)
async def update_campaign(request: Request, campaign_id: str, update: CampaignUpdate):
    """Update a campaign."""
    db = request.app.state.db

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Convert dates to strings
    if "start_date" in update_data:
        update_data["start_date"] = update_data["start_date"].isoformat()
    if "end_date" in update_data:
        update_data["end_date"] = update_data["end_date"].isoformat()
    if "status" in update_data:
        update_data["status"] = update_data["status"].value

    update_data["updated_at"] = datetime.utcnow()

    try:
        result = await db.commercial_campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": update_data}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


@router.delete("/{campaign_id}")
async def delete_campaign(request: Request, campaign_id: str, hard_delete: bool = False):
    """Delete a campaign (soft delete by default sets status to deleted)."""
    db = request.app.state.db

    try:
        if hard_delete:
            result = await db.commercial_campaigns.delete_one({"_id": ObjectId(campaign_id)})
            if result.deleted_count == 0:
                raise HTTPException(status_code=404, detail="Campaign not found")
            return {"message": "Campaign permanently deleted"}
        else:
            result = await db.commercial_campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$set": {"status": CampaignStatus.DELETED.value, "updated_at": datetime.utcnow()}}
            )
            if result.matched_count == 0:
                raise HTTPException(status_code=404, detail="Campaign not found")
            return {"message": "Campaign deleted"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")


@router.patch("/{campaign_id}/status", response_model=dict)
async def toggle_campaign_status(request: Request, campaign_id: str):
    """Toggle campaign status between active and paused."""
    db = request.app.state.db

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    current_status = item.get("status", CampaignStatus.DRAFT.value)

    # Toggle logic
    if current_status == CampaignStatus.ACTIVE.value:
        new_status = CampaignStatus.PAUSED.value
    elif current_status in [CampaignStatus.PAUSED.value, CampaignStatus.DRAFT.value]:
        new_status = CampaignStatus.ACTIVE.value
    else:
        # Can't toggle completed campaigns
        raise HTTPException(status_code=400, detail="Cannot toggle completed campaigns")

    await db.commercial_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


@router.post("/{campaign_id}/clone", response_model=dict)
async def clone_campaign(request: Request, campaign_id: str):
    """
    Clone a campaign with a new 1-year time frame.
    Works regardless of the original campaign's status.
    The cloned campaign will have '-cloned' suffix and start as draft.
    """
    db = request.app.state.db

    try:
        original = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not original:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Calculate new date range (1 year from today)
    today = date.today()
    one_year_later = date(today.year + 1, today.month, today.day)

    # Create cloned campaign data
    cloned_data = {
        "name": f"{original.get('name', 'Campaign')}-cloned",
        "name_he": f"{original.get('name_he', '')}-cloned" if original.get('name_he') else None,
        "campaign_type": original.get("campaign_type", ""),
        "comment": original.get("comment"),
        "start_date": today.isoformat(),
        "end_date": one_year_later.isoformat(),
        "priority": original.get("priority", 5),
        "contract_link": original.get("contract_link"),
        "content_refs": original.get("content_refs", []),
        "schedule_grid": [],  # Start with empty schedule
        "status": CampaignStatus.DRAFT.value,
        "calendar_event_id": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.commercial_campaigns.insert_one(cloned_data)
    cloned_data["_id"] = str(result.inserted_id)

    return cloned_data


# ==================== Schedule Grid Endpoints ====================

@router.put("/{campaign_id}/schedule-grid", response_model=dict)
async def update_schedule_grid(
    request: Request,
    campaign_id: str,
    grid: List[ScheduleSlot]
):
    """Update the entire schedule grid for a campaign."""
    db = request.app.state.db

    # Convert to list of dicts
    grid_data = [slot.model_dump() for slot in grid]

    try:
        result = await db.commercial_campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": {"schedule_grid": grid_data, "updated_at": datetime.utcnow()}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


@router.patch("/{campaign_id}/schedule-slot", response_model=dict)
async def update_schedule_slot(
    request: Request,
    campaign_id: str,
    slot_date: str = Query(...),  # YYYY-MM-DD format
    slot_index: int = Query(ge=0, le=47),
    play_count: int = Query(ge=0)
):
    """Update a single slot in the schedule grid."""
    db = request.app.state.db

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Get existing grid or create empty
    grid = item.get("schedule_grid", [])

    # Find and update or add the slot
    slot_found = False
    for slot in grid:
        if slot["slot_date"] == slot_date and slot["slot_index"] == slot_index:
            slot["play_count"] = play_count
            slot_found = True
            break

    if not slot_found:
        grid.append({
            "slot_date": slot_date,
            "slot_index": slot_index,
            "play_count": play_count
        })

    # Remove slots with 0 play count to keep grid clean
    grid = [s for s in grid if s["play_count"] > 0]

    await db.commercial_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"schedule_grid": grid, "updated_at": datetime.utcnow()}}
    )

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


# ==================== Content Management Endpoints ====================

@router.post("/{campaign_id}/content", response_model=dict)
async def add_campaign_content(
    request: Request,
    campaign_id: str,
    content_ref: CampaignContentRef
):
    """Add content to a campaign."""
    db = request.app.state.db

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # If content_id provided, validate it exists
    if content_ref.content_id:
        content = await db.content.find_one({"_id": ObjectId(content_ref.content_id)})
        if not content:
            raise HTTPException(status_code=400, detail="Content not found in library")

    # Add to content_refs
    content_refs = item.get("content_refs", [])
    content_refs.append(content_ref.model_dump())

    await db.commercial_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"content_refs": content_refs, "updated_at": datetime.utcnow()}}
    )

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


@router.delete("/{campaign_id}/content/{content_index}", response_model=dict)
async def remove_campaign_content(
    request: Request,
    campaign_id: str,
    content_index: int
):
    """Remove content from a campaign by index."""
    db = request.app.state.db

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    content_refs = item.get("content_refs", [])
    if content_index < 0 or content_index >= len(content_refs):
        raise HTTPException(status_code=400, detail="Invalid content index")

    content_refs.pop(content_index)

    await db.commercial_campaigns.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"content_refs": content_refs, "updated_at": datetime.utcnow()}}
    )

    item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    item["_id"] = str(item["_id"])
    return item


# ==================== Preview Endpoints ====================

@router.get("/preview/daily", response_model=dict)
async def get_daily_preview(
    request: Request,
    target_date: date = Query(default=None)
):
    """
    Get a preview of all scheduled commercials for a specific date.

    Returns a timeline organized by 30-minute slots with campaign info.
    """
    db = request.app.state.db

    if target_date is None:
        target_date = date.today()

    slot_date_str = target_date.isoformat()
    day_of_week = (target_date.weekday() + 1) % 7  # Convert to 0=Sunday

    # Find all active campaigns for this date
    query = {
        "status": CampaignStatus.ACTIVE.value,
        "start_date": {"$lte": slot_date_str},
        "end_date": {"$gte": slot_date_str}
    }

    cursor = db.commercial_campaigns.find(query).sort("priority", -1)

    # Build slots map
    slots_map = {}  # slot_index -> list of commercials

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
                    "content_count": len(content_refs)
                })

    # Convert to sorted list
    slots = []
    for slot_idx in sorted(slots_map.keys()):
        # Sort by priority (highest first)
        commercials = sorted(slots_map[slot_idx], key=lambda x: -x["priority"])
        slots.append({
            "slot_index": slot_idx,
            "time": slot_index_to_time(slot_idx),
            "commercials": commercials
        })

    return {
        "date": slot_date_str,
        "day_of_week": day_of_week,
        "slots": slots
    }


# ==================== Calendar Sync Endpoints ====================

@router.post("/{campaign_id}/sync-calendar", response_model=dict)
async def sync_campaign_to_calendar(request: Request, campaign_id: str):
    """Sync a campaign to Google Calendar as an all-day event."""
    db = request.app.state.db
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(status_code=503, detail="Calendar service not available")

    try:
        item = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not item:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Delete existing event if any
    existing_event_id = item.get("calendar_event_id")
    if existing_event_id:
        try:
            await calendar_service.delete_event(existing_event_id)
        except Exception:
            pass  # Ignore if event doesn't exist

    # Create event
    summary = f"[Commercial] {item['name']}"
    description = f"""Campaign: {item['name']}
Type: {item.get('campaign_type', 'N/A')}
Priority: {item['priority']}/9
Status: {item['status']}
Comment: {item.get('comment', 'N/A')}"""

    start_date = date.fromisoformat(item["start_date"])
    end_date = date.fromisoformat(item["end_date"])

    try:
        event = await calendar_service.create_event(
            summary=summary,
            start_time=datetime.combine(start_date, datetime.min.time()),
            end_time=datetime.combine(end_date, datetime.min.time()),
            description=description,
            all_day=True,
            color_id="6"  # Tangerine (orange) for commercials
        )

        event_id = event.get("id")

        # Update campaign with event ID
        await db.commercial_campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": {"calendar_event_id": event_id, "updated_at": datetime.utcnow()}}
        )

        return {"message": "Calendar event created", "event_id": event_id}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")


@router.post("/sync-all-calendar", response_model=dict)
async def sync_all_campaigns_to_calendar(request: Request):
    """Sync all active campaigns to Google Calendar."""
    db = request.app.state.db
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    if not calendar_service:
        raise HTTPException(status_code=503, detail="Calendar service not available")

    # Get all active campaigns
    cursor = db.commercial_campaigns.find({"status": CampaignStatus.ACTIVE.value})

    synced = 0
    errors = []

    async for campaign in cursor:
        campaign_id = str(campaign["_id"])
        try:
            # Delete existing event
            if campaign.get("calendar_event_id"):
                try:
                    await calendar_service.delete_event(campaign["calendar_event_id"])
                except Exception:
                    pass

            # Create event
            summary = f"[Commercial] {campaign['name']}"
            description = f"""Campaign: {campaign['name']}
Type: {campaign.get('campaign_type', 'N/A')}
Priority: {campaign['priority']}/9"""

            start_date = date.fromisoformat(campaign["start_date"])
            end_date = date.fromisoformat(campaign["end_date"])

            event = await calendar_service.create_event(
                summary=summary,
                start_time=datetime.combine(start_date, datetime.min.time()),
                end_time=datetime.combine(end_date, datetime.min.time()),
                description=description,
                all_day=True,
                color_id="6"
            )

            # Update campaign
            await db.commercial_campaigns.update_one(
                {"_id": ObjectId(campaign_id)},
                {"$set": {"calendar_event_id": event.get("id"), "updated_at": datetime.utcnow()}}
            )

            synced += 1

        except Exception as e:
            errors.append(f"{campaign['name']}: {str(e)}")

    return {
        "message": "Calendar sync completed",
        "synced": synced,
        "errors": errors
    }


# ==================== Analytics Endpoints ====================

@router.get("/{campaign_id}/stats", response_model=dict)
async def get_campaign_stats(request: Request, campaign_id: str):
    """Get playback statistics for a campaign."""
    db = request.app.state.db

    try:
        campaign = await db.commercial_campaigns.find_one({"_id": ObjectId(campaign_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Count plays from logs
    today = date.today()
    today_str = today.isoformat()
    total_plays = await db.commercial_play_logs.count_documents({"campaign_id": campaign_id})
    today_plays = await db.commercial_play_logs.count_documents({
        "campaign_id": campaign_id,
        "slot_date": today_str
    })

    # Calculate scheduled plays for today (by date)
    scheduled_today = 0
    for slot in campaign.get("schedule_grid", []):
        if slot["slot_date"] == today_str:
            scheduled_today += slot["play_count"]

    # Total scheduled (all dates)
    total_scheduled = sum(slot["play_count"] for slot in campaign.get("schedule_grid", []))

    return {
        "campaign_id": campaign_id,
        "name": campaign["name"],
        "total_plays": total_plays,
        "plays_today": today_plays,
        "scheduled_today": scheduled_today,
        "total_scheduled": total_scheduled,
        "content_count": len(campaign.get("content_refs", []))
    }


# ==================== Admin Endpoints ====================

@router.post("/slots/run-now", response_model=dict)
async def run_slot_now(
    request: Request,
    slot_date: str = Query(..., description="Date in YYYY-MM-DD format"),
    slot_index: int = Query(..., ge=0, le=47, description="Slot index 0-47"),
    use_opening_jingle: bool = Query(False, description="Add opening jingle before commercials"),
    opening_jingle_id: Optional[str] = Query(None, description="Opening jingle content ID"),
    use_closing_jingle: bool = Query(False, description="Add closing jingle after commercials"),
    closing_jingle_id: Optional[str] = Query(None, description="Closing jingle content ID"),
):
    """
    Manually trigger a time slot to run now, regardless of current time.
    Admin-only endpoint for testing campaign playback.

    This will:
    1. Optionally add an opening jingle at the start
    2. Get all commercials scheduled for the specified slot
    3. Insert them at the front of the playback queue
    4. Optionally add a closing jingle at the end
    5. Record the plays in the logs
    """
    from app.services.commercial_scheduler import get_scheduler
    from app.routers.playback import add_to_queue, get_queue
    from app.routers.websocket import broadcast_queue_update

    db = request.app.state.db
    scheduler = get_scheduler(db)

    # Fetch opening jingle content if enabled
    opening_jingle_content = None
    if use_opening_jingle and opening_jingle_id:
        try:
            opening_jingle_content = await db.content.find_one({"_id": ObjectId(opening_jingle_id)})
            if opening_jingle_content:
                opening_jingle_content["_id"] = str(opening_jingle_content["_id"])
        except Exception as e:
            logger.warning(f"Failed to fetch opening jingle {opening_jingle_id}: {e}")

    # Fetch closing jingle content if enabled
    closing_jingle_content = None
    if use_closing_jingle and closing_jingle_id:
        try:
            closing_jingle_content = await db.content.find_one({"_id": ObjectId(closing_jingle_id)})
            if closing_jingle_content:
                closing_jingle_content["_id"] = str(closing_jingle_content["_id"])
        except Exception as e:
            logger.warning(f"Failed to fetch closing jingle {closing_jingle_id}: {e}")

    # Create a fake datetime for the target slot
    target_date = date.fromisoformat(slot_date)
    hour = slot_index // 2
    minute = (slot_index % 2) * 30
    target_datetime = datetime.combine(target_date, datetime.min.time().replace(hour=hour, minute=minute))

    # Get commercials for the slot (bypass play count limits for manual trigger)
    commercials = await scheduler.get_commercials_for_slot(
        target_datetime=target_datetime,
        max_count=20,
        bypass_play_limit=True,  # Admin manual trigger ignores already-played count
    )

    if not commercials:
        return {
            "success": True,
            "message": f"No commercials scheduled for {slot_date} at {slot_index_to_time(slot_index)}",
            "queued": 0
        }

    # Build the queue items list
    queue_items = []

    # Add opening jingle if enabled
    if opening_jingle_content:
        queue_items.append({
            "_id": opening_jingle_content["_id"],
            "title": opening_jingle_content.get("title", "Jingle"),
            "artist": opening_jingle_content.get("artist"),
            "type": "jingle",
            "duration_seconds": opening_jingle_content.get("duration_seconds", 5),
            "genre": opening_jingle_content.get("genre"),
            "metadata": opening_jingle_content.get("metadata", {}),
            "commercial_jingle": True,
            "jingle_position": "opening"
        })

    # Add commercials
    for commercial_data in commercials:
        content = commercial_data.get("content", {})
        campaign_id = commercial_data.get("campaign_id")

        queue_items.append({
            "_id": str(content.get("_id", "")),
            "title": content.get("title", "Commercial"),
            "artist": content.get("artist"),
            "type": content.get("type", "commercial"),
            "duration_seconds": content.get("duration_seconds", 30),
            "genre": content.get("genre"),
            "metadata": content.get("metadata", {}),
            "campaign_id": campaign_id,
            "scheduled_campaign": True,
            "manual_trigger": True
        })

    # Add closing jingle if enabled
    if closing_jingle_content:
        queue_items.append({
            "_id": closing_jingle_content["_id"],
            "title": closing_jingle_content.get("title", "Jingle"),
            "artist": closing_jingle_content.get("artist"),
            "type": "jingle",
            "duration_seconds": closing_jingle_content.get("duration_seconds", 5),
            "genre": closing_jingle_content.get("genre"),
            "metadata": closing_jingle_content.get("metadata", {}),
            "commercial_jingle": True,
            "jingle_position": "closing"
        })

    # Insert all items at front of queue
    for idx, queue_item in enumerate(queue_items):
        add_to_queue(queue_item, position=idx)

    # Record commercial plays (not jingles)
    for commercial_data in commercials:
        content = commercial_data.get("content", {})
        campaign_id = commercial_data.get("campaign_id")
        await scheduler.record_play(
            campaign_id=campaign_id,
            content_id=str(content.get("_id", "")),
            slot_index=slot_index,
            slot_date=slot_date,
            triggered_by="manual_admin"
        )

    # Broadcast queue update
    await broadcast_queue_update(get_queue())

    queued_count = len(queue_items)
    jingle_parts = []
    if opening_jingle_content:
        jingle_parts.append("opening jingle")
    if closing_jingle_content:
        jingle_parts.append("closing jingle")
    jingle_info = f" (with {' and '.join(jingle_parts)})" if jingle_parts else ""

    return {
        "success": True,
        "message": f"Triggered {len(commercials)} commercials{jingle_info} for {slot_date} at {slot_index_to_time(slot_index)}",
        "queued": queued_count,
        "commercials": [
            {"campaign": c.get("campaign_name"), "title": c.get("content", {}).get("title")}
            for c in commercials
        ],
        "opening_jingle_used": opening_jingle_content.get("title") if opening_jingle_content else None,
        "closing_jingle_used": closing_jingle_content.get("title") if closing_jingle_content else None
    }


@router.get("/settings/jingle", response_model=dict)
async def get_jingle_settings(request: Request):
    """
    Get the global jingle settings for commercial playback.
    """
    from app.services.commercial_scheduler import get_scheduler

    db = request.app.state.db
    scheduler = get_scheduler(db)

    settings = await scheduler.get_jingle_settings()
    return settings


@router.put("/settings/jingle", response_model=dict)
async def save_jingle_settings(
    request: Request,
    use_opening_jingle: bool = Query(..., description="Whether to use opening jingle before commercials"),
    opening_jingle_id: Optional[str] = Query(None, description="Opening jingle content ID"),
    use_closing_jingle: bool = Query(..., description="Whether to use closing jingle after commercials"),
    closing_jingle_id: Optional[str] = Query(None, description="Closing jingle content ID"),
):
    """
    Save the global jingle settings for commercial playback.
    These settings are used by the automatic scheduler.
    """
    from app.services.commercial_scheduler import get_scheduler

    db = request.app.state.db
    scheduler = get_scheduler(db)

    await scheduler.save_jingle_settings(
        use_opening_jingle=use_opening_jingle,
        opening_jingle_id=opening_jingle_id,
        use_closing_jingle=use_closing_jingle,
        closing_jingle_id=closing_jingle_id
    )

    return {
        "success": True,
        "use_opening_jingle": use_opening_jingle,
        "opening_jingle_id": opening_jingle_id,
        "use_closing_jingle": use_closing_jingle,
        "closing_jingle_id": closing_jingle_id
    }
