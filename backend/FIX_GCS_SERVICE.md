# Fix GCS Service Not Available Error

## Problem
The Librarian AI Agent shows: `❌ GCS service not available`

This prevents automatic fixing of gs:// URLs and metadata extraction.

## Root Cause
Google Cloud Storage service can't initialize due to missing or invalid credentials.

## Solution

### Option 1: Use Service Account Key (Recommended)

1. **Ensure service-account.json exists:**
   ```bash
   ls -la backend/service-account.json
   ```

2. **Set environment variable:**
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/Users/olorin/Documents/Israeli-Radio-Manager/backend/service-account.json"
   ```

3. **Add to .env file:**
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   ```

4. **Verify service account has permissions:**
   - Storage Object Viewer (for reading)
   - Storage Object Creator (for writing)
   - Or use Storage Admin for full access

### Option 2: Use Application Default Credentials

If running on Cloud Run or GCE, use default credentials:

```bash
# Authenticate with gcloud
gcloud auth application-default login

# Verify it works
gcloud storage ls gs://israeli-radio-475c9-audio/
```

### Option 3: Make Bucket Public (Simple but Less Secure)

If you want public access without authentication:

```bash
# Make bucket publicly readable
gsutil iam ch allUsers:objectViewer gs://israeli-radio-475c9-audio

# Test public access
curl https://storage.googleapis.com/israeli-radio-475c9-audio/commercials/batch1/example.mp3
```

## Verify Fix

After applying one of the above solutions:

1. **Restart the backend server**
2. **Run an audit in LIVE mode** (uncheck "Dry Run")
3. **Check the logs** - should see:
   ```
   ✅ Fixed 186 URLs, 0 failed
   ✅ Extracted metadata for 188 items
   ```

## Expected Results After Fix

- **Before:** Issues Found: 374, Issues Fixed: 0
- **After:** Issues Found: 374, Issues Fixed: 374

All gs:// URLs will be converted to:
```
https://storage.googleapis.com/israeli-radio-475c9-audio/path/to/file.mp3
```

## Test GCS Service Manually

```python
# backend/test_gcs.py
from app.services.gcs_storage import GCSStorageService

gcs = GCSStorageService()
print(f"GCS Available: {gcs.is_available}")
print(f"Bucket: {gcs.bucket_name}")

# Test URL conversion
test_path = "gs://israeli-radio-475c9-audio/commercials/batch1/test.mp3"
https_url = gcs.get_public_url(test_path)
print(f"Converted URL: {https_url}")
```

Run test:
```bash
cd backend
python -m test_gcs
```

## Troubleshooting

### Error: "Could not automatically determine credentials"
- Set GOOGLE_APPLICATION_CREDENTIALS
- Or run `gcloud auth application-default login`

### Error: "403 Forbidden"
- Service account lacks permissions
- Add Storage Object Viewer role

### Error: "404 Not Found"
- Bucket name is wrong
- Check GCS_BUCKET_NAME in .env

### URLs still showing gs://
- You ran in DRY RUN mode
- Uncheck "Dry Run (Preview only)" checkbox
- Run audit again

## Quick Fix Script

```bash
#!/bin/bash
# Run this to quickly fix GCS credentials

cd backend

# Check if service account exists
if [ ! -f "service-account.json" ]; then
    echo "❌ service-account.json not found!"
    echo "Download it from Google Cloud Console:"
    echo "https://console.cloud.google.com/iam-admin/serviceaccounts?project=israeli-radio-475c9"
    exit 1
fi

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS="$(pwd)/service-account.json"

# Test connection
python -c "from app.services.gcs_storage import GCSStorageService; gcs = GCSStorageService(); print('✅ GCS Available!' if gcs.is_available else '❌ GCS Not Available')"

echo ""
echo "Add this to your .env file:"
echo "GOOGLE_APPLICATION_CREDENTIALS=./service-account.json"
```

Save as `fix_gcs.sh`, then:
```bash
chmod +x fix_gcs.sh
./fix_gcs.sh
```
