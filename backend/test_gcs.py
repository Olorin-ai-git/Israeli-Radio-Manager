#!/usr/bin/env python3
"""
Test script to verify GCS service is properly configured
Run: python test_gcs.py
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from app.services.gcs_storage import GCSStorageService
from app.config import settings

def main():
    print("=" * 60)
    print("Testing Google Cloud Storage Service")
    print("=" * 60)
    print()
    
    # Check environment
    print("📋 Configuration:")
    print(f"   Bucket Name: {settings.gcs_bucket_name}")
    print(f"   Service Account: {settings.google_service_account_file}")
    
    gcs_creds = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if gcs_creds:
        print(f"   Credentials: {gcs_creds}")
    else:
        print("   Credentials: Not set (using default)")
    print()
    
    # Initialize service
    print("🔧 Initializing GCS service...")
    try:
        gcs = GCSStorageService()
        
        if gcs.is_available:
            print("✅ GCS service initialized successfully!")
        else:
            print("❌ GCS service not available")
            print()
            print("💡 Troubleshooting:")
            print("   1. Check if service-account.json exists")
            print("   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable")
            print("   3. Verify service account has Storage permissions")
            print()
            print("See FIX_GCS_SERVICE.md for detailed instructions")
            return 1
            
    except Exception as e:
        print(f"❌ Failed to initialize GCS: {e}")
        return 1
    
    print()
    
    # Test URL conversion
    print("🔗 Testing URL conversions:")
    
    test_paths = [
        "gs://israeli-radio-475c9-audio/commercials/batch1/test.mp3",
        "gs://israeli-radio-475c9-audio/songs/test-song.mp3",
    ]
    
    for gs_path in test_paths:
        print(f"\n   Testing: {gs_path}")
        
        # Try public URL
        public_url = gcs.get_public_url(gs_path)
        if public_url:
            print(f"   ✅ Public URL: {public_url[:80]}...")
        else:
            print("   ⚠️  Public URL failed")
        
        # Try signed URL
        signed_url = gcs.get_signed_url(gs_path)
        if signed_url:
            print(f"   ✅ Signed URL: {signed_url[:80]}...")
        else:
            print("   ⚠️  Signed URL failed")
    
    print()
    print("=" * 60)
    print("✅ GCS Service Test Complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("1. Run an audit in LIVE mode (uncheck 'Dry Run')")
    print("2. Watch the logs for '✅ Fixed X URLs'")
    print("3. Verify streams are now accessible")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
