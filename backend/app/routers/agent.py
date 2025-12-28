"""AI Agent control router."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
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

    # Check if audio player is active (agent is considered active if playback system is available)
    audio_player = getattr(request.app.state, 'audio_player', None)
    is_active = audio_player is not None

    # Get most recent decision
    last_decision_doc = await db.agent_decisions.find_one(
        {},
        sort=[("created_at", -1)]
    )
    last_decision = None
    if last_decision_doc:
        last_decision = {
            "action_type": last_decision_doc.get("action_type"),
            "reasoning": last_decision_doc.get("reasoning"),
            "created_at": last_decision_doc.get("created_at").isoformat() if last_decision_doc.get("created_at") else None
        }

    return {
        "mode": mode,
        "active": is_active,
        "pending_actions": pending_count,
        "decisions_today": decisions_today,
        "last_decision": last_decision
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

    # Execute the approved action via the orchestrator agent
    from app.agent.orchestrator import OrchestratorAgent
    audio_player = getattr(request.app.state, 'audio_player', None)
    content_sync = getattr(request.app.state, 'content_sync', None)
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    agent = OrchestratorAgent(
        db,
        audio_player=audio_player,
        content_sync=content_sync,
        calendar_service=calendar_service
    )

    execution_result = await agent.execute_action(final_action)

    # Log the execution
    await db.action_log.insert_one({
        "action_id": action_id,
        "action": final_action,
        "result": execution_result,
        "executed_at": datetime.utcnow()
    })

    return {
        "message": "Action approved and executed",
        "final_action": final_action,
        "execution_result": execution_result
    }


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
    db = request.app.state.db

    from app.agent.orchestrator import OrchestratorAgent
    audio_player = getattr(request.app.state, 'audio_player', None)
    content_sync = getattr(request.app.state, 'content_sync', None)
    calendar_service = getattr(request.app.state, 'calendar_service', None)

    agent = OrchestratorAgent(
        db,
        audio_player=audio_player,
        content_sync=content_sync,
        calendar_service=calendar_service
    )

    result = None
    try:
        if action_type == ActionType.SELECT_NEXT_TRACK:
            result = await agent.decide_next_track()
        elif action_type == ActionType.CATEGORIZE_CONTENT:
            # List pending uploads that need classification
            pending = await db.pending_uploads.find({"status": "pending"}).to_list(10)
            results = []
            for upload in pending:
                classification = await agent.classify_content(
                    upload.get("filename", "unknown"),
                    upload.get("metadata", {})
                )
                results.append(classification)
            result = {"classifications": results}
        elif action_type == ActionType.INSERT_COMMERCIAL:
            # Trigger commercial insertion check
            from app.agent.decisions import DecisionEngine
            engine = DecisionEngine(db)
            result = await engine.check_commercial_timing()
        else:
            result = {"message": f"No handler for action type: {action_type.value}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent trigger failed: {str(e)}")

    return {
        "message": f"Agent triggered for {action_type.value}",
        "queued": False,
        "executed": True,
        "result": result
    }


# Chat endpoint for natural language communication
class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    response: str
    timestamp: str
    play_track: Optional[dict] = None  # Track to play in browser


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
    import anthropic

    db = request.app.state.db

    # Initialize agent (in production, this would be a singleton)
    audio_player = request.app.state.audio_player
    content_sync = request.app.state.content_sync
    calendar_service = getattr(request.app.state, 'calendar_service', None)
    agent = OrchestratorAgent(
        db,
        audio_player=audio_player,
        content_sync=content_sync,
        calendar_service=calendar_service
    )

    try:
        # Get response from agent
        result = await agent.chat(chat.message)
    except anthropic.AuthenticationError:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable: Invalid API key. Please configure ANTHROPIC_API_KEY in .env"
        )
    except anthropic.APIError as e:
        raise HTTPException(
            status_code=503,
            detail=f"AI service error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat error: {str(e)}"
        )

    return ChatResponse(
        response=result["response"],
        timestamp=datetime.utcnow().isoformat(),
        play_track=result.get("play_track")
    )


def convert_mongo_types(obj):
    """Recursively convert MongoDB types (ObjectId, datetime) to JSON-serializable types."""
    if isinstance(obj, dict):
        return {k: convert_mongo_types(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_mongo_types(item) for item in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj


@router.get("/chat/history")
async def get_chat_history(request: Request, limit: int = 50):
    """Get recent chat history."""
    db = request.app.state.db

    cursor = db.chat_logs.find().sort("timestamp", -1).limit(limit)

    history = []
    async for entry in cursor:
        # Recursively convert all MongoDB types to JSON-serializable types
        entry = convert_mongo_types(entry)
        history.append(entry)

    # Reverse to get chronological order
    return list(reversed(history))


@router.delete("/chat/history")
async def clear_chat_history(request: Request):
    """Clear chat history."""
    db = request.app.state.db
    await db.chat_logs.delete_many({})
    return {"message": "Chat history cleared"}
