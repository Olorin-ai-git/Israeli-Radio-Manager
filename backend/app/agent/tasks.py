"""Task execution system for natural language commands."""

import logging
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

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
    }

    def __init__(self, db: AsyncIOMotorDatabase, audio_player=None, content_sync=None, calendar_service=None):
        self.db = db
        self._audio_player = audio_player
        self._content_sync = content_sync
        self._calendar_service = calendar_service
        self._scheduled_tasks: List[Dict[str, Any]] = []

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

        title = task.parameters.get("title")
        artist = task.parameters.get("artist")
        content_type = task.parameters.get("content_type", "song")

        # Search for content
        query: Dict[str, Any] = {"active": True}
        if title:
            query["$or"] = [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ]
        if artist:
            query["artist"] = {"$regex": artist, "$options": "i"}

        content = await self.db.content.find_one(query)
        logger.info(f"Play request - title: {title}, found content: {content.get('title') if content else 'None'}")

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
            # Search suggestions
            suggestions = await self._find_similar(title or "")
            return {
                "success": False,
                "message": f"❌ לא מצאתי את '{title}'. האם התכוונת לאחד מאלה?",
                "message_en": f"Couldn't find '{title}'. Did you mean one of these?",
                "suggestions": suggestions
            }

    async def _execute_schedule(self, task: ParsedTask) -> Dict[str, Any]:
        """Schedule content for a specific time."""
        title = task.parameters.get("title")
        scheduled_time = task.parameters.get("time")

        if not scheduled_time:
            return {
                "success": False,
                "message": "❌ לא ציינת שעה. לדוגמה: 'תזמן את השיר לשעה 16:00'",
                "message_en": "No time specified. Example: 'Schedule the song for 4:00 PM'"
            }

        # Find the content
        content = await self.db.content.find_one({
            "$or": [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ],
            "active": True
        })

        if content:
            await self._schedule_for_later(content, scheduled_time)
            return {
                "success": True,
                "message": f"✅ '{content['title']}' תוזמן לשעה {scheduled_time.strftime('%H:%M')}",
                "message_en": f"'{content['title']}' scheduled for {scheduled_time.strftime('%H:%M')}"
            }

        return {
            "success": False,
            "message": f"❌ לא מצאתי תוכן בשם '{title}'",
            "message_en": f"Couldn't find content named '{title}'"
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
        """Add content to queue."""
        title = task.parameters.get("title")

        content = await self.db.content.find_one({
            "$or": [
                {"title": {"$regex": title, "$options": "i"}},
                {"title_he": {"$regex": title, "$options": "i"}}
            ],
            "active": True
        })

        if content:
            await self.db.playback_queue.insert_one({
                "content_id": content["_id"],
                "priority": 50,
                "requested_at": datetime.utcnow(),
                "requested_by": "user_chat"
            })
            return {
                "success": True,
                "message": f"✅ '{content['title']}' נוסף לתור",
                "message_en": f"'{content['title']}' added to queue"
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
                    "message": f"🎵 מתנגן עכשיו: '{content['title']}' מאת {content.get('artist', 'לא ידוע')}",
                    "message_en": f"Now playing: '{content['title']}' by {content.get('artist', 'Unknown')}",
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

        genre = task.parameters.get("genre")

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
        query_text = task.parameters.get("query", "")

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
                f"• {r['title']} - {r.get('artist', '')}" for r in results
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

    async def _find_similar(self, title: str, limit: int = 5) -> List[Dict]:
        """Find similar content titles."""
        if not title:
            return []

        results = await self.db.content.find({
            "active": True
        }).limit(limit).to_list(limit)

        return [{"title": r["title"], "artist": r.get("artist")} for r in results]

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

        title = task.parameters.get("title")
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
        """Create a new auto flow from natural language description."""
        description = task.parameters.get("description", task.original_text)

        # Use the parse endpoint to convert natural language to flow
        from app.routers.flows import router as flows_router
        import re

        # Parse the description into actions
        actions = []
        parts = re.split(r',\s*then\s*|,\s*אז\s*|,\s*ואז\s*', description, flags=re.IGNORECASE)

        genre_map = {
            "חסידי": "hasidi", "חסידית": "hasidi",
            "מזרחי": "mizrahi", "מזרחית": "mizrahi",
            "פופ": "pop", "רוק": "rock",
            "ים תיכוני": "mediterranean", "קלאסי": "classic", "עברי": "hebrew",
        }

        for part in parts:
            part = part.strip().lower()

            # Parse genre
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

            # Parse commercials
            commercial_match = re.search(r'(?:play|נגן|השמע)\s+(\d+)\s+(?:commercials?|פרסומות?)', part)
            if commercial_match:
                count = int(commercial_match.group(1))
                actions.append({
                    "action_type": "play_commercials",
                    "commercial_count": count,
                    "description": f"Play {count} commercial(s)"
                })
                continue

        if not actions:
            return {
                "success": False,
                "message": "❌ לא הצלחתי להבין את הזרימה. נסה לתאר בפורמט: 'נגן מוזיקה חסידית, אז נגן 2 פרסומות, אז נגן מזרחית'",
                "message_en": "Couldn't parse flow. Try: 'play hasidi music, then play 2 commercials, then play mizrahi'"
            }

        # Extract schedule if present
        schedule = None
        time_match = re.search(r'(?:between|from|at|בין|מ-?|ב-?)\s*(\d{1,2})(?::(\d{2}))?\s*(?:am|בבוקר)?', description, re.IGNORECASE)
        if time_match:
            start_hour = int(time_match.group(1))
            start_min = int(time_match.group(2) or 0)
            schedule = {
                "start_time": f"{start_hour:02d}:{start_min:02d}",
                "days_of_week": [0, 1, 2, 3, 4, 5, 6]
            }

        # Create the flow
        flow_name = task.parameters.get("name", f"Flow {datetime.now().strftime('%H:%M')}")
        flow_doc = {
            "name": flow_name,
            "name_he": flow_name,
            "description": description,
            "actions": actions,
            "trigger_type": "scheduled" if schedule else "manual",
            "schedule": schedule,
            "status": "active",
            "priority": 0,
            "loop": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_run": None,
            "run_count": 0
        }

        result = await self.db.flows.insert_one(flow_doc)
        flow_doc["_id"] = str(result.inserted_id)

        actions_summary = ", ".join([a.get("description", a.get("action_type")) for a in actions])

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
            flow_list.append(f"{status_emoji} {flow['name']} ({actions_count} פעולות)")

        return {
            "success": True,
            "message": f"📋 זרימות ({len(flows)}):\n" + "\n".join(flow_list),
            "message_en": f"Flows ({len(flows)}):\n" + "\n".join(flow_list),
            "flows": [{**f, "_id": str(f["_id"])} for f in flows]
        }

    async def _execute_run_flow(self, task: ParsedTask) -> Dict[str, Any]:
        """Run/execute a flow."""
        flow_name = task.parameters.get("name")
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
                    self._audio_player.add_to_queue(track, priority=10)

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
        flow_name = task.parameters.get("name")
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
        else:
            flow = await self.db.flows.find_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })

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
        flow_name = task.parameters.get("name")
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
        else:
            result = await self.db.flows.delete_one({
                "$or": [
                    {"name": {"$regex": flow_name, "$options": "i"}},
                    {"name_he": {"$regex": flow_name, "$options": "i"}}
                ]
            })

        if result.deleted_count > 0:
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
        flow_name = task.parameters.get("name")
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
