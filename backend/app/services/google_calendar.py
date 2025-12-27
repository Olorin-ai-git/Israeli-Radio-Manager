"""Google Calendar service for scheduling content."""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, List
from enum import Enum

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


class RecurrenceFrequency(str, Enum):
    """Recurrence frequency options."""
    DAILY = "DAILY"
    WEEKLY = "WEEKLY"
    MONTHLY = "MONTHLY"
    YEARLY = "YEARLY"


class ReminderMethod(str, Enum):
    """Reminder notification methods."""
    EMAIL = "email"
    POPUP = "popup"
    SMS = "sms"


class EventVisibility(str, Enum):
    """Event visibility options."""
    DEFAULT = "default"
    PUBLIC = "public"
    PRIVATE = "private"
    CONFIDENTIAL = "confidential"


class EventStatus(str, Enum):
    """Event status options."""
    CONFIRMED = "confirmed"
    TENTATIVE = "tentative"
    CANCELLED = "cancelled"


class GoogleCalendarService:
    """
    Google Calendar integration for scheduling radio content.

    Supports all Google Calendar event options:
    - Start/end times with timezone
    - All-day events
    - Recurring events (daily, weekly, monthly, yearly)
    - Reminders (email, popup, SMS)
    - Event visibility and status
    - Location and description
    - Attendees
    - Color coding
    - Extended properties for content metadata
    """

    SCOPES = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
    ]

    # Google Calendar event colors (id -> color name)
    EVENT_COLORS = {
        "1": "Lavender",
        "2": "Sage",
        "3": "Grape",
        "4": "Flamingo",
        "5": "Banana",
        "6": "Tangerine",
        "7": "Peacock",
        "8": "Graphite",
        "9": "Blueberry",
        "10": "Basil",
        "11": "Tomato"
    }

    # Content type to color mapping
    CONTENT_TYPE_COLORS = {
        "song": "7",       # Peacock (blue)
        "commercial": "6", # Tangerine (orange)
        "show": "10"       # Basil (green)
    }

    def __init__(
        self,
        credentials_file: str = "credentials.json",
        token_file: str = "token.json",
        calendar_id: Optional[str] = None
    ):
        """
        Initialize Google Calendar service.

        Args:
            credentials_file: Path to OAuth2 credentials JSON
            token_file: Path to store access token
            calendar_id: Google Calendar ID (defaults to primary)
        """
        self._credentials_file = Path(credentials_file)
        self._token_file = Path(token_file)
        self._calendar_id = calendar_id or "primary"
        self._service = None
        self._creds = None

    async def authenticate(self) -> bool:
        """
        Authenticate with Google Calendar API using OAuth2.

        Returns:
            True if authentication successful
        """
        try:
            # Check for existing token
            if self._token_file.exists():
                self._creds = Credentials.from_authorized_user_file(
                    str(self._token_file), self.SCOPES
                )

            # Refresh or get new credentials
            if not self._creds or not self._creds.valid:
                if self._creds and self._creds.expired and self._creds.refresh_token:
                    self._creds.refresh(Request())
                else:
                    if not self._credentials_file.exists():
                        logger.error(f"Credentials file not found: {self._credentials_file}")
                        return False

                    flow = InstalledAppFlow.from_client_secrets_file(
                        str(self._credentials_file), self.SCOPES
                    )
                    self._creds = flow.run_local_server(port=0)

                # Save token for next run
                with open(self._token_file, 'w') as token:
                    token.write(self._creds.to_json())

            # Build service
            self._service = build('calendar', 'v3', credentials=self._creds)
            logger.info("Google Calendar authentication successful")
            return True

        except Exception as e:
            logger.error(f"Google Calendar authentication failed: {e}")
            return False

    def _ensure_authenticated(self):
        """Ensure the service is authenticated."""
        if not self._service:
            raise RuntimeError("Google Calendar service not authenticated. Call authenticate() first.")

    async def create_event(
        self,
        summary: str,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        description: Optional[str] = None,
        location: Optional[str] = None,
        timezone: str = "Asia/Jerusalem",
        all_day: bool = False,
        content_type: Optional[str] = None,
        content_id: Optional[str] = None,
        color_id: Optional[str] = None,
        visibility: EventVisibility = EventVisibility.DEFAULT,
        status: EventStatus = EventStatus.CONFIRMED,
        reminders: Optional[List[Dict[str, Any]]] = None,
        recurrence: Optional[Dict[str, Any]] = None,
        attendees: Optional[List[str]] = None,
        guests_can_modify: bool = False,
        guests_can_invite_others: bool = True,
        guests_can_see_other_guests: bool = True,
        transparency: str = "opaque"
    ) -> Dict[str, Any]:
        """
        Create a calendar event for scheduled content.

        Args:
            summary: Event title
            start_time: Event start datetime
            end_time: Event end datetime (defaults to start + 1 hour)
            description: Event description (Hebrew/English)
            location: Event location
            timezone: Timezone for the event
            all_day: Whether this is an all-day event
            content_type: Type of content (song/commercial/show)
            content_id: MongoDB content ID for linking
            color_id: Google Calendar color ID (1-11)
            visibility: Event visibility setting
            status: Event status
            reminders: List of reminder settings
            recurrence: Recurrence rule settings
            attendees: List of email addresses to invite
            guests_can_modify: Allow guests to modify event
            guests_can_invite_others: Allow guests to invite others
            guests_can_see_other_guests: Allow guests to see attendee list
            transparency: "opaque" (busy) or "transparent" (free)

        Returns:
            Created event data from Google Calendar API
        """
        self._ensure_authenticated()

        # Default end time to start + 1 hour
        if not end_time:
            end_time = start_time + timedelta(hours=1)

        # Build event body
        event = {
            "summary": summary,
            "visibility": visibility.value,
            "status": status.value,
            "transparency": transparency,
            "guestsCanModify": guests_can_modify,
            "guestsCanInviteOthers": guests_can_invite_others,
            "guestsCanSeeOtherGuests": guests_can_see_other_guests,
        }

        # Set start/end times
        if all_day:
            event["start"] = {"date": start_time.strftime("%Y-%m-%d")}
            event["end"] = {"date": end_time.strftime("%Y-%m-%d")}
        else:
            event["start"] = {
                "dateTime": start_time.isoformat(),
                "timeZone": timezone
            }
            event["end"] = {
                "dateTime": end_time.isoformat(),
                "timeZone": timezone
            }

        # Optional fields
        if description:
            event["description"] = description

        if location:
            event["location"] = location

        # Color - use content type default if not specified
        if color_id:
            event["colorId"] = color_id
        elif content_type and content_type in self.CONTENT_TYPE_COLORS:
            event["colorId"] = self.CONTENT_TYPE_COLORS[content_type]

        # Store content metadata in extended properties
        if content_id or content_type:
            event["extendedProperties"] = {
                "private": {
                    "radio_content_id": content_id or "",
                    "radio_content_type": content_type or "",
                    "radio_managed": "true"
                }
            }

        # Reminders
        if reminders is not None:
            event["reminders"] = {
                "useDefault": False,
                "overrides": reminders
            }
        else:
            # Default: 30 min popup reminder
            event["reminders"] = {
                "useDefault": False,
                "overrides": [
                    {"method": "popup", "minutes": 30}
                ]
            }

        # Recurrence
        if recurrence:
            event["recurrence"] = [self._build_rrule(recurrence)]

        # Attendees
        if attendees:
            event["attendees"] = [{"email": email} for email in attendees]

        try:
            result = self._service.events().insert(
                calendarId=self._calendar_id,
                body=event,
                sendUpdates="all" if attendees else "none"
            ).execute()

            logger.info(f"Created calendar event: {result.get('id')} - {summary}")
            return result

        except HttpError as e:
            logger.error(f"Failed to create calendar event: {e}")
            raise

    def _build_rrule(self, recurrence: Dict[str, Any]) -> str:
        """
        Build an RFC 5545 RRULE string from recurrence settings.

        Args:
            recurrence: Dict with recurrence settings:
                - frequency: DAILY, WEEKLY, MONTHLY, YEARLY
                - interval: Every N periods (default 1)
                - count: Number of occurrences (optional)
                - until: End date (optional)
                - by_day: List of days for WEEKLY (MO, TU, WE, TH, FR, SA, SU)
                - by_month_day: Day of month for MONTHLY (1-31)
                - by_month: Month for YEARLY (1-12)

        Returns:
            RRULE string
        """
        parts = ["RRULE:FREQ=" + recurrence.get("frequency", "WEEKLY")]

        if "interval" in recurrence:
            parts.append(f"INTERVAL={recurrence['interval']}")

        if "count" in recurrence:
            parts.append(f"COUNT={recurrence['count']}")
        elif "until" in recurrence:
            until = recurrence["until"]
            if isinstance(until, datetime):
                parts.append(f"UNTIL={until.strftime('%Y%m%dT%H%M%SZ')}")
            else:
                parts.append(f"UNTIL={until}")

        if "by_day" in recurrence:
            days = recurrence["by_day"]
            if isinstance(days, list):
                parts.append(f"BYDAY={','.join(days)}")
            else:
                parts.append(f"BYDAY={days}")

        if "by_month_day" in recurrence:
            parts.append(f"BYMONTHDAY={recurrence['by_month_day']}")

        if "by_month" in recurrence:
            parts.append(f"BYMONTH={recurrence['by_month']}")

        return ";".join(parts)

    async def update_event(
        self,
        event_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Update an existing calendar event.

        Args:
            event_id: Google Calendar event ID
            **kwargs: Fields to update (same as create_event)

        Returns:
            Updated event data
        """
        self._ensure_authenticated()

        try:
            # Get existing event
            event = self._service.events().get(
                calendarId=self._calendar_id,
                eventId=event_id
            ).execute()

            # Update fields
            if "summary" in kwargs:
                event["summary"] = kwargs["summary"]
            if "description" in kwargs:
                event["description"] = kwargs["description"]
            if "location" in kwargs:
                event["location"] = kwargs["location"]
            if "start_time" in kwargs:
                start = kwargs["start_time"]
                timezone = kwargs.get("timezone", "Asia/Jerusalem")
                if kwargs.get("all_day"):
                    event["start"] = {"date": start.strftime("%Y-%m-%d")}
                else:
                    event["start"] = {
                        "dateTime": start.isoformat(),
                        "timeZone": timezone
                    }
            if "end_time" in kwargs:
                end = kwargs["end_time"]
                timezone = kwargs.get("timezone", "Asia/Jerusalem")
                if kwargs.get("all_day"):
                    event["end"] = {"date": end.strftime("%Y-%m-%d")}
                else:
                    event["end"] = {
                        "dateTime": end.isoformat(),
                        "timeZone": timezone
                    }
            if "color_id" in kwargs:
                event["colorId"] = kwargs["color_id"]
            if "visibility" in kwargs:
                event["visibility"] = kwargs["visibility"].value
            if "status" in kwargs:
                event["status"] = kwargs["status"].value
            if "reminders" in kwargs:
                event["reminders"] = {
                    "useDefault": False,
                    "overrides": kwargs["reminders"]
                }
            if "recurrence" in kwargs:
                event["recurrence"] = [self._build_rrule(kwargs["recurrence"])]

            result = self._service.events().update(
                calendarId=self._calendar_id,
                eventId=event_id,
                body=event
            ).execute()

            logger.info(f"Updated calendar event: {event_id}")
            return result

        except HttpError as e:
            logger.error(f"Failed to update calendar event: {e}")
            raise

    async def delete_event(self, event_id: str) -> bool:
        """
        Delete a calendar event.

        Args:
            event_id: Google Calendar event ID

        Returns:
            True if deleted successfully
        """
        self._ensure_authenticated()

        try:
            self._service.events().delete(
                calendarId=self._calendar_id,
                eventId=event_id
            ).execute()

            logger.info(f"Deleted calendar event: {event_id}")
            return True

        except HttpError as e:
            logger.error(f"Failed to delete calendar event: {e}")
            return False

    async def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a single calendar event.

        Args:
            event_id: Google Calendar event ID

        Returns:
            Event data or None
        """
        self._ensure_authenticated()

        try:
            event = self._service.events().get(
                calendarId=self._calendar_id,
                eventId=event_id
            ).execute()
            return event
        except HttpError:
            return None

    async def list_events(
        self,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None,
        max_results: int = 100,
        content_type: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        List calendar events with optional filters.

        Args:
            time_min: Start of time range
            time_max: End of time range
            max_results: Maximum events to return
            content_type: Filter by content type (song/commercial/show)
            search_query: Free-text search query

        Returns:
            List of events
        """
        self._ensure_authenticated()

        try:
            params = {
                "calendarId": self._calendar_id,
                "maxResults": max_results,
                "singleEvents": True,
                "orderBy": "startTime"
            }

            if time_min:
                params["timeMin"] = time_min.isoformat() + "Z"
            else:
                params["timeMin"] = datetime.utcnow().isoformat() + "Z"

            if time_max:
                params["timeMax"] = time_max.isoformat() + "Z"

            if search_query:
                params["q"] = search_query

            events = self._service.events().list(**params).execute()
            items = events.get("items", [])

            # Filter by content type if specified
            if content_type:
                items = [
                    e for e in items
                    if e.get("extendedProperties", {})
                        .get("private", {})
                        .get("radio_content_type") == content_type
                ]

            return items

        except HttpError as e:
            logger.error(f"Failed to list calendar events: {e}")
            return []

    async def list_radio_events(
        self,
        time_min: Optional[datetime] = None,
        time_max: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        List only events managed by the radio system.

        Args:
            time_min: Start of time range
            time_max: End of time range

        Returns:
            List of radio-managed events
        """
        events = await self.list_events(time_min, time_max)

        return [
            e for e in events
            if e.get("extendedProperties", {})
                .get("private", {})
                .get("radio_managed") == "true"
        ]

    async def create_reminder(
        self,
        method: ReminderMethod,
        minutes: int
    ) -> Dict[str, Any]:
        """
        Create a reminder configuration.

        Args:
            method: Reminder method (email, popup, sms)
            minutes: Minutes before event to remind

        Returns:
            Reminder dict for use in create_event
        """
        return {
            "method": method.value,
            "minutes": minutes
        }

    async def schedule_content(
        self,
        content: Dict[str, Any],
        start_time: datetime,
        end_time: Optional[datetime] = None,
        recurrence: Optional[Dict[str, Any]] = None,
        reminders: Optional[List[Dict[str, Any]]] = None,
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Schedule radio content on the calendar.

        This is a convenience method that automatically sets up
        the event with appropriate defaults for radio content.

        Args:
            content: Content document from MongoDB
            start_time: When to play the content
            end_time: End time (defaults to start + duration)
            recurrence: Recurrence settings
            reminders: Custom reminders
            description: Additional description

        Returns:
            Created calendar event
        """
        content_type = content.get("type", "song")
        content_id = str(content.get("_id", ""))
        duration_seconds = content.get("duration_seconds", 300)

        # Build summary (Hebrew preferred)
        title = content.get("title_he") or content.get("title", "Unknown")
        artist = content.get("artist", "")

        if artist:
            summary = f"{title} - {artist}"
        else:
            summary = title

        # Add content type emoji
        type_emoji = {
            "song": "🎵",
            "commercial": "📢",
            "show": "🎙️"
        }
        summary = f"{type_emoji.get(content_type, '🎵')} {summary}"

        # Calculate end time from duration if not specified
        if not end_time:
            end_time = start_time + timedelta(seconds=duration_seconds)

        # Build description
        desc_parts = []
        if description:
            desc_parts.append(description)

        desc_parts.append(f"סוג: {content_type}")
        if content.get("genre"):
            desc_parts.append(f"ז'אנר: {content['genre']}")
        desc_parts.append(f"משך: {duration_seconds // 60}:{duration_seconds % 60:02d}")
        desc_parts.append(f"\nContent ID: {content_id}")

        full_description = "\n".join(desc_parts)

        # Default reminders for radio content
        if reminders is None:
            reminders = [
                {"method": "popup", "minutes": 5},
                {"method": "email", "minutes": 30}
            ]

        return await self.create_event(
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            description=full_description,
            content_type=content_type,
            content_id=content_id,
            reminders=reminders,
            recurrence=recurrence
        )

    async def get_schedule_for_day(
        self,
        date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all scheduled content for a specific day.

        Args:
            date: The date to get schedule for (defaults to today)

        Returns:
            List of scheduled events for that day
        """
        if not date:
            date = datetime.now()

        # Start and end of day
        day_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        return await self.list_radio_events(day_start, day_end)
