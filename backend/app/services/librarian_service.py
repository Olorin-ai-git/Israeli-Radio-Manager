"""
Librarian AI Agent Service
Main orchestrator for daily content auditing and maintenance
"""
import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.librarian import AuditReport, LibrarianAction

logger = logging.getLogger(__name__)


@dataclass
class AuditScope:
    """Defines the scope of items to audit"""
    content_ids: List[str] = field(default_factory=list)
    schedule_slot_ids: List[str] = field(default_factory=list)
    audit_type: str = "daily_incremental"


@dataclass
class AuditStats:
    """Statistics for a completed audit"""
    total_items: int = 0
    healthy_items: int = 0
    issues_found: int = 0
    issues_fixed: int = 0
    manual_review_needed: int = 0


async def run_daily_audit(
    db: AsyncIOMotorDatabase,
    audit_type: str = "daily_incremental",
    dry_run: bool = False,
    language: str = "en"
) -> Dict[str, Any]:
    """
    Main entry point for librarian audit.

    Args:
        db: MongoDB database instance
        audit_type: "daily_incremental", "weekly_full", or "manual"
        dry_run: If true, only report issues without fixing
        language: Language code for AI insights (en, he)

    Returns:
        Audit report as dictionary

    Workflow:
    1. Determine audit scope (incremental vs full)
    2. Audit all content types in parallel
    3. Perform database maintenance
    4. Generate comprehensive report
    5. Send notifications (if configured)
    """
    start_time = datetime.utcnow()
    logger.info("=" * 80)
    logger.info(f"🤖 Starting Librarian AI Agent - {audit_type}")
    logger.info(f"   Dry run: {dry_run}")
    logger.info("=" * 80)

    # Create audit report
    audit_report = AuditReport(
        audit_type=audit_type,
        status="in_progress",
        audit_date=start_time,
    )
    report_dict = audit_report.model_dump()
    result = await db.audit_reports.insert_one(report_dict)
    audit_id = audit_report.audit_id

    try:
        # Step 1: Determine audit scope
        logger.info("\n📋 Step 1: Determining audit scope...")
        scope = await determine_audit_scope(db, audit_type)
        logger.info(f"   Content items: {len(scope.content_ids)}")
        logger.info(f"   Schedule slots: {len(scope.schedule_slot_ids)}")

        # Step 2: Audit all content types in parallel
        logger.info("\n🔍 Step 2: Auditing all content types...")

        # Import services here to avoid circular imports
        from app.services.content_auditor import audit_content_items
        from app.services.stream_validator import validate_content_streams
        from app.services.database_maintenance import perform_database_maintenance

        # Run audits in parallel
        content_results, stream_results, db_health = await asyncio.gather(
            audit_content_items(db, scope.content_ids, audit_id, dry_run),
            validate_content_streams(db, scope, audit_id),
            perform_database_maintenance(db),
            return_exceptions=True
        )

        # Handle any exceptions
        if isinstance(content_results, Exception):
            logger.error(f"❌ Content audit failed: {content_results}")
            content_results = {"status": "failed", "error": str(content_results)}

        if isinstance(stream_results, Exception):
            logger.error(f"❌ Stream validation failed: {stream_results}")
            stream_results = {"status": "failed", "error": str(stream_results)}

        if isinstance(db_health, Exception):
            logger.error(f"❌ Database maintenance failed: {db_health}")
            db_health = {"status": "failed", "error": str(db_health)}

        # Step 3: Compile results
        logger.info("\n📊 Step 3: Compiling audit results...")
        
        # Extract issues from results
        broken_streams = stream_results.get("broken_streams", [])
        missing_metadata = content_results.get("missing_metadata", [])
        misclassifications = content_results.get("misclassifications", [])
        orphaned_items = db_health.get("orphaned_items", [])

        # Get actions taken
        actions_cursor = db.librarian_actions.find({"audit_id": audit_id})
        actions = await actions_cursor.to_list(length=None)

        fixes_applied = [
            {
                "action_id": str(action.get("action_id")),
                "action_type": action.get("action_type"),
                "content_id": action.get("content_id"),
                "description": action.get("description"),
            }
            for action in actions if action.get("auto_approved")
        ]

        # Calculate summary stats
        total_issues = (
            len(broken_streams) +
            len(missing_metadata) +
            len(misclassifications) +
            len(orphaned_items)
        )

        summary = {
            "total_items": len(scope.content_ids) + len(scope.schedule_slot_ids),
            "issues_found": total_issues,
            "issues_fixed": len(fixes_applied),
            "manual_review_needed": len([]),
            "healthy_items": (len(scope.content_ids) - total_issues),
        }

        # Step 4: Generate AI insights
        logger.info("\n🧠 Step 4: Generating AI insights...")
        ai_insights = []
        try:
            from app.services.content_auditor import generate_ai_insights
            temp_report = {
                "summary": summary,
                "broken_streams": broken_streams,
                "missing_metadata": missing_metadata,
                "misclassifications": misclassifications,
                "orphaned_items": orphaned_items,
            }
            ai_insights = await generate_ai_insights(temp_report, language=language)
        except Exception as e:
            logger.warning(f"⚠️ Failed to generate AI insights: {e}")

        # Step 5: Finalize report
        end_time = datetime.utcnow()
        execution_time = (end_time - start_time).total_seconds()

        # Update report in database
        await db.audit_reports.update_one(
            {"audit_id": audit_id},
            {
                "$set": {
                    "execution_time_seconds": execution_time,
                    "status": "completed",
                    "summary": summary,
                    "content_results": content_results,
                    "broken_streams": broken_streams,
                    "missing_metadata": missing_metadata,
                    "misclassifications": misclassifications,
                    "orphaned_items": orphaned_items,
                    "fixes_applied": fixes_applied,
                    "database_health": db_health,
                    "ai_insights": ai_insights,
                    "completed_at": end_time,
                }
            }
        )

        # Final summary
        logger.info("\n" + "=" * 80)
        logger.info("✅ Librarian Audit Complete")
        logger.info(f"   Total items checked: {summary['total_items']}")
        logger.info(f"   Issues found: {summary['issues_found']}")
        logger.info(f"   Issues fixed: {summary['issues_fixed']}")
        logger.info(f"   Execution time: {execution_time:.2f}s")
        logger.info("=" * 80 + "\n")

        # Return updated report
        return await db.audit_reports.find_one({"audit_id": audit_id})

    except Exception as e:
        logger.error(f"❌ Audit failed: {e}", exc_info=True)
        await db.audit_reports.update_one(
            {"audit_id": audit_id},
            {
                "$set": {
                    "status": "failed",
                    "database_health": {"error": str(e)}
                }
            }
        )
        raise


async def determine_audit_scope(db: AsyncIOMotorDatabase, audit_type: str) -> AuditScope:
    """
    Determine which items to audit based on audit type.

    Strategies:
    - daily_incremental: Items modified in last 7 days + random 10% sample
    - weekly_full: All items
    - manual: All items (customizable in future)
    """
    scope = AuditScope(audit_type=audit_type)
    now = datetime.utcnow()

    if audit_type == "daily_incremental":
        # Get items modified in last 7 days
        seven_days_ago = now - timedelta(days=7)

        # Content
        recent_content_cursor = db.content.find({"updated_at": {"$gte": seven_days_ago}})
        recent_content = await recent_content_cursor.to_list(length=None)
        scope.content_ids = [str(c["_id"]) for c in recent_content]

        # Add random 10% sample of older items
        older_content_cursor = db.content.find({"updated_at": {"$lt": seven_days_ago}})
        older_content = await older_content_cursor.to_list(length=None)

        if older_content:
            sample_size = max(1, len(older_content) // 10)  # 10%
            sampled = random.sample(older_content, min(sample_size, len(older_content)))
            scope.content_ids.extend([str(c["_id"]) for c in sampled])

        # Schedule slots (check recent ones)
        recent_slots_cursor = db.schedules.find({})
        recent_slots = await recent_slots_cursor.to_list(length=100)
        scope.schedule_slot_ids = [str(s["_id"]) for s in recent_slots]

    elif audit_type in ["weekly_full", "manual"]:
        # Full audit - get all items
        all_content_cursor = db.content.find({})
        all_content = await all_content_cursor.to_list(length=None)
        scope.content_ids = [str(c["_id"]) for c in all_content]

        all_slots_cursor = db.schedules.find({})
        all_slots = await all_slots_cursor.to_list(length=None)
        scope.schedule_slot_ids = [str(s["_id"]) for s in all_slots]

    return scope


async def get_latest_audit_report(db: AsyncIOMotorDatabase) -> Optional[Dict[str, Any]]:
    """Get the most recent audit report"""
    reports_cursor = db.audit_reports.find({"status": "completed"}).sort([("audit_date", -1)]).limit(1)
    reports = await reports_cursor.to_list(length=1)
    return reports[0] if reports else None


async def get_audit_statistics(db: AsyncIOMotorDatabase, days: int = 30) -> Dict[str, Any]:
    """
    Get audit statistics for the last N days.

    Returns metrics like:
    - Total audits run
    - Average execution time
    - Total issues found
    - Total issues fixed
    - Fix success rate
    """
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Count all audits (completed and partial)
    reports_cursor = db.audit_reports.find({"audit_date": {"$gte": cutoff_date}})
    reports = await reports_cursor.to_list(length=None)

    if not reports:
        return {
            "period_days": days,
            "total_audits": 0,
            "avg_execution_time": 0,
            "total_issues_found": 0,
            "total_issues_fixed": 0,
            "fix_success_rate": 0,
        }

    # Get audit IDs for action counting
    audit_ids = [r["audit_id"] for r in reports]

    # Count actual LibrarianAction records
    total_actions = await db.librarian_actions.count_documents(
        {"audit_id": {"$in": audit_ids}}
    )

    total_execution_time = sum(r.get("execution_time_seconds", 0) for r in reports)

    # For issues found, try to get from summary
    total_issues_from_summary = sum(
        r.get("summary", {}).get("issues_found", 0) for r in reports
    )
    # If summaries show 0 but we have actions, use action count as estimate
    total_issues = max(total_issues_from_summary, total_actions)

    # Calculate average execution time
    reports_with_time = [r for r in reports if r.get("execution_time_seconds")]
    avg_execution_time = (
        total_execution_time / len(reports_with_time) if reports_with_time else 0
    )

    return {
        "period_days": days,
        "total_audits": len(reports),
        "avg_execution_time": avg_execution_time,
        "total_issues_found": total_issues,
        "total_issues_fixed": total_actions,
        "fix_success_rate": (total_actions / total_issues * 100) if total_issues > 0 else 0,
        "last_audit_date": reports[0].get("audit_date") if reports else None,
    }
