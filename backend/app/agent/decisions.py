"""Decision execution engine for the AI Agent."""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.content import ContentType
from app.models.agent import ActionType

logger = logging.getLogger(__name__)


class DecisionEngine:
    """
    Executes decisions made by the AI Orchestrator.

    Handles the actual implementation of:
    - Track selection and queuing
    - Content categorization and filing
    - Commercial insertion
    - Error handling
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def execute_track_selection(
        self,
        decision: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a track selection decision.

        Args:
            decision: Decision dict from the orchestrator

        Returns:
            Execution result
        """
        suggestion = decision.get("suggestion", {})
        content_type = suggestion.get("content_type", "song")
        genre = suggestion.get("genre")
        specific_id = suggestion.get("specific_id")

        # If specific content requested
        if specific_id:
            content = await self.db.content.find_one({"_id": ObjectId(specific_id)})
            if content:
                content["_id"] = str(content["_id"])
                return {
                    "success": True,
                    "content": content,
                    "action": "play_specific"
                }

        # Query for content based on type and genre
        query: Dict[str, Any] = {
            "type": content_type,
            "active": True
        }

        if genre:
            query["genre"] = genre

        # Get recently played to exclude
        recent_ids = decision.get("context", {}).get("recent_plays", [])
        if recent_ids:
            query["_id"] = {"$nin": [ObjectId(rid) for rid in recent_ids if ObjectId.is_valid(rid)]}

        # Find best candidate
        content = await self.db.content.find_one(
            query,
            sort=[("play_count", 1), ("last_played", 1)]  # Prefer less played, older
        )

        if content:
            # Update play stats
            await self.db.content.update_one(
                {"_id": content["_id"]},
                {
                    "$set": {"last_played": datetime.utcnow()},
                    "$inc": {"play_count": 1}
                }
            )

            content["_id"] = str(content["_id"])
            return {
                "success": True,
                "content": content,
                "action": "play_selected"
            }

        # Fallback - any content of the type
        fallback = await self.db.content.find_one(
            {"type": content_type, "active": True}
        )
        if fallback:
            fallback["_id"] = str(fallback["_id"])
            return {
                "success": True,
                "content": fallback,
                "action": "play_fallback",
                "warning": "Used fallback selection"
            }

        return {
            "success": False,
            "error": f"No {content_type} content available"
        }

    async def execute_categorization(
        self,
        decision: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a content categorization decision.

        Args:
            decision: Classification decision from the orchestrator

        Returns:
            Execution result
        """
        content_type = decision.get("suggested_type")
        genre = decision.get("suggested_genre")
        filename = decision.get("filename")

        if not content_type:
            return {
                "success": False,
                "error": "No content type specified"
            }

        # Determine Google Drive folder path
        folder_path = self._get_folder_path(content_type, genre)

        return {
            "success": True,
            "content_type": content_type,
            "genre": genre,
            "folder_path": folder_path,
            "action": "categorize",
            "message": f"File should be moved to: {folder_path}"
        }

    async def execute_commercial_insert(
        self,
        decision: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute a commercial insertion decision.

        Returns the next commercial to play.
        """
        # Get recently played commercials
        recent = await self.db.playback_logs.find(
            {"content_type": ContentType.COMMERCIAL.value}
        ).sort("started_at", -1).limit(5).to_list(5)

        recent_ids = [r.get("content_id") for r in recent]

        # Find a commercial not recently played
        query: Dict[str, Any] = {"type": ContentType.COMMERCIAL.value, "active": True}
        if recent_ids:
            query["_id"] = {"$nin": [ObjectId(rid) for rid in recent_ids if ObjectId.is_valid(rid)]}

        commercial = await self.db.content.find_one(
            query,
            sort=[("play_count", 1)]
        )

        if commercial:
            commercial["_id"] = str(commercial["_id"])
            return {
                "success": True,
                "content": commercial,
                "action": "play_commercial"
            }

        # Fallback to any commercial
        any_commercial = await self.db.content.find_one(
            {"type": ContentType.COMMERCIAL.value, "active": True}
        )
        if any_commercial:
            any_commercial["_id"] = str(any_commercial["_id"])
            return {
                "success": True,
                "content": any_commercial,
                "action": "play_commercial",
                "warning": "Repeated commercial due to limited selection"
            }

        return {
            "success": False,
            "error": "No commercials available"
        }

    def _get_folder_path(
        self,
        content_type: str,
        genre: Optional[str]
    ) -> str:
        """Determine the Google Drive folder path for content."""
        if content_type == "song":
            if genre:
                return f"Songs/{genre.title()}"
            return "Songs/Uncategorized"
        elif content_type == "show":
            return "Shows"
        elif content_type == "commercial":
            return "Commercials/Active"
        else:
            return "Uncategorized"

    async def get_next_content(
        self,
        preferred_type: Optional[ContentType] = None,
        preferred_genre: Optional[str] = None,
        exclude_ids: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the next piece of content to play.

        Utility method for simpler queries.
        """
        query: Dict[str, Any] = {"active": True}

        if preferred_type:
            query["type"] = preferred_type.value

        if preferred_genre:
            query["genre"] = preferred_genre

        if exclude_ids:
            valid_ids = [ObjectId(eid) for eid in exclude_ids if ObjectId.is_valid(eid)]
            if valid_ids:
                query["_id"] = {"$nin": valid_ids}

        content = await self.db.content.find_one(
            query,
            sort=[("last_played", 1), ("play_count", 1)]
        )

        if content:
            content["_id"] = str(content["_id"])

        return content
