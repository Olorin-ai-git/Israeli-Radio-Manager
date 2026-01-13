# Sync Google Drive Command

Manually trigger Google Drive folder synchronization to import new content.

## Usage

```bash
/sync-drive [folder-type] [--force]
```

## Arguments

- **folder-type** - `songs`, `shows`, `commercials`, or `all` (default: all)
- **--force** - Force re-import of all files (default: false)

## Examples

### Sync All Folders
```bash
/sync-drive
```

### Sync Songs Only
```bash
/sync-drive songs
```

### Force Sync Commercials
```bash
/sync-drive commercials --force
```

## Workflow

1. **Connect to Google Drive API** - Use service account credentials
2. **List Files** - Get files from configured Drive folder
3. **Filter New Files** - Check against existing content in MongoDB
4. **Download** - Download audio files to local cache
5. **Extract Metadata** - Use mutagen to extract ID3 tags
6. **Create Content** - Insert into `content` collection
7. **Log Sync** - Record sync in `sync_logs` collection

## Drive Folder Configuration

**Environment Variables:**
```bash
GOOGLE_DRIVE_SONGS_FOLDER_ID=folder_id_here
GOOGLE_DRIVE_SHOWS_FOLDER_ID=folder_id_here
GOOGLE_DRIVE_COMMERCIALS_FOLDER_ID=folder_id_here
```

## API Endpoint
```bash
POST /api/content/sync-drive
{
  "folder_type": "songs",
  "force": false
}
```

## Background Service

Auto-sync runs every 5 minutes via APScheduler:
```python
@scheduler.scheduled_job('interval', minutes=5)
async def auto_sync_drive():
    await sync_drive_folders()
```

## Prerequisites

- Google Drive API enabled
- Service account credentials configured
- Drive folders shared with service account
- `CACHE_DIR` has sufficient space (10GB limit)

## Related Files

- `backend/app/services/google_services.py` - Drive API integration
- `backend/app/routers/content.py` - Sync endpoint
