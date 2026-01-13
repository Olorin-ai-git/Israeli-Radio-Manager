"""
Migration script: Move all content from Google Drive to GCS and update MongoDB.

This script will:
1. Find all content with google_drive_id but no gcs_path
2. Download from Google Drive and upload to GCS
3. Update MongoDB records to use gcs_path instead of google_drive_id
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.services.google_drive import GoogleDriveService
from app.services.gcs_storage import GCSStorageService
from pathlib import Path
import io

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def migrate():
    """Run the migration."""
    logger.info("Starting Drive → GCS migration...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    logger.info(f"Connected to MongoDB: {settings.mongodb_db}")
    
    # Initialize services
    drive_service = GoogleDriveService(
        credentials_path=settings.google_credentials_file,
        token_path=settings.google_drive_token_file,
        service_account_file=settings.google_service_account_file,
        root_folder_id=settings.google_drive_root_folder_id,
        cache_dir=settings.cache_dir
    )
    
    try:
        drive_service.authenticate()
        logger.info("Google Drive authenticated")
    except Exception as e:
        logger.error(f"Drive authentication failed: {e}")
        logger.info("Will update database records but skip file transfers")
        drive_service = None
    
    gcs_service = GCSStorageService()
    if not gcs_service.is_available:
        logger.error("GCS not available - cannot proceed")
        return
    
    logger.info(f"GCS bucket: {gcs_service.bucket_name}")
    
    # Find content with Drive ID but no GCS path
    query = {
        "google_drive_id": {"$exists": True, "$ne": None},
        "$or": [
            {"gcs_path": {"$exists": False}},
            {"gcs_path": None},
            {"gcs_path": ""}
        ]
    }
    
    total = await db.content.count_documents(query)
    logger.info(f"Found {total} items to migrate")
    
    if total == 0:
        logger.info("No items need migration")
        return
    
    stats = {
        "total": total,
        "migrated": 0,
        "updated_db_only": 0,
        "skipped": 0,
        "errors": []
    }
    
    cursor = db.content.find(query)
    
    async for item in cursor:
        content_id = str(item["_id"])
        title = item.get("title", "Unknown")
        drive_id = item.get("google_drive_id")
        content_type = item.get("type", "unknown")
        genre = item.get("genre")
        
        logger.info(f"Processing: {title} (type: {content_type})")
        
        try:
            # Build GCS folder path
            type_folders = {
                "song": "songs",
                "commercial": "commercials",
                "show": "shows",
                "jingle": "jingles",
                "sample": "samples",
                "newsflash": "newsflashes"
            }
            folder_name = type_folders.get(content_type, "uploads")
            if genre:
                folder_name = f"{folder_name}/{genre}"
            
            # If Drive service available, transfer the file
            gcs_path = None
            if drive_service and drive_id:
                try:
                    # Download from Drive to memory
                    logger.info(f"  Downloading from Drive: {drive_id}")
                    stream = drive_service.download_to_stream(drive_id)
                    
                    # Upload to GCS
                    filename = item.get("google_drive_path", "").split("/")[-1] or f"{title}.mp3"
                    file_extension = Path(filename).suffix or ".mp3"
                    
                    logger.info(f"  Uploading to GCS: {folder_name}/{filename}")
                    gcs_full_path = gcs_service.upload_from_stream(
                        stream=stream,
                        folder=folder_name,
                        filename=filename,
                        file_extension=file_extension,
                        metadata={
                            "title": title,
                            "artist": item.get("artist", ""),
                            "genre": genre or "",
                            "type": content_type,
                            "migrated_from_drive": "true",
                            "original_drive_id": drive_id
                        }
                    )
                    
                    if gcs_full_path:
                        gcs_path = gcs_full_path.replace(f"gs://{gcs_service.bucket_name}/", "")
                        logger.info(f"  ✓ Uploaded to: {gcs_path}")
                        stats["migrated"] += 1
                    else:
                        logger.warning(f"  ✗ Upload failed")
                        stats["errors"].append(f"{title}: Upload failed")
                        continue
                        
                except Exception as e:
                    logger.error(f"  ✗ Transfer failed: {e}")
                    stats["errors"].append(f"{title}: {str(e)}")
                    continue
            
            # Update MongoDB record
            update_doc = {}
            unset_doc = {}
            
            if gcs_path:
                update_doc["gcs_path"] = gcs_path
            
            # Remove Google Drive fields
            unset_doc["google_drive_id"] = ""
            unset_doc["google_drive_path"] = ""
            
            update_query = {}
            if update_doc:
                update_query["$set"] = update_doc
            if unset_doc:
                update_query["$unset"] = unset_doc
            
            if update_query:
                await db.content.update_one(
                    {"_id": item["_id"]},
                    update_query
                )
                logger.info(f"  ✓ Database updated")
                if not gcs_path:
                    stats["updated_db_only"] += 1
            
        except Exception as e:
            logger.error(f"  ✗ Error processing {title}: {e}")
            stats["errors"].append(f"{title}: {str(e)}")
            stats["skipped"] += 1
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("MIGRATION COMPLETE")
    logger.info("="*60)
    logger.info(f"Total items:           {stats['total']}")
    logger.info(f"Successfully migrated: {stats['migrated']}")
    logger.info(f"DB updated only:       {stats['updated_db_only']}")
    logger.info(f"Skipped:              {stats['skipped']}")
    logger.info(f"Errors:               {len(stats['errors'])}")
    
    if stats['errors']:
        logger.info("\nErrors:")
        for error in stats['errors'][:10]:  # Show first 10 errors
            logger.info(f"  - {error}")
        if len(stats['errors']) > 10:
            logger.info(f"  ... and {len(stats['errors']) - 10} more")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
