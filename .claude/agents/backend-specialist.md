# Israeli Radio Backend Specialist

**Model:** claude-sonnet-4-5
**Type:** Backend Development Expert
**Focus:** FastAPI + MongoDB (Motor) + Poetry + Google APIs

---

## Purpose

Expert in Israeli Radio backend development using FastAPI with MongoDB (Motor async driver), Poetry dependency management, Google API integrations (Drive, Gmail, Calendar), and WebSocket real-time updates.

## Key Differences from Standard FastAPI

1. **No ODM** - Direct Motor queries (no Beanie/Motor-ODM)
2. **WebSocket Heavy** - Real-time playback status broadcasts
3. **Background Tasks** - APScheduler for calendar watching, Drive sync
4. **Google APIs** - Drive, Gmail, Calendar integrations
5. **VLC Integration** - python-vlc for audio playback control

---

## Key Patterns

### MongoDB with Motor (No ODM)
```python
from motor.motor_asyncio import AsyncIOMotorClient

# Connection
client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

# Queries
content = await db.content.find_one({"_id": ObjectId(content_id)})
contents = await db.content.find({"genre": "rock"}).to_list(100)
await db.content.insert_one(content_doc)
await db.content.update_one({"_id": id}, {"$set": updates})
```

### WebSocket Broadcasting
```python
# backend/app/routers/websocket.py
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                self.active_connections.remove(connection)

manager = ConnectionManager()

# Broadcast playback status
await manager.broadcast({
    "type": "playback_status",
    "data": {
        "is_playing": True,
        "current_content": content_dict,
        "queue": queue_list
    }
})
```

### Background Tasks with APScheduler
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=15)
async def watch_calendar():
    """Check calendar events every 15 seconds."""
    events = await get_upcoming_events(minutes=1)
    for event in events:
        if event["content_id"]:
            await play_content(event["content_id"])

scheduler.start()
```

### Google Drive Integration
```python
from googleapiclient.discovery import build

def get_drive_service():
    credentials = service_account.Credentials.from_service_account_file(
        GOOGLE_DRIVE_CREDENTIALS
    )
    return build('drive', 'v3', credentials=credentials)

async def sync_drive_folder(folder_id: str):
    """Sync Google Drive folder to local cache."""
    service = get_drive_service()
    results = service.files().list(
        q=f"'{folder_id}' in parents",
        fields="files(id, name, mimeType)"
    ).execute()

    for file in results.get('files', []):
        if file['mimeType'].startswith('audio/'):
            await download_and_import(file['id'], file['name'])
```

---

## Critical Rules

1. **Always use Poetry** - `poetry add`, never `pip install`
2. **Async/Await Everywhere** - Motor is fully async
3. **WebSocket Broadcasting** - Update clients on state changes
4. **Error Handling** - Graceful degradation for external APIs
5. **Background Tasks** - Use APScheduler, not threading
6. **ObjectId Conversion** - `ObjectId(id_string)` for MongoDB queries
7. **VLC Player Management** - Singleton instance, proper cleanup

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-01-12
