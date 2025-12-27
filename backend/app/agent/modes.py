"""Operating modes for the AI Orchestrator Agent."""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.agent import ActionType, AgentConfig

logger = logging.getLogger(__name__)


class OperatingMode(ABC):
    """Base class for agent operating modes."""

    def __init__(self, db: AsyncIOMotorDatabase, config: AgentConfig):
        self.db = db
        self.config = config

    @abstractmethod
    async def should_confirm(self, action_type: ActionType) -> bool:
        """Check if an action requires confirmation."""
        pass

    @abstractmethod
    async def handle_decision(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a decision based on the mode."""
        pass


class AutomationMode(OperatingMode):
    """
    Full Automation Mode - No human intervention required.

    All decisions are executed immediately without confirmation.
    Used for 24/7 unattended operation.
    """

    async def should_confirm(self, action_type: ActionType) -> bool:
        """In full automation, nothing requires confirmation."""
        return False

    async def handle_decision(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute decision immediately.

        In full automation mode, all decisions are approved automatically.
        """
        decision["status"] = "approved"
        decision["confirmed_by"] = "automation"
        decision["requires_confirmation"] = False

        logger.info(
            f"[FULL_AUTO] Executing {decision.get('action_type')}: "
            f"{decision.get('reasoning', 'No reasoning provided')[:50]}..."
        )

        return decision


class PromptMode(OperatingMode):
    """
    Prompt Mode - Certain actions require user confirmation.

    The agent will pause and wait for user approval on configured actions.
    Other actions proceed automatically.
    """

    async def should_confirm(self, action_type: ActionType) -> bool:
        """Check if action is in the confirmation required list."""
        return action_type in self.config.confirmation_required_actions

    async def handle_decision(self, decision: Dict[str, Any]) -> Dict[str, Any]:
        """
        Check if confirmation is needed and handle accordingly.
        """
        action_type = decision.get("action_type")

        if isinstance(action_type, str):
            try:
                action_type = ActionType(action_type)
            except ValueError:
                logger.warning(f"Unknown action type: {action_type}")
                decision["status"] = "approved"
                return decision

        if await self.should_confirm(action_type):
            decision["status"] = "pending_confirmation"
            decision["requires_confirmation"] = True

            logger.info(
                f"[PROMPT] Waiting for confirmation: {action_type.value}"
            )
        else:
            decision["status"] = "approved"
            decision["confirmed_by"] = "auto_approve"
            decision["requires_confirmation"] = False

            logger.info(
                f"[PROMPT] Auto-approved: {action_type.value}"
            )

        return decision


def get_mode_handler(
    db: AsyncIOMotorDatabase,
    config: AgentConfig
) -> OperatingMode:
    """
    Factory function to get the appropriate mode handler.

    Args:
        db: Database connection
        config: Agent configuration

    Returns:
        The appropriate mode handler
    """
    from app.models.agent import AgentMode

    if config.mode == AgentMode.FULL_AUTOMATION:
        return AutomationMode(db, config)
    else:
        return PromptMode(db, config)
