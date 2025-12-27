"""Main AI Orchestrator Agent for radio automation."""

import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from anthropic import Anthropic

from app.config import settings
from app.models.agent import (
    AgentConfig, AgentMode, ActionType, PendingAction, ActionStatus
)
from app.models.content import ContentType
from app.agent.prompts import SYSTEM_PROMPT, get_decision_prompt, get_classification_prompt
from app.agent.decisions import DecisionEngine
from app.agent.confirmation import ConfirmationManager
from app.agent.tasks import TaskExecutor, ParsedTask, TaskType

logger = logging.getLogger(__name__)


class OrchestratorAgent:
    """
    AI Orchestrator Agent that manages radio station operations.

    Operates in two modes:
    - Full Automation: Makes all decisions autonomously
    - Prompt Mode: Requires user confirmation for certain actions

    Capabilities:
    - Select next track based on schedule and history
    - Classify incoming content (song/show/commercial, genre)
    - Handle email attachments
    - Manage commercial breaks
    - Respond to natural language commands via chat
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        anthropic_api_key: Optional[str] = None
    ):
        self.db = db
        self._client = Anthropic(api_key=anthropic_api_key or settings.anthropic_api_key)
        self._config: Optional[AgentConfig] = None
        self._decision_engine = DecisionEngine(db)
        self._confirmation_manager = ConfirmationManager(db)
        self._task_executor = TaskExecutor(db)

        # Conversation history for chat
        self._chat_history: List[Dict[str, str]] = []

    async def get_config(self) -> AgentConfig:
        """Load or get cached agent configuration."""
        if self._config is None:
            config_doc = await self.db.agent_config.find_one({"_id": "default"})
            if config_doc:
                self._config = AgentConfig(**config_doc)
            else:
                self._config = AgentConfig()
        return self._config

    async def refresh_config(self):
        """Force reload of configuration."""
        self._config = None
        await self.get_config()

    @property
    async def mode(self) -> AgentMode:
        """Get current operating mode."""
        config = await self.get_config()
        return config.mode

    async def requires_confirmation(self, action_type: ActionType) -> bool:
        """Check if an action type requires user confirmation."""
        config = await self.get_config()

        # In full automation mode, nothing requires confirmation
        if config.mode == AgentMode.FULL_AUTOMATION:
            return False

        # In prompt mode, check the configured actions
        return action_type in config.confirmation_required_actions

    async def decide_next_track(self) -> Dict[str, Any]:
        """
        Decide what track to play next.

        Uses AI to analyze:
        - Current time and schedule rules
        - Recent play history
        - Genre preferences for the hour
        - Commercial break timing

        Returns:
            Decision dict with track info and reasoning
        """
        config = await self.get_config()

        # Gather context
        context = await self._gather_playback_context()

        # Get AI decision
        prompt = get_decision_prompt("next_track", context)
        response = await self._call_claude(prompt)

        decision = {
            "action_type": ActionType.SELECT_NEXT_TRACK,
            "suggestion": response,
            "context": context,
            "reasoning": response.get("reasoning", ""),
            "timestamp": datetime.utcnow()
        }

        # Check if confirmation needed
        if await self.requires_confirmation(ActionType.SELECT_NEXT_TRACK):
            pending = await self._create_pending_action(decision)
            decision["pending_action_id"] = pending["_id"]
            decision["status"] = "pending_confirmation"
        else:
            decision["status"] = "approved"

        # Log decision
        await self._log_decision(decision)
        return decision

    async def classify_content(
        self,
        filename: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Classify new audio content using AI.

        Args:
            filename: Name of the audio file
            metadata: Extracted audio metadata (ID3 tags, etc.)

        Returns:
            Classification with type, genre, and confidence
        """
        config = await self.get_config()

        # Build classification prompt
        prompt = get_classification_prompt(filename, metadata)
        response = await self._call_claude(prompt)

        classification = {
            "action_type": ActionType.CATEGORIZE_CONTENT,
            "filename": filename,
            "suggested_type": response.get("type"),
            "suggested_genre": response.get("genre"),
            "confidence": response.get("confidence", 0.0),
            "reasoning": response.get("reasoning", ""),
            "timestamp": datetime.utcnow()
        }

        # Check confidence threshold
        if classification["confidence"] < config.automation_rules.auto_categorize_threshold:
            # Low confidence - always ask for confirmation
            classification["requires_confirmation"] = True
        elif await self.requires_confirmation(ActionType.CATEGORIZE_CONTENT):
            classification["requires_confirmation"] = True
        else:
            classification["requires_confirmation"] = False

        if classification["requires_confirmation"]:
            pending = await self._create_pending_action(classification)
            classification["pending_action_id"] = str(pending["_id"])
            classification["status"] = "pending_confirmation"
        else:
            classification["status"] = "approved"

        await self._log_decision(classification)
        return classification

    async def chat(self, user_message: str) -> str:
        """
        Handle natural language chat with the user.

        Allows operators to:
        - Ask questions about the schedule
        - Request specific songs/shows
        - Get status updates
        - Give instructions to the agent
        - Execute tasks like "play song X at Y time"

        Args:
            user_message: User's message in natural language

        Returns:
            Agent's response
        """
        # Add to history
        self._chat_history.append({
            "role": "user",
            "content": user_message
        })

        # Keep history manageable
        if len(self._chat_history) > 20:
            self._chat_history = self._chat_history[-20:]

        # Get current context for the agent
        context = await self._gather_chat_context()

        # Build messages for Claude
        messages = [
            {"role": "user", "content": f"הקשר נוכחי / Current context:\n{context}"},
            *self._chat_history
        ]

        # Call Claude
        response = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages
        )

        assistant_message = response.content[0].text

        # Check if response contains a task to execute
        task_result = await self._try_execute_task(assistant_message, user_message)
        if task_result:
            # Use the task result as the response
            final_response = task_result.get("message", assistant_message)

            # If task was executed, add action confirmation
            if task_result.get("success"):
                # Execute any actions
                action = task_result.get("action")
                if action:
                    await self._execute_action(action, task_result)
        else:
            final_response = assistant_message

        # Add response to history
        self._chat_history.append({
            "role": "assistant",
            "content": final_response
        })

        # Log the interaction
        await self.db.chat_logs.insert_one({
            "user_message": user_message,
            "assistant_message": final_response,
            "task_executed": task_result is not None,
            "task_result": task_result,
            "timestamp": datetime.utcnow()
        })

        return final_response

    async def _try_execute_task(self, ai_response: str, original_message: str) -> Optional[Dict[str, Any]]:
        """
        Try to parse and execute a task from the AI response.

        Returns:
            Task result if a task was found and executed, None otherwise
        """
        import json

        # Try to find JSON in the response
        try:
            # Look for JSON block
            start = ai_response.find('{')
            end = ai_response.rfind('}') + 1

            if start >= 0 and end > start:
                json_str = ai_response[start:end]
                task_data = json.loads(json_str)

                # Check if this is a task
                if "task_type" in task_data:
                    task_type_str = task_data.get("task_type", "unknown")
                    try:
                        task_type = TaskType(task_type_str)
                    except ValueError:
                        task_type = TaskType.UNKNOWN

                    # Parse time if present
                    parameters = task_data.get("parameters", {})
                    time_str = parameters.get("time")
                    scheduled_time = None
                    if time_str:
                        scheduled_time = self._parse_time(time_str)

                    # Create and execute task
                    task = ParsedTask(
                        task_type=task_type,
                        parameters=parameters,
                        original_text=original_message,
                        confidence=task_data.get("confidence", 0.8)
                    )
                    task.scheduled_time = scheduled_time

                    result = await self._task_executor.execute_task(task)

                    # Add the custom response message if present
                    if "response_message" in task_data:
                        result["message"] = task_data["response_message"]

                    return result

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            logger.debug(f"No task found in response: {e}")

        return None

    def _parse_time(self, time_str: str) -> Optional[datetime]:
        """Parse a time string into a datetime object."""
        import re

        now = datetime.now()

        # Try HH:MM format
        match = re.match(r"(\d{1,2}):(\d{2})", time_str)
        if match:
            hour, minute = int(match.group(1)), int(match.group(2))
            result = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            # If time is in the past, schedule for tomorrow
            if result < now:
                result += timedelta(days=1)
            return result

        # Try relative time patterns
        relative_patterns = [
            (r"בעוד (\d+) דקות?", lambda m: now + timedelta(minutes=int(m.group(1)))),
            (r"בעוד (\d+) שעות?", lambda m: now + timedelta(hours=int(m.group(1)))),
            (r"in (\d+) minutes?", lambda m: now + timedelta(minutes=int(m.group(1)))),
            (r"in (\d+) hours?", lambda m: now + timedelta(hours=int(m.group(1)))),
        ]

        for pattern, handler in relative_patterns:
            match = re.search(pattern, time_str, re.IGNORECASE)
            if match:
                return handler(match)

        return None

    async def _execute_action(self, action: str, task_result: Dict[str, Any]):
        """Execute a playback action from a task result."""
        # This would integrate with the audio player service
        # For now, we log the action
        await self.db.action_log.insert_one({
            "action": action,
            "task_result": task_result,
            "executed_at": datetime.utcnow()
        })
        logger.info(f"Executed action: {action}")

    async def execute_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute an approved action."""
        action_type = action.get("action_type")

        if action_type == ActionType.SELECT_NEXT_TRACK:
            return await self._decision_engine.execute_track_selection(action)
        elif action_type == ActionType.CATEGORIZE_CONTENT:
            return await self._decision_engine.execute_categorization(action)
        elif action_type == ActionType.INSERT_COMMERCIAL:
            return await self._decision_engine.execute_commercial_insert(action)
        else:
            logger.warning(f"Unknown action type: {action_type}")
            return {"error": f"Unknown action type: {action_type}"}

    async def _gather_playback_context(self) -> Dict[str, Any]:
        """Gather context for playback decisions."""
        now = datetime.utcnow()

        # Get recent plays
        recent = await self.db.playback_logs.find(
            {"started_at": {"$gte": now - timedelta(hours=4)}}
        ).to_list(50)

        # Get current schedule slot
        current_slot = await self.db.schedules.find_one({
            "enabled": True,
            "start_time": {"$lte": now.strftime("%H:%M")},
            "end_time": {"$gt": now.strftime("%H:%M")}
        })

        # Get content stats
        song_count = await self.db.content.count_documents({"type": "song", "active": True})
        show_count = await self.db.content.count_documents({"type": "show", "active": True})
        commercial_count = await self.db.content.count_documents({"type": "commercial", "active": True})

        return {
            "current_time": now.isoformat(),
            "current_hour": now.hour,
            "day_of_week": now.weekday(),
            "recent_plays": [str(r.get("content_id")) for r in recent],
            "current_schedule_slot": current_slot,
            "content_counts": {
                "songs": song_count,
                "shows": show_count,
                "commercials": commercial_count
            }
        }

    async def _gather_chat_context(self) -> str:
        """Gather context for chat responses."""
        now = datetime.utcnow()

        # Get current playing
        status = {"state": "unknown"}  # TODO: Get from audio player

        # Get pending actions
        pending = await self.db.pending_actions.count_documents({"status": "pending"})

        context = f"""
Current time: {now.strftime("%H:%M")} ({now.strftime("%A")})
Playback status: {status.get('state', 'unknown')}
Pending confirmations: {pending}
Agent mode: {(await self.get_config()).mode.value}
"""
        return context

    async def _call_claude(self, prompt: str) -> Dict[str, Any]:
        """Call Claude API and parse response."""
        import json

        response = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.content[0].text

        # Try to parse as JSON
        try:
            # Find JSON in response
            start = content.find('{')
            end = content.rfind('}') + 1
            if start >= 0 and end > start:
                return json.loads(content[start:end])
        except json.JSONDecodeError:
            pass

        return {"raw_response": content}

    async def _create_pending_action(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        """Create a pending action for user confirmation."""
        config = await self.get_config()
        action_type = decision.get("action_type")

        # Determine timeout
        timeout_key = action_type.value if isinstance(action_type, ActionType) else str(action_type)
        timeout_seconds = config.timeouts.get(timeout_key, config.timeouts.get("default", 300))

        pending = {
            "action_type": action_type.value if isinstance(action_type, ActionType) else str(action_type),
            "description": decision.get("reasoning", "Action requires confirmation"),
            "description_he": decision.get("reasoning_he", "פעולה דורשת אישור"),
            "ai_reasoning": decision.get("reasoning", ""),
            "suggested_action": decision,
            "alternatives": [],
            "context": decision.get("context", {}),
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(seconds=timeout_seconds),
            "status": ActionStatus.PENDING.value
        }

        result = await self.db.pending_actions.insert_one(pending)
        pending["_id"] = str(result.inserted_id)

        return pending

    async def _log_decision(self, decision: Dict[str, Any]):
        """Log a decision to the database."""
        log_entry = {
            "action_type": decision.get("action_type").value if isinstance(decision.get("action_type"), ActionType) else str(decision.get("action_type")),
            "decision": decision,
            "reasoning": decision.get("reasoning", ""),
            "mode": (await self.get_config()).mode.value,
            "created_at": datetime.utcnow()
        }
        await self.db.agent_decisions.insert_one(log_entry)
