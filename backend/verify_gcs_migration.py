#!/usr/bin/env python3
"""
Comprehensive GCS Migration Verification Script

This script will:
1. Check MongoDB for Drive references
2. Verify GCS connectivity and bucket access
3. Test streaming from GCS for existing content
4. Generate a detailed report
5. Optionally clean up Drive fields from MongoDB
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from app.services.gcs_storage import GCSStorageService

load_dotenv()


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'


async def check_mongodb_connection(uri: str, db_name: str) -> bool:
    """Test MongoDB connection."""
    try:
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        client.close()
        return True
    except Exception as e:
        print(f"{Colors.RED}✗ MongoDB connection failed: {e}{Colors.END}")
        return False


async def analyze_mongodb_content(db):
    """Analyze content in MongoDB."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}=" * 60)
    print("MongoDB Content Analysis")
    print("=" * 60 + Colors.END)
    
    stats = {}
    
    # Total documents
    total = await db.content.count_documents({})
    stats['total_documents'] = total
    print(f"\n📊 Total content documents: {Colors.BOLD}{total}{Colors.END}")
    
    if total == 0:
        print(f"{Colors.YELLOW}⚠ No content found in database{Colors.END}")
        return stats
    
    # Documents with Drive fields
    with_drive_id = await db.content.count_documents({"google_drive_id": {"$exists": True}})
    with_drive_path = await db.content.count_documents({"google_drive_path": {"$exists": True}})
    stats['with_drive_id'] = with_drive_id
    stats['with_drive_path'] = with_drive_path
    
    if with_drive_id > 0 or with_drive_path > 0:
        print(f"\n{Colors.RED}✗ Found Google Drive references:{Colors.END}")
        print(f"  - Documents with google_drive_id: {Colors.BOLD}{with_drive_id}{Colors.END}")
        print(f"  - Documents with google_drive_path: {Colors.BOLD}{with_drive_path}{Colors.END}")
    else:
        print(f"\n{Colors.GREEN}✓ No Google Drive fields found{Colors.END}")
    
    # Documents with GCS path
    with_gcs = await db.content.count_documents({"gcs_path": {"$exists": True, "$ne": None}})
    stats['with_gcs_path'] = with_gcs
    
    print(f"\n☁️  GCS Storage Status:")
    print(f"  - Documents with gcs_path: {Colors.BOLD}{with_gcs}{Colors.END}")
    print(f"  - Documents without cloud storage: {Colors.BOLD}{total - with_gcs}{Colors.END}")
    
    if with_gcs > 0:
        pct = (with_gcs / total * 100)
        color = Colors.GREEN if pct > 80 else Colors.YELLOW if pct > 50 else Colors.RED
        print(f"  - Coverage: {color}{pct:.1f}%{Colors.END}")
    
    # Breakdown by content type
    pipeline = [
        {"$group": {
            "_id": "$type",
            "total": {"$sum": 1},
            "with_gcs": {"$sum": {"$cond": [{"$and": [{"$ne": ["$gcs_path", None]}, {"$ne": ["$gcs_path", ""]}]}, 1, 0]}},
            "with_drive": {"$sum": {"$cond": [{"$ne": ["$google_drive_id", None]}, 1, 0]}}
        }},
        {"$sort": {"_id": 1}}
    ]
    
    type_stats = await db.content.aggregate(pipeline).to_list(100)
    
    if type_stats:
        print(f"\n📋 Breakdown by content type:")
        print(f"  {'Type':<15} {'Total':<8} {'GCS':<8} {'Drive':<8}")
        print(f"  {'-' * 45}")
        for t in type_stats:
            type_name = t['_id'] or 'Unknown'
            total_count = t['total']
            gcs_count = t['with_gcs']
            drive_count = t['with_drive']
            
            gcs_indicator = f"{Colors.GREEN}✓{Colors.END}" if gcs_count == total_count else f"{Colors.YELLOW}▸{Colors.END}"
            drive_indicator = f"{Colors.RED}✗{Colors.END}" if drive_count > 0 else f"{Colors.GREEN}✓{Colors.END}"
            
            print(f"  {type_name:<15} {total_count:<8} {gcs_count:<8} {drive_count:<8}  {gcs_indicator} {drive_indicator}")
    
    # Sample documents without GCS
    missing_gcs = await db.content.find(
        {"$or": [{"gcs_path": None}, {"gcs_path": {"$exists": False}}]},
        {"title": 1, "type": 1, "_id": 1}
    ).limit(5).to_list(5)
    
    if missing_gcs:
        print(f"\n{Colors.YELLOW}⚠ Sample documents without GCS storage:{Colors.END}")
        for doc in missing_gcs:
            print(f"  - [{doc.get('type', 'unknown')}] {doc.get('title', 'Untitled')} (ID: {doc['_id']})")
    
    stats['breakdown'] = type_stats
    return stats


async def verify_gcs_access():
    """Verify GCS service is available and working."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}=" * 60)
    print("GCS Service Verification")
    print("=" * 60 + Colors.END)
    
    gcs = GCSStorageService()
    
    if not gcs.is_available:
        print(f"{Colors.RED}✗ GCS service is NOT available{Colors.END}")
        print(f"{Colors.YELLOW}  Check your service account credentials and bucket configuration{Colors.END}")
        return False
    
    print(f"{Colors.GREEN}✓ GCS service initialized{Colors.END}")
    print(f"  Bucket: {Colors.BOLD}{gcs.bucket_name}{Colors.END}")
    
    # Try to list files
    try:
        files = await gcs.list_files()
        print(f"{Colors.GREEN}✓ Successfully connected to bucket{Colors.END}")
        print(f"  Files in bucket: {Colors.BOLD}{len(files)}{Colors.END}")
        
        # Show sample files
        if files:
            print(f"\n  Sample files:")
            for file in files[:5]:
                size_mb = file['size'] / (1024 * 1024)
                print(f"    - {file['name']} ({size_mb:.2f} MB)")
        
        return True
    except Exception as e:
        print(f"{Colors.RED}✗ Failed to access bucket: {e}{Colors.END}")
        return False


async def test_streaming(db, gcs: GCSStorageService):
    """Test streaming URLs for sample content."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}=" * 60)
    print("GCS Streaming Test")
    print("=" * 60 + Colors.END)
    
    # Get sample documents with GCS paths
    samples = await db.content.find(
        {"gcs_path": {"$exists": True, "$ne": None}},
        {"title": 1, "type": 1, "gcs_path": 1}
    ).limit(5).to_list(5)
    
    if not samples:
        print(f"{Colors.YELLOW}⚠ No content with GCS paths found to test{Colors.END}")
        return False
    
    print(f"\nTesting signed URL generation for {len(samples)} files...\n")
    
    success_count = 0
    for doc in samples:
        title = doc.get('title', 'Untitled')
        gcs_path = doc.get('gcs_path')
        content_type = doc.get('type', 'unknown')
        
        # Test signed URL generation
        signed_url = gcs.get_signed_url(gcs_path)
        
        if signed_url:
            print(f"{Colors.GREEN}✓{Colors.END} [{content_type}] {title}")
            print(f"  GCS: {gcs_path}")
            print(f"  URL: {signed_url[:80]}...")
            success_count += 1
        else:
            print(f"{Colors.RED}✗{Colors.END} [{content_type}] {title}")
            print(f"  GCS: {gcs_path}")
            print(f"  {Colors.RED}Failed to generate signed URL{Colors.END}")
    
    print(f"\n{Colors.BOLD}Streaming test: {success_count}/{len(samples)} successful{Colors.END}")
    
    return success_count == len(samples)


async def cleanup_drive_fields(db, dry_run=True):
    """Remove Google Drive fields from MongoDB."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}=" * 60)
    print("Drive Fields Cleanup")
    print("=" * 60 + Colors.END)
    
    if dry_run:
        print(f"\n{Colors.YELLOW}🔍 DRY RUN MODE - No changes will be made{Colors.END}")
    
    # Check what would be affected
    affected = await db.content.count_documents({
        "$or": [
            {"google_drive_id": {"$exists": True}},
            {"google_drive_path": {"$exists": True}}
        ]
    })
    
    if affected == 0:
        print(f"\n{Colors.GREEN}✓ No Drive fields to clean up{Colors.END}")
        return
    
    print(f"\n{Colors.YELLOW}Found {affected} documents with Drive fields{Colors.END}")
    
    if not dry_run:
        result = await db.content.update_many(
            {},
            {"$unset": {
                "google_drive_id": "",
                "google_drive_path": ""
            }}
        )
        print(f"{Colors.GREEN}✓ Removed Drive fields from {result.modified_count} documents{Colors.END}")
    else:
        print(f"  Would remove Drive fields from {affected} documents")
        print(f"\n{Colors.CYAN}Run with --cleanup flag to perform actual cleanup{Colors.END}")


async def main():
    """Main verification flow."""
    print(f"{Colors.BOLD}{Colors.BLUE}")
    print("=" * 60)
    print("  GCS Migration Verification & Cleanup Script")
    print("=" * 60)
    print(Colors.END)
    
    # Check arguments
    cleanup_mode = "--cleanup" in sys.argv
    
    if cleanup_mode:
        print(f"\n{Colors.RED}{Colors.BOLD}⚠ CLEANUP MODE ENABLED{Colors.END}")
        print(f"{Colors.YELLOW}This will remove Google Drive fields from MongoDB{Colors.END}")
        response = input("\nContinue? (yes/no): ")
        if response.lower() != 'yes':
            print("Aborted.")
            return
    
    # Get configuration
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB", "israeli_radio")
    
    print(f"\n📡 Configuration:")
    print(f"  MongoDB: {db_name}")
    print(f"  GCS Bucket: {os.getenv('GCS_BUCKET_NAME', 'Not configured')}")
    
    # Test MongoDB connection
    print(f"\n🔌 Testing MongoDB connection...")
    if not await check_mongodb_connection(mongodb_uri, db_name):
        print(f"\n{Colors.RED}❌ Verification failed - cannot connect to MongoDB{Colors.END}")
        return
    
    print(f"{Colors.GREEN}✓ MongoDB connected{Colors.END}")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(mongodb_uri)
    db = client[db_name]
    
    try:
        # Analyze MongoDB content
        mongo_stats = await analyze_mongodb_content(db)
        
        # Verify GCS access
        gcs_available = await verify_gcs_access()
        
        if gcs_available:
            # Test streaming
            gcs = GCSStorageService()
            streaming_ok = await test_streaming(db, gcs)
        else:
            streaming_ok = False
        
        # Cleanup if requested
        if cleanup_mode:
            await cleanup_drive_fields(db, dry_run=False)
        else:
            await cleanup_drive_fields(db, dry_run=True)
        
        # Final Summary
        print(f"\n{Colors.BOLD}{Colors.BLUE}=" * 60)
        print("Final Summary")
        print("=" * 60 + Colors.END)
        
        total = mongo_stats.get('total_documents', 0)
        with_gcs = mongo_stats.get('with_gcs_path', 0)
        with_drive = mongo_stats.get('with_drive_id', 0) + mongo_stats.get('with_drive_path', 0)
        
        print(f"\n📊 Content Status:")
        print(f"  Total documents: {total}")
        print(f"  With GCS storage: {with_gcs} ({with_gcs/total*100 if total else 0:.1f}%)")
        print(f"  With Drive refs: {with_drive}")
        
        # Determine overall status
        all_good = (
            gcs_available and
            streaming_ok and
            with_drive == 0 and
            with_gcs > 0
        )
        
        if all_good:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ All checks passed!{Colors.END}")
            print(f"{Colors.GREEN}Migration to GCS is complete and working.{Colors.END}")
        else:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ Some issues found:{Colors.END}")
            if not gcs_available:
                print(f"  {Colors.RED}✗{Colors.END} GCS not available")
            if not streaming_ok:
                print(f"  {Colors.RED}✗{Colors.END} Streaming test failed")
            if with_drive > 0:
                print(f"  {Colors.YELLOW}▸{Colors.END} Drive references still present")
            if with_gcs == 0:
                print(f"  {Colors.RED}✗{Colors.END} No content in GCS")
        
    finally:
        client.close()
    
    print(f"\n{Colors.CYAN}Done!{Colors.END}\n")


if __name__ == "__main__":
    asyncio.run(main())
