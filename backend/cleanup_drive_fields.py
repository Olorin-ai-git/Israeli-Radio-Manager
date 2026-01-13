"""
Remove Google Drive fields from MongoDB after migration to GCS.

This script will:
1. Remove google_drive_id and google_drive_path fields from all content
2. Keep gcs_path for cloud storage references
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def cleanup():
    """Remove Google Drive fields from MongoDB."""
    logger.info("Starting Google Drive field cleanup...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    logger.info(f"Connected to MongoDB: {settings.mongodb_db}")
    
    # Count items with Drive fields
    with_drive = await db.content.count_documents({
        "$or": [
            {"google_drive_id": {"$exists": True}},
            {"google_drive_path": {"$exists": True}}
        ]
    })
    
    logger.info(f"Found {with_drive} items with Google Drive fields")
    
    if with_drive == 0:
        logger.info("No cleanup needed - all Drive fields already removed")
        client.close()
        return
    
    # Double-check: verify all have GCS paths or are local
    items_without_storage = await db.content.count_documents({
        "$or": [
            {"google_drive_id": {"$exists": True}},
            {"google_drive_path": {"$exists": True}}
        ],
        "$or": [
            {"gcs_path": {"$exists": False}},
            {"gcs_path": None},
            {"gcs_path": ""}
        ],
        "$and": [
            {"$or": [
                {"local_cache_path": {"$exists": False}},
                {"local_cache_path": None}
            ]}
        ]
    })
    
    if items_without_storage > 0:
        logger.warning(f"⚠️  {items_without_storage} items have Drive fields but NO GCS path or local file!")
        logger.warning("These items might lose access to their files if we remove Drive fields.")
        
        response = input("\nDo you want to proceed anyway? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            logger.info("Cleanup cancelled by user")
            client.close()
            return
    
    # Remove Google Drive fields
    logger.info("Removing google_drive_id and google_drive_path fields...")
    
    result = await db.content.update_many(
        {
            "$or": [
                {"google_drive_id": {"$exists": True}},
                {"google_drive_path": {"$exists": True}}
            ]
        },
        {
            "$unset": {
                "google_drive_id": "",
                "google_drive_path": ""
            }
        }
    )
    
    logger.info(f"✓ Updated {result.modified_count} documents")
    
    # Verify cleanup
    remaining = await db.content.count_documents({
        "$or": [
            {"google_drive_id": {"$exists": True}},
            {"google_drive_path": {"$exists": True}}
        ]
    })
    
    if remaining == 0:
        logger.info("✓ All Google Drive fields successfully removed!")
    else:
        logger.warning(f"⚠️  {remaining} documents still have Drive fields")
    
    # Show updated stats
    with_gcs = await db.content.count_documents({
        "gcs_path": {"$exists": True, "$ne": None, "$ne": ""}
    })
    total = await db.content.count_documents({"active": True})
    
    logger.info(f"\nFinal status:")
    logger.info(f"  Total active content: {total}")
    logger.info(f"  With GCS storage: {with_gcs}")
    logger.info(f"  Storage on GCS: {(with_gcs/total*100):.1f}%")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup())
