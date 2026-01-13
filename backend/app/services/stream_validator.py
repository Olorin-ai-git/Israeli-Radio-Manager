"""
Stream Validator Service
Validates streaming URLs for accessibility and health
"""
import logging
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.services.librarian_service import AuditScope

logger = logging.getLogger(__name__)


async def validate_content_streams(
    db: AsyncIOMotorDatabase,
    scope: AuditScope,
    audit_id: str
) -> Dict[str, Any]:
    """
    Validate streaming URLs for content items.

    Args:
        db: MongoDB database instance
        scope: Audit scope with content IDs
        audit_id: Parent audit report ID

    Returns:
        Dictionary with validation results
    """
    logger.info(f"🔗 Validating streams for {len(scope.content_ids)} content items...")

    results = {
        "status": "completed",
        "items_checked": len(scope.content_ids),
        "broken_streams": [],
        "cached_results": 0,
    }

    if not scope.content_ids:
        return results

    try:
        # Fetch content items
        object_ids = [ObjectId(cid) for cid in scope.content_ids]
        contents_cursor = db.content.find({"_id": {"$in": object_ids}})
        contents = await contents_cursor.to_list(length=None)

        broken_count = 0
        for content in contents:
            audio_url = content.get("audio_url") or content.get("gcs_path")
            
            if not audio_url:
                continue

            # Check cache first
            cache_entry = await db.stream_validation_cache.find_one({
                "stream_url": audio_url
            })

            now = datetime.utcnow()
            
            # Use cache if recent and not expired
            if cache_entry and cache_entry.get("expires_at") > now:
                if not cache_entry.get("is_valid"):
                    results["broken_streams"].append({
                        "content_id": str(content["_id"]),
                        "title": content.get("title", "Unknown"),
                        "url": audio_url,
                        "error": cache_entry.get("error_message", "Cached as broken"),
                        "cached": True
                    })
                    broken_count += 1
                results["cached_results"] += 1
                continue

            # Validate stream
            validation = await validate_stream_url(audio_url)

            # Cache result
            ttl_hours = 48 if validation["is_valid"] else 4
            expires_at = now + timedelta(hours=ttl_hours)

            await db.stream_validation_cache.update_one(
                {"stream_url": audio_url},
                {
                    "$set": {
                        "stream_url": audio_url,
                        "last_validated": now,
                        "is_valid": validation["is_valid"],
                        "status_code": validation.get("status_code"),
                        "response_time_ms": validation.get("response_time_ms"),
                        "error_message": validation.get("error_message"),
                        "expires_at": expires_at,
                    }
                },
                upsert=True
            )

            if not validation["is_valid"]:
                results["broken_streams"].append({
                    "content_id": str(content["_id"]),
                    "title": content.get("title", "Unknown"),
                    "url": audio_url,
                    "error": validation.get("error_message", "Unknown error"),
                    "status_code": validation.get("status_code"),
                })
                broken_count += 1

        logger.info(f"   Found {broken_count} broken streams")
        logger.info(f"   Used {results['cached_results']} cached results")

    except Exception as e:
        logger.error(f"Stream validation failed: {e}")
        return {"status": "failed", "error": str(e)}

    return results


async def validate_stream_url(url: str, timeout: int = 10) -> Dict[str, Any]:
    """
    Validate a streaming URL.

    Args:
        url: URL to validate
        timeout: Request timeout in seconds

    Returns:
        Validation result dictionary
    """
    result = {
        "url": url,
        "is_valid": False,
        "status_code": None,
        "response_time_ms": None,
        "error_message": None,
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            start_time = datetime.utcnow()
            response = await client.head(url, follow_redirects=True)
            end_time = datetime.utcnow()

            result["status_code"] = response.status_code
            result["response_time_ms"] = int((end_time - start_time).total_seconds() * 1000)
            result["is_valid"] = response.status_code == 200

            if response.status_code != 200:
                result["error_message"] = f"HTTP {response.status_code}"

    except httpx.TimeoutException:
        result["error_message"] = "Request timeout"
    except httpx.RequestError as e:
        result["error_message"] = f"Request error: {str(e)}"
    except Exception as e:
        result["error_message"] = f"Unexpected error: {str(e)}"

    return result
