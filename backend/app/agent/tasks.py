"""Task execution system for natural language commands."""

import logging
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.routers.websocket import broadcast_calendar_update

logger = logging.getLogger(__name__)


class TaskType(str, Enum):
    """Types of tasks the agent can execute."""
    PLAY_CONTENT = "play_content"           # Play specific song/show/commercial
    SCHEDULE_CONTENT = "schedule_content"   # Schedule content for specific time
    SEARCH_CONTENT = "search_content"       # Find content by name/artist
    SKIP_CURRENT = "skip_current"           # Skip current track
    PAUSE_PLAYBACK = "pause_playback"       # Pause playback
    RESUME_PLAYBACK = "resume_playback"     # Resume playback
    SET_VOLUME = "set_volume"               # Change volume
    ADD_TO_QUEUE = "add_to_queue"           # Add to queue
    GET_STATUS = "get_status"               # Get current status
    LIST_UPCOMING = "list_upcoming"         # List upcoming schedule
    CHANGE_GENRE = "change_genre"           # Switch to different genre
    INSERT_COMMERCIAL = "insert_commercial" # Insert commercial break
    # Calendar scheduling tasks
    SCHEDULE_TO_CALENDAR = "schedule_to_calendar"  # Schedule content to Google Calendar
    LIST_CALENDAR_EVENTS = "list_calendar_events"  # List upcoming calendar events
    UPDATE_CALENDAR_EVENT = "update_calendar_event"  # Update a calendar event
    DELETE_CALENDAR_EVENT = "delete_calendar_event"  # Delete a calendar event
    GET_DAY_SCHEDULE = "get_day_schedule"  # Get schedule for a specific day
    # Auto flow tasks
    CREATE_FLOW = "create_flow"             # Create a new auto flow
    LIST_FLOWS = "list_flows"               # List all flows
    RUN_FLOW = "run_flow"                   # Run/execute a flow
    UPDATE_FLOW = "update_flow"             # Update a flow
    DELETE_FLOW = "delete_flow"             # Delete a flow
    TOGGLE_FLOW = "toggle_flow"             # Enable/disable a flow
    # Library queries
    LIST_ARTISTS = "list_artists"           # List all artists in the library
    LIST_GENRES = "list_genres"             # List available genres
    # Content management
    UPDATE_METADATA = "update_metadata"     # Update song/content metadata
    # Queue management
    SHOW_QUEUE = "show_queue"               # Show current queue
    CLEAR_QUEUE = "clear_queue"             # Clear the queue
    REMOVE_FROM_QUEUE = "remove_from_queue" # Remove item from queue
    # Statistics/Analytics
    GET_STATISTICS = "get_statistics"       # Get library/playback statistics
    GET_MOST_PLAYED = "get_most_played"     # Get most played songs
    # Help/FAQ
    GET_HELP = "get_help"                   # Get help and available commands
    # Admin operations
    SYNC_DRIVE = "sync_drive"               # Trigger Google Drive sync
    GET_SYNC_STATUS = "get_sync_status"     # Get sync status
    UNKNOWN = "unknown"                     # Unknown task


class ParsedTask:
    """A parsed task from natural language input."""

    def __init__(
        self,
        task_type: TaskType,
        parameters: Dict[str, Any],
        original_text: str,
        confidence: float = 1.0
    ):
        self.task_type = task_type
        self.parameters = parameters
        self.original_text = original_text
        self.confidence = confidence
        self.scheduled_time: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_type": self.task_type.value,
            "parameters": self.parameters,
            "original_text": self.original_text,
            "confidence": self.confidence,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None
        }


class TaskExecutor:
    """
    Executes tasks based on natural language instructions.

    Examples of supported commands (Hebrew & English):
    - "תנגן את השיר 'אתמול' בשעה 4" (Play the song 'Yesterday' at 4)
    - "הוסף פרסומת בעוד 10 דקות" (Add commercial in 10 minutes)
    - "מה מתנגן עכשיו?" (What's playing now?)
    - "עבור לז'אנר מזרחי" (Switch to Mizrahi genre)
    - "Play 'Hallelujah' by Idan Raichel next"
    - "Schedule morning show for 7 AM tomorrow"
    """

    # Hebrew time patterns
    HEBREW_TIMES = {
        "עכשיו": 0,
        "מיד": 0,
        "בעוד דקה": 1,
        "בעוד 5 דקות": 5,
        "בעוד 10 דקות": 10,
        "בעוד רבע שעה": 15,
        "בעוד חצי שעה": 30,
        "בעוד שעה": 60,
    }

    # Hebrew command keywords
    HEBREW_COMMANDS = {
        "תנגן": TaskType.PLAY_CONTENT,
        "נגן": TaskType.PLAY_CONTENT,
        "שיר": TaskType.PLAY_CONTENT,
        "הפעל": TaskType.PLAY_CONTENT,
        "תפעיל": TaskType.PLAY_CONTENT,
        "תעצור": TaskType.PAUSE_PLAYBACK,
        "עצור": TaskType.PAUSE_PLAYBACK,
        "השהה": TaskType.PAUSE_PLAYBACK,
        "המשך": TaskType.RESUME_PLAYBACK,
        "תמשיך": TaskType.RESUME_PLAYBACK,
        "דלג": TaskType.SKIP_CURRENT,
        "תדלג": TaskType.SKIP_CURRENT,
        "הבא": TaskType.SKIP_CURRENT,
        "עוצמה": TaskType.SET_VOLUME,
        "ווליום": TaskType.SET_VOLUME,
        "הוסף": TaskType.ADD_TO_QUEUE,
        "תוסיף": TaskType.ADD_TO_QUEUE,
        "מה מתנגן": TaskType.GET_STATUS,
        "סטטוס": TaskType.GET_STATUS,
        "מצב": TaskType.GET_STATUS,
        "תזמן": TaskType.SCHEDULE_CONTENT,
        "קבע": TaskType.SCHEDULE_CONTENT,
        "תקבע": TaskType.SCHEDULE_CONTENT,
        "פרסומת": TaskType.INSERT_COMMERCIAL,
        "ז'אנר": TaskType.CHANGE_GENRE,
        "עבור ל": TaskType.CHANGE_GENRE,
        "תעבור ל": TaskType.CHANGE_GENRE,
        "חפש": TaskType.SEARCH_CONTENT,
        "תחפש": TaskType.SEARCH_CONTENT,
        "מצא": TaskType.SEARCH_CONTENT,
        # Calendar commands
        "תזמן ליומן": TaskType.SCHEDULE_TO_CALENDAR,
        "הוסף ליומן": TaskType.SCHEDULE_TO_CALENDAR,
        "קבע ביומן": TaskType.SCHEDULE_TO_CALENDAR,
        "לוח זמנים": TaskType.LIST_CALENDAR_EVENTS,
        "מה מתוזמן": TaskType.LIST_CALENDAR_EVENTS,
        "תוכניות היום": TaskType.GET_DAY_SCHEDULE,
        "לוז היום": TaskType.GET_DAY_SCHEDULE,
        "מחק מהיומן": TaskType.DELETE_CALENDAR_EVENT,
        "עדכן ביומן": TaskType.UPDATE_CALENDAR_EVENT,
        # Flow commands
        "צור זרימה": TaskType.CREATE_FLOW,
        "זרימה חדשה": TaskType.CREATE_FLOW,
        "תזרום": TaskType.CREATE_FLOW,
        "הצג זרימות": TaskType.LIST_FLOWS,
        "רשימת זרימות": TaskType.LIST_FLOWS,
        "הרץ זרימה": TaskType.RUN_FLOW,
        "הפעל זרימה": TaskType.RUN_FLOW,
        "מחק זרימה": TaskType.DELETE_FLOW,
        "עדכן זרימה": TaskType.UPDATE_FLOW,
        "השבת זרימה": TaskType.TOGGLE_FLOW,
        "הפעל זרימה": TaskType.TOGGLE_FLOW,
        # Metadata editing commands
        "עדכן": TaskType.UPDATE_METADATA,
        "ערוך": TaskType.UPDATE_METADATA,
        "שנה שם": TaskType.UPDATE_METADATA,
        "שנה אמן": TaskType.UPDATE_METADATA,
        "עדכן מטאדאטא": TaskType.UPDATE_METADATA,
        "תקן": TaskType.UPDATE_METADATA,
        # Queue management commands
        "הצג תור": TaskType.SHOW_QUEUE,
        "מה בתור": TaskType.SHOW_QUEUE,
        "תור": TaskType.SHOW_QUEUE,
        "נקה תור": TaskType.CLEAR_QUEUE,
        "רוקן תור": TaskType.CLEAR_QUEUE,
        "הסר מתור": TaskType.REMOVE_FROM_QUEUE,
        "מחק מתור": TaskType.REMOVE_FROM_QUEUE,
        # Statistics commands
        "סטטיסטיקה": TaskType.GET_STATISTICS,
        "סטטיסטיקות": TaskType.GET_STATISTICS,
        "נתונים": TaskType.GET_STATISTICS,
        "הכי מנוגן": TaskType.GET_MOST_PLAYED,
        "פופולרי": TaskType.GET_MOST_PLAYED,
        "הכי פופולרי": TaskType.GET_MOST_PLAYED,
        # Help commands
        "עזרה": TaskType.GET_HELP,
        "מה אתה יכול": TaskType.GET_HELP,
        "פקודות": TaskType.GET_HELP,
        "איך": TaskType.GET_HELP,
        # Admin/sync commands
        "סנכרן": TaskType.SYNC_DRIVE,
        "סנכרון": TaskType.SYNC_DRIVE,
        "סנכרן דרייב": TaskType.SYNC_DRIVE,
        "סטטוס סנכרון": TaskType.GET_SYNC_STATUS,
        "מצב סנכרון": TaskType.GET_SYNC_STATUS,
    }

    def __init__(self, db: AsyncIOMotorDatabase, audio_player=None, content_sync=None, calendar_service=None):
        self.db = db
        self._audio_player = audio_player
        self._content_sync = content_sync
        self._calendar_service = calendar_service
        self._scheduled_tasks: List[Dict[str, Any]] = []

    @staticmethod
    def _to_regex_string(value: Any) -> Optional[str]:
        """
        Safely convert a value to a string for use in MongoDB $regex queries.
        Returns None if the value is None or empty after conversion.
        """
        if value is None:
            return None
        # Convert to string and strip whitespace
        str_value = str(value).strip()
        return str_value if str_value else None

    async def execute_task(self, task: ParsedTask) -> Dict[str, Any]:
        """
        Execute a parsed task.

        Returns:
            Result dict with success status and message
        """
        logger.info(f"Executing task: {task.task_type.value}")

        try:
            if task.task_type == TaskType.PLAY_CONTENT:
                return await self._execute_play(task)
            elif task.task_type == TaskType.SCHEDULE_CONTENT:
                return await self._execute_schedule(task)
            elif task.task_type == TaskType.SKIP_CURRENT:
                return await self._execute_skip(task)
            elif task.task_type == TaskType.PAUSE_PLAYBACK:
                return await self._execute_pause(task)
            elif task.task_type == TaskType.RESUME_PLAYBACK:
                return await self._execute_resume(task)
            elif task.task_type == TaskType.SET_VOLUME:
                return await self._execute_volume(task)
            elif task.task_type == TaskType.ADD_TO_QUEUE:
                return await self._execute_add_queue(task)
            elif task.task_type == TaskType.GET_STATUS:
                return await self._execute_status(task)
            elif task.task_type == TaskType.CHANGE_GENRE:
                return await self._execute_genre_change(task)
            elif task.task_type == TaskType.INSERT_COMMERCIAL:
                return await self._execute_commercial(task)
            elif task.task_type == TaskType.SEARCH_CONTENT:
                return await self._execute_search(task)
            elif task.task_type == TaskType.SCHEDULE_TO_CALENDAR:
                return await self._execute_schedule_to_calendar(task)
            elif task.task_type == TaskType.LIST_CALENDAR_EVENTS:
                return await self._execute_list_calendar_events(task)
            elif task.task_type == TaskType.UPDATE_CALENDAR_EVENT:
                return await self._execute_update_calendar_event(task)
            elif task.task_type == TaskType.DELETE_CALENDAR_EVENT:
                return await self._execute_delete_calendar_event(task)
            elif task.task_type == TaskType.GET_DAY_SCHEDULE:
                return await self._execute_get_day_schedule(task)
            # Flow tasks
            elif task.task_type == TaskType.CREATE_FLOW:
                return await self._execute_create_flow(task)
            elif task.task_type == TaskType.LIST_FLOWS:
                return await self._execute_list_flows(task)
            elif task.task_type == TaskType.RUN_FLOW:
                return await self._execute_run_flow(task)
            elif task.task_type == TaskType.UPDATE_FLOW:
                return await self._execute_update_flow(task)
            elif task.task_type == TaskType.DELETE_FLOW:
                return await self._execute_delete_flow(task)
            elif task.task_type == TaskType.TOGGLE_FLOW:
                return await self._execute_toggle_flow(task)
            elif task.task_type == TaskType.LIST_ARTISTS:
                return await self._execute_list_artists(task)
            elif task.task_type == TaskType.LIST_GENRES:
                return await self._execute_list_genres(task)
            elif task.task_type == TaskType.UPDATE_METADATA:
                return await self._execute_update_metadata(task)
            # Queue management
            elif task.task_type == TaskType.SHOW_QUEUE:
                return await self._execute_show_queue(task)
            elif task.task_type == TaskType.CLEAR_QUEUE:
                return await self._execute_clear_queue(task)
            elif task.task_type == TaskType.REMOVE_FROM_QUEUE:
                return await self._execute_remove_from_queue(task)
            # Statistics
            elif task.task_type == TaskType.GET_STATISTICS:
                return await self._execute_get_statistics(task)
            elif task.task_type == TaskType.GET_MOST_PLAYED:
                return await self._execute_get_most_played(task)
            # Help
            elif task.task_type == TaskType.GET_HELP:
                return await self._execute_get_help(task)
            # Admin
            elif task.task_type == TaskType.SYNC_DRIVE:
                return await self._execute_sync_drive(task)
            elif task.task_type == TaskType.GET_SYNC_STATUS:
                return await self._execute_get_sync_status(task)
            else:
                return {
                    "success": False,
                    "message": "לא הבנתי את הבקשה. אנא נסה שוב.",
                    "message_en": "I didn't understand the request. Please try again."
                }
        except Exception as e:
            logger.error(f"Task execution error: {e}")
            return {
                "success": False,
                "message": f"שגיאה בביצוע המשימה: {str(e)}",
                "message_en": f"Error executing task: {str(e)}"
            }

    async def _execute_play(self, task: ParsedTask) -> Dict[str, Any]:
        """Play specific content."""
        from app.services.audio_player import TrackInfo
        from app.routers.websocket import broadcast_scheduled_playback
        import random

        title = self._to_regex_string(task.parameters.get("title"))
        artist = self._to_regex_string(task.parameters.get("artist"))
        content_type = task.parameters.get("content_type", "song")

        logger.info(f"Play request - title: {title}, artist: {artist}")

        # Search for content
        query: Dict[str, Any] = {"active": True, "type": "song"}
        if title:
            query["$or"] = [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ]
        if artist:
            query["artist"] = {"$regex": artist, "$options": "i"}

        # For artist-only queries (no title), find all songs and pick randomly
        if artist and not title:
            songs = await self.db.content.find(query).to_list(50)
            if songs:
                content = random.choice(songs)
                logger.info(f"Artist-only search: found {len(songs)} songs by '{artist}', randomly selected '{content.get('title')}'")
            else:
                content = None
        else:
            content = await self.db.content.find_one(query)

        logger.info(f"Play request - title: {title}, artist: {artist}, found content: {content.get('title') if content else 'None'}")

        if content:
            # Check if scheduled for later
            if task.scheduled_time and task.scheduled_time > datetime.now():
                await self._schedule_for_later(content, task.scheduled_time)
                return {
                    "success": True,
                    "message": f"✅ השיר '{content['title']}' תוזמן לשעה {task.scheduled_time.strftime('%H:%M')}",
                    "message_en": f"Song '{content['title']}' scheduled for {task.scheduled_time.strftime('%H:%M')}",
                    "content": content
                }
            else:
                # Prepare content data for browser playback
                content_data = {
                    "_id": str(content["_id"]),
                    "title": content.get("title"),
                    "artist": content.get("artist"),
                    "type": content.get("type"),
                    "duration_seconds": content.get("duration_seconds"),
                    "genre": content.get("genre"),
                    "metadata": content.get("metadata"),
                }

                # Always broadcast to browser for frontend playback
                logger.info(f"Broadcasting playback to browser: {content.get('title')}")
                await broadcast_scheduled_playback(content_data)

                # Notify flow monitor about playback
                from app.services.flow_monitor import notify_playback_started
                notify_playback_started(content_data, content.get("duration_seconds", 0))

                # Log playback
                await self.db.playback_logs.insert_one({
                    "content_id": content["_id"],
                    "started_at": datetime.utcnow(),
                    "ended_at": None,
                    "requested_by": "user_chat"
                })

                # Also try backend VLC playback if available
                vlc_success = False
                if self._audio_player and self._content_sync:
                    try:
                        local_path = await self._content_sync.download_for_playback(str(content["_id"]))
                        if local_path:
                            track = TrackInfo(
                                content_id=str(content["_id"]),
                                title=content.get("title", "Unknown"),
                                artist=content.get("artist"),
                                duration_seconds=content.get("duration_seconds", 0),
                                file_path=str(local_path)
                            )
                            vlc_success = await self._audio_player.play(track)
                            if vlc_success:
                                logger.info(f"VLC playback started for: {content.get('title')}")
                    except Exception as e:
                        logger.warning(f"VLC playback failed: {e}")

                return {
                    "success": True,
                    "message": f"🎵 מנגן עכשיו: '{content['title']}'",
                    "message_en": f"Now playing: '{content['title']}'",
                    "content": content
                }
        else:
            # Search suggestions - use artist search type when looking for artists
            if artist and not title:
                suggestions = await self._find_similar(artist, limit=5, search_type="artist")
                # Format artists as readable list
                if suggestions:
                    artist_list = ", ".join([s.get("artist") or "Unknown" for s in suggestions if s.get("artist")])
                    return {
                        "success": False,
                        "message": f"❌ לא מצאתי שירים של '{artist}'. האמנים הזמינים: {artist_list}",
                        "message_en": f"Couldn't find any songs by '{artist}'. Available artists: {artist_list}",
                        "suggestions": suggestions
                    }
                return {
                    "success": False,
                    "message": f"❌ לא מצאתי שירים של '{artist}'. אין אמנים בספרייה.",
                    "message_en": f"Couldn't find any songs by '{artist}'. No artists in library.",
                    "suggestions": []
                }

            search_term = title or ""
            suggestions = await self._find_similar(search_term)
            if suggestions:
                suggestion_list = ", ".join([f"{s.get('title', 'Unknown')} - {s.get('artist', 'Unknown')}" for s in suggestions[:3] if s.get('title')])
                return {
                    "success": False,
                    "message": f"❌ לא מצאתי את '{search_term}'. אולי התכוונת ל: {suggestion_list}",
                    "message_en": f"Couldn't find '{search_term}'. Did you mean: {suggestion_list}",
                    "suggestions": suggestions
                }
            return {
                "success": False,
                "message": f"❌ לא מצאתי את '{search_term}'.",
                "message_en": f"Couldn't find '{search_term}'.",
                "suggestions": []
            }

    async def _execute_schedule(self, task: ParsedTask) -> Dict[str, Any]:
        """Schedule content for a specific time."""
        title = self._to_regex_string(task.parameters.get("title"))
        artist = self._to_regex_string(task.parameters.get("artist"))
        time_str = self._to_regex_string(task.parameters.get("time"))
        date_str = self._to_regex_string(task.parameters.get("date"))

        if not time_str:
            return {
                "success": False,
                "message": "❌ לא ציינת שעה. לדוגמה: 'תזמן את השיר לשעה 16:00'",
                "message_en": "No time specified. Example: 'Schedule the song for 4:00 PM'"
            }

        # Parse the time string into a datetime object
        scheduled_time = self._parse_datetime(date_str, time_str)
        if not scheduled_time:
            return {
                "success": False,
                "message": f"❌ לא הצלחתי לפרסר את השעה: {time_str}",
                "message_en": f"Couldn't parse time: {time_str}"
            }

        # Build query for finding content
        query: Dict[str, Any] = {"active": True}
        if title:
            query["$or"] = [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ]
        if artist:
            query["artist"] = {"$regex": artist, "$options": "i"}

        # Find the content - if only artist specified, pick a random song
        if artist and not title:
            import random
            songs = await self.db.content.find(query).to_list(50)
            content = random.choice(songs) if songs else None
        else:
            content = await self.db.content.find_one(query)

        if content:
            # Schedule internally for playback
            await self._schedule_for_later(content, scheduled_time)

            # Also add to Google Calendar if available
            calendar_msg = ""
            if self._calendar_service:
                try:
                    event = await self._calendar_service.schedule_content(
                        content=content,
                        start_time=scheduled_time
                    )
                    if event:
                        calendar_msg = " ונוסף ליומן"
                        await broadcast_calendar_update("created")
                except Exception as e:
                    logger.warning(f"Failed to add to calendar: {e}")

            return {
                "success": True,
                "message": f"✅ '{content['title']}' תוזמן לשעה {scheduled_time.strftime('%H:%M')}{calendar_msg}",
                "message_en": f"'{content['title']}' scheduled for {scheduled_time.strftime('%H:%M')}{' and added to calendar' if calendar_msg else ''}"
            }

        search_term = title or artist or "unknown"
        return {
            "success": False,
            "message": f"❌ לא מצאתי תוכן: '{search_term}'",
            "message_en": f"Couldn't find content: '{search_term}'"
        }

    async def _execute_skip(self, task: ParsedTask) -> Dict[str, Any]:
        """Skip current track."""
        return {
            "success": True,
            "action": "skip",
            "message": "⏭️ עוברים לשיר הבא",
            "message_en": "Skipping to next track"
        }

    async def _execute_pause(self, task: ParsedTask) -> Dict[str, Any]:
        """Pause playback."""
        return {
            "success": True,
            "action": "pause",
            "message": "⏸️ הנגינה הושהתה",
            "message_en": "Playback paused"
        }

    async def _execute_resume(self, task: ParsedTask) -> Dict[str, Any]:
        """Resume playback."""
        return {
            "success": True,
            "action": "resume",
            "message": "▶️ ממשיכים לנגן",
            "message_en": "Resuming playback"
        }

    async def _execute_volume(self, task: ParsedTask) -> Dict[str, Any]:
        """Set volume."""
        level = task.parameters.get("level", 80)
        return {
            "success": True,
            "action": "volume",
            "level": level,
            "message": f"🔊 עוצמת הקול הוגדרה ל-{level}%",
            "message_en": f"Volume set to {level}%"
        }

    async def _execute_add_queue(self, task: ParsedTask) -> Dict[str, Any]:
        """Add content to queue at the TOP (position 0)."""
        from app.routers.playback import add_to_queue_async, get_queue_async
        from app.routers.websocket import broadcast_queue_update

        title = self._to_regex_string(task.parameters.get("title"))

        if not title:
            return {
                "success": False,
                "message": "❌ לא ציינת שם שיר",
                "message_en": "No song title specified"
            }

        content = await self.db.content.find_one({
            "$or": [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ],
            "active": True
        })

        if content:
            # Build queue item
            queue_item = {
                "_id": str(content["_id"]),
                "title": content.get("title", "Unknown"),
                "artist": content.get("artist"),
                "type": content.get("type", "song"),
                "duration_seconds": content.get("duration_seconds", 0),
                "genre": content.get("genre"),
                "metadata": content.get("metadata", {}),
                "batches": content.get("batches", [])
            }

            # Insert at TOP of queue (position 0, persisted to MongoDB)
            await add_to_queue_async(self.db, queue_item, position=0)

            # Broadcast queue update
            updated_queue = await get_queue_async(self.db)
            await broadcast_queue_update(updated_queue)

            return {
                "success": True,
                "message": f"✅ '{content['title']}' נוסף לראש התור",
                "message_en": f"'{content['title']}' added to top of queue"
            }

        return {
            "success": False,
            "message": f"❌ לא מצאתי '{title}'",
            "message_en": f"Couldn't find '{title}'"
        }

    async def _execute_status(self, task: ParsedTask) -> Dict[str, Any]:
        """Get current playback status."""
        # Get current playing from logs
        current = await self.db.playback_logs.find_one(
            {"ended_at": None},
            sort=[("started_at", -1)]
        )

        if current:
            content = await self.db.content.find_one({"_id": current["content_id"]})
            if content:
                return {
                    "success": True,
                    "message": f"🎵 מתנגן עכשיו: '{content.get('title', 'Unknown')}' מאת {content.get('artist', 'לא ידוע')}",
                    "message_en": f"Now playing: '{content.get('title', 'Unknown')}' by {content.get('artist', 'Unknown')}",
                    "current_track": content
                }

        return {
            "success": True,
            "message": "🔇 לא מתנגן כלום כרגע",
            "message_en": "Nothing playing right now"
        }

    async def _execute_genre_change(self, task: ParsedTask) -> Dict[str, Any]:
        """Change to a different genre and play a random song from it."""
        from app.routers.websocket import broadcast_scheduled_playback
        import random

        genre = self._to_regex_string(task.parameters.get("genre"))

        # Map Hebrew genre names to English equivalents
        genre_map = {
            "מזרחי": "mizrahi",
            "מזרחית": "mizrahi",
            "פופ": "pop",
            "רוק": "rock",
            "קלאסי": "classic",
            "קלאסית": "classic",
            "ישראלי": "israeli",
            "ישראלית": "israeli",
            "חסידי": "hasidic",
            "חסידית": "hasidic",
            "ים תיכוני": "mediterranean",
            "ים-תיכוני": "mediterranean",
            "עברי": "hebrew",
            "עברית": "hebrew",
        }

        # Normalize genre - try Hebrew mapping first
        normalized_genre = genre_map.get(genre, genre)
        logger.info(f"Genre change: original='{genre}', normalized='{normalized_genre}'")

        # Update current schedule preference
        await self.db.agent_state.update_one(
            {"_id": "current"},
            {"$set": {"preferred_genre": normalized_genre, "updated_at": datetime.utcnow()}},
            upsert=True
        )

        # Get recently played song IDs (last 4 hours) to avoid repeating
        four_hours_ago = datetime.utcnow() - timedelta(hours=4)
        recent_logs = await self.db.playback_logs.find({
            "started_at": {"$gte": four_hours_ago}
        }).to_list(100)
        recent_ids = [log["content_id"] for log in recent_logs if "content_id" in log]
        logger.info(f"Genre change: excluding {len(recent_ids)} recently played songs")

        # Find songs from the new genre - search both original and normalized
        query = {
            "type": "song",
            "active": True,
            "$or": [
                {"genre": {"$regex": genre, "$options": "i"}},
                {"genre": {"$regex": normalized_genre, "$options": "i"}},
                {"metadata.genre": {"$regex": genre, "$options": "i"}},
                {"metadata.genre": {"$regex": normalized_genre, "$options": "i"}}
            ]
        }

        # Exclude recently played songs
        if recent_ids:
            query["_id"] = {"$nin": recent_ids}

        songs = await self.db.content.find(query).to_list(50)

        # If all songs in genre were recently played, fall back to all songs
        if not songs and recent_ids:
            logger.info("All songs in genre were recently played, using all songs")
            del query["_id"]
            songs = await self.db.content.find(query).to_list(50)

        if songs:
            # Shuffle all songs and pick unique ones (up to 10)
            random.shuffle(songs)
            selected_songs = songs[:min(10, len(songs))]

            logger.info(f"Genre change: selected {len(selected_songs)} unique songs from {len(songs)} available")

            # First song plays immediately
            first_song = selected_songs[0]
            content_data = {
                "_id": str(first_song["_id"]),
                "title": first_song.get("title"),
                "artist": first_song.get("artist"),
                "type": first_song.get("type"),
                "duration_seconds": first_song.get("duration_seconds"),
                "genre": first_song.get("genre"),
                "metadata": first_song.get("metadata"),
            }

            # Broadcast first song for immediate playback
            logger.info(f"Genre change: playing first song - {first_song.get('title')}")
            await broadcast_scheduled_playback(content_data)

            # Notify flow monitor about playback
            from app.services.flow_monitor import notify_playback_started
            notify_playback_started(content_data, first_song.get("duration_seconds", 0))

            # Queue remaining songs
            from app.routers.websocket import broadcast_queue_tracks
            if len(selected_songs) > 1:
                queue_tracks = []
                for song in selected_songs[1:]:
                    queue_tracks.append({
                        "_id": str(song["_id"]),
                        "title": song.get("title"),
                        "artist": song.get("artist"),
                        "type": song.get("type"),
                        "duration_seconds": song.get("duration_seconds"),
                        "genre": song.get("genre"),
                        "metadata": song.get("metadata"),
                    })
                logger.info(f"Genre change: queueing {len(queue_tracks)} additional songs")
                await broadcast_queue_tracks(queue_tracks)

            # Log playback for first song
            await self.db.playback_logs.insert_one({
                "content_id": first_song["_id"],
                "started_at": datetime.utcnow(),
                "ended_at": None,
                "requested_by": "genre_change"
            })

            song_list = ", ".join([s.get("title", "?") for s in selected_songs[:3]])
            if len(selected_songs) > 3:
                song_list += f" ועוד {len(selected_songs) - 3}..."

            return {
                "success": True,
                "message": f"🎶 עוברים לז'אנר {genre}\n🎵 מנגן: {first_song.get('title')}\n📋 בתור: {len(selected_songs) - 1} שירים נוספים",
                "message_en": f"Switching to {genre} genre\nNow playing: {first_song.get('title')}\nQueued: {len(selected_songs) - 1} more songs",
                "genre": genre,
                "content": first_song
            }
        else:
            return {
                "success": True,
                "message": f"🎶 עוברים לז'אנר {genre}\n⚠️ לא נמצאו שירים בז'אנר זה",
                "message_en": f"Switching to {genre} genre\nNo songs found in this genre",
                "genre": genre
            }

    async def _execute_commercial(self, task: ParsedTask) -> Dict[str, Any]:
        """Insert a commercial break."""
        when = task.parameters.get("when", "now")

        if when == "now":
            return {
                "success": True,
                "action": "insert_commercial",
                "message": "📢 מוסיף הפסקת פרסומות",
                "message_en": "Inserting commercial break"
            }

        return {
            "success": True,
            "message": f"📢 הפסקת פרסומות תוזמנה ל{when}",
            "message_en": f"Commercial break scheduled for {when}"
        }

    async def _execute_search(self, task: ParsedTask) -> Dict[str, Any]:
        """Search for content."""
        query_text = self._to_regex_string(task.parameters.get("query")) or ""

        if not query_text:
            return {
                "success": False,
                "message": "❌ לא ציינת מה לחפש",
                "message_en": "No search query specified"
            }

        results = await self.db.content.find({
            "$or": [
                {"title": {"$regex": query_text, "$options": "i"}},
                {"title_he": {"$regex": query_text, "$options": "i"}},
                {"artist": {"$regex": query_text, "$options": "i"}}
            ],
            "active": True
        }).limit(10).to_list(10)

        if results:
            result_list = "\n".join([
                f"• {r.get('title', 'Unknown')} - {r.get('artist', '')}" for r in results if r.get('title')
            ])
            return {
                "success": True,
                "message": f"🔍 מצאתי {len(results)} תוצאות:\n{result_list}",
                "message_en": f"Found {len(results)} results",
                "results": results
            }

        return {
            "success": False,
            "message": f"❌ לא מצאתי תוצאות עבור '{query_text}'",
            "message_en": f"No results found for '{query_text}'"
        }

    async def _schedule_for_later(self, content: Dict, scheduled_time: datetime):
        """Schedule content for later playback."""
        await self.db.scheduled_tasks.insert_one({
            "content_id": content["_id"],
            "scheduled_time": scheduled_time,
            "created_at": datetime.utcnow(),
            "status": "pending",
            "requested_by": "user_chat"
        })

    async def _find_similar(self, search_term: str, limit: int = 5, search_type: str = "title") -> List[Dict]:
        """Find similar content or artists."""
        # Ensure search_term is a string for regex queries
        search_term = self._to_regex_string(search_term) if search_term else None
        if not search_term:
            # Return random artists from library
            pipeline = [
                {"$match": {"active": True, "type": "song", "artist": {"$exists": True, "$ne": ""}}},
                {"$group": {"_id": "$artist", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": limit}
            ]
            artist_results = await self.db.content.aggregate(pipeline).to_list(limit)
            return [{"artist": r["_id"] or "Unknown", "song_count": r["count"]} for r in artist_results if r.get("_id")]

        if search_type == "artist":
            # Find artists with similar names
            pipeline = [
                {"$match": {"active": True, "type": "song", "artist": {"$exists": True, "$ne": ""}}},
                {"$group": {"_id": "$artist", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": limit * 2}
            ]
            all_artists = await self.db.content.aggregate(pipeline).to_list(limit * 2)
            return [{"artist": r["_id"] or "Unknown", "song_count": r["count"]} for r in all_artists[:limit] if r.get("_id")]

        # Default: find by title
        results = await self.db.content.find({
            "active": True,
            "$or": [
                {"title": {"$regex": search_term, "$options": "i"}},
                {"artist": {"$regex": search_term, "$options": "i"}}
            ]
        }).limit(limit).to_list(limit)

        return [{"title": r.get("title") or "Unknown", "artist": r.get("artist") or "Unknown"} for r in results if r.get("title")]

    async def _get_all_artists(self, limit: int = 20) -> List[Dict]:
        """Get all unique artists in the library."""
        pipeline = [
            {"$match": {"active": True, "type": "song", "artist": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$artist", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit}
        ]
        results = await self.db.content.aggregate(pipeline).to_list(limit)
        return [{"artist": r["_id"] or "Unknown", "song_count": r["count"]} for r in results if r.get("_id")]

    async def _execute_list_artists(self, task: ParsedTask) -> Dict[str, Any]:
        """List all artists in the library."""
        limit = task.parameters.get("limit", 20)

        artists = await self._get_all_artists(limit=limit)

        if not artists:
            return {
                "success": True,
                "message": "📚 אין אמנים בספרייה עדיין.",
                "message_en": "No artists in the library yet.",
                "artists": []
            }

        # Format artist list
        artist_lines = []
        for i, a in enumerate(artists, 1):
            artist_lines.append(f"{i}. {a['artist']} ({a['song_count']} שירים)")

        artist_list_he = "\n".join(artist_lines)
        artist_list_en = ", ".join([a['artist'] for a in artists])

        return {
            "success": True,
            "message": f"🎤 האמנים בספרייה:\n{artist_list_he}",
            "message_en": f"Artists in library: {artist_list_en}",
            "artists": artists
        }

    async def _execute_list_genres(self, task: ParsedTask) -> Dict[str, Any]:
        """List all genres in the library."""
        pipeline = [
            {"$match": {"active": True, "type": "song", "genre": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$genre", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        results = await self.db.content.aggregate(pipeline).to_list(50)

        if not results:
            return {
                "success": True,
                "message": "📚 אין ז'אנרים מוגדרים בספרייה.",
                "message_en": "No genres defined in the library.",
                "genres": []
            }

        genres = [{"genre": r["_id"] or "Unknown", "song_count": r["count"]} for r in results if r.get("_id")]

        # Format genre list
        genre_lines = []
        for i, g in enumerate(genres, 1):
            genre_lines.append(f"{i}. {g['genre']} ({g['song_count']} שירים)")

        genre_list_he = "\n".join(genre_lines)
        genre_list_en = ", ".join([g['genre'] for g in genres])

        return {
            "success": True,
            "message": f"🎵 הז'אנרים בספרייה:\n{genre_list_he}",
            "message_en": f"Genres in library: {genre_list_en}",
            "genres": genres
        }

    # Calendar task execution methods

    async def _execute_schedule_to_calendar(self, task: ParsedTask) -> Dict[str, Any]:
        """
        Schedule content to Google Calendar.

        Parameters:
            - title: Content title to schedule
            - date: Date for scheduling (YYYY-MM-DD or relative like "tomorrow")
            - time: Time for scheduling (HH:MM)
            - end_time: Optional end time
            - recurrence: Recurrence settings (daily, weekly, monthly, yearly)
            - recurrence_count: Number of occurrences
            - recurrence_until: End date for recurrence
            - recurrence_days: Days for weekly recurrence (MO,TU,WE,TH,FR,SA,SU)
            - reminder_minutes: Minutes before to remind (default 30)
            - reminder_method: email, popup, or sms
            - description: Additional description
            - all_day: Whether it's an all-day event
        """
        if not self._calendar_service:
            return {
                "success": False,
                "message": "❌ שירות יומן Google לא מוגדר",
                "message_en": "Google Calendar service not configured"
            }

        title = self._to_regex_string(task.parameters.get("title"))
        date_str = task.parameters.get("date")
        time_str = task.parameters.get("time")

        if not title:
            return {
                "success": False,
                "message": "❌ לא ציינת שם של תוכן לתזמון",
                "message_en": "Please specify content title to schedule"
            }

        # Find the content
        content = await self.db.content.find_one({
            "$or": [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ],
            "active": True
        })

        if not content:
            return {
                "success": False,
                "message": f"❌ לא מצאתי תוכן בשם '{title}'",
                "message_en": f"Couldn't find content named '{title}'"
            }

        # Parse date and time
        scheduled_datetime = self._parse_datetime(date_str, time_str)
        if not scheduled_datetime:
            return {
                "success": False,
                "message": "❌ לא הצלחתי להבין את התאריך או השעה",
                "message_en": "Couldn't parse date or time"
            }

        # Parse end time if provided
        end_time = None
        end_time_str = task.parameters.get("end_time")
        if end_time_str:
            end_time = self._parse_datetime(date_str, end_time_str)

        # Build recurrence settings
        recurrence = None
        recurrence_type = task.parameters.get("recurrence")
        if recurrence_type:
            recurrence = {
                "frequency": recurrence_type.upper()
            }
            if task.parameters.get("recurrence_count"):
                recurrence["count"] = int(task.parameters["recurrence_count"])
            if task.parameters.get("recurrence_until"):
                recurrence["until"] = task.parameters["recurrence_until"]
            if task.parameters.get("recurrence_days"):
                recurrence["by_day"] = task.parameters["recurrence_days"].split(",")
            if task.parameters.get("recurrence_interval"):
                recurrence["interval"] = int(task.parameters["recurrence_interval"])

        # Build reminders
        reminders = None
        reminder_minutes = task.parameters.get("reminder_minutes")
        reminder_method = task.parameters.get("reminder_method", "popup")
        if reminder_minutes:
            reminders = [{"method": reminder_method, "minutes": int(reminder_minutes)}]

        # Get additional options
        description = task.parameters.get("description")
        all_day = task.parameters.get("all_day", False)

        try:
            event = await self._calendar_service.schedule_content(
                content=content,
                start_time=scheduled_datetime,
                end_time=end_time,
                recurrence=recurrence,
                reminders=reminders,
                description=description
            )

            # Notify frontend to refresh calendar
            await broadcast_calendar_update("created")

            event_link = event.get("htmlLink", "")
            recurrence_text = ""
            if recurrence:
                freq_he = {
                    "DAILY": "יומי",
                    "WEEKLY": "שבועי",
                    "MONTHLY": "חודשי",
                    "YEARLY": "שנתי"
                }
                recurrence_text = f" (חזרה: {freq_he.get(recurrence['frequency'], recurrence['frequency'])})"

            return {
                "success": True,
                "message": f"📅 '{content['title']}' נוסף ליומן ב-{scheduled_datetime.strftime('%d/%m/%Y %H:%M')}{recurrence_text}",
                "message_en": f"'{content['title']}' scheduled for {scheduled_datetime.strftime('%Y-%m-%d %H:%M')}{' (recurring)' if recurrence else ''}",
                "event": event,
                "event_link": event_link
            }

        except Exception as e:
            logger.error(f"Calendar scheduling error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בתזמון: {str(e)}",
                "message_en": f"Scheduling error: {str(e)}"
            }

    async def _execute_list_calendar_events(self, task: ParsedTask) -> Dict[str, Any]:
        """List upcoming calendar events."""
        if not self._calendar_service:
            return {
                "success": False,
                "message": "❌ שירות יומן Google לא מוגדר",
                "message_en": "Google Calendar service not configured"
            }

        days_ahead = int(task.parameters.get("days", 7))
        content_type = task.parameters.get("content_type")

        time_max = datetime.now() + timedelta(days=days_ahead)

        try:
            events = await self._calendar_service.list_radio_events(
                time_min=datetime.now(),
                time_max=time_max
            )

            if content_type:
                events = [
                    e for e in events
                    if e.get("extendedProperties", {}).get("private", {}).get("radio_content_type") == content_type
                ]

            if not events:
                return {
                    "success": True,
                    "message": f"📅 אין אירועים מתוזמנים ב-{days_ahead} הימים הקרובים",
                    "message_en": f"No events scheduled in the next {days_ahead} days",
                    "events": []
                }

            event_list = []
            for event in events[:10]:  # Limit to 10
                start = event.get("start", {})
                start_time = start.get("dateTime", start.get("date", ""))
                if "T" in start_time:
                    dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    time_str = dt.strftime("%d/%m %H:%M")
                else:
                    time_str = start_time

                event_list.append(f"• {time_str}: {event.get('summary', 'Untitled')}")

            return {
                "success": True,
                "message": f"📅 אירועים מתוזמנים:\n" + "\n".join(event_list),
                "message_en": f"Scheduled events:\n" + "\n".join(event_list),
                "events": events
            }

        except Exception as e:
            logger.error(f"Calendar list error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בטעינת יומן: {str(e)}",
                "message_en": f"Calendar error: {str(e)}"
            }

    async def _execute_update_calendar_event(self, task: ParsedTask) -> Dict[str, Any]:
        """Update a calendar event."""
        if not self._calendar_service:
            return {
                "success": False,
                "message": "❌ שירות יומן Google לא מוגדר",
                "message_en": "Google Calendar service not configured"
            }

        event_id = task.parameters.get("event_id")
        if not event_id:
            return {
                "success": False,
                "message": "❌ לא צוין מזהה אירוע לעדכון",
                "message_en": "No event ID specified for update"
            }

        try:
            update_params = {}

            if task.parameters.get("title"):
                update_params["summary"] = task.parameters["title"]
            if task.parameters.get("description"):
                update_params["description"] = task.parameters["description"]
            if task.parameters.get("time"):
                new_time = self._parse_datetime(
                    task.parameters.get("date"),
                    task.parameters["time"]
                )
                if new_time:
                    update_params["start_time"] = new_time
            if task.parameters.get("end_time"):
                end_time = self._parse_datetime(
                    task.parameters.get("date"),
                    task.parameters["end_time"]
                )
                if end_time:
                    update_params["end_time"] = end_time

            event = await self._calendar_service.update_event(event_id, **update_params)

            # Notify frontend to refresh calendar
            await broadcast_calendar_update("updated")

            return {
                "success": True,
                "message": f"✅ האירוע עודכן בהצלחה",
                "message_en": "Event updated successfully",
                "event": event
            }

        except Exception as e:
            logger.error(f"Calendar update error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בעדכון: {str(e)}",
                "message_en": f"Update error: {str(e)}"
            }

    async def _execute_delete_calendar_event(self, task: ParsedTask) -> Dict[str, Any]:
        """Delete a calendar event."""
        if not self._calendar_service:
            return {
                "success": False,
                "message": "❌ שירות יומן Google לא מוגדר",
                "message_en": "Google Calendar service not configured"
            }

        event_id = task.parameters.get("event_id")
        if not event_id:
            return {
                "success": False,
                "message": "❌ לא צוין מזהה אירוע למחיקה",
                "message_en": "No event ID specified for deletion"
            }

        try:
            success = await self._calendar_service.delete_event(event_id)

            if success:
                # Notify frontend to refresh calendar
                await broadcast_calendar_update("deleted")

                return {
                    "success": True,
                    "message": "✅ האירוע נמחק מהיומן",
                    "message_en": "Event deleted from calendar"
                }
            else:
                return {
                    "success": False,
                    "message": "❌ לא הצלחתי למחוק את האירוע",
                    "message_en": "Failed to delete event"
                }

        except Exception as e:
            logger.error(f"Calendar delete error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה במחיקה: {str(e)}",
                "message_en": f"Delete error: {str(e)}"
            }

    async def _execute_get_day_schedule(self, task: ParsedTask) -> Dict[str, Any]:
        """Get the schedule for a specific day."""
        if not self._calendar_service:
            return {
                "success": False,
                "message": "❌ שירות יומן Google לא מוגדר",
                "message_en": "Google Calendar service not configured"
            }

        date_str = task.parameters.get("date")

        # Parse date
        if date_str:
            target_date = self._parse_date(date_str)
        else:
            target_date = datetime.now()

        if not target_date:
            target_date = datetime.now()

        try:
            events = await self._calendar_service.get_schedule_for_day(target_date)

            if not events:
                date_formatted = target_date.strftime("%d/%m/%Y")
                return {
                    "success": True,
                    "message": f"📅 אין תוכניות מתוזמנות ליום {date_formatted}",
                    "message_en": f"No content scheduled for {date_formatted}",
                    "events": []
                }

            event_list = []
            for event in events:
                start = event.get("start", {})
                start_time = start.get("dateTime", "")
                if start_time and "T" in start_time:
                    dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
                    time_str = dt.strftime("%H:%M")
                else:
                    time_str = "כל היום"

                event_list.append(f"• {time_str}: {event.get('summary', 'Untitled')}")

            date_formatted = target_date.strftime("%d/%m/%Y")
            return {
                "success": True,
                "message": f"📅 לוח זמנים ליום {date_formatted}:\n" + "\n".join(event_list),
                "message_en": f"Schedule for {date_formatted}:\n" + "\n".join(event_list),
                "events": events
            }

        except Exception as e:
            logger.error(f"Calendar day schedule error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בטעינת לוח זמנים: {str(e)}",
                "message_en": f"Schedule error: {str(e)}"
            }

    def _parse_datetime(self, date_str: Optional[str], time_str: Optional[str]) -> Optional[datetime]:
        """Parse date and time strings into a datetime object."""
        now = datetime.now()

        # Parse date
        if not date_str or date_str.lower() in ["היום", "today"]:
            target_date = now.date()
        elif date_str.lower() in ["מחר", "tomorrow"]:
            target_date = (now + timedelta(days=1)).date()
        elif date_str.lower() in ["מחרתיים", "day after tomorrow"]:
            target_date = (now + timedelta(days=2)).date()
        else:
            # Try to parse as date
            for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"]:
                try:
                    target_date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                target_date = now.date()

        # Parse time
        if not time_str:
            target_time = now.time()
        else:
            # Try HH:MM format
            for fmt in ["%H:%M", "%H:%M:%S", "%I:%M %p"]:
                try:
                    target_time = datetime.strptime(time_str, fmt).time()
                    break
                except ValueError:
                    continue
            else:
                target_time = now.time()

        return datetime.combine(target_date, target_time)

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse a date string into a datetime object."""
        now = datetime.now()

        if date_str.lower() in ["היום", "today"]:
            return now
        elif date_str.lower() in ["מחר", "tomorrow"]:
            return now + timedelta(days=1)
        elif date_str.lower() in ["מחרתיים", "day after tomorrow"]:
            return now + timedelta(days=2)

        # Try various date formats
        for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"]:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        return None

    # Flow execution methods

    async def _execute_create_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Create a new auto flow from natural language description using Claude AI."""
        description = task.parameters.get("description", task.original_text)

        # Use Claude AI to parse the flow description (same mechanism as /parse-natural endpoint)
        import anthropic
        import json
        from app.config import settings

        actions = []
        schedule = None

        if not settings.anthropic_api_key:
            logger.warning("ANTHROPIC_API_KEY not set, falling back to regex parsing")
            # Fallback to basic regex parsing
            import re
            parts = re.split(r',\s*then\s*|,\s*אז\s*|,\s*ואז\s*', description, flags=re.IGNORECASE)
            genre_map = {
                "חסידי": "hasidi", "חסידית": "hasidi",
                "מזרחי": "mizrahi", "מזרחית": "mizrahi",
                "פופ": "pop", "רוק": "rock",
                "ים תיכוני": "mediterranean", "קלאסי": "classic", "עברי": "hebrew",
            }
            for part in parts:
                part = part.strip().lower()
                genre_match = re.search(r'(?:play|נגן|השמע)\s+(\w+)\s+(?:music|מוזיקה)?', part)
                if genre_match:
                    genre = genre_match.group(1)
                    genre = genre_map.get(genre, genre)
                    duration_match = re.search(r'(?:for|במשך)\s+(\d+)\s*(?:minutes?|min|דקות?)', part)
                    duration = int(duration_match.group(1)) if duration_match else 30
                    actions.append({
                        "action_type": "play_genre",
                        "genre": genre,
                        "duration_minutes": duration,
                        "description": f"Play {genre} music for {duration} minutes"
                    })
                    continue
                commercial_match = re.search(r'(?:play|נגן|השמע)\s+(\d+)\s+(?:commercials?|פרסומות?)', part)
                if commercial_match:
                    count = int(commercial_match.group(1))
                    actions.append({
                        "action_type": "play_commercials",
                        "commercial_count": count,
                        "description": f"Play {count} commercial(s)"
                    })
        else:
            # Use Claude AI for parsing
            try:
                client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

                prompt = f"""Parse this radio flow description into structured actions. Return ONLY a JSON array of actions, no explanations.

Available action types:
- play_genre: Play music from a genre (hasidi, mizrahi, happy, israeli, pop, rock, mediterranean, classic, hebrew, all, mixed)
  * song_count: Exact number of songs to play (e.g., "play 1 song" -> song_count: 1, "play 5 songs" -> song_count: 5)
  * duration_minutes: Alternative to song_count - play songs for this duration (system calculates ~4 min/song)
  * If neither specified, defaults to 10 songs
- play_commercials: Play commercials. Support:
  * commercial_count: How many times to REPEAT the commercial set (default 1, max 10)
  * batch_number: (1, 2, 3, etc.) - refers to predefined commercial batches
  * To play ALL commercials once: set commercial_count to 1 or omit it (system fetches all active commercials)
  * If "Batch-1", "Batch-2" etc mentioned, set batch_number field
  * If "Play All Commercials" or "all commercial batches": generate MULTIPLE play_commercials actions, one for each batch (batch_number: 1, then batch_number: 2, then batch_number: 3)
- wait: Wait for a duration
- set_volume: Set volume level

Description: {description}

PARSING RULES:
1. If description mentions ALTERNATING patterns (e.g., "every 30 minutes", "on the hour do X, on the half-hour do Y"), create a sequence that can loop
2. For time-based patterns, create actions in the order they would execute in one cycle
3. Each commercial batch mention should be a SEPARATE action
4. IMPORTANT: After EVERY commercial action, add a music action to continue playing
5. If the last action is commercials, ALWAYS add a final music action so the loop is complete
6. If "repeat" or "loop" is mentioned, the flow should loop - still create the action sequence for one cycle

Examples:

Input: "Play 1 song, then all commercials, then continue playing music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "commercial_count": 1, "description": "Play all commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Input: "Play 3 happy songs, then 2 commercials, then mizrahi for 20 minutes"
Output:
[
  {{"action_type": "play_genre", "genre": "happy", "song_count": 3, "description": "Play 3 happy songs"}},
  {{"action_type": "play_commercials", "commercial_count": 2, "description": "Play 2 commercials"}},
  {{"action_type": "play_genre", "genre": "mizrahi", "duration_minutes": 20, "description": "Play mizrahi for 20 minutes"}}
]

Input: "Play music, every 30 min check time: on the hour play Batch-1 commercials, on half-hour play Batch-2 commercials, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Play music"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials (on the hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials (on half-hour)"}},
  {{"action_type": "play_genre", "genre": "mixed", "duration_minutes": 30, "description": "Continue playing music"}}
]

Input: "Play 1 song, then play all commercial batches, then continue music"
Output:
[
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 1, "description": "Play 1 song"}},
  {{"action_type": "play_commercials", "batch_number": 1, "description": "Play Batch-1 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 2, "description": "Play Batch-2 commercials"}},
  {{"action_type": "play_commercials", "batch_number": 3, "description": "Play Batch-3 commercials"}},
  {{"action_type": "play_genre", "genre": "mixed", "song_count": 10, "description": "Continue playing music"}}
]

Now parse this description: {description}

Return the JSON array:"""

                response = client.messages.create(
                    model="claude-3-haiku-20240307",
                    max_tokens=1024,
                    messages=[{"role": "user", "content": prompt}]
                )

                # Extract JSON from response
                response_text = response.content[0].text.strip()

                # Remove markdown code blocks if present
                if response_text.startswith("```"):
                    lines = response_text.split("\n")
                    response_text = "\n".join(lines[1:-1])
                if response_text.startswith("json"):
                    response_text = response_text[4:].strip()

                actions = json.loads(response_text)
                logger.info(f"Claude parsed {len(actions)} actions from: {description}")

            except Exception as e:
                logger.error(f"Failed to parse with Claude: {e}")
                # actions will remain empty, and we'll return an error below

        if not actions:
            return {
                "success": False,
                "message": "❌ לא הצלחתי להבין את הזרימה. נסה לתאר בפורמט: 'נגן מוזיקה חסידית, אז נגן 2 פרסומות, אז נגן מזרחית'",
                "message_en": "Couldn't parse flow. Try: 'play hasidi music, then play 2 commercials, then play mizrahi'"
            }

        # Extract schedule from text
        import re
        time_match = re.search(
            r'(?:between|from|at|בין|מ-?|ב-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|בבוקר)?(?:\s*(?:-|to|עד)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|בבוקר|בערב)?)?',
            description, re.IGNORECASE
        )
        if time_match:
            start_hour = int(time_match.group(1))
            start_min = int(time_match.group(2) or 0)
            schedule = {
                "recurrence": "weekly",
                "start_time": f"{start_hour:02d}:{start_min:02d}",
                "days_of_week": task.parameters.get("schedule_days", [0, 1, 2, 3, 4, 5, 6])
            }
            if time_match.group(3):
                end_hour = int(time_match.group(3))
                end_min = int(time_match.group(4) or 0)
                schedule["end_time"] = f"{end_hour:02d}:{end_min:02d}"

        # Check for loop keyword
        loop = task.parameters.get("loop", False)
        if not loop and re.search(r'\b(loop|repeat|חזור|לולאה)\b', description, re.IGNORECASE):
            loop = True

        # Create the flow
        flow_name = task.parameters.get("name", f"Flow from chat {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        flow_doc = {
            "name": flow_name,
            "name_he": flow_name,
            "description": description,
            "actions": actions,
            "trigger_type": "scheduled" if schedule else "manual",
            "schedule": schedule,
            "status": "active",
            "priority": 0,
            "loop": loop,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_run": None,
            "run_count": 0
        }

        result = await self.db.flows.insert_one(flow_doc)
        flow_doc["_id"] = str(result.inserted_id)

        actions_summary = ", ".join([a.get("description") or a.get("action_type") or "action" for a in actions])

        return {
            "success": True,
            "message": f"✅ נוצרה זרימה חדשה: {flow_name}\nפעולות: {actions_summary}",
            "message_en": f"Created new flow: {flow_name}\nActions: {actions_summary}",
            "flow": flow_doc
        }

    async def _execute_list_flows(self, task: ParsedTask) -> Dict[str, Any]:
        """List all auto flows."""
        status_filter = task.parameters.get("status")

        query = {}
        if status_filter:
            query["status"] = status_filter

        flows = await self.db.flows.find(query).sort("priority", -1).to_list(20)

        if not flows:
            return {
                "success": True,
                "message": "📋 אין זרימות מוגדרות",
                "message_en": "No flows defined",
                "flows": []
            }

        flow_list = []
        for flow in flows:
            status_emoji = {"active": "✅", "paused": "⏸️", "disabled": "❌", "running": "▶️"}.get(flow.get("status", ""), "❓")
            actions_count = len(flow.get("actions", []))
            flow_list.append(f"{status_emoji} {flow.get('name', 'Unnamed')} ({actions_count} פעולות)")

        return {
            "success": True,
            "message": f"📋 זרימות ({len(flows)}):\n" + "\n".join(flow_list),
            "message_en": f"Flows ({len(flows)}):\n" + "\n".join(flow_list),
            "flows": [{**f, "_id": str(f["_id"])} for f in flows]
        }

    async def _execute_run_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Run/execute a flow."""
        flow_name = self._to_regex_string(task.parameters.get("name"))
        flow_id = task.parameters.get("flow_id")

        # Find the flow
        if flow_id:
            try:
                flow = await self.db.flows.find_one({"_id": ObjectId(flow_id)})
            except:
                flow = None
        elif flow_name:
            flow = await self.db.flows.find_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })
        else:
            return {
                "success": False,
                "message": "❌ לא ציינת שם זרימה להרצה",
                "message_en": "No flow name specified"
            }

        if not flow:
            return {
                "success": False,
                "message": f"❌ לא מצאתי זרימה בשם '{flow_name or flow_id}'",
                "message_en": f"Flow '{flow_name or flow_id}' not found"
            }

        # Execute the flow actions
        actions = flow.get("actions", [])
        if not actions:
            return {
                "success": False,
                "message": "❌ הזרימה ריקה - אין פעולות להרצה",
                "message_en": "Flow is empty - no actions to execute"
            }

        # Log execution start
        execution_log = {
            "flow_id": str(flow["_id"]),
            "flow_name": flow.get("name"),
            "started_at": datetime.utcnow(),
            "status": "running",
            "actions_completed": 0,
            "total_actions": len(actions),
            "triggered_by": "chat"
        }
        log_result = await self.db.flow_executions.insert_one(execution_log)

        # Update flow status
        await self.db.flows.update_one(
            {"_id": flow["_id"]},
            {"$set": {"status": "running"}, "$inc": {"run_count": 1}}
        )

        # Execute actions
        actions_completed = 0
        for action in actions:
            action_type = action.get("action_type")

            if action_type == "play_genre" and self._audio_player:
                genre = action.get("genre")
                songs = await self.db.content.find({
                    "type": "song", "genre": genre, "active": True
                }).limit(5).to_list(5)

                for song in songs:
                    from app.services.audio_player import TrackInfo
                    track = TrackInfo(
                        content_id=str(song["_id"]),
                        title=song.get("title", "Unknown"),
                        artist=song.get("artist"),
                        duration_seconds=song.get("duration_seconds", 0),
                        file_path=song.get("local_cache_path", "")
                    )
                    self._audio_player.add_to_queue(track)

            elif action_type == "play_commercials" and self._audio_player:
                count = action.get("commercial_count", 1)
                commercials = await self.db.content.find({
                    "type": "commercial", "active": True
                }).limit(count).to_list(count)

                for commercial in commercials:
                    from app.services.audio_player import TrackInfo
                    track = TrackInfo(
                        content_id=str(commercial["_id"]),
                        title=commercial.get("title", "Commercial"),
                        artist=None,
                        duration_seconds=commercial.get("duration_seconds", 0),
                        file_path=commercial.get("local_cache_path", "")
                    )
                    self._audio_player.add_to_queue(track)  # Same priority as songs to preserve order

            actions_completed += 1

        # Mark completed
        await self.db.flow_executions.update_one(
            {"_id": log_result.inserted_id},
            {"$set": {"status": "completed", "ended_at": datetime.utcnow(), "actions_completed": actions_completed}}
        )

        await self.db.flows.update_one(
            {"_id": flow["_id"]},
            {"$set": {"status": "active", "last_run": datetime.utcnow()}}
        )

        return {
            "success": True,
            "message": f"▶️ הזרימה '{flow['name']}' הופעלה ({actions_completed} פעולות)",
            "message_en": f"Flow '{flow['name']}' executed ({actions_completed} actions)",
            "execution_id": str(log_result.inserted_id)
        }

    async def _execute_update_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Update a flow."""
        flow_name = self._to_regex_string(task.parameters.get("name"))
        flow_id = task.parameters.get("flow_id")

        if not flow_name and not flow_id:
            return {
                "success": False,
                "message": "❌ לא ציינת שם זרימה לעדכון",
                "message_en": "No flow name specified"
            }

        # Find flow
        if flow_id:
            flow = await self.db.flows.find_one({"_id": ObjectId(flow_id)})
        elif flow_name:
            flow = await self.db.flows.find_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })
        else:
            flow = None

        if not flow:
            return {
                "success": False,
                "message": f"❌ לא מצאתי זרימה בשם '{flow_name}'",
                "message_en": f"Flow '{flow_name}' not found"
            }

        # Build update
        update_doc = {"updated_at": datetime.utcnow()}

        if task.parameters.get("new_name"):
            update_doc["name"] = task.parameters["new_name"]
        if task.parameters.get("description"):
            update_doc["description"] = task.parameters["description"]
        if task.parameters.get("priority") is not None:
            update_doc["priority"] = int(task.parameters["priority"])

        await self.db.flows.update_one({"_id": flow["_id"]}, {"$set": update_doc})

        return {
            "success": True,
            "message": f"✅ הזרימה '{flow['name']}' עודכנה",
            "message_en": f"Flow '{flow['name']}' updated"
        }

    async def _execute_delete_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Delete a flow."""
        flow_name = self._to_regex_string(task.parameters.get("name"))
        flow_id = task.parameters.get("flow_id")

        if not flow_name and not flow_id:
            return {
                "success": False,
                "message": "❌ לא ציינת שם זרימה למחיקה",
                "message_en": "No flow name specified"
            }

        # Find flow
        if flow_id:
            result = await self.db.flows.delete_one({"_id": ObjectId(flow_id)})
        elif flow_name:
            result = await self.db.flows.delete_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })
        else:
            result = None

        if result and result.deleted_count > 0:
            return {
                "success": True,
                "message": f"🗑️ הזרימה נמחקה",
                "message_en": "Flow deleted"
            }

        return {
            "success": False,
            "message": f"❌ לא מצאתי זרימה למחיקה",
            "message_en": "Flow not found"
        }

    async def _execute_toggle_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Toggle flow status (enable/disable)."""
        flow_name = self._to_regex_string(task.parameters.get("name"))
        flow_id = task.parameters.get("flow_id")

        # Find flow
        if flow_id:
            flow = await self.db.flows.find_one({"_id": ObjectId(flow_id)})
        elif flow_name:
            flow = await self.db.flows.find_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })
        else:
            return {
                "success": False,
                "message": "❌ לא ציינת שם זרימה",
                "message_en": "No flow name specified"
            }

        if not flow:
            return {
                "success": False,
                "message": f"❌ לא מצאתי זרימה",
                "message_en": "Flow not found"
            }

        current_status = flow.get("status", "active")
        new_status = "paused" if current_status == "active" else "active"

        await self.db.flows.update_one(
            {"_id": flow["_id"]},
            {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
        )

        status_he = "מופעלת" if new_status == "active" else "מושהית"
        return {
            "success": True,
            "message": f"✅ הזרימה '{flow['name']}' כעת {status_he}",
            "message_en": f"Flow '{flow['name']}' is now {new_status}",
            "new_status": new_status
        }

    async def _execute_update_metadata(self, task: ParsedTask) -> Dict[str, Any]:
        """
        Update content metadata (title, artist, genre).

        Parameters:
            - title: Current title to search for (or song_id)
            - new_title: New title to set
            - new_artist: New artist to set
            - new_genre: New genre to set
            - song_id: Direct content ID to update
        """
        # Get search parameters
        search_title = self._to_regex_string(task.parameters.get("title"))
        search_artist = self._to_regex_string(task.parameters.get("artist"))
        song_id = task.parameters.get("song_id") or task.parameters.get("content_id")

        # Get update values
        new_title = task.parameters.get("new_title")
        new_artist = task.parameters.get("new_artist")
        new_genre = task.parameters.get("new_genre")

        # Validate we have something to search for
        if not search_title and not song_id:
            return {
                "success": False,
                "message": "❌ לא ציינת איזה שיר לעדכן. ציין את שם השיר הנוכחי.",
                "message_en": "Please specify which song to update by its current title."
            }

        # Validate we have something to update
        if not new_title and not new_artist and not new_genre:
            return {
                "success": False,
                "message": "❌ לא ציינת מה לעדכן. ציין שם חדש, אמן חדש, או ז'אנר חדש.",
                "message_en": "Please specify what to update: new title, artist, or genre."
            }

        # Find the content
        content = None
        if song_id:
            try:
                content = await self.db.content.find_one({"_id": ObjectId(song_id)})
            except:
                pass

        if not content and search_title:
            # Build search query
            query: Dict[str, Any] = {"active": True}

            # Search by title
            query["$or"] = [
                {"title": {"$regex": search_title, "$options": "i"}},
                {"title_he": {"$regex": search_title, "$options": "i"}}
            ]

            # Optionally filter by artist too
            if search_artist:
                query["artist"] = {"$regex": search_artist, "$options": "i"}

            content = await self.db.content.find_one(query)

        if not content:
            # Try to find similar songs to suggest
            suggestions = await self.db.content.find({
                "active": True,
                "$or": [
                    {"title": {"$regex": search_title or "", "$options": "i"}},
                    {"artist": {"$regex": search_title or "", "$options": "i"}}
                ]
            }).limit(5).to_list(5)

            if suggestions:
                suggestion_list = ", ".join([f"'{s.get('title')}'" for s in suggestions[:3]])
                return {
                    "success": False,
                    "message": f"❌ לא מצאתי שיר בשם '{search_title}'. אולי התכוונת ל: {suggestion_list}?",
                    "message_en": f"Couldn't find '{search_title}'. Did you mean: {suggestion_list}?",
                    "suggestions": suggestions
                }

            return {
                "success": False,
                "message": f"❌ לא מצאתי שיר בשם '{search_title}'",
                "message_en": f"Couldn't find song named '{search_title}'"
            }

        # Build update document
        update_doc = {"updated_at": datetime.utcnow()}
        changes = []

        if new_title:
            update_doc["title"] = new_title
            changes.append(f"כותרת: '{new_title}'")

        if new_artist:
            update_doc["artist"] = new_artist
            changes.append(f"אמן: '{new_artist}'")

        if new_genre:
            update_doc["genre"] = new_genre
            changes.append(f"ז'אנר: '{new_genre}'")

        # Perform the update
        result = await self.db.content.update_one(
            {"_id": content["_id"]},
            {"$set": update_doc}
        )

        if result.modified_count > 0:
            changes_str = ", ".join(changes)
            old_title = content.get("title", "Unknown")

            return {
                "success": True,
                "message": f"✅ עודכן '{old_title}': {changes_str}",
                "message_en": f"Updated '{old_title}': {', '.join([f'title: {new_title}' if new_title else '', f'artist: {new_artist}' if new_artist else '', f'genre: {new_genre}' if new_genre else '']).strip(', ')}",
                "content_id": str(content["_id"]),
                "updated_fields": {
                    "title": new_title,
                    "artist": new_artist,
                    "genre": new_genre
                }
            }

        return {
            "success": False,
            "message": "❌ לא הצלחתי לעדכן את השיר",
            "message_en": "Failed to update the song"
        }

    # Queue management methods

    async def _execute_show_queue(self, task: ParsedTask) -> Dict[str, Any]:
        """Show current playback queue."""
        from app.routers.playback import get_queue_async

        queue = await get_queue_async(self.db)

        if not queue:
            return {
                "success": True,
                "message": "📋 התור ריק כרגע",
                "message_en": "Queue is currently empty",
                "queue": []
            }

        # Format queue items
        queue_lines = []
        for i, item in enumerate(queue[:10], 1):
            title = item.get("title", "Unknown")
            artist = item.get("artist", "")
            if artist:
                queue_lines.append(f"{i}. {title} - {artist}")
            else:
                queue_lines.append(f"{i}. {title}")

        queue_display = "\n".join(queue_lines)
        remaining = len(queue) - 10 if len(queue) > 10 else 0

        if remaining > 0:
            queue_display += f"\n...ועוד {remaining} פריטים"

        return {
            "success": True,
            "message": f"📋 התור הנוכחי ({len(queue)} פריטים):\n{queue_display}",
            "message_en": f"Current queue ({len(queue)} items):\n{queue_display}",
            "queue": queue,
            "total_count": len(queue)
        }

    async def _execute_clear_queue(self, task: ParsedTask) -> Dict[str, Any]:
        """Clear the playback queue."""
        from app.routers.playback import clear_queue_async, get_queue_async
        from app.routers.websocket import broadcast_queue_update

        previous_queue = await get_queue_async(self.db)
        previous_count = len(previous_queue)
        await clear_queue_async(self.db)

        # Broadcast queue update
        await broadcast_queue_update([])

        return {
            "success": True,
            "message": f"🗑️ התור נוקה ({previous_count} פריטים הוסרו)",
            "message_en": f"Queue cleared ({previous_count} items removed)",
            "cleared_count": previous_count
        }

    async def _execute_remove_from_queue(self, task: ParsedTask) -> Dict[str, Any]:
        """Remove an item from the queue."""
        from app.routers.playback import get_queue_async, remove_from_queue_async
        from app.routers.websocket import broadcast_queue_update

        title = self._to_regex_string(task.parameters.get("title"))
        position = task.parameters.get("position")

        if not title and position is None:
            return {
                "success": False,
                "message": "❌ ציין את שם השיר או מספר המיקום להסרה",
                "message_en": "Specify song title or position number to remove"
            }

        queue = await get_queue_async(self.db)

        if not queue:
            return {
                "success": False,
                "message": "❌ התור ריק",
                "message_en": "Queue is empty"
            }

        removed_item = None
        remove_index = None

        # Remove by position
        if position is not None:
            pos = int(position) - 1  # Convert to 0-indexed
            if 0 <= pos < len(queue):
                removed_item = queue[pos]
                remove_index = pos

        # Remove by title
        elif title:
            for i, item in enumerate(queue):
                if title.lower() in item.get("title", "").lower():
                    removed_item = item
                    remove_index = i
                    break

        if removed_item and remove_index is not None:
            await remove_from_queue_async(self.db, remove_index)
            # Broadcast queue update
            updated_queue = await get_queue_async(self.db)
            await broadcast_queue_update(updated_queue)

            return {
                "success": True,
                "message": f"✅ '{removed_item.get('title', 'Unknown')}' הוסר מהתור",
                "message_en": f"'{removed_item.get('title', 'Unknown')}' removed from queue",
                "removed_item": removed_item
            }

        return {
            "success": False,
            "message": f"❌ לא מצאתי '{title or position}' בתור",
            "message_en": f"Couldn't find '{title or position}' in queue"
        }

    # Statistics methods

    async def _execute_get_statistics(self, task: ParsedTask) -> Dict[str, Any]:
        """Get library and playback statistics."""
        # Get content counts by type
        song_count = await self.db.content.count_documents({"type": "song", "active": True})
        show_count = await self.db.content.count_documents({"type": "show", "active": True})
        commercial_count = await self.db.content.count_documents({"type": "commercial", "active": True})
        jingle_count = await self.db.content.count_documents({"type": "jingle", "active": True})

        # Get total playback count (last 24 hours)
        from datetime import timedelta
        yesterday = datetime.utcnow() - timedelta(days=1)
        plays_24h = await self.db.playback_logs.count_documents({"started_at": {"$gte": yesterday}})

        # Get plays this week
        week_ago = datetime.utcnow() - timedelta(days=7)
        plays_week = await self.db.playback_logs.count_documents({"started_at": {"$gte": week_ago}})

        # Get unique artists count
        artists_pipeline = [
            {"$match": {"active": True, "type": "song", "artist": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$artist"}},
            {"$count": "total"}
        ]
        artist_result = await self.db.content.aggregate(artists_pipeline).to_list(1)
        artist_count = artist_result[0]["total"] if artist_result else 0

        # Get genres count
        genres_pipeline = [
            {"$match": {"active": True, "type": "song", "genre": {"$exists": True, "$ne": ""}}},
            {"$group": {"_id": "$genre"}},
            {"$count": "total"}
        ]
        genre_result = await self.db.content.aggregate(genres_pipeline).to_list(1)
        genre_count = genre_result[0]["total"] if genre_result else 0

        # Get flows count
        flow_count = await self.db.flows.count_documents({})
        active_flows = await self.db.flows.count_documents({"status": "active"})

        stats_he = f"""📊 סטטיסטיקות הספרייה:

🎵 שירים: {song_count}
📻 תוכניות: {show_count}
📢 פרסומות: {commercial_count}
🎶 ג'ינגלים: {jingle_count}

🎤 אמנים: {artist_count}
🎭 ז'אנרים: {genre_count}

▶️ נוגנו ב-24 שעות: {plays_24h}
📅 נוגנו השבוע: {plays_week}

🔄 זרימות: {flow_count} ({active_flows} פעילות)"""

        return {
            "success": True,
            "message": stats_he,
            "message_en": f"Library: {song_count} songs, {show_count} shows, {commercial_count} commercials. {artist_count} artists, {genre_count} genres. {plays_24h} plays in 24h, {plays_week} this week. {flow_count} flows ({active_flows} active).",
            "statistics": {
                "songs": song_count,
                "shows": show_count,
                "commercials": commercial_count,
                "jingles": jingle_count,
                "artists": artist_count,
                "genres": genre_count,
                "plays_24h": plays_24h,
                "plays_week": plays_week,
                "flows": flow_count,
                "active_flows": active_flows
            }
        }

    async def _execute_get_most_played(self, task: ParsedTask) -> Dict[str, Any]:
        """Get most played songs."""
        limit = int(task.parameters.get("limit", 10))
        period = task.parameters.get("period", "week")

        # Determine time range
        if period == "day":
            since = datetime.utcnow() - timedelta(days=1)
            period_he = "היום"
        elif period == "month":
            since = datetime.utcnow() - timedelta(days=30)
            period_he = "החודש"
        else:  # week
            since = datetime.utcnow() - timedelta(days=7)
            period_he = "השבוע"

        # Aggregate most played
        pipeline = [
            {"$match": {"started_at": {"$gte": since}}},
            {"$group": {"_id": "$content_id", "play_count": {"$sum": 1}}},
            {"$sort": {"play_count": -1}},
            {"$limit": limit}
        ]

        top_played = await self.db.playback_logs.aggregate(pipeline).to_list(limit)

        if not top_played:
            return {
                "success": True,
                "message": f"📊 אין נתוני נגינה עבור {period_he}",
                "message_en": f"No playback data for this {period}",
                "top_played": []
            }

        # Get content details
        content_ids = [item["_id"] for item in top_played]
        contents = await self.db.content.find({"_id": {"$in": content_ids}}).to_list(limit)
        content_map = {str(c["_id"]): c for c in contents}

        # Format results
        result_lines = []
        for i, item in enumerate(top_played, 1):
            content_id = str(item["_id"])
            content = content_map.get(content_id, {})
            title = content.get("title", "Unknown")
            artist = content.get("artist", "")
            plays = item["play_count"]

            if artist:
                result_lines.append(f"{i}. {title} - {artist} ({plays} פעמים)")
            else:
                result_lines.append(f"{i}. {title} ({plays} פעמים)")

        result_display = "\n".join(result_lines)

        return {
            "success": True,
            "message": f"🏆 הכי מנוגנים {period_he}:\n{result_display}",
            "message_en": f"Most played this {period}",
            "top_played": top_played
        }

    # Help method

    async def _execute_get_help(self, task: ParsedTask) -> Dict[str, Any]:
        """Get help and available commands."""
        topic = task.parameters.get("topic", "general")

        help_text_he = """🤖 עזרה - פקודות זמינות:

🎵 **ניגון:**
• "תנגן [שם שיר]" - נגן שיר
• "נגן שיר של [אמן]" - נגן שיר של אמן
• "דלג" - דלג לשיר הבא
• "השהה/המשך" - עצור או המשך
• "עבור לז'אנר [שם]" - החלף ז'אנר

📋 **תור:**
• "מה בתור?" - הצג את התור
• "הוסף [שיר] לתור" - הוסף לתור
• "נקה תור" - רוקן את התור
• "הסר [שיר] מתור" - הסר פריט

📅 **תזמון:**
• "תזמן [שיר] לשעה [זמן]" - תזמן שיר
• "מה מתוזמן היום?" - הצג לוח זמנים
• "הוסף ליומן" - הוסף לגוגל קלנדר

🔄 **זרימות:**
• "צור זרימה: [תיאור]" - צור זרימה חדשה
• "הצג זרימות" - רשימת זרימות
• "הפעל זרימה [שם]" - הרץ זרימה

📊 **סטטיסטיקות:**
• "סטטיסטיקות" - נתוני ספרייה
• "הכי מנוגנים" - שירים פופולריים

🔧 **ניהול:**
• "סנכרן דרייב" - סנכרן מגוגל דרייב
• "עדכן [שיר]" - ערוך מטאדאטא

💡 **טיפ:** הקלד @ לרשימת פעולות מהירות!"""

        help_text_en = """🤖 Help - Available Commands:

🎵 **Playback:**
• "Play [song name]" - Play a song
• "Play a song by [artist]" - Play by artist
• "Skip" - Skip to next
• "Pause/Resume" - Control playback
• "Switch to [genre]" - Change genre

📋 **Queue:**
• "Show queue" - View queue
• "Add [song] to queue" - Add to queue
• "Clear queue" - Empty queue
• "Remove [song] from queue" - Remove item

📅 **Scheduling:**
• "Schedule [song] for [time]" - Schedule
• "What's scheduled today?" - View schedule
• "Add to calendar" - Google Calendar

🔄 **Flows:**
• "Create flow: [description]" - New flow
• "List flows" - Show all flows
• "Run flow [name]" - Execute flow

📊 **Statistics:**
• "Statistics" - Library stats
• "Most played" - Popular songs

🔧 **Admin:**
• "Sync drive" - Sync from Google Drive
• "Update [song]" - Edit metadata

💡 **Tip:** Type @ for quick action menu!"""

        return {
            "success": True,
            "message": help_text_he,
            "message_en": help_text_en,
            "topic": topic
        }

    # Admin methods

    async def _execute_sync_drive(self, task: ParsedTask) -> Dict[str, Any]:
        """Trigger Google Drive sync."""
        if not self._content_sync:
            return {
                "success": False,
                "message": "❌ שירות הסנכרון אינו זמין",
                "message_en": "Sync service not available"
            }

        try:
            # Start sync in background
            import asyncio
            asyncio.create_task(self._content_sync.sync_from_drive())

            return {
                "success": True,
                "message": "🔄 סנכרון מגוגל דרייב התחיל... ייתכן שייקח מספר דקות",
                "message_en": "Google Drive sync started... this may take a few minutes",
                "action": "sync_started"
            }
        except Exception as e:
            logger.error(f"Drive sync error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בהתחלת סנכרון: {str(e)}",
                "message_en": f"Sync error: {str(e)}"
            }

    async def _execute_get_sync_status(self, task: ParsedTask) -> Dict[str, Any]:
        """Get sync status."""
        if not self._content_sync:
            return {
                "success": False,
                "message": "❌ שירות הסנכרון אינו זמין",
                "message_en": "Sync service not available"
            }

        try:
            progress = self._content_sync.get_sync_progress()

            if not progress:
                return {
                    "success": True,
                    "message": "ℹ️ אין סנכרון פעיל כרגע",
                    "message_en": "No active sync",
                    "status": "idle"
                }

            status = progress.get("status", "unknown")
            processed = progress.get("processed_files", 0)
            total = progress.get("total_files", 0)
            percent = progress.get("percentage", 0)
            current = progress.get("current_file", "")

            status_he = {
                "running": "פעיל",
                "completed": "הושלם",
                "error": "שגיאה",
                "idle": "לא פעיל"
            }.get(status, status)

            if status == "running":
                message = f"🔄 סנכרון {status_he}: {processed}/{total} ({percent:.1f}%)\n📄 {current}"
            elif status == "completed":
                message = f"✅ סנכרון הושלם: {processed} קבצים עובדו"
            else:
                message = f"ℹ️ מצב סנכרון: {status_he}"

            return {
                "success": True,
                "message": message,
                "message_en": f"Sync {status}: {processed}/{total} files ({percent:.1f}%)",
                "progress": progress
            }
        except Exception as e:
            logger.error(f"Get sync status error: {e}")
            return {
                "success": False,
                "message": f"❌ שגיאה בקבלת סטטוס: {str(e)}",
                "message_en": f"Error getting status: {str(e)}"
            }
