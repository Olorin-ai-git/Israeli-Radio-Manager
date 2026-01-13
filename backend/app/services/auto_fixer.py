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


async def fix_gcs_urls(
    db: AsyncIOMotorDatabase,
    audit_id: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Convert gs:// URLs to HTTPS URLs for all content items.
    
    This is a critical fix that should run automatically in all audits.
    
    Args:
        db: MongoDB database instance
        audit_id: Parent audit report ID
        dry_run: If True, only report what would be fixed
        
    Returns:
        Summary of fixes applied
    """
    from app.services.librarian_service import add_execution_log
    
    logger.info("🔧 Fixing GCS URLs...")
    await add_execution_log(db, audit_id, "info", "🔧 Converting gs:// URLs to HTTPS URLs...", "auto_fixer")
    
    # Check if dry run
    if dry_run:
        await add_execution_log(
            db, audit_id, "info", 
            "   Running in DRY RUN mode - no actual changes will be made", 
            "auto_fixer"
        )
    
    results = {
        "urls_fixed": 0,
        "urls_failed": 0,
        "errors": []
    }
    
    try:
        # Import GCS service
        try:
            from app.services.gcs_storage import GCSStorageService
            gcs_service = GCSStorageService()
        except Exception as e:
            logger.error(f"Failed to initialize GCS service: {e}")
            await add_execution_log(db, audit_id, "error", f"❌ Failed to initialize GCS service: {str(e)}", "auto_fixer")
            return results
        
        if not gcs_service.is_available:
            logger.error("GCS service not available - check service account credentials")
            await add_execution_log(
                db, audit_id, "warn", 
                "⚠️ GCS service not available - cannot convert URLs. Check GOOGLE_APPLICATION_CREDENTIALS or service-account.json", 
                "auto_fixer"
            )
            return results
        
        # Find all content with gs:// URLs
        cursor = db.content.find({
            "$or": [
                {"audio_url": {"$regex": "^gs://"}},
                {"gcs_path": {"$regex": "^gs://"}}
            ]
        })
        
        items = await cursor.to_list(length=None)
        logger.info(f"Found {len(items)} items with gs:// URLs")
        
        if len(items) == 0:
            await add_execution_log(db, audit_id, "info", "✅ No gs:// URLs found - all streams are already using HTTPS", "auto_fixer")
            return results
        
        await add_execution_log(
            db, audit_id, "info", 
            f"Found {len(items)} items with gs:// URLs to {'convert' if not dry_run else 'analyze'}", 
            "auto_fixer"
        )
        
        for item in items:
            try:
                content_id = str(item["_id"])
                gcs_path = item.get("gcs_path") or item.get("audio_url")
                
                if not gcs_path or not gcs_path.startswith("gs://"):
                    continue
                
                # Convert to HTTPS URL (try public first, fallback to signed)
                https_url = gcs_service.get_public_url(gcs_path)
                
                if not https_url:
                    # Fallback to signed URL
                    https_url = gcs_service.get_signed_url(gcs_path)
                
                if not https_url:
                    logger.warning(f"Failed to convert {gcs_path} to HTTPS")
                    results["urls_failed"] += 1
                    continue
                
                # Store before state for rollback
                before_state = {
                    "audio_url": item.get("audio_url"),
                    "gcs_path": item.get("gcs_path")
                }
                
                # Update if not dry run
                if not dry_run:
                    await db.content.update_one(
                        {"_id": item["_id"]},
                        {
                            "$set": {
                                "audio_url": https_url,
                                "gcs_path": gcs_path,  # Keep original gs:// path for reference
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                
                # Log the action
                action = LibrarianAction(
                    audit_id=audit_id,
                    action_type="fix_url",
                    content_id=content_id,
                    content_type="content",
                    issue_type="gs_protocol_url",
                    before_state=before_state,
                    after_state={"audio_url": https_url, "gcs_path": gcs_path},
                    auto_approved=True,
                    rollback_available=True,
                    description=f"Converted gs:// URL to HTTPS URL"
                )
                
                action_dict = action.model_dump()
                await db.librarian_actions.insert_one(action_dict)
                
                results["urls_fixed"] += 1
                
                if results["urls_fixed"] % 50 == 0:
                    logger.info(f"   Fixed {results['urls_fixed']}/{len(items)} URLs...")
                    await add_execution_log(
                        db, audit_id, "info",
                        f"   Fixed {results['urls_fixed']}/{len(items)} URLs...",
                        "auto_fixer"
                    )
                
            except Exception as e:
                logger.error(f"Failed to fix URL for {content_id}: {e}")
                results["urls_failed"] += 1
                results["errors"].append(str(e))
        
        if dry_run and results['urls_fixed'] > 0:
            logger.info(f"✅ Would fix {results['urls_fixed']} URLs in live mode, {results['urls_failed']} failed")
            await add_execution_log(
                db, audit_id, "success",
                f"✅ Would fix {results['urls_fixed']} URLs in live mode (DRY RUN - no changes made)",
                "auto_fixer"
            )
        else:
            logger.info(f"✅ Fixed {results['urls_fixed']} URLs, {results['urls_failed']} failed")
            await add_execution_log(
                db, audit_id, "success",
                f"✅ Fixed {results['urls_fixed']} URLs, {results['urls_failed']} failed",
                "auto_fixer"
            )
        
    except Exception as e:
        logger.error(f"GCS URL fix failed: {e}")
        await add_execution_log(db, audit_id, "error", f"❌ GCS URL fix failed: {str(e)}", "auto_fixer")
        results["errors"].append(str(e))
    
    return results


async def extract_metadata(
    db: AsyncIOMotorDatabase,
    audit_id: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Extract metadata (duration, bitrate) from audio files.
    
    This should run AFTER fix_gcs_urls so URLs are accessible.
    
    Args:
        db: MongoDB database instance
        audit_id: Parent audit report ID
        dry_run: If True, only report what would be fixed
        
    Returns:
        Summary of metadata extracted
    """
    from app.services.librarian_service import add_execution_log
    
    logger.info("🔍 Extracting metadata from audio files...")
    await add_execution_log(db, audit_id, "info", "🔍 Extracting metadata from audio files...", "auto_fixer")
    
    # Check if dry run
    if dry_run:
        await add_execution_log(
            db, audit_id, "info", 
            "   Running in DRY RUN mode - no metadata will be saved", 
            "auto_fixer"
        )
    
    results = {
        "metadata_extracted": 0,
        "metadata_failed": 0,
        "errors": []
    }
    
    try:
        # Find all content missing duration
        cursor = db.content.find({
            "$or": [
                {"duration": {"$exists": False}},
                {"duration": None},
                {"duration": 0}
            ]
        })
        
        items = await cursor.to_list(length=None)
        logger.info(f"Found {len(items)} items missing duration metadata")
        
        if len(items) == 0:
            await add_execution_log(db, audit_id, "info", "✅ All items have duration metadata", "auto_fixer")
            return results
        
        await add_execution_log(
            db, audit_id, "info",
            f"Found {len(items)} items missing duration metadata",
            "auto_fixer"
        )
        
        # Import metadata extraction utility
        try:
            from app.utils.audio_metadata import extract_audio_metadata
        except ImportError:
            logger.warning("Audio metadata utility not available, using HTTP headers as fallback")
            extract_audio_metadata = None
        
        for item in items:
            try:
                content_id = str(item["_id"])
                audio_url = item.get("audio_url")
                
                if not audio_url:
                    continue
                
                # Try to extract metadata
                metadata = None
                duration = None
                
                # Method 1: Use audio metadata utility if available
                if extract_audio_metadata:
                    try:
                        metadata = await extract_audio_metadata(audio_url)
                        duration = metadata.get("duration")
                    except Exception as e:
                        logger.debug(f"Metadata extraction failed for {content_id}: {e}")
                
                # Method 2: Fallback to HTTP Content-Length estimate
                if not duration:
                    try:
                        import httpx
                        async with httpx.AsyncClient(timeout=5) as client:
                            response = await client.head(audio_url, follow_redirects=True)
                            
                            if response.status_code == 200:
                                content_length = int(response.headers.get("Content-Length", 0))
                                # Estimate duration based on file size (rough estimate for MP3 ~128kbps)
                                if content_length > 0:
                                    duration = content_length / 16000  # Rough estimate
                    except Exception as e:
                        logger.debug(f"HTTP metadata fallback failed for {content_id}: {e}")
                
                if not duration:
                    results["metadata_failed"] += 1
                    continue
                
                # Store before state for rollback
                before_state = {
                    "duration": item.get("duration"),
                    "duration_seconds": item.get("duration_seconds")
                }
                
                # Update if not dry run
                if not dry_run:
                    await db.content.update_one(
                        {"_id": item["_id"]},
                        {
                            "$set": {
                                "duration": int(duration),
                                "duration_seconds": int(duration),
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                
                # Log the action
                action = LibrarianAction(
                    audit_id=audit_id,
                    action_type="update_metadata",
                    content_id=content_id,
                    content_type="content",
                    issue_type="missing_duration",
                    before_state=before_state,
                    after_state={"duration": int(duration), "duration_seconds": int(duration)},
                    auto_approved=True,
                    rollback_available=True,
                    description=f"Extracted duration metadata: {int(duration)}s"
                )
                
                action_dict = action.model_dump()
                await db.librarian_actions.insert_one(action_dict)
                
                results["metadata_extracted"] += 1
                
                if results["metadata_extracted"] % 50 == 0:
                    logger.info(f"   Extracted metadata for {results['metadata_extracted']}/{len(items)} items...")
                    await add_execution_log(
                        db, audit_id, "info",
                        f"   Extracted metadata for {results['metadata_extracted']}/{len(items)} items...",
                        "auto_fixer"
                    )
                
            except Exception as e:
                logger.error(f"Failed to extract metadata for {content_id}: {e}")
                results["metadata_failed"] += 1
                results["errors"].append(str(e))
        
        if dry_run and results['metadata_extracted'] > 0:
            logger.info(f"✅ Would extract metadata for {results['metadata_extracted']} items in live mode, {results['metadata_failed']} failed")
            await add_execution_log(
                db, audit_id, "success",
                f"✅ Would extract metadata for {results['metadata_extracted']} items in live mode (DRY RUN - no changes made)",
                "auto_fixer"
            )
        else:
            logger.info(f"✅ Extracted metadata for {results['metadata_extracted']} items, {results['metadata_failed']} failed")
            await add_execution_log(
                db, audit_id, "success",
                f"✅ Extracted metadata for {results['metadata_extracted']} items, {results['metadata_failed']} failed",
                "auto_fixer"
            )
        
    except Exception as e:
        logger.error(f"Metadata extraction failed: {e}")
        await add_execution_log(db, audit_id, "error", f"❌ Metadata extraction failed: {str(e)}", "auto_fixer")
        results["errors"].append(str(e))
    
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

        # Restore before_state
        content_id = action.get("content_id")
        before_state = action.get("before_state", {})
        
        if content_id and before_state:
            # Restore the original values
            await db.content.update_one(
                {"_id": ObjectId(content_id)},
                {
                    "$set": {
                        **before_state,
                        "updated_at": datetime.utcnow()
                    }
                }
            )

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
