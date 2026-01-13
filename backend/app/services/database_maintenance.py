"""
Database Maintenance Service
MongoDB health checks and maintenance tasks
"""
import logging
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def perform_database_maintenance(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """
    Perform database health checks and maintenance.

    Args:
        db: MongoDB database instance

    Returns:
        Database health report
    """
    logger.info("🗄️ Performing database maintenance...")

    health_report = {
        "status": "healthy",
        "connection_status": "healthy",
        "collections_checked": 0,
        "referential_integrity": "passed",
        "orphaned_documents": 0,
        "orphaned_items": [],
        "index_status": "all_present",
        "issues": []
    }

    try:
        # Check connection
        await db.command("ping")
        health_report["connection_status"] = "healthy"

        # Get collection names
        collections = await db.list_collection_names()
        health_report["collections_checked"] = len(collections)

        # Check for orphaned references
        orphaned_items = await check_orphaned_references(db)
        health_report["orphaned_items"] = orphaned_items
        health_report["orphaned_documents"] = len(orphaned_items)

        if len(orphaned_items) > 0:
            health_report["referential_integrity"] = "failed"
            health_report["issues"].append(f"Found {len(orphaned_items)} orphaned documents")

        # Check indexes
        index_check = await check_indexes(db)
        if not index_check["all_present"]:
            health_report["index_status"] = "missing_some"
            health_report["issues"].append("Some indexes are missing")

        # Overall status
        if health_report["issues"]:
            health_report["status"] = "needs_attention"

        logger.info(f"   Database status: {health_report['status']}")
        if health_report["issues"]:
            for issue in health_report["issues"]:
                logger.warning(f"   ⚠️ {issue}")

    except Exception as e:
        logger.error(f"Database maintenance failed: {e}")
        health_report["status"] = "unhealthy"
        health_report["connection_status"] = "failed"
        health_report["issues"].append(str(e))

    return health_report


async def check_orphaned_references(db: AsyncIOMotorDatabase) -> list:
    """
    Check for orphaned document references.

    Returns:
        List of orphaned items
    """
    orphaned = []

    try:
        # Example: Check if schedule slots reference non-existent content
        # This is a simplified check
        schedules_cursor = db.schedules.find({})
        schedules = await schedules_cursor.to_list(length=None)

        for schedule in schedules:
            if schedule.get("content_id"):
                content = await db.content.find_one({"_id": schedule["content_id"]})
                if not content:
                    orphaned.append({
                        "type": "schedule_slot",
                        "id": str(schedule["_id"]),
                        "issue": "References non-existent content",
                        "content_id": str(schedule["content_id"])
                    })

    except Exception as e:
        logger.warning(f"Orphan check failed: {e}")

    return orphaned


async def check_indexes(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """
    Check if all required indexes exist.

    Returns:
        Index status report
    """
    result = {
        "all_present": True,
        "missing_indexes": []
    }

    try:
        # Check critical indexes
        required_indexes = {
            "content": ["type", "genre"],
            "schedules": ["day_of_week"],
            "playback_logs": ["started_at"],
        }

        for collection_name, index_fields in required_indexes.items():
            collection = db[collection_name]
            existing_indexes = await collection.index_information()
            
            for field in index_fields:
                # Check if index exists (simplified check)
                index_exists = any(field in str(idx) for idx in existing_indexes.keys())
                
                if not index_exists:
                    result["all_present"] = False
                    result["missing_indexes"].append(f"{collection_name}.{field}")

    except Exception as e:
        logger.warning(f"Index check failed: {e}")
        result["all_present"] = False

    return result
