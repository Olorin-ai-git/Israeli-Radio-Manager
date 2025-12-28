"""Email Watcher Service - monitors Gmail for audio attachments and auto-imports them."""

import asyncio
import logging
from datetime import datetime
from typing import Optional, Set, Dict, Any, List
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase
from mutagen import File as MutagenFile

from app.models.agent import ActionType, ActionStatus
from app.models.content import ContentType

logger = logging.getLogger(__name__)


class EmailWatcherService:
    """
    Background service that watches Gmail for audio attachments
    and automatically imports them into the radio content library.

    Flow:
    1. Periodically check Gmail for unread emails with audio attachments
    2. Download attachments to temp storage
    3. Extract metadata using mutagen
    4. Classify using AI agent (type, genre)
    5. Upload to Google Drive (organized by type/genre)
    6. Add to MongoDB content collection
    7. Mark email as processed
    """

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        gmail_service,
        drive_service,
        orchestrator_agent=None,
        notification_service=None,
        check_interval: int = 60,
        auto_approve_threshold: float = 0.8
    ):
        """
        Initialize email watcher.

        Args:
            db: MongoDB database
            gmail_service: GmailService instance
            drive_service: GoogleDriveService instance
            orchestrator_agent: OrchestratorAgent for AI classification
            notification_service: NotificationService for alerts
            check_interval: Seconds between checks (default 60)
            auto_approve_threshold: Confidence threshold for auto-approval
        """
        self.db = db
        self.gmail = gmail_service
        self.drive = drive_service
        self.agent = orchestrator_agent
        self.notifications = notification_service
        self.check_interval = check_interval
        self.auto_approve_threshold = auto_approve_threshold

        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._processed_messages: Set[str] = set()
        self._last_check: Optional[datetime] = None
        self._stats = {
            "total_processed": 0,
            "successful_imports": 0,
            "pending_review": 0,
            "errors": 0
        }

    async def start(self):
        """Start the email watcher background task."""
        if self._running:
            logger.warning("Email watcher already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._watch_loop())
        logger.info(f"Email watcher started (checking every {self.check_interval}s)")

    async def stop(self):
        """Stop the email watcher."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Email watcher stopped")

    async def _watch_loop(self):
        """Main watch loop - runs continuously."""
        while self._running:
            try:
                await self._check_for_attachments()
                self._last_check = datetime.now()
            except Exception as e:
                logger.error(f"Error in email watcher: {e}", exc_info=True)
                self._stats["errors"] += 1

            await asyncio.sleep(self.check_interval)

    async def _check_for_attachments(self):
        """Check Gmail for new audio attachments."""
        if not self.gmail:
            logger.debug("No Gmail service available")
            return

        try:
            # Get unread emails with audio attachments
            attachments = await self.gmail.check_for_audio_attachments(
                max_results=10,
                only_unread=True
            )

            if not attachments:
                return

            logger.info(f"Found {len(attachments)} new audio attachments")

            for attachment_info in attachments:
                message_id = attachment_info["message_id"]

                # Skip already processed
                if message_id in self._processed_messages:
                    continue

                await self._process_attachment(attachment_info)
                self._processed_messages.add(message_id)
                self._stats["total_processed"] += 1

                # Keep set size reasonable
                if len(self._processed_messages) > 500:
                    self._processed_messages = set(list(self._processed_messages)[-250:])

        except Exception as e:
            logger.error(f"Failed to check for attachments: {e}", exc_info=True)

    async def _process_attachment(self, attachment_info: Dict[str, Any]):
        """
        Process a single audio attachment.

        Steps:
        1. Download attachment
        2. Extract metadata
        3. Classify with AI
        4. Handle based on confidence/mode
        5. Upload and store
        """
        filename = attachment_info["filename"]
        sender = attachment_info["sender"]
        subject = attachment_info["subject"]

        logger.info(f"Processing attachment: {filename} from {sender}")

        try:
            # Step 1: Download attachment
            local_path = await self.gmail.download_attachment(
                attachment_info["message_id"],
                attachment_info["attachment_id"],
                filename
            )

            # Step 2: Extract metadata
            metadata = self._extract_metadata(local_path)
            metadata["sender"] = sender
            metadata["subject"] = subject
            metadata["original_filename"] = filename

            # Step 3: Classify with AI
            classification = await self._classify_content(filename, metadata)

            # Step 4: Determine action based on confidence and mode
            confidence = classification.get("confidence", 0.0)
            needs_review = await self._needs_user_review(confidence)

            if needs_review:
                # Create pending action for user review
                await self._create_pending_action(
                    attachment_info,
                    local_path,
                    metadata,
                    classification
                )
                self._stats["pending_review"] += 1
            else:
                # Auto-import the content
                await self._import_content(
                    local_path,
                    metadata,
                    classification
                )
                self._stats["successful_imports"] += 1

                # Mark email as processed
                await self.gmail.mark_as_processed(attachment_info["message_id"])

            # Send notification
            await self._send_notification(
                filename,
                classification,
                needs_review
            )

        except Exception as e:
            logger.error(f"Failed to process attachment {filename}: {e}", exc_info=True)
            self._stats["errors"] += 1

    def _extract_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Extract metadata from audio file using mutagen."""
        metadata = {}

        try:
            audio = MutagenFile(str(file_path), easy=True)
            if audio is None:
                return metadata

            if hasattr(audio, 'get'):
                metadata["title"] = self._get_first(audio.get("title"))
                metadata["artist"] = self._get_first(audio.get("artist"))
                metadata["album"] = self._get_first(audio.get("album"))
                metadata["genre"] = self._get_first(audio.get("genre"))

                year = self._get_first(audio.get("date"))
                if year:
                    try:
                        metadata["year"] = int(year[:4])
                    except (ValueError, TypeError):
                        pass

            if hasattr(audio, 'info') and audio.info:
                metadata["duration"] = int(audio.info.length)

        except Exception as e:
            logger.warning(f"Could not extract metadata from {file_path}: {e}")

        return metadata

    def _get_first(self, value) -> Optional[str]:
        """Get first item if list, otherwise return value."""
        if isinstance(value, list) and value:
            return value[0]
        return value

    async def _classify_content(
        self,
        filename: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Classify content using AI agent."""
        if not self.agent:
            # Fallback classification without AI
            return self._fallback_classification(filename, metadata)

        try:
            return await self.agent.classify_content(filename, metadata)
        except Exception as e:
            logger.warning(f"AI classification failed, using fallback: {e}")
            return self._fallback_classification(filename, metadata)

    def _fallback_classification(
        self,
        filename: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Simple rule-based classification when AI is unavailable."""
        filename_lower = filename.lower()

        # Detect commercials
        if any(word in filename_lower for word in ["commercial", "ad", "promo", "פרסומת"]):
            content_type = ContentType.COMMERCIAL
        # Detect shows
        elif any(word in filename_lower for word in ["show", "episode", "תוכנית", "פרק"]):
            content_type = ContentType.SHOW
        else:
            content_type = ContentType.SONG

        # Try to detect genre from metadata or filename
        genre = metadata.get("genre")
        if not genre:
            if any(word in filename_lower for word in ["mizrahi", "מזרחי"]):
                genre = "Mizrahi"
            elif any(word in filename_lower for word in ["hasidi", "חסידי"]):
                genre = "Hasidi"
            elif any(word in filename_lower for word in ["rock", "רוק"]):
                genre = "Rock"
            else:
                genre = "Mixed"

        return {
            "suggested_type": content_type.value,
            "suggested_genre": genre,
            "confidence": 0.5,  # Low confidence for fallback
            "reasoning": "Classified using filename/metadata patterns (AI unavailable)"
        }

    async def _needs_user_review(self, confidence: float) -> bool:
        """Determine if content needs user review."""
        if not self.agent:
            return True  # Always review if no AI

        # Check if we're in prompt mode
        try:
            config = await self.agent.get_config()
            from app.models.agent import AgentMode

            if config.mode == AgentMode.PROMPT:
                # In prompt mode, check if categorization requires confirmation
                if ActionType.CATEGORIZE_CONTENT in config.confirmation_required_actions:
                    return True

            # Auto-approve if confidence is high enough
            return confidence < self.auto_approve_threshold

        except Exception as e:
            logger.warning(f"Error checking agent config: {e}")
            return True

    async def _create_pending_action(
        self,
        attachment_info: Dict[str, Any],
        local_path: Path,
        metadata: Dict[str, Any],
        classification: Dict[str, Any]
    ):
        """Create a pending action for user review."""
        from app.models.agent import PendingAction

        pending_action = {
            "action_type": ActionType.CATEGORIZE_CONTENT.value,
            "description": f"Categorize new audio: {attachment_info['filename']}",
            "description_he": f"סיווג שיר חדש: {attachment_info['filename']}",
            "ai_reasoning": classification.get("reasoning", ""),
            "suggested_action": {
                "type": classification.get("suggested_type"),
                "genre": classification.get("suggested_genre"),
                "title": metadata.get("title") or self._title_from_filename(attachment_info['filename']),
                "artist": metadata.get("artist"),
            },
            "alternatives": [
                {"type": "song", "genre": "Mizrahi"},
                {"type": "song", "genre": "Hasidi"},
                {"type": "song", "genre": "Rock"},
                {"type": "commercial", "genre": None},
                {"type": "show", "genre": None},
            ],
            "context": {
                "filename": attachment_info["filename"],
                "sender": attachment_info["sender"],
                "subject": attachment_info["subject"],
                "local_path": str(local_path),
                "metadata": metadata,
            },
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow(),  # Will be set by confirmation manager
            "status": ActionStatus.PENDING.value,
            "responded_by": None,
            "response_channel": None,
            "final_action": None
        }

        result = await self.db.pending_actions.insert_one(pending_action)
        logger.info(f"Created pending action for review: {result.inserted_id}")

        # Broadcast via WebSocket
        try:
            from app.routers.websocket import broadcast_confirmation_required
            pending_action["_id"] = str(result.inserted_id)
            await broadcast_confirmation_required(pending_action)
        except Exception as e:
            logger.warning(f"Failed to broadcast pending action: {e}")

    async def _import_content(
        self,
        local_path: Path,
        metadata: Dict[str, Any],
        classification: Dict[str, Any]
    ):
        """Import content to Google Drive and database."""
        content_type = classification.get("suggested_type", "song")
        genre = classification.get("suggested_genre")
        filename = local_path.name

        # Determine Drive folder based on type/genre
        folder_path = self._get_drive_folder(content_type, genre)

        try:
            # Upload to Google Drive
            drive_result = await self.drive.upload_file(
                local_path,
                folder_path=folder_path
            )

            drive_id = drive_result.get("id")
            drive_path = f"{folder_path}/{filename}"

            # Create content document
            content_doc = {
                "google_drive_id": drive_id,
                "google_drive_path": drive_path,
                "type": content_type,
                "title": metadata.get("title") or self._title_from_filename(filename),
                "artist": metadata.get("artist"),
                "genre": genre,
                "duration_seconds": metadata.get("duration", 0),
                "local_cache_path": str(local_path),
                "metadata": {
                    "album": metadata.get("album"),
                    "year": metadata.get("year"),
                    "language": "hebrew",
                    "tags": [],
                    "ai_classification": {
                        "confidence": classification.get("confidence", 0),
                        "suggested_type": content_type,
                        "suggested_genre": genre
                    },
                    "imported_from_email": True,
                    "sender": metadata.get("sender"),
                    "import_date": datetime.utcnow().isoformat()
                },
                "active": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "play_count": 0,
                "last_played": None
            }

            result = await self.db.content.insert_one(content_doc)
            logger.info(f"Imported content: {content_doc['title']} (ID: {result.inserted_id})")

            # Broadcast content update
            try:
                from app.routers.websocket import broadcast_content_update
                content_doc["_id"] = str(result.inserted_id)
                await broadcast_content_update("added", content_doc)
            except Exception as e:
                logger.warning(f"Failed to broadcast content update: {e}")

        except Exception as e:
            logger.error(f"Failed to import content: {e}", exc_info=True)
            raise

    def _get_drive_folder(self, content_type: str, genre: Optional[str]) -> str:
        """Determine the Google Drive folder path for content."""
        if content_type == "commercial":
            return "Commercials"
        elif content_type == "show":
            return "Shows"
        else:
            # Songs go into genre subfolders
            if genre:
                return f"Songs/{genre}"
            return "Songs/Mixed"

    def _title_from_filename(self, filename: str) -> str:
        """Extract title from filename."""
        import re
        name = Path(filename).stem
        name = name.replace("_", " ").replace("-", " ")
        name = re.sub(r"^\d+[\s\.\-_]+", "", name)
        return name.strip()

    async def _send_notification(
        self,
        filename: str,
        classification: Dict[str, Any],
        needs_review: bool
    ):
        """Send notification about processed attachment."""
        if not self.notifications:
            return

        try:
            if needs_review:
                await self.notifications.send_notification(
                    title="New Audio Needs Review",
                    message=f"New audio file '{filename}' requires categorization review.",
                    level="info",
                    channels=["dashboard", "email"]
                )
            else:
                content_type = classification.get("suggested_type", "content")
                genre = classification.get("suggested_genre", "")
                await self.notifications.send_notification(
                    title="Audio Auto-Imported",
                    message=f"'{filename}' imported as {content_type} ({genre})",
                    level="info",
                    channels=["dashboard"]
                )
        except Exception as e:
            logger.warning(f"Failed to send notification: {e}")

    async def process_pending_action(
        self,
        action_id: str,
        approved: bool,
        modified_action: Optional[Dict[str, Any]] = None
    ):
        """
        Process a user's response to a pending categorization action.

        Args:
            action_id: ID of the pending action
            approved: Whether the user approved
            modified_action: Modified classification if user changed it
        """
        from bson import ObjectId

        # Get the pending action
        action = await self.db.pending_actions.find_one({"_id": ObjectId(action_id)})
        if not action:
            logger.error(f"Pending action not found: {action_id}")
            return

        context = action.get("context", {})
        local_path = Path(context.get("local_path", ""))

        if not local_path.exists():
            logger.error(f"Local file no longer exists: {local_path}")
            return

        if approved:
            # Use modified action if provided, otherwise use suggested
            final_action = modified_action or action.get("suggested_action", {})

            classification = {
                "suggested_type": final_action.get("type"),
                "suggested_genre": final_action.get("genre"),
                "confidence": 1.0,  # User-approved
                "reasoning": "Approved by user"
            }

            metadata = context.get("metadata", {})
            metadata["title"] = final_action.get("title")
            metadata["artist"] = final_action.get("artist")

            # Import the content
            await self._import_content(local_path, metadata, classification)

            # Mark email as processed
            message_id = context.get("message_id")
            if message_id:
                await self.gmail.mark_as_processed(message_id)

            self._stats["successful_imports"] += 1
        else:
            # Move to rejected folder or delete
            logger.info(f"Content rejected by user: {context.get('filename')}")

        # Update pending action status
        await self.db.pending_actions.update_one(
            {"_id": ObjectId(action_id)},
            {
                "$set": {
                    "status": ActionStatus.APPROVED.value if approved else ActionStatus.REJECTED.value,
                    "responded_by": "user",
                    "response_channel": "dashboard",
                    "final_action": modified_action or action.get("suggested_action")
                }
            }
        )

        self._stats["pending_review"] = max(0, self._stats["pending_review"] - 1)

    def get_status(self) -> Dict[str, Any]:
        """Get watcher status."""
        return {
            "running": self._running,
            "last_check": self._last_check.isoformat() if self._last_check else None,
            "check_interval": self.check_interval,
            "auto_approve_threshold": self.auto_approve_threshold,
            "stats": self._stats.copy()
        }

    async def manual_check(self) -> Dict[str, Any]:
        """Manually trigger a check for attachments."""
        await self._check_for_attachments()
        return self.get_status()
