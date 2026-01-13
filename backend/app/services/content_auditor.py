"""
Content Auditor Service
AI-powered content validation using Claude API for classification verification
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)


async def audit_content_items(
    db: AsyncIOMotorDatabase,
    content_ids: List[str],
    audit_id: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Audit content items for metadata completeness and quality.

    Args:
        db: MongoDB database instance
        content_ids: List of content IDs to audit
        audit_id: Parent audit report ID
        dry_run: If true, only report issues without fixing

    Returns:
        Dictionary with audit results
    """
    logger.info(f"📚 Auditing {len(content_ids)} content items...")

    results = {
        "status": "completed",
        "items_checked": len(content_ids),
        "missing_metadata": [],
        "misclassifications": [],
        "issues_found": 0,
    }

    if not content_ids:
        return results

    # Fetch all content items
    try:
        object_ids = [ObjectId(cid) for cid in content_ids]
        contents_cursor = db.content.find({"_id": {"$in": object_ids}})
        contents = await contents_cursor.to_list(length=None)
    except Exception as e:
        logger.error(f"Error fetching content: {e}")
        return {"status": "failed", "error": str(e)}

    logger.info(f"   Found {len(contents)} content items in database")

    # Check metadata completeness
    logger.info("   Checking metadata completeness...")
    missing_metadata = await check_metadata_completeness(contents)
    results["missing_metadata"] = missing_metadata

    # Auto-fix if not dry run
    if not dry_run and missing_metadata:
        logger.info("   Auto-fixing issues...")
        try:
            from app.services.auto_fixer import fix_content_issues
            await fix_content_issues(db, missing_metadata, [], audit_id)
        except Exception as e:
            logger.warning(f"Auto-fix failed: {e}")

    results["issues_found"] = len(missing_metadata)

    logger.info(f"   ✅ Content audit complete: {results['issues_found']} issues found")
    return results


async def check_metadata_completeness(contents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Check for missing or incomplete metadata.

    Checks:
    - Missing title
    - Missing audio URL
    - Missing duration
    - Missing genre/type
    """
    missing_metadata = []

    for content in contents:
        issues = []

        # Check title
        if not content.get("title"):
            issues.append("missing_title")

        # Check audio URL
        if not content.get("audio_url") and not content.get("gcs_path"):
            issues.append("missing_audio_url")

        # Check duration
        if not content.get("duration"):
            issues.append("missing_duration")

        # Check genre/type
        if not content.get("genre") and not content.get("type"):
            issues.append("missing_genre")

        if issues:
            missing_metadata.append({
                "content_id": str(content["_id"]),
                "title": content.get("title", "Unknown"),
                "issues": issues,
                "fixable": False,  # May need manual review
            })

    logger.info(f"      Found {len(missing_metadata)} items with missing metadata")
    return missing_metadata


async def generate_ai_insights(audit_report: Dict[str, Any], language: str = "en") -> List[str]:
    """
    Generate AI-powered insights and recommendations from audit results.

    Uses Claude to analyze patterns and provide actionable recommendations.

    Args:
        audit_report: The audit report data to analyze
        language: Language code (en, he) for insights
    """
    insights = []

    try:
        from app.config import settings
        
        if not settings.anthropic_api_key:
            logger.warning("Anthropic API key not configured, skipping AI insights")
            return []

        import anthropic

        # Prepare audit summary for Claude
        summary_data = {
            "total_items": audit_report.get("summary", {}).get("total_items", 0),
            "issues_found": audit_report.get("summary", {}).get("issues_found", 0),
            "issues_fixed": audit_report.get("summary", {}).get("issues_fixed", 0),
            "broken_streams_count": len(audit_report.get("broken_streams", [])),
            "missing_metadata_count": len(audit_report.get("missing_metadata", [])),
        }

        # Sample some issues for context
        sample_issues = {
            "broken_streams": audit_report.get("broken_streams", [])[:5],
            "missing_metadata": audit_report.get("missing_metadata", [])[:5],
        }

        # Language-specific prompts
        prompts = {
            "en": f"""Analyze the following audit results and identify patterns and recommendations.

**Audit Summary:**
{summary_data}

**Sample Issues:**
{sample_issues}

Return 3-5 insights as a JSON array of strings: {{"insights": ["...", "..."]}}""",
            "he": f"""נתח את תוצאות הביקורת הבאות וזהה דפוסים והמלצות.

**סיכום ביקורת:**
{summary_data}

**דוגמאות בעיות:**
{sample_issues}

החזר 3-5 תובנות כמערך JSON של מחרוזות: {{"insights": ["...", "..."]}}"""
        }

        prompt = prompts.get(language, prompts["en"])

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text.strip()

        # Clean up response
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        import json
        data = json.loads(response_text.strip())
        insights = data.get("insights", [])

    except Exception as e:
        logger.warning(f"Failed to generate AI insights: {e}")
        insights = []

    return insights
