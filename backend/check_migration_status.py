"""Check the current state of content storage (Drive vs GCS)."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings


async def check_status():
    """Check current storage status."""
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    
    print(f"\n{'='*60}")
    print(f"CONTENT STORAGE STATUS - {settings.mongodb_db}")
    print(f"{'='*60}\n")
    
    # Total content
    total = await db.content.count_documents({"active": True})
    print(f"Total active content: {total}")
    
    # Content with Google Drive ID
    with_drive = await db.content.count_documents({
        "active": True,
        "google_drive_id": {"$exists": True, "$ne": None}
    })
    print(f"  - With Google Drive ID: {with_drive}")
    
    # Content with GCS path
    with_gcs = await db.content.count_documents({
        "active": True,
        "gcs_path": {"$exists": True, "$ne": None, "$ne": ""}
    })
    print(f"  - With GCS path: {with_gcs}")
    
    # Content with both
    with_both = await db.content.count_documents({
        "active": True,
        "google_drive_id": {"$exists": True, "$ne": None},
        "gcs_path": {"$exists": True, "$ne": None, "$ne": ""}
    })
    print(f"  - With both Drive and GCS: {with_both}")
    
    # Content with Drive but NO GCS (needs migration)
    needs_migration = await db.content.count_documents({
        "active": True,
        "google_drive_id": {"$exists": True, "$ne": None},
        "$or": [
            {"gcs_path": {"$exists": False}},
            {"gcs_path": None},
            {"gcs_path": ""}
        ]
    })
    print(f"\n  ⚠️  NEEDS MIGRATION: {needs_migration}")
    
    # Content with neither (local only)
    with_neither = await db.content.count_documents({
        "active": True,
        "$or": [
            {"google_drive_id": {"$exists": False}},
            {"google_drive_id": None}
        ],
        "$or": [
            {"gcs_path": {"$exists": False}},
            {"gcs_path": None},
            {"gcs_path": ""}
        ]
    })
    print(f"  - Local only (no cloud storage): {with_neither}")
    
    # Breakdown by type
    print(f"\n{'='*60}")
    print("BY CONTENT TYPE")
    print(f"{'='*60}\n")
    
    pipeline = [
        {"$match": {"active": True}},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": 1},
            "with_drive": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$ne": ["$google_drive_id", None]},
                            {"$ne": ["$google_drive_id", ""]}
                        ]},
                        1,
                        0
                    ]
                }
            },
            "with_gcs": {
                "$sum": {
                    "$cond": [
                        {"$and": [
                            {"$ne": ["$gcs_path", None]},
                            {"$ne": ["$gcs_path", ""]}
                        ]},
                        1,
                        0
                    ]
                }
            }
        }},
        {"$sort": {"total": -1}}
    ]
    
    async for row in db.content.aggregate(pipeline):
        content_type = row["_id"] or "unknown"
        total = row["total"]
        drive = row["with_drive"]
        gcs = row["with_gcs"]
        needs_mig = drive - gcs if drive > gcs else 0
        
        print(f"{content_type:15} Total: {total:4}  |  Drive: {drive:4}  |  GCS: {gcs:4}  |  Need migration: {needs_mig:4}")
    
    # Sample of items needing migration
    if needs_migration > 0:
        print(f"\n{'='*60}")
        print("SAMPLE OF ITEMS NEEDING MIGRATION (first 10)")
        print(f"{'='*60}\n")
        
        cursor = db.content.find(
            {
                "active": True,
                "google_drive_id": {"$exists": True, "$ne": None},
                "$or": [
                    {"gcs_path": {"$exists": False}},
                    {"gcs_path": None},
                    {"gcs_path": ""}
                ]
            },
            {"title": 1, "type": 1, "artist": 1, "google_drive_id": 1}
        ).limit(10)
        
        async for item in cursor:
            title = item.get("title", "Unknown")
            content_type = item.get("type", "unknown")
            artist = item.get("artist", "")
            artist_str = f" - {artist}" if artist else ""
            print(f"  • [{content_type:10}] {title}{artist_str}")
    
    print(f"\n{'='*60}\n")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(check_status())
