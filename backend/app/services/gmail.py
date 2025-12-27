"""Gmail Service for monitoring email attachments."""

import base64
import logging
import tempfile
from typing import Optional, List, Dict, Any
from pathlib import Path

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
]

# Audio file extensions to look for
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.aac', '.ogg'}


class GmailService:
    """
    Service for monitoring Gmail for audio attachments.

    Watches for new emails with MP3 attachments and downloads them
    for processing by the AI agent.
    """

    def __init__(
        self,
        credentials_path: str = "credentials.json",
        token_path: str = "gmail_token.json",
        download_dir: str = "./downloads"
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)

        self._service = None
        self._credentials = None

        # Track processed message IDs to avoid duplicates
        self._processed_ids: set = set()

    def _get_credentials(self) -> Credentials:
        """Get or refresh OAuth credentials."""
        creds = None

        if Path(self.token_path).exists():
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not Path(self.credentials_path).exists():
                    raise FileNotFoundError(
                        f"Credentials file not found: {self.credentials_path}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                creds = flow.run_local_server(port=0)

            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())

        return creds

    def _ensure_service(self):
        """Ensure Gmail service is initialized."""
        if self._service is None:
            self._credentials = self._get_credentials()
            self._service = build('gmail', 'v1', credentials=self._credentials)
            logger.info("Gmail service initialized")

    async def check_for_audio_attachments(
        self,
        max_results: int = 10,
        only_unread: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Check inbox for emails with audio attachments.

        Args:
            max_results: Maximum number of messages to check
            only_unread: Only check unread messages

        Returns:
            List of attachment info dicts
        """
        self._ensure_service()

        # Build search query
        query = "has:attachment"
        if only_unread:
            query += " is:unread"

        # Get message list
        results = self._service.users().messages().list(
            userId='me',
            q=query,
            maxResults=max_results
        ).execute()

        messages = results.get('messages', [])
        attachments = []

        for msg_info in messages:
            msg_id = msg_info['id']

            # Skip already processed
            if msg_id in self._processed_ids:
                continue

            # Get full message
            message = self._service.users().messages().get(
                userId='me',
                id=msg_id,
                format='full'
            ).execute()

            # Extract attachment info
            msg_attachments = self._extract_audio_attachments(message)
            if msg_attachments:
                attachments.extend(msg_attachments)

        logger.info(f"Found {len(attachments)} audio attachments")
        return attachments

    def _extract_audio_attachments(self, message: dict) -> List[Dict[str, Any]]:
        """Extract audio attachment info from a message."""
        attachments = []
        msg_id = message['id']

        # Get sender and subject from headers
        headers = {h['name']: h['value'] for h in message['payload'].get('headers', [])}
        sender = headers.get('From', 'Unknown')
        subject = headers.get('Subject', 'No Subject')

        # Check all parts for attachments
        parts = message['payload'].get('parts', [])
        for part in parts:
            filename = part.get('filename', '')
            if not filename:
                continue

            # Check if it's an audio file
            ext = Path(filename).suffix.lower()
            if ext not in AUDIO_EXTENSIONS:
                continue

            attachment_id = part['body'].get('attachmentId')
            if not attachment_id:
                continue

            attachments.append({
                'message_id': msg_id,
                'attachment_id': attachment_id,
                'filename': filename,
                'mime_type': part.get('mimeType', 'audio/mpeg'),
                'size': int(part['body'].get('size', 0)),
                'sender': sender,
                'subject': subject
            })

        return attachments

    async def download_attachment(
        self,
        message_id: str,
        attachment_id: str,
        filename: str
    ) -> Path:
        """
        Download an attachment to local storage.

        Args:
            message_id: Gmail message ID
            attachment_id: Attachment ID within message
            filename: Original filename

        Returns:
            Path to downloaded file
        """
        self._ensure_service()

        # Get attachment data
        attachment = self._service.users().messages().attachments().get(
            userId='me',
            messageId=message_id,
            id=attachment_id
        ).execute()

        # Decode base64 data
        data = base64.urlsafe_b64decode(attachment['data'])

        # Save to file
        local_path = self.download_dir / filename
        local_path.write_bytes(data)

        logger.info(f"Downloaded attachment: {filename}")
        return local_path

    async def mark_as_processed(self, message_id: str, add_label: bool = True):
        """
        Mark a message as processed.

        Args:
            message_id: Gmail message ID
            add_label: Whether to add a "Processed" label
        """
        self._ensure_service()

        # Track locally
        self._processed_ids.add(message_id)

        # Mark as read
        self._service.users().messages().modify(
            userId='me',
            id=message_id,
            body={'removeLabelIds': ['UNREAD']}
        ).execute()

        # Optionally add a label
        if add_label:
            # First, ensure the label exists
            label_name = "RadioManager/Processed"
            label_id = await self._get_or_create_label(label_name)
            if label_id:
                self._service.users().messages().modify(
                    userId='me',
                    id=message_id,
                    body={'addLabelIds': [label_id]}
                ).execute()

        logger.info(f"Marked message {message_id} as processed")

    async def _get_or_create_label(self, label_name: str) -> Optional[str]:
        """Get or create a Gmail label."""
        try:
            # List existing labels
            results = self._service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])

            # Check if label exists
            for label in labels:
                if label['name'] == label_name:
                    return label['id']

            # Create new label
            label_body = {
                'name': label_name,
                'labelListVisibility': 'labelShow',
                'messageListVisibility': 'show'
            }
            created = self._service.users().labels().create(
                userId='me',
                body=label_body
            ).execute()

            return created['id']

        except Exception as e:
            logger.error(f"Failed to get/create label: {e}")
            return None

    async def get_unprocessed_count(self) -> int:
        """Get count of unread emails with attachments."""
        self._ensure_service()

        results = self._service.users().messages().list(
            userId='me',
            q="has:attachment is:unread",
            maxResults=1
        ).execute()

        return results.get('resultSizeEstimate', 0)
