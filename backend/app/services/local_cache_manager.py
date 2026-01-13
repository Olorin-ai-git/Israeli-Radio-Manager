"""
Local Cache Manager Service
Ensures a minimum number of audio files are always cached locally for instant playback
"""
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = logging.getLogger(__name__)


class LocalCacheManager:
    """
    Manages local audio file cache to prevent dead air time.
    
    Responsibilities:
    - Ensure minimum 20 songs are always cached locally
    - Prioritize high-play-count and recently added content
    - Auto-download missing cache items
    - Clean up old/unused cache files
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, cache_dir: str, gcs_service=None):
        self.db = db
        self.cache_dir = Path(cache_dir)
        self.gcs_service = gcs_service
        self.min_cached_items = 20
        self.target_cached_items = 30  # Keep extra buffer
        
        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
    async def ensure_minimum_cache(self) -> Dict[str, Any]:
        """
        Ensure minimum number of items are cached locally.
        
        Returns:
            Status report with cache statistics
        """
        logger.info(f"🗄️ Checking local cache (minimum: {self.min_cached_items} items)...")
        
        # Count currently cached items
        cached_count = await self._count_cached_items()
        
        result = {
            "status": "healthy",
            "cached_items": cached_count,
            "min_required": self.min_cached_items,
            "target": self.target_cached_items,
            "items_downloaded": 0,
            "errors": []
        }
        
        if cached_count >= self.min_cached_items:
            logger.info(f"   ✅ Cache healthy: {cached_count} items cached")
            result["status"] = "healthy"
            return result
        
        # Need to download more items
        needed = self.target_cached_items - cached_count
        logger.warning(f"   ⚠️ Cache below minimum! Need to download {needed} more items")
        
        # Get priority items to cache
        items_to_cache = await self._get_priority_items_to_cache(needed)
        
        # Download items
        downloaded = 0
        for item in items_to_cache:
            try:
                success = await self._download_and_cache_item(item)
                if success:
                    downloaded += 1
                    logger.info(f"   Downloaded: {item.get('title', 'Unknown')} ({downloaded}/{needed})")
            except Exception as e:
                error_msg = f"Failed to cache {item.get('title')}: {e}"
                logger.error(f"   {error_msg}")
                result["errors"].append(error_msg)
        
        result["items_downloaded"] = downloaded
        result["cached_items"] = cached_count + downloaded
        
        if result["cached_items"] >= self.min_cached_items:
            result["status"] = "healthy"
            logger.info(f"   ✅ Cache restored: {result['cached_items']} items now cached")
        else:
            result["status"] = "critical"
            logger.error(f"   ❌ Cache still critical: only {result['cached_items']} items cached")
        
        return result
    
    async def _count_cached_items(self) -> int:
        """Count items with valid local cache paths."""
        count = await self.db.content.count_documents({
            "local_cache_path": {"$exists": True, "$ne": None},
            "type": {"$in": ["song", "music"]}  # Only count playable content
        })
        return count
    
    async def _get_priority_items_to_cache(self, limit: int) -> List[Dict[str, Any]]:
        """
        Get priority items to cache based on:
        1. High play count
        2. Recently added
        3. Not currently cached
        4. Valid audio URL
        """
        # Build aggregation pipeline
        pipeline = [
            # Only items not currently cached
            {
                "$match": {
                    "$or": [
                        {"local_cache_path": {"$exists": False}},
                        {"local_cache_path": None}
                    ],
                    "type": {"$in": ["song", "music"]},
                    "$or": [
                        {"audio_url": {"$exists": True, "$ne": None}},
                        {"gcs_path": {"$exists": True, "$ne": None}}
                    ]
                }
            },
            # Add play count from logs
            {
                "$lookup": {
                    "from": "playback_logs",
                    "localField": "_id",
                    "foreignField": "content_id",
                    "as": "plays"
                }
            },
            {
                "$addFields": {
                    "play_count": {"$size": "$plays"}
                }
            },
            # Sort by play count (desc) and created date (desc)
            {
                "$sort": {
                    "play_count": -1,
                    "created_at": -1
                }
            },
            # Limit results
            {"$limit": limit}
        ]
        
        cursor = self.db.content.aggregate(pipeline)
        items = await cursor.to_list(length=limit)
        
        logger.info(f"   Selected {len(items)} priority items to cache")
        return items
    
    async def _download_and_cache_item(self, item: Dict[str, Any]) -> bool:
        """
        Download an item and cache it locally.
        
        Args:
            item: Content document from database
            
        Returns:
            True if successful, False otherwise
        """
        content_id = str(item["_id"])
        
        # Determine source URL
        audio_url = item.get("audio_url") or item.get("gcs_path")
        if not audio_url:
            logger.warning(f"   No audio URL for {content_id}")
            return False
        
        # If it's a GCS URL, use GCS service
        if audio_url.startswith("gs://") and self.gcs_service:
            return await self._download_from_gcs(item, audio_url)
        elif audio_url.startswith("http"):
            return await self._download_from_http(item, audio_url)
        else:
            logger.warning(f"   Unsupported URL format: {audio_url}")
            return False
    
    async def _download_from_gcs(self, item: Dict[str, Any], gcs_path: str) -> bool:
        """Download from Google Cloud Storage."""
        try:
            content_id = str(item["_id"])
            title = item.get("title", "unknown")
            
            # Generate local filename
            filename = f"{content_id}.mp3"  # Assume MP3 for now
            local_path = self.cache_dir / filename
            
            # Download from GCS
            success = await self.gcs_service.download_file(gcs_path, local_path)
            
            if success and local_path.exists():
                # Update database
                await self.db.content.update_one(
                    {"_id": item["_id"]},
                    {
                        "$set": {
                            "local_cache_path": str(local_path),
                            "cached_at": datetime.utcnow()
                        }
                    }
                )
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"GCS download failed: {e}")
            return False
    
    async def _download_from_http(self, item: Dict[str, Any], url: str) -> bool:
        """Download from HTTP/HTTPS URL."""
        import httpx
        
        try:
            content_id = str(item["_id"])
            
            # Determine file extension from URL or content type
            ext = ".mp3"  # Default
            if "." in url.split("/")[-1]:
                ext = "." + url.split(".")[-1].split("?")[0]
            
            filename = f"{content_id}{ext}"
            local_path = self.cache_dir / filename
            
            # Download file
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                # Write to file
                with open(local_path, "wb") as f:
                    f.write(response.content)
            
            # Update database
            await self.db.content.update_one(
                {"_id": item["_id"]},
                {
                    "$set": {
                        "local_cache_path": str(local_path),
                        "cached_at": datetime.utcnow()
                    }
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"HTTP download failed: {e}")
            return False
    
    async def cleanup_old_cache(self, max_age_days: int = 30, max_size_gb: int = 10) -> Dict[str, Any]:
        """
        Clean up old or unused cache files.
        
        Args:
            max_age_days: Remove files older than this many days
            max_size_gb: Maximum cache size in GB
            
        Returns:
            Cleanup statistics
        """
        logger.info(f"🧹 Cleaning up cache (max age: {max_age_days} days, max size: {max_size_gb} GB)...")
        
        result = {
            "files_removed": 0,
            "space_freed_mb": 0,
            "errors": []
        }
        
        try:
            # Get all cached files
            cache_files = list(self.cache_dir.glob("*"))
            
            # Calculate total size
            total_size_bytes = sum(f.stat().st_size for f in cache_files if f.is_file())
            total_size_gb = total_size_bytes / (1024 ** 3)
            
            logger.info(f"   Current cache size: {total_size_gb:.2f} GB ({len(cache_files)} files)")
            
            # Find files to remove (oldest first)
            cutoff_date = datetime.utcnow() - timedelta(days=max_age_days)
            
            files_to_remove = []
            for file_path in cache_files:
                if not file_path.is_file():
                    continue
                
                # Check age
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if mtime < cutoff_date:
                    files_to_remove.append((file_path, file_path.stat().st_size))
            
            # If still over size limit, remove oldest files
            if total_size_gb > max_size_gb:
                # Sort by modification time (oldest first)
                all_files = [(f, f.stat().st_mtime, f.stat().st_size) 
                            for f in cache_files if f.is_file()]
                all_files.sort(key=lambda x: x[1])
                
                # Remove until under limit
                for file_path, mtime, size in all_files:
                    if total_size_gb <= max_size_gb:
                        break
                    if (file_path, size) not in files_to_remove:
                        files_to_remove.append((file_path, size))
                        total_size_gb -= size / (1024 ** 3)
            
            # Remove files
            for file_path, size in files_to_remove:
                try:
                    file_path.unlink()
                    result["files_removed"] += 1
                    result["space_freed_mb"] += size / (1024 ** 2)
                    
                    # Update database to remove cache reference
                    filename = file_path.name
                    content_id = filename.split(".")[0]
                    try:
                        await self.db.content.update_one(
                            {"_id": ObjectId(content_id)},
                            {"$unset": {"local_cache_path": "", "cached_at": ""}}
                        )
                    except:
                        pass  # Content might not exist anymore
                        
                except Exception as e:
                    result["errors"].append(f"Failed to remove {file_path.name}: {e}")
            
            logger.info(f"   ✅ Removed {result['files_removed']} files, freed {result['space_freed_mb']:.2f} MB")
            
        except Exception as e:
            logger.error(f"Cache cleanup failed: {e}")
            result["errors"].append(str(e))
        
        return result
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """Get current cache statistics."""
        try:
            cache_files = list(self.cache_dir.glob("*"))
            total_size_bytes = sum(f.stat().st_size for f in cache_files if f.is_file())
            
            cached_count = await self._count_cached_items()
            
            return {
                "cached_items": cached_count,
                "min_required": self.min_cached_items,
                "target": self.target_cached_items,
                "status": "healthy" if cached_count >= self.min_cached_items else "critical",
                "total_files": len([f for f in cache_files if f.is_file()]),
                "total_size_mb": total_size_bytes / (1024 ** 2),
                "total_size_gb": total_size_bytes / (1024 ** 3),
                "cache_dir": str(self.cache_dir)
            }
        except Exception as e:
            logger.error(f"Failed to get cache statistics: {e}")
            return {"error": str(e)}
