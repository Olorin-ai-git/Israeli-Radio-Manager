# Automatic Weekly Backup - Quick Start

## ✅ What Was Implemented

**Automatic weekly backups** of your entire content library and related data.

---

## 🚀 Quick Deploy

### 1. Deploy the Cloud Scheduler

```bash
cd /Users/olorin/Documents/olorin/olorin-media/Israeli-Radio-Manager/backend/scripts
./setup_backup_scheduler.sh
```

This creates a weekly backup job that runs **every Sunday at 3:00 AM EST**.

---

## 📋 What Gets Backed Up

- ✅ **Content library** (all songs, shows, commercials, jingles, samples, newsflashes)
- ✅ **Schedule slots**
- ✅ **Commercial campaigns**
- ✅ **Automation flows**
- ✅ **TTS voice configurations**
- ✅ **Pending uploads**

---

## 💾 Where Backups Are Stored

1. **Local**: `./backups/library_backup_weekly_YYYYMMDD_HHMMSS.zip`
2. **Google Cloud Storage**: `gs://israeli-radio-475c9-audio/backups/`
3. **MongoDB**: Metadata tracked in `backups` collection

---

## ⚙️ Configuration

**Schedule**: Every Sunday at 3:00 AM EST  
**Retention**: 30 days (minimum 5 backups always kept)  
**Auto-cleanup**: Runs after each backup  
**Format**: Compressed JSON (ZIP)  

---

## 🔧 Manual Backup

Create a manual backup anytime via API:

```bash
curl -X POST https://your-service.run.app/api/admin/backups/create \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"backup_type": "manual", "include_logs": false}'
```

---

## 📊 Check Status

```bash
# List backups
curl -H "Authorization: Bearer $TOKEN" \
  https://your-service.run.app/api/admin/backups/list

# Get statistics
curl -H "Authorization: Bearer $TOKEN" \
  https://your-service.run.app/api/admin/backups/statistics
```

---

## 🔍 Verify Cloud Scheduler

```bash
# List all scheduler jobs
gcloud scheduler jobs list --location=us-east1

# Check specific backup job
gcloud scheduler jobs describe weekly-library-backup --location=us-east1

# Manually trigger a backup (for testing)
gcloud scheduler jobs run weekly-library-backup --location=us-east1
```

---

## 📁 Files Created

- `/backend/app/services/backup_service.py` - Backup service implementation
- `/backend/app/routers/admin.py` - Added backup API endpoints
- `/backend/scripts/setup_backup_scheduler.sh` - Cloud Scheduler setup script
- `/backend/BACKUP_SYSTEM.md` - Full documentation

---

## 🎯 Next Steps

1. **Deploy scheduler**: Run `./setup_backup_scheduler.sh`
2. **Test it**: Manually trigger the job
3. **Verify**: Check that backups appear in GCS
4. **Monitor**: Set up alerts for backup failures (optional)

---

## 📖 Full Documentation

See `BACKUP_SYSTEM.md` for complete documentation including:
- Restore procedures
- API reference
- Troubleshooting
- Configuration options

---

**Status**: ✅ Ready to deploy  
**Created**: January 13, 2026
