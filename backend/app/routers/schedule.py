"""Schedule management router."""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from app.models.schedule import (
    ScheduleSlot,
    ScheduleSlotCreate,
    ScheduleSlotUpdate,
    ScheduleConfig
)

router = APIRouter()


@router.get("/", response_model=List[dict])
async def list_schedule_slots(
    request: Request,
    enabled: Optional[bool] = None
):
    """List all schedule slots."""
    db = request.app.state.db

    query = {}
    if enabled is not None:
        query["enabled"] = enabled

    cursor = db.schedules.find(query).sort("priority", -1)
    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/current", response_model=dict)
async def get_current_slot(request: Request):
    """Get the currently active schedule slot based on current time."""
    db = request.app.state.db

    now = datetime.now()
    current_time = now.strftime("%H:%M")
    current_day = now.weekday()  # 0=Monday

    # Find matching slots
    cursor = db.schedules.find({
        "enabled": True,
        "start_time": {"$lte": current_time},
        "end_time": {"$gt": current_time},
        "$or": [
            {"day_of_week": "all"},
            {"day_of_week": current_day}
        ]
    }).sort("priority", -1)

    async for item in cursor:
        item["_id"] = str(item["_id"])
        return item

    return {"message": "No active schedule slot", "fallback": True}


@router.get("/upcoming", response_model=List[dict])
async def get_upcoming_schedule(
    request: Request,
    hours: int = 24
):
    """Get upcoming schedule for the next N hours."""
    db = request.app.state.db

    # Get all enabled slots and return them
    # In production, this would calculate actual upcoming slots
    cursor = db.schedules.find({"enabled": True}).sort([
        ("priority", -1),
        ("start_time", 1)
    ])

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.post("/slots", response_model=dict)
async def create_schedule_slot(request: Request, slot: ScheduleSlotCreate):
    """Create a new schedule slot."""
    db = request.app.state.db

    doc = slot.model_dump()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()

    result = await db.schedules.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    return doc


@router.put("/slots/{slot_id}", response_model=dict)
async def update_schedule_slot(
    request: Request,
    slot_id: str,
    update: ScheduleSlotUpdate
):
    """Update a schedule slot."""
    db = request.app.state.db

    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    update_data["updated_at"] = datetime.utcnow()

    result = await db.schedules.update_one(
        {"_id": ObjectId(slot_id)},
        {"$set": update_data}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    item = await db.schedules.find_one({"_id": ObjectId(slot_id)})
    item["_id"] = str(item["_id"])
    return item


@router.delete("/slots/{slot_id}")
async def delete_schedule_slot(request: Request, slot_id: str):
    """Delete a schedule slot."""
    db = request.app.state.db

    result = await db.schedules.delete_one({"_id": ObjectId(slot_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Schedule slot not found")

    return {"message": "Schedule slot deleted"}


@router.get("/config", response_model=dict)
async def get_schedule_config(request: Request):
    """Get the schedule configuration."""
    db = request.app.state.db

    config = await db.schedule_config.find_one({"_id": "default"})
    if not config:
        # Return default config
        return ScheduleConfig().model_dump()

    return config


@router.put("/config", response_model=dict)
async def update_schedule_config(request: Request, config: ScheduleConfig):
    """Update the schedule configuration."""
    db = request.app.state.db

    doc = config.model_dump()
    doc["_id"] = "default"
    doc["updated_at"] = datetime.utcnow()

    await db.schedule_config.replace_one(
        {"_id": "default"},
        doc,
        upsert=True
    )

    return doc
