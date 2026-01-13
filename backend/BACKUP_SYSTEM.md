# Automatic Backup System

## Overview

The Israeli Radio Manager includes an automatic weekly backup system that creates full backups of your content library and related data. Backups are stored both locally and in Google Cloud Storage.

---

## Features

✅ **Automatic Weekly Backups** - Runs every Sunday at 3:00 AM  
✅ **Multiple Storage** - Local filesystem + Google Cloud Storage  
✅ **Compression** - Backups are compressed (ZIP format)  
✅ **Retention Policy** - Keep 30 days, minimum 5 backups  
✅ **Verification** - Built-in backup integrity checking  
✅ **Manual Backups** - Create backups on-demand via API  
✅ **Restore Ready** - JSON format for easy data recovery  

---

## What Gets Backed Up

The backup includes the following MongoDB collections:

1. **content** - All audio files (songs, shows, commercials, jingles, samples, newsflashes)
2. **schedule_slots** - Scheduling information
3. **commercial_campaigns** - Campaign data
4. **flows** - Automation workflows
5. **voices** - TTS voice configurations
6. **pending_uploads** - Files awaiting categorization

**Optional:**
- **playback_logs** - Can be included but excluded by default (can be very large)

---

## Backup Schedule

### Automatic Backups

**Schedule**: Every Sunday at 3:00 AM EST  
**Type**: `weekly`  
**Includes Logs**: No  
**Cleanup**: Automatically removes backups older than 30 days (keeps minimum 5)

### Manual Backups

You can create manual backups anytime via:
- Admin API endpoint
- Cloud Scheduler manual trigger
- Future: Admin UI button

---

## Storage Locations

### 1. Local Storage
- **Path**: `./backups/` (relative to backend directory)
- **Format**: 
  - Compressed: `library_backup_weekly_YYYYMMDD_HHMMSS.zip`
  - Uncompressed: `library_backup_weekly_YYYYMMDD_HHMMSS.json`

### 2. Google Cloud Storage
- **Bucket**: `israeli-radio-475c9-audio` (same as audio files)
- **Path**: `backups/library_backup_weekly_YYYYMMDD_HHMMSS.zip`
- **Access**: Via service account

### 3. MongoDB Metadata
- **Collection**: `backups`
- **Indexed**: By date, type, name, status
- **Queryable**: Via Admin API

---

## Setup

### Deploy Cloud Scheduler

```bash
cd backend/scripts
./setup_backup_scheduler.sh
```

This creates a Cloud Scheduler job that triggers backups automatically.

### Manual Configuration

If you need to customize:

```bash
gcloud scheduler jobs create http weekly-library-backup \
    --location=us-east1 \
    --schedule="0 3 * * 0" \
    --time-zone="America/New_York" \
    --uri="https://your-service.run.app/api/admin/internal/backups/scheduled" \
    --http-method=POST \
    --oidc-service-account-email="your-service-account@your-project.iam.gserviceaccount.com"
```

---

## API Endpoints

All backup endpoints require admin authentication.

### Get Backup Statistics
```http
GET /api/admin/backups/statistics
```

**Response:**
```json
{
  "total_backups": 12,
  "total_size_mb": 458.32,
  "local_file_count": 12,
  "backup_directory": "./backups",
  "latest_backup": {
    "name": "library_backup_weekly_20260113_030000",
    "created_at": "2026-01-13T03:00:00",
    "total_items": 1523,
    "size_mb": 42.15
  }
}
```

### List Available Backups
```http
GET /api/admin/backups/list?limit=20
```

**Response:**
```json
{
  "backups": [
    {
      "_id": "...",
      "backup_name": "library_backup_weekly_20260113_030000",
      "backup_type": "weekly",
      "created_at": "2026-01-13T03:00:00",
      "total_items": 1523,
      "compressed_size_mb": 42.15,
      "gcs_uploaded": true,
      "status": "completed"
    }
  ]
}
```

### Create Manual Backup
```http
POST /api/admin/backups/create?backup_type=manual&include_logs=false
```

**Response:**
```json
{
  "status": "success",
  "backup_name": "library_backup_manual_20260113_150000",
  "total_items": 1523,
  "duration_seconds": 12.5,
  "file_size_mb": 45.2,
  "compressed_size_mb": 42.15,
  "local_path": "./backups/library_backup_manual_20260113_150000.zip",
  "gcs_uploaded": true,
  "statistics": {
    "content": 188,
    "schedule_slots": 48,
    "commercial_campaigns": 12,
    "flows": 5,
    "voices": 3,
    "pending_uploads": 0
  }
}
```

### Verify Backup Integrity
```http
POST /api/admin/backups/verify/{backup_name}
```

**Response:**
```json
{
  "status": "success",
  "message": "Backup verified successfully",
  "total_items": 1523,
  "collections": ["content", "schedule_slots", "commercial_campaigns", "flows", "voices"],
  "file_size_mb": 42.15
}
```

### Cleanup Old Backups
```http
POST /api/admin/backups/cleanup?retention_days=30&keep_minimum=5
```

**Response:**
```json
{
  "deleted_count": 3,
  "deleted_size_mb": 126.45,
  "errors": [],
  "remaining_backups": 9
}
```

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Backup Configuration
BACKUP_RETENTION_DAYS=30          # How long to keep backups
BACKUP_MINIMUM_KEEP=5             # Minimum backups to always keep
BACKUP_INCLUDE_LOGS_DEFAULT=false # Include playback logs by default
```

### Retention Policy

**Default Settings:**
- **Retention Period**: 30 days
- **Minimum Backups**: 5 (always kept, even if older than 30 days)
- **Automatic Cleanup**: Runs after each backup

**Example:**
- If you have 10 backups, and 7 are older than 30 days
- The 5 most recent will be kept (even if > 30 days old)
- The 2 oldest will be deleted

---

## Backup Structure

Each backup is a JSON file with the following structure:

```json
{
  "backup_name": "library_backup_weekly_20260113_030000",
  "backup_type": "weekly",
  "created_at": "2026-01-13T03:00:00.000Z",
  "total_items": 1523,
  "collections": {
    "content": [
      {
        "_id": "abc123...",
        "type": "song",
        "title": "Example Song",
        "artist": "Example Artist",
        "genre": "Pop",
        "duration_seconds": 180,
        "created_at": "2025-12-01T10:00:00.000Z"
      }
    ],
    "schedule_slots": [...],
    "commercial_campaigns": [...],
    "flows": [...],
    "voices": [...]
  },
  "statistics": {
    "content": 188,
    "schedule_slots": 48,
    "commercial_campaigns": 12,
    "flows": 5,
    "voices": 3
  }
}
```

---

## Monitoring

### Check Backup Health

```bash
# List recent scheduler runs
gcloud scheduler jobs describe weekly-library-backup \
    --location=us-east1 \
    --project=israeli-radio-475c9

# View execution logs
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=weekly-library-backup" \
    --limit=10 \
    --format=json
```

### Verify Latest Backup

```bash
# Using curl (requires authentication token)
curl -H "Authorization: Bearer $TOKEN" \
    https://your-service.run.app/api/admin/backups/statistics
```

---

## Restore Process

To restore from a backup:

1. **Download the backup file**
   - From local: `./backups/library_backup_*.zip`
   - From GCS: `gs://israeli-radio-475c9-audio/backups/library_backup_*.zip`

2. **Extract the ZIP file**
   ```bash
   unzip library_backup_weekly_20260113_030000.zip
   ```

3. **Parse the JSON**
   ```bash
   jq . library_backup_weekly_20260113_030000.json
   ```

4. **Restore to MongoDB**
   ```python
   import json
   from pymongo import MongoClient
   
   # Load backup
   with open('library_backup_weekly_20260113_030000.json') as f:
       backup = json.load(f)
   
   # Connect to MongoDB
   client = MongoClient('mongodb://localhost:27017')
   db = client['israeli_radio']
   
   # Restore each collection
   for collection_name, documents in backup['collections'].items():
       collection = db[collection_name]
       if documents:
           collection.insert_many(documents)
   ```

---

## Troubleshooting

### Backup Fails

**Check logs:**
```bash
# Backend logs
tail -f logs/app.log | grep -i backup

# Cloud Scheduler logs
gcloud logging read "resource.type=cloud_scheduler_job" --limit=50
```

**Common issues:**
1. **GCS upload fails** - Check service account permissions
2. **Disk space** - Ensure enough space in `./backups/`
3. **MongoDB timeout** - Large collections may need more time

### GCS Upload Fails

**Verify service account:**
```bash
# Check service account file
ls -la backend/service-account.json

# Test GCS access
gsutil ls gs://israeli-radio-475c9-audio/backups/
```

**Required permissions:**
- `storage.objects.create`
- `storage.objects.get`
- `storage.buckets.get`

---

## Best Practices

✅ **Test Restore** - Periodically test restoring from a backup  
✅ **Monitor Logs** - Check scheduler execution logs weekly  
✅ **Verify Storage** - Ensure GCS backups are uploading  
✅ **Disk Space** - Monitor local backup directory size  
✅ **Off-site Copy** - GCS provides off-site redundancy  

---

## Future Enhancements

Planned features:
- [ ] Admin UI for backup management
- [ ] Email notifications on backup success/failure
- [ ] Incremental backups (only changed data)
- [ ] Point-in-time restore
- [ ] Backup encryption
- [ ] Multi-region GCS replication

---

**Last Updated**: January 13, 2026  
**Status**: ✅ Implemented and ready for deployment
