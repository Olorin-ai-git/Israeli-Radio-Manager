"""
Backup Service
Handles automatic database backups for the content library
"""
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import zipfile
import io

logger = logging.getLogger(__name__)


class BackupService:
    """
    Service for backing up the content library and related data.
    
    Features:
    - Automatic weekly backups
    - Configurable retention period
    - GCS storage integration
    - Backup verification
    - Restore capability
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, backup_dir: str = "./backups", gcs_service=None):
        self.db = db
        self.backup_dir = Path(backup_dir)
        self.gcs_service = gcs_service
        
        # Ensure backup directory exists
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Collections to backup
        self.collections_to_backup = [
            "content",
            "schedule_slots",
            "commercial_campaigns",
            "flows",
            "voices",
            "pending_uploads",
        ]
    
    async def create_backup(self, backup_type: str = "weekly", include_logs: bool = False) -> Dict[str, Any]:
        """
        Create a full backup of the library and related data.
        
        Args:
            backup_type: Type of backup (daily, weekly, manual)
            include_logs: Whether to include playback logs (can be large)
            
        Returns:
            Backup metadata and status
        """
        start_time = datetime.utcnow()
        timestamp = start_time.strftime("%Y%m%d_%H%M%S")
        backup_name = f"library_backup_{backup_type}_{timestamp}"
        
        logger.info(f"🗄️ Creating backup: {backup_name}")
        
        backup_data = {
            "backup_name": backup_name,
            "backup_type": backup_type,
            "created_at": start_time.isoformat(),
            "collections": {},
            "statistics": {}
        }
        
        try:
            # Backup each collection
            collections_to_process = self.collections_to_backup.copy()
            if include_logs:
                collections_to_process.append("playback_logs")
            
            for collection_name in collections_to_process:
                try:
                    collection = self.db[collection_name]
                    
                    # Get all documents
                    cursor = collection.find({})
                    documents = await cursor.to_list(length=None)
                    
                    # Convert ObjectId to string for JSON serialization
                    serialized_docs = []
                    for doc in documents:
                        serialized_doc = self._serialize_document(doc)
                        serialized_docs.append(serialized_doc)
                    
                    backup_data["collections"][collection_name] = serialized_docs
                    backup_data["statistics"][collection_name] = len(serialized_docs)
                    
                    logger.info(f"   ✅ Backed up {collection_name}: {len(serialized_docs)} items")
                    
                except Exception as e:
                    logger.error(f"   ❌ Failed to backup {collection_name}: {e}")
                    backup_data["statistics"][f"{collection_name}_error"] = str(e)
            
            # Calculate total items
            total_items = sum(v for k, v in backup_data["statistics"].items() if isinstance(v, int))
            backup_data["total_items"] = total_items
            
            # Save backup to file
            backup_file_path = self.backup_dir / f"{backup_name}.json"
            with open(backup_file_path, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=2, ensure_ascii=False)
            
            # Create compressed version
            zip_path = self.backup_dir / f"{backup_name}.zip"
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(backup_file_path, f"{backup_name}.json")
            
            # Get file sizes
            json_size_mb = backup_file_path.stat().st_size / (1024 * 1024)
            zip_size_mb = zip_path.stat().st_size / (1024 * 1024)
            
            # Upload to GCS if available
            gcs_uploaded = False
            if self.gcs_service and self.gcs_service.is_available:
                try:
                    gcs_path = f"backups/{backup_name}.zip"
                    success = await self._upload_to_gcs(zip_path, gcs_path)
                    if success:
                        gcs_uploaded = True
                        logger.info(f"   ✅ Uploaded to GCS: gs://{self.gcs_service.bucket_name}/{gcs_path}")
                except Exception as e:
                    logger.error(f"   ⚠️ Failed to upload to GCS: {e}")
            
            end_time = datetime.utcnow()
            duration = (end_time - start_time).total_seconds()
            
            # Create metadata record in database
            backup_metadata = {
                "backup_name": backup_name,
                "backup_type": backup_type,
                "created_at": start_time,
                "completed_at": end_time,
                "duration_seconds": duration,
                "total_items": total_items,
                "collections": list(backup_data["statistics"].keys()),
                "file_size_mb": json_size_mb,
                "compressed_size_mb": zip_size_mb,
                "local_path": str(zip_path),
                "gcs_uploaded": gcs_uploaded,
                "gcs_path": f"backups/{backup_name}.zip" if gcs_uploaded else None,
                "status": "completed"
            }
            
            await self.db.backups.insert_one(backup_metadata)
            
            logger.info(f"✅ Backup completed: {backup_name}")
            logger.info(f"   Total items: {total_items}")
            logger.info(f"   Size: {json_size_mb:.2f} MB (compressed: {zip_size_mb:.2f} MB)")
            logger.info(f"   Duration: {duration:.1f}s")
            logger.info(f"   GCS uploaded: {gcs_uploaded}")
            
            return {
                "status": "success",
                "backup_name": backup_name,
                "total_items": total_items,
                "duration_seconds": duration,
                "file_size_mb": round(json_size_mb, 2),
                "compressed_size_mb": round(zip_size_mb, 2),
                "local_path": str(zip_path),
                "gcs_uploaded": gcs_uploaded,
                "statistics": backup_data["statistics"]
            }
            
        except Exception as e:
            logger.error(f"❌ Backup failed: {e}", exc_info=True)
            return {
                "status": "failed",
                "error": str(e),
                "backup_name": backup_name
            }
    
    async def _upload_to_gcs(self, local_path: Path, gcs_path: str) -> bool:
        """Upload backup file to Google Cloud Storage."""
        try:
            # Read file content
            with open(local_path, 'rb') as f:
                content = f.read()
            
            # Upload to GCS
            blob = self.gcs_service.bucket.blob(gcs_path)
            blob.upload_from_string(content, content_type='application/zip')
            
            return True
        except Exception as e:
            logger.error(f"Failed to upload to GCS: {e}")
            return False
    
    def _serialize_document(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document to JSON-serializable format."""
        from bson import ObjectId
        from datetime import datetime
        
        serialized = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                serialized[key] = str(value)
            elif isinstance(value, datetime):
                serialized[key] = value.isoformat()
            elif isinstance(value, dict):
                serialized[key] = self._serialize_document(value)
            elif isinstance(value, list):
                serialized[key] = [
                    self._serialize_document(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                serialized[key] = value
        
        return serialized
    
    async def cleanup_old_backups(self, retention_days: int = 30, keep_minimum: int = 5) -> Dict[str, Any]:
        """
        Clean up old backup files.
        
        Args:
            retention_days: Number of days to keep backups
            keep_minimum: Minimum number of backups to keep regardless of age
            
        Returns:
            Cleanup statistics
        """
        logger.info(f"🧹 Cleaning up backups older than {retention_days} days...")
        
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
        
        # Get all backup metadata from database
        backups_cursor = self.db.backups.find({}).sort("created_at", -1)
        all_backups = await backups_cursor.to_list(length=None)
        
        # Keep at least keep_minimum recent backups
        backups_to_check = all_backups[keep_minimum:]
        
        deleted_count = 0
        deleted_size_mb = 0
        errors = []
        
        for backup in backups_to_check:
            created_at = backup.get("created_at")
            if isinstance(created_at, str):
                created_at = datetime.fromisoformat(created_at)
            
            if created_at < cutoff_date:
                backup_name = backup.get("backup_name")
                
                try:
                    # Delete local files
                    local_path = backup.get("local_path")
                    if local_path:
                        local_file = Path(local_path)
                        if local_file.exists():
                            size_mb = local_file.stat().st_size / (1024 * 1024)
                            local_file.unlink()
                            deleted_size_mb += size_mb
                            
                            # Also delete the uncompressed JSON if it exists
                            json_path = local_file.with_suffix('.json')
                            if json_path.exists():
                                json_path.unlink()
                    
                    # Delete from database
                    await self.db.backups.delete_one({"_id": backup["_id"]})
                    
                    deleted_count += 1
                    logger.info(f"   Deleted: {backup_name}")
                    
                except Exception as e:
                    error_msg = f"Failed to delete {backup_name}: {e}"
                    logger.error(f"   {error_msg}")
                    errors.append(error_msg)
        
        logger.info(f"✅ Cleanup complete: deleted {deleted_count} backups, freed {deleted_size_mb:.2f} MB")
        
        return {
            "deleted_count": deleted_count,
            "deleted_size_mb": round(deleted_size_mb, 2),
            "errors": errors,
            "remaining_backups": len(all_backups) - deleted_count
        }
    
    async def list_backups(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get list of available backups."""
        cursor = self.db.backups.find({}).sort("created_at", -1).limit(limit)
        backups = await cursor.to_list(length=limit)
        
        # Convert ObjectId to string
        for backup in backups:
            backup["_id"] = str(backup["_id"])
            if "created_at" in backup and isinstance(backup["created_at"], datetime):
                backup["created_at"] = backup["created_at"].isoformat()
            if "completed_at" in backup and isinstance(backup["completed_at"], datetime):
                backup["completed_at"] = backup["completed_at"].isoformat()
        
        return backups
    
    async def get_backup_statistics(self) -> Dict[str, Any]:
        """Get backup system statistics."""
        # Count total backups
        total_backups = await self.db.backups.count_documents({})
        
        # Get latest backup
        latest_cursor = self.db.backups.find({}).sort("created_at", -1).limit(1)
        latest_backups = await latest_cursor.to_list(length=1)
        latest_backup = latest_backups[0] if latest_backups else None
        
        # Calculate total backup size
        all_backups_cursor = self.db.backups.find({})
        all_backups = await all_backups_cursor.to_list(length=None)
        total_size_mb = sum(b.get("compressed_size_mb", 0) for b in all_backups)
        
        # Count local files
        local_backup_files = list(self.backup_dir.glob("*.zip"))
        local_file_count = len(local_backup_files)
        
        return {
            "total_backups": total_backups,
            "total_size_mb": round(total_size_mb, 2),
            "local_file_count": local_file_count,
            "backup_directory": str(self.backup_dir),
            "latest_backup": {
                "name": latest_backup.get("backup_name") if latest_backup else None,
                "created_at": latest_backup.get("created_at").isoformat() if latest_backup and latest_backup.get("created_at") else None,
                "total_items": latest_backup.get("total_items") if latest_backup else None,
                "size_mb": latest_backup.get("compressed_size_mb") if latest_backup else None,
            } if latest_backup else None
        }
    
    async def verify_backup(self, backup_name: str) -> Dict[str, Any]:
        """Verify backup integrity."""
        logger.info(f"🔍 Verifying backup: {backup_name}")
        
        # Find backup metadata
        backup_meta = await self.db.backups.find_one({"backup_name": backup_name})
        if not backup_meta:
            return {"status": "error", "message": "Backup not found in database"}
        
        # Check if file exists
        local_path = Path(backup_meta.get("local_path", ""))
        if not local_path.exists():
            return {"status": "error", "message": "Backup file not found"}
        
        try:
            # Try to open and read the backup
            with zipfile.ZipFile(local_path, 'r') as zipf:
                # Check zip integrity
                bad_file = zipf.testzip()
                if bad_file:
                    return {"status": "error", "message": f"Corrupted file in zip: {bad_file}"}
                
                # Try to load JSON
                json_filename = f"{backup_name}.json"
                with zipf.open(json_filename) as f:
                    data = json.load(f)
                
                # Verify structure
                if "collections" not in data or "statistics" not in data:
                    return {"status": "error", "message": "Invalid backup structure"}
                
                return {
                    "status": "success",
                    "message": "Backup verified successfully",
                    "total_items": backup_meta.get("total_items"),
                    "collections": list(data["collections"].keys()),
                    "file_size_mb": backup_meta.get("compressed_size_mb")
                }
        
        except Exception as e:
            return {"status": "error", "message": f"Verification failed: {str(e)}"}
