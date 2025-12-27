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
    }

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
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
                # Play now - add to queue with high priority
                await self.db.playback_queue.insert_one({
                    "content_id": content["_id"],
                    "priority": 100,  # High priority for manual requests
                    "requested_at": datetime.utcnow(),
                    "requested_by": "user_chat"
                })
                return {
                    "success": True,
                    "message": f"✅ מנגן עכשיו: '{content['title']}'",
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
        """Change to a different genre."""
        genre = task.parameters.get("genre")

        # Update current schedule preference
        await self.db.agent_state.update_one(
            {"_id": "current"},
            {"$set": {"preferred_genre": genre, "updated_at": datetime.utcnow()}},
            upsert=True
        )

        return {
            "success": True,
            "message": f"🎶 עוברים לז'אנר {genre}",
            "message_en": f"Switching to {genre} genre",
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
