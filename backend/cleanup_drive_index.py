"""Remove the google_drive_id index since we no longer use Google Drive."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


async def cleanup_index():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    
    print("Removing google_drive_id index...")
    
    try:
        await db.content.drop_index("google_drive_id_1")
        print("✓ Index removed successfully")
    except Exception as e:
        print(f"Index removal: {e}")
    
    # Show remaining indexes
    indexes = await db.content.index_information()
    print("\nRemaining indexes on content collection:")
    for idx_name, idx_info in indexes.items():
        print(f"  - {idx_name}: {idx_info.get('key')}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(cleanup_index())
