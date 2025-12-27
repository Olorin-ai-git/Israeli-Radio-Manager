"""AI Agent control router."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

from app.models.agent import (
    AgentConfig,
    AgentMode,
    PendingAction,
    ActionStatus,
    ActionType
)

router = APIRouter()


@router.get("/config", response_model=dict)
async def get_agent_config(request: Request):
    """Get current agent configuration."""
    db = request.app.state.db

    config = await db.agent_config.find_one({"_id": "default"})
    if not config:
        # Return default config
        default = AgentConfig()
        return default.model_dump()

    return config


@router.put("/config", response_model=dict)
async def update_agent_config(request: Request, config: AgentConfig):
    """Update agent configuration."""
    db = request.app.state.db

    doc = config.model_dump(by_alias=True)
    doc["_id"] = "default"
    doc["updated_at"] = datetime.utcnow()

    await db.agent_config.replace_one(
        {"_id": "default"},
        doc,
        upsert=True
    )

    return doc


@router.post("/mode/{mode}")
async def set_agent_mode(request: Request, mode: AgentMode):
    """Quick switch between agent modes."""
    db = request.app.state.db

    await db.agent_config.update_one(
        {"_id": "default"},
        {
            "$set": {
                "mode": mode.value,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )

    return {"message": f"Agent mode set to {mode.value}"}


@router.get("/status")
async def get_agent_status(request: Request):
    """Get current agent status and statistics."""
    db = request.app.state.db

    config = await db.agent_config.find_one({"_id": "default"})
    mode = config.get("mode", "prompt") if config else "prompt"

    # Count pending actions
    pending_count = await db.pending_actions.count_documents({"status": "pending"})

    # Get recent decisions
    decisions_today = await db.agent_decisions.count_documents({
        "created_at": {"$gte": datetime.utcnow().replace(hour=0, minute=0, second=0)}
    })

    return {
        "mode": mode,
        "active": True,  # TODO: Check if agent is actually running
        "pending_actions": pending_count,
        "decisions_today": decisions_today,
        "last_decision": None  # TODO: Get most recent decision
    }


@router.get("/pending", response_model=List[dict])
async def list_pending_actions(
    request: Request,
    action_type: Optional[ActionType] = None,
    limit: int = 50
):
    """List pending actions awaiting confirmation."""
    db = request.app.state.db

    query = {"status": ActionStatus.PENDING.value}
    if action_type:
        query["action_type"] = action_type.value

    cursor = db.pending_actions.find(query).sort("created_at", -1).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/pending/{action_id}", response_model=dict)
async def get_pending_action(request: Request, action_id: str):
    """Get details of a specific pending action."""
    db = request.app.state.db

    action = await db.pending_actions.find_one({"_id": ObjectId(action_id)})
    if not action:
        raise HTTPException(status_code=404, detail="Pending action not found")

    action["_id"] = str(action["_id"])
    return action


@router.post("/pending/{action_id}/approve")
async def approve_action(
    request: Request,
    action_id: str,
    use_alternative: Optional[int] = None
):
    """Approve a pending action."""
    db = request.app.state.db

    action = await db.pending_actions.find_one({"_id": ObjectId(action_id)})
    if not action:
        raise HTTPException(status_code=404, detail="Pending action not found")

    if action["status"] != ActionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Action already processed")

    # Determine which action to execute
    if use_alternative is not None and action.get("alternatives"):
        if 0 <= use_alternative < len(action["alternatives"]):
            final_action = action["alternatives"][use_alternative]
        else:
            raise HTTPException(status_code=400, detail="Invalid alternative index")
    else:
        final_action = action["suggested_action"]

    # Update the action
    await db.pending_actions.update_one(
        {"_id": ObjectId(action_id)},
        {
            "$set": {
                "status": ActionStatus.APPROVED.value,
                "responded_by": "user",
                "response_channel": "dashboard",
                "final_action": final_action,
                "executed_at": datetime.utcnow()
            }
        }
    )

    # TODO: Trigger the agent to execute the action

    return {"message": "Action approved", "final_action": final_action}


@router.post("/pending/{action_id}/reject")
async def reject_action(request: Request, action_id: str, reason: Optional[str] = None):
    """Reject a pending action."""
    db = request.app.state.db

    action = await db.pending_actions.find_one({"_id": ObjectId(action_id)})
    if not action:
        raise HTTPException(status_code=404, detail="Pending action not found")

    if action["status"] != ActionStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Action already processed")

    await db.pending_actions.update_one(
        {"_id": ObjectId(action_id)},
        {
            "$set": {
                "status": ActionStatus.REJECTED.value,
                "responded_by": "user",
                "response_channel": "dashboard",
                "rejection_reason": reason,
                "executed_at": datetime.utcnow()
            }
        }
    )

    return {"message": "Action rejected"}


@router.get("/decisions", response_model=List[dict])
async def list_decisions(
    request: Request,
    limit: int = 100,
    offset: int = 0
):
    """List recent agent decisions."""
    db = request.app.state.db

    cursor = db.agent_decisions.find().sort("created_at", -1).skip(offset).limit(limit)

    items = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        items.append(item)

    return items


@router.get("/decisions/{decision_id}", response_model=dict)
async def get_decision(request: Request, decision_id: str):
    """Get details of a specific decision."""
    db = request.app.state.db

    decision = await db.agent_decisions.find_one({"_id": ObjectId(decision_id)})
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")

    decision["_id"] = str(decision["_id"])
    return decision


@router.post("/trigger")
async def trigger_agent(request: Request, action_type: ActionType):
    """Manually trigger the agent to perform an action."""
    # TODO: Actually trigger the agent
    return {
        "message": f"Agent triggered for {action_type.value}",
        "queued": True
    }


# Chat endpoint for natural language communication
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    timestamp: str


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: Request, chat: ChatMessage):
    """
    Chat with the AI agent in natural language.

    Allows operators to:
    - Ask questions about the schedule
    - Request specific songs/shows
    - Get status updates
    - Give instructions to the agent

    Supports both Hebrew and English.
    """
    from app.agent.orchestrator import OrchestratorAgent
    from datetime import datetime

    db = request.app.state.db

    # Initialize agent (in production, this would be a singleton)
    agent = OrchestratorAgent(db)

    # Get response from agent
    response = await agent.chat(chat.message)

    return ChatResponse(
        response=response,
        timestamp=datetime.utcnow().isoformat()
    )


@router.get("/chat/history")
async def get_chat_history(request: Request, limit: int = 50):
    """Get recent chat history."""
    db = request.app.state.db

    cursor = db.chat_logs.find().sort("timestamp", -1).limit(limit)

    history = []
    async for entry in cursor:
        entry["_id"] = str(entry["_id"])
        history.append(entry)

    # Reverse to get chronological order
    return list(reversed(history))


@router.delete("/chat/history")
async def clear_chat_history(request: Request):
    """Clear chat history."""
    db = request.app.state.db
    await db.chat_logs.delete_many({})
    return {"message": "Chat history cleared"}
