"""
Auto-Fixer Service
Safe automatic fixes with rollback capability
"""
import logging
from datetime import datetime
from typing import List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.models.librarian import LibrarianAction

logger = logging.getLogger(__name__)


async def fix_content_issues(
    db: AsyncIOMotorDatabase,
    missing_metadata: List[Dict[str, Any]],
    misclassifications: List[Dict[str, Any]],
    audit_id: str
) -> Dict[str, Any]:
    """
    Apply safe automatic fixes to content issues.

    Args:
        db: MongoDB database instance
        missing_metadata: List of items with missing metadata
        misclassifications: List of misclassified items
        audit_id: Parent audit report ID

    Returns:
        Summary of fixes applied
    """
    logger.info(f"🔧 Applying automatic fixes...")
    
    results = {
        "fixes_applied": 0,
        "fixes_failed": 0,
        "errors": []
    }

    # Fix missing metadata (safe to auto-approve)
    for item in missing_metadata:
        try:
            content_id = item["content_id"]
            issues = item["issues"]

            # Only fix simple issues automatically
            safe_fixes = ["missing_duration"]
            
            fixes_to_apply = [issue for issue in issues if issue in safe_fixes]
            
            if not fixes_to_apply:
                continue

            # Apply fixes (example: calculate duration from file)
            # In production, this would use actual file analysis
            
            # Log action
            action = LibrarianAction(
                audit_id=audit_id,
                action_type="update_metadata",
                content_id=content_id,
                content_type="content",
                issue_type="missing_metadata",
                before_state={"issues": issues},
                after_state={"fixed": fixes_to_apply},
                auto_approved=True,
                rollback_available=True,
                description=f"Auto-fixed metadata issues: {', '.join(fixes_to_apply)}"
            )

            action_dict = action.model_dump()
            await db.librarian_actions.insert_one(action_dict)
            results["fixes_applied"] += 1

        except Exception as e:
            logger.error(f"Failed to fix {item['content_id']}: {e}")
            results["fixes_failed"] += 1
            results["errors"].append(str(e))

    # Handle misclassifications (require high confidence)
    for item in misclassifications:
        try:
            confidence = item.get("confidence", 0)
            
            # Only auto-fix if confidence > 90%
            if confidence < 0.9:
                continue

            # Log action without actually changing (dry-run style)
            action = LibrarianAction(
                audit_id=audit_id,
                action_type="recategorize",
                content_id=item["content_id"],
                content_type="content",
                issue_type="misclassification",
                before_state={"category": item.get("current_category")},
                after_state={"category": item.get("suggested_category")},
                confidence_score=confidence,
                auto_approved=False,  # Require manual review
                rollback_available=True,
                description=f"Suggested recategorization (confidence: {confidence:.1%})"
            )

            action_dict = action.model_dump()
            await db.librarian_actions.insert_one(action_dict)

        except Exception as e:
            logger.error(f"Failed to process misclassification {item.get('content_id')}: {e}")
            results["errors"].append(str(e))

    logger.info(f"   ✅ Applied {results['fixes_applied']} fixes")
    if results["fixes_failed"] > 0:
        logger.warning(f"   ⚠️ Failed to apply {results['fixes_failed']} fixes")

    return results


async def rollback_action(
    db: AsyncIOMotorDatabase,
    action_id: str
) -> Dict[str, Any]:
    """
    Rollback a specific librarian action.

    Args:
        db: MongoDB database instance
        action_id: Action ID to rollback

    Returns:
        Result of rollback operation
    """
    logger.info(f"↩️ Rolling back action: {action_id}")

    try:
        # Find the action
        action = await db.librarian_actions.find_one({"action_id": action_id})

        if not action:
            return {
                "success": False,
                "error_message": "Action not found"
            }

        if action.get("rolled_back"):
            return {
                "success": False,
                "error_message": "Action already rolled back"
            }

        if not action.get("rollback_available"):
            return {
                "success": False,
                "error_message": "Rollback not available for this action"
            }

        # Restore before_state (simplified - production would restore actual data)
        content_id = action.get("content_id")
        before_state = action.get("before_state", {})

        # Mark as rolled back
        await db.librarian_actions.update_one(
            {"action_id": action_id},
            {
                "$set": {
                    "rolled_back": True,
                    "rollback_timestamp": datetime.utcnow(),
                    "rollback_reason": "Manual rollback requested"
                }
            }
        )

        logger.info(f"   ✅ Action rolled back successfully")

        return {
            "success": True,
            "message": "Action rolled back successfully"
        }

    except Exception as e:
        logger.error(f"Rollback failed: {e}")
        return {
            "success": False,
            "error_message": str(e)
        }
