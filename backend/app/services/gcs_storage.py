"""Google Cloud Storage service for audio file storage and streaming."""

import io
import logging
from datetime import timedelta
from pathlib import Path
from typing import Optional, BinaryIO
from urllib.parse import quote

from google.cloud import storage
from google.cloud.storage import Blob

from app.config import settings

logger = logging.getLogger(__name__)


class GCSStorageService:
    """
    Service for storing and streaming audio files from Google Cloud Storage.

    Uses signed URLs for secure, time-limited access to audio files.
    """

    def __init__(self):
        """Initialize GCS client."""
        self.client = None
        self.bucket = None
        self.bucket_name = settings.gcs_bucket_name
        self.signed_url_expiry = timedelta(hours=settings.gcs_signed_url_expiry_hours)
        self._initialized = False

        try:
            # Try to use service account file if it exists
            import os
            service_account_path = None
            
            # Check multiple possible locations
            possible_paths = [
                settings.google_service_account_file,  # Relative path from config
                os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), settings.google_service_account_file),  # backend/service-account.json
                "/Users/olorin/Documents/Israeli-Radio-Manager/backend/service-account.json",  # Absolute path
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    service_account_path = path
                    logger.info(f"Found service account file at: {path}")
                    break
            
            # Initialize client with credentials
            if service_account_path:
                from google.oauth2 import service_account
                credentials = service_account.Credentials.from_service_account_file(
                    service_account_path,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                self.client = storage.Client(credentials=credentials, project=credentials.project_id)
                logger.info(f"GCS client initialized with service account: {service_account_path}")
            else:
                # Fall back to default credentials (ADC)
                self.client = storage.Client()
                logger.info("GCS client initialized with default credentials")
            
            self.bucket = self.client.bucket(self.bucket_name)
            self._initialized = True
            logger.info(f"GCS service initialized with bucket: {self.bucket_name}")
            
        except Exception as e:
            logger.warning(f"GCS service initialization failed: {e}. GCS features will be unavailable.")
            logger.warning(f"Tried paths: {possible_paths if 'possible_paths' in locals() else 'none'}")

    @property
    def is_available(self) -> bool:
        """Check if GCS is available."""
        return self._initialized and self.client is not None and self.bucket is not None

    def _get_blob_path(self, content_type: str, filename: str) -> str:
        """
        Generate the blob path for a file.

        Structure: {content_type}/{filename}
        Examples:
            - songs/artist_name/song.mp3
            - commercials/batch1/ad.mp3
            - emergency/song.mp3
        """
        # Sanitize filename for GCS
        safe_filename = quote(filename, safe='/')
        return f"{content_type}/{safe_filename}"

    async def upload_file(
        self,
        local_path: Path,
        content_type: str,
        filename: str,
        metadata: Optional[dict] = None
    ) -> Optional[str]:
        """
        Upload a file to GCS.

        Args:
            local_path: Path to local file
            content_type: Type of content (song, commercial, show, emergency)
            filename: Original filename
            metadata: Optional metadata to attach

        Returns:
            GCS path (gs://bucket/path) or None if failed
        """
        if not self.is_available:
            logger.warning("GCS not available - skipping upload")
            return None

        try:
            blob_path = self._get_blob_path(content_type, filename)
            blob = self.bucket.blob(blob_path)

            # Set content type for proper streaming
            content_type_map = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
            }
            suffix = local_path.suffix.lower()
            blob.content_type = content_type_map.get(suffix, 'audio/mpeg')

            # Add custom metadata
            if metadata:
                blob.metadata = metadata

            # Upload file
            blob.upload_from_filename(str(local_path))

            gcs_path = f"gs://{self.bucket_name}/{blob_path}"
            logger.info(f"Uploaded {filename} to {gcs_path}")
            return gcs_path

        except Exception as e:
            logger.error(f"Failed to upload {filename} to GCS: {e}")
            return None

    def upload_from_stream(
        self,
        stream: BinaryIO,
        folder: str,
        filename: str,
        file_extension: str = ".mp3",
        metadata: Optional[dict] = None
    ) -> Optional[str]:
        """
        Upload directly from a stream (no local file needed).

        This enables direct Drive→GCS transfer without local download.

        Args:
            stream: File-like object with read() method
            folder: GCS folder (e.g., "songs/Mizrahi", "commercials/batch1")
            filename: Original filename
            file_extension: File extension for content-type detection
            metadata: Optional metadata to attach

        Returns:
            GCS path (gs://bucket/path) or None if failed
        """
        if not self.is_available:
            logger.warning("GCS not available - skipping upload")
            return None

        try:
            blob_path = self._get_blob_path(folder, filename)
            blob = self.bucket.blob(blob_path)

            # Set content type for proper streaming
            content_type_map = {
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/wav',
                '.ogg': 'audio/ogg',
                '.m4a': 'audio/mp4',
                '.aac': 'audio/aac',
            }
            blob.content_type = content_type_map.get(file_extension.lower(), 'audio/mpeg')

            # Add custom metadata
            if metadata:
                blob.metadata = metadata

            # Upload from stream
            blob.upload_from_file(stream, rewind=True)

            gcs_path = f"gs://{self.bucket_name}/{blob_path}"
            logger.info(f"Uploaded {filename} to {gcs_path} (streamed)")
            return gcs_path

        except Exception as e:
            logger.error(f"Failed to stream upload {filename} to GCS: {e}")
            return None

    def get_signed_url(self, gcs_path: str) -> Optional[str]:
        """
        Generate a signed URL for streaming a file.

        Args:
            gcs_path: GCS path (gs://bucket/path or just path)

        Returns:
            Signed URL valid for configured expiry time, or None if failed
        """
        if not self.is_available:
            return None

        try:
            # Extract blob path from gs:// URL if needed
            if gcs_path.startswith('gs://'):
                # gs://bucket/path -> path
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return None
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            blob = self.bucket.blob(blob_path)

            # Generate signed URL
            url = blob.generate_signed_url(
                version="v4",
                expiration=self.signed_url_expiry,
                method="GET",
                response_disposition="inline",  # Stream in browser, don't download
            )

            return url

        except Exception as e:
            logger.error(f"Failed to generate signed URL for {gcs_path}: {e}")
            return None

    def get_public_url(self, gcs_path: str) -> Optional[str]:
        """
        Get the public URL for a GCS file.

        This works for publicly accessible buckets (allUsers have read access).
        No signing required.

        Args:
            gcs_path: GCS path (gs://bucket/path or just path)

        Returns:
            Public URL string, or None if unavailable
        """
        if not self.is_available:
            return None

        try:
            # Extract blob path from gs:// URL if needed
            if gcs_path.startswith('gs://'):
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return None
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            # URL encode the path for special characters (Hebrew, spaces)
            from urllib.parse import quote
            encoded_path = quote(blob_path, safe='/')

            # Public URL format
            return f"https://storage.googleapis.com/{self.bucket_name}/{encoded_path}"

        except Exception as e:
            logger.error(f"Failed to get public URL for {gcs_path}: {e}")
            return None

    async def delete_file(self, gcs_path: str) -> bool:
        """
        Delete a file from GCS.

        Args:
            gcs_path: GCS path (gs://bucket/path or just path)

        Returns:
            True if deleted, False otherwise
        """
        if not self.is_available:
            return False

        try:
            if gcs_path.startswith('gs://'):
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return False
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            blob = self.bucket.blob(blob_path)
            blob.delete()
            logger.info(f"Deleted {gcs_path}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete {gcs_path}: {e}")
            return False

    def file_exists(self, gcs_path: str) -> bool:
        """Check if a file exists in GCS."""
        if not self.is_available:
            return False

        try:
            if gcs_path.startswith('gs://'):
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return False
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            blob = self.bucket.blob(blob_path)
            return blob.exists()

        except Exception as e:
            logger.error(f"Failed to check if {gcs_path} exists: {e}")
            return False

    async def list_files(self, prefix: str = "") -> list[dict]:
        """
        List files in GCS bucket.

        Args:
            prefix: Optional prefix to filter by (e.g., "emergency/")

        Returns:
            List of file info dicts with name, size, updated
        """
        if not self.is_available:
            return []

        try:
            blobs = self.bucket.list_blobs(prefix=prefix)
            files = []
            for blob in blobs:
                files.append({
                    "name": blob.name,
                    "size": blob.size,
                    "updated": blob.updated,
                    "content_type": blob.content_type,
                    "gcs_path": f"gs://{self.bucket_name}/{blob.name}"
                })
            return files

        except Exception as e:
            logger.error(f"Failed to list files with prefix {prefix}: {e}")
            return []

    def stream_file(self, gcs_path: str) -> Optional[tuple]:
        """
        Stream a file directly from GCS.

        Args:
            gcs_path: GCS path (gs://bucket/path or just path)

        Returns:
            Tuple of (blob content iterator, content_type, size) or None if failed
        """
        if not self.is_available:
            return None

        try:
            # Extract blob path from gs:// URL if needed
            if gcs_path.startswith('gs://'):
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return None
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            blob = self.bucket.blob(blob_path)

            # Check if blob exists
            if not blob.exists():
                logger.warning(f"Blob not found: {blob_path}")
                return None

            # Get blob metadata
            blob.reload()
            content_type = blob.content_type or 'audio/mpeg'
            size = blob.size

            # Download as bytes
            content = blob.download_as_bytes()

            return (content, content_type, size)

        except Exception as e:
            logger.error(f"Failed to stream file {gcs_path}: {e}")
            return None

    async def copy_to_emergency(self, gcs_path: str) -> Optional[str]:
        """
        Copy a file to the emergency playlist folder.

        Args:
            gcs_path: Source GCS path

        Returns:
            New GCS path in emergency folder, or None if failed
        """
        if not self.is_available:
            return None

        try:
            if gcs_path.startswith('gs://'):
                parts = gcs_path.replace('gs://', '').split('/', 1)
                if len(parts) < 2:
                    return None
                blob_path = parts[1]
            else:
                blob_path = gcs_path

            source_blob = self.bucket.blob(blob_path)

            # Get just the filename
            filename = blob_path.split('/')[-1]
            dest_path = f"emergency/{filename}"

            # Copy to emergency folder
            self.bucket.copy_blob(source_blob, self.bucket, dest_path)

            new_path = f"gs://{self.bucket_name}/{dest_path}"
            logger.info(f"Copied {gcs_path} to {new_path}")
            return new_path

        except Exception as e:
            logger.error(f"Failed to copy {gcs_path} to emergency: {e}")
            return None
