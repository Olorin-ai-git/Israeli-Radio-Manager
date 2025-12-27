"""Confirmation flow manager for prompt mode."""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.agent import ActionStatus, ActionType

logger = logging.getLogger(__name__)


class ConfirmationManager:
    """
    Manages the confirmation flow for actions in prompt mode.

    Handles:
    - Creating pending actions
    - Waiting for user response
    - Handling timeouts
    - Processing approvals/rejections
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_pending_actions(
        self,
        action_type: Optional[ActionType] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get all pending actions."""
        query = {"status": ActionStatus.PENDING.value}
        if action_type:
            query["action_type"] = action_type.value

        cursor = self.db.pending_actions.find(query).sort("created_at", -1).limit(limit)

        actions = []
        async for action in cursor:
            action["_id"] = str(action["_id"])
            actions.append(action)

        return actions

    async def get_pending_action(self, action_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific pending action."""
        action = await self.db.pending_actions.find_one({"_id": ObjectId(action_id)})
        if action:
            action["_id"] = str(action["_id"])
        return action

    async def approve_action(
        self,
        action_id: str,
        response_channel: str = "dashboard",
        use_alternative: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Approve a pending action.

        Args:
            action_id: ID of the pending action
            response_channel: How the response was received
            use_alternative: Index of alternative to use instead of suggestion

        Returns:
            The updated action
        """
        action = await self.db.pending_actions.find_one({"_id": ObjectId(action_id)})
        if not action:
            return {"error": "Action not found"}

        if action["status"] != ActionStatus.PENDING.value:
            return {"error": "Action already processed"}

        # Determine final action
        if use_alternative is not None and action.get("alternatives"):
            if 0 <= use_alternative < len(action["alternatives"]):
                final_action = action["alternatives"][use_alternative]
            else:
                return {"error": "Invalid alternative index"}
        else:
            final_action = action["suggested_action"]

        # Update the action
        await self.db.pending_actions.update_one(
            {"_id": ObjectId(action_id)},
            {
                "$set": {
                    "status": ActionStatus.APPROVED.value,
                    "responded_by": "user",
                    "response_channel": response_channel,
                    "final_action": final_action,
                    "executed_at": datetime.utcnow()
                }
            }
        )

        action["status"] = ActionStatus.APPROVED.value
        action["final_action"] = final_action
        action["_id"] = str(action["_id"])

        logger.info(f"Action {action_id} approved via {response_channel}")
        return action

    async def reject_action(
        self,
        action_id: str,
        reason: Optional[str] = None,
        response_channel: str = "dashboard"
    ) -> Dict[str, Any]:
        """
        Reject a pending action.

        Args:
            action_id: ID of the pending action
            reason: Optional rejection reason
            response_channel: How the response was received

        Returns:
            The updated action
        """
        action = await self.db.pending_actions.find_one({"_id": ObjectId(action_id)})
        if not action:
            return {"error": "Action not found"}

        if action["status"] != ActionStatus.PENDING.value:
            return {"error": "Action already processed"}

        await self.db.pending_actions.update_one(
            {"_id": ObjectId(action_id)},
            {
                "$set": {
                    "status": ActionStatus.REJECTED.value,
                    "responded_by": "user",
                    "response_channel": response_channel,
                    "rejection_reason": reason,
                    "executed_at": datetime.utcnow()
                }
            }
        )

        action["status"] = ActionStatus.REJECTED.value
        action["_id"] = str(action["_id"])

        logger.info(f"Action {action_id} rejected via {response_channel}")
        return action

    async def process_expired_actions(self) -> List[Dict[str, Any]]:
        """
        Process actions that have exceeded their timeout.

        Called periodically to handle timeouts.

        Returns:
            List of processed actions
        """
        now = datetime.utcnow()

        # Find expired pending actions
        cursor = self.db.pending_actions.find({
            "status": ActionStatus.PENDING.value,
            "expires_at": {"$lt": now}
        })

        processed = []
        async for action in cursor:
            action_id = str(action["_id"])
            action_type = action.get("action_type")

            # Get timeout default for this action type
            config = await self.db.agent_config.find_one({"_id": "default"})
            timeout_defaults = config.get("timeout_defaults", {}) if config else {}
            default_action = timeout_defaults.get(action_type, "reject")

            if default_action == "approve":
                result = await self.approve_action(action_id, "timeout")
            else:
                result = await self.reject_action(
                    action_id,
                    reason="Timeout - no response received",
                    response_channel="timeout"
                )

            # Update to timeout status
            await self.db.pending_actions.update_one(
                {"_id": action["_id"]},
                {"$set": {"responded_by": "timeout"}}
            )

            result["timeout"] = True
            processed.append(result)

            logger.info(f"Action {action_id} timed out - {default_action}")

        return processed

    async def process_sms_response(
        self,
        from_phone: str,
        message: str
    ) -> Optional[Dict[str, Any]]:
        """
        Process an SMS response (YES/NO).

        Args:
            from_phone: Phone number the response came from
            message: SMS message content

        Returns:
            The processed action or None
        """
        message_lower = message.strip().lower()

        # Determine response
        if message_lower in ["yes", "y", "כן", "אשר"]:
            approve = True
        elif message_lower in ["no", "n", "לא", "דחה"]:
            approve = False
        else:
            logger.warning(f"Unrecognized SMS response: {message}")
            return None

        # Get most recent pending action
        action = await self.db.pending_actions.find_one(
            {"status": ActionStatus.PENDING.value},
            sort=[("created_at", -1)]
        )

        if not action:
            logger.warning("No pending action found for SMS response")
            return None

        action_id = str(action["_id"])

        if approve:
            return await self.approve_action(action_id, "sms")
        else:
            return await self.reject_action(
                action_id,
                reason="Rejected via SMS",
                response_channel="sms"
            )

    async def get_pending_count(self) -> int:
        """Get count of pending actions."""
        return await self.db.pending_actions.count_documents({
            "status": ActionStatus.PENDING.value
        })
