"""Google Drive Service for file storage and retrieval."""

import io
import logging
from typing import Optional, List, Dict, Any
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.oauth2 import service_account
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaFileUpload

logger = logging.getLogger(__name__)

# Google Drive API scopes
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
]


class GoogleDriveService:
    """
    Service for interacting with Google Drive.

    Handles authentication, file listing, downloading, and uploading
    for the radio content folders.
    """

    def __init__(
        self,
        credentials_path: str = "credentials.json",
        token_path: str = "token.json",
        service_account_file: Optional[str] = None,
        root_folder_id: Optional[str] = None,
        cache_dir: str = "./cache"
    ):
        self.credentials_path = credentials_path
        self.token_path = token_path
        self.service_account_file = service_account_file
        self.root_folder_id = root_folder_id
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self._service = None
        self._credentials = None

    def _get_credentials(self):
        """Get credentials - tries service account first, then OAuth."""
        # Try service account first (preferred for server apps)
        if self.service_account_file and Path(self.service_account_file).exists():
            logger.info(f"Using service account: {self.service_account_file}")
            return service_account.Credentials.from_service_account_file(
                self.service_account_file,
                scopes=SCOPES
            )

        # Fall back to OAuth
        creds = None

        # Load existing token
        if Path(self.token_path).exists():
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)

        # Refresh or get new credentials
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not Path(self.credentials_path).exists():
                    raise FileNotFoundError(
                        f"No credentials found. Either:\n"
                        f"1. Create a service account and save to: {self.service_account_file}\n"
                        f"2. Or download OAuth credentials to: {self.credentials_path}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save credentials for next run (may fail if file is read-only, e.g., in Cloud Run)
            try:
                with open(self.token_path, 'w') as token:
                    token.write(creds.to_json())
            except (OSError, IOError) as e:
                logger.warning(f"Could not save token file (read-only?): {e}")

        return creds

    def _ensure_service(self):
        """Ensure Drive service is initialized."""
        if self._service is None:
            self._credentials = self._get_credentials()
            self._service = build('drive', 'v3', credentials=self._credentials)
            logger.info("Google Drive service initialized")

    def authenticate(self):
        """
        Authenticate with Google Drive API.

        This will trigger OAuth flow if no valid token exists.
        Call this at startup to ensure Drive access is ready.
        """
        self._ensure_service()
        return self._service is not None

    async def list_folders(self, parent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List folders within a parent folder.

        Args:
            parent_id: Parent folder ID (uses root if None)

        Returns:
            List of folder metadata
        """
        self._ensure_service()

        folder_id = parent_id or self.root_folder_id
        if not folder_id:
            raise ValueError("No folder ID specified")

        query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

        results = self._service.files().list(
            q=query,
            fields="files(id, name, modifiedTime)",
            orderBy="name"
        ).execute()

        folders = results.get('files', [])
        logger.info(f"Found {len(folders)} folders in {folder_id}")
        return folders

    async def list_files(
        self,
        folder_id: Optional[str] = None,
        mime_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        List files within a folder.

        Args:
            folder_id: Folder ID to list files from
            mime_types: Filter by MIME types (e.g., ['audio/mpeg'])

        Returns:
            List of file metadata
        """
        self._ensure_service()

        fid = folder_id or self.root_folder_id
        if not fid:
            raise ValueError("No folder ID specified")

        query = f"'{fid}' in parents and trashed=false"

        if mime_types:
            mime_query = " or ".join([f"mimeType='{mt}'" for mt in mime_types])
            query += f" and ({mime_query})"

        results = self._service.files().list(
            q=query,
            fields="files(id, name, mimeType, size, modifiedTime)",
            orderBy="name"
        ).execute()

        files = results.get('files', [])
        logger.info(f"Found {len(files)} files in {fid}")
        return files

    async def list_audio_files(self, folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List only audio files (MP3, WAV, etc.)."""
        audio_types = [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/x-wav',
            'audio/aac',
            'audio/ogg',
            'audio/m4a',
            'audio/x-m4a',
        ]
        return await self.list_files(folder_id, audio_types)

    async def download_file(
        self,
        file_id: str,
        filename: Optional[str] = None
    ) -> Path:
        """
        Download a file to the local cache.

        Args:
            file_id: Google Drive file ID
            filename: Optional local filename

        Returns:
            Path to the downloaded file
        """
        self._ensure_service()

        # Get file metadata if filename not provided
        if not filename:
            file_meta = self._service.files().get(fileId=file_id).execute()
            filename = file_meta['name']

        local_path = self.cache_dir / filename

        # Check if already cached
        if local_path.exists():
            logger.info(f"File already cached: {filename}")
            return local_path

        # Download file
        request = self._service.files().get_media(fileId=file_id)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logger.debug(f"Download progress: {int(status.progress() * 100)}%")

        # Write to file
        local_path.write_bytes(fh.getvalue())
        logger.info(f"Downloaded: {filename} -> {local_path}")

        return local_path

    def download_to_stream(self, file_id: str) -> io.BytesIO:
        """
        Download a file directly to memory (no local file).

        This is used for direct Drive→GCS streaming without local storage.

        Args:
            file_id: Google Drive file ID

        Returns:
            BytesIO stream containing file content
        """
        self._ensure_service()

        request = self._service.files().get_media(fileId=file_id)
        stream = io.BytesIO()
        downloader = MediaIoBaseDownload(stream, request)

        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                logger.debug(f"Stream download progress: {int(status.progress() * 100)}%")

        stream.seek(0)  # Reset to beginning for reading
        logger.info(f"Downloaded {file_id} to memory stream ({stream.getbuffer().nbytes} bytes)")
        return stream

    async def upload_file(
        self,
        local_path: str,
        folder_id: str,
        filename: Optional[str] = None,
        mime_type: str = 'audio/mpeg'
    ) -> Dict[str, Any]:
        """
        Upload a file to Google Drive.

        Args:
            local_path: Path to local file
            folder_id: Destination folder ID
            filename: Optional filename (uses local filename if None)
            mime_type: MIME type of the file

        Returns:
            Uploaded file metadata
        """
        self._ensure_service()

        path = Path(local_path)
        name = filename or path.name

        file_metadata = {
            'name': name,
            'parents': [folder_id]
        }

        media = MediaFileUpload(str(path), mimetype=mime_type, resumable=True)

        file = self._service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()

        logger.info(f"Uploaded: {name} -> {file.get('id')}")
        return file

    async def get_folder_structure(self) -> Dict[str, Any]:
        """
        Get the expected folder structure for radio content.

        Returns:
            Nested dictionary of folders
        """
        self._ensure_service()

        if not self.root_folder_id:
            raise ValueError("Root folder ID not configured")

        structure = {
            "id": self.root_folder_id,
            "name": "Radio Content",
            "children": {}
        }

        # Get top-level folders (Songs, Shows, Commercials)
        top_folders = await self.list_folders(self.root_folder_id)

        for folder in top_folders:
            folder_name = folder['name']
            structure["children"][folder_name] = {
                "id": folder['id'],
                "name": folder_name,
                "children": {}
            }

            # Get subfolders (genres for Songs, show names for Shows)
            subfolders = await self.list_folders(folder['id'])
            for subfolder in subfolders:
                structure["children"][folder_name]["children"][subfolder['name']] = {
                    "id": subfolder['id'],
                    "name": subfolder['name']
                }

        return structure

    async def find_folder_by_path(self, path: str) -> Optional[str]:
        """
        Find a folder ID by path (e.g., "Songs/Mizrahi").

        Args:
            path: Folder path relative to root

        Returns:
            Folder ID if found
        """
        self._ensure_service()

        parts = path.strip('/').split('/')
        current_id = self.root_folder_id

        for part in parts:
            folders = await self.list_folders(current_id)
            found = next((f for f in folders if f['name'] == part), None)
            if not found:
                return None
            current_id = found['id']

        return current_id

    def clear_cache(self, max_age_hours: int = 24):
        """
        Clear old files from the cache.

        Args:
            max_age_hours: Remove files older than this
        """
        import time

        now = time.time()
        max_age_seconds = max_age_hours * 3600

        for file_path in self.cache_dir.iterdir():
            if file_path.is_file():
                age = now - file_path.stat().st_mtime
                if age > max_age_seconds:
                    file_path.unlink()
                    logger.info(f"Removed from cache: {file_path.name}")
