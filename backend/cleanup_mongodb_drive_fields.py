#!/usr/bin/env python3
"""
Cleanup script to remove Google Drive fields from MongoDB.
Removes google_drive_id and google_drive_path from all content documents.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup_drive_fields():
    """Remove Google Drive fields from all content documents."""
    
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "israeli_radio")
    
    print(f"Connecting to MongoDB: {db_name}")
    client = AsyncIOMotorClient(mongodb_uri)
    db = client[db_name]
    
    # Check current state
    print("\n🔍 Checking current state...")
    total_docs = await db.content.count_documents({})
    with_drive_id = await db.content.count_documents({"google_drive_id": {"$exists": True}})
    with_drive_path = await db.content.count_documents({"google_drive_path": {"$exists": True}})
    with_gcs = await db.content.count_documents({"gcs_path": {"$exists": True, "$ne": None}})
    
    print(f"  Total content documents: {total_docs}")
    print(f"  Documents with google_drive_id: {with_drive_id}")
    print(f"  Documents with google_drive_path: {with_drive_path}")
    print(f"  Documents with gcs_path: {with_gcs}")
    
    if with_drive_id == 0 and with_drive_path == 0:
        print("\n✅ No Google Drive fields found. Database is already clean!")
        client.close()
        return
    
    print("\n🧹 Removing Google Drive fields...")
    
    # Remove google_drive_id and google_drive_path fields
    result = await db.content.update_many(
        {},
        {"$unset": {
            "google_drive_id": "",
            "google_drive_path": ""
        }}
    )
    
    print(f"  Modified {result.modified_count} documents")
    
    # Verify cleanup
    print("\n✅ Verifying cleanup...")
    remaining_drive_id = await db.content.count_documents({"google_drive_id": {"$exists": True}})
    remaining_drive_path = await db.content.count_documents({"google_drive_path": {"$exists": True}})
    
    print(f"  Remaining documents with google_drive_id: {remaining_drive_id}")
    print(f"  Remaining documents with google_drive_path: {remaining_drive_path}")
    
    if remaining_drive_id == 0 and remaining_drive_path == 0:
        print("\n✅ Cleanup successful! All Google Drive fields removed.")
    else:
        print(f"\n⚠️  Warning: Some Google Drive fields still remain.")
    
    # Show final state
    print("\n📊 Final state:")
    final_total = await db.content.count_documents({})
    final_gcs = await db.content.count_documents({"gcs_path": {"$exists": True, "$ne": None}})
    print(f"  Total content documents: {final_total}")
    print(f"  Documents with GCS storage: {final_gcs}")
    print(f"  Documents without cloud storage: {final_total - final_gcs}")
    
    client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("MongoDB Google Drive Fields Cleanup Script")
    print("=" * 60)
    asyncio.run(cleanup_drive_fields())
    print("\n✨ Done!")
