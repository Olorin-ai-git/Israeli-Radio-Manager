"""Content synchronization service for Google Drive."""

import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorDatabase
from mutagen import File as MutagenFile
from mutagen.easyid3 import EasyID3

from app.services.google_drive import GoogleDriveService

logger = logging.getLogger(__name__)


class ContentSyncService:
    """
    Service for synchronizing content from Google Drive to local cache and database.

    Expected folder structure in Google Drive:
    - Songs/
      - Mizrahi/
      - Pop/
      - Rock/
      - etc.
    - Shows/
      - Morning Show/
      - Evening Show/
      - etc.
    - Commercials/
    """

    # Map folder names to content types
    CONTENT_TYPE_FOLDERS = {
        "songs": "song",
        "שירים": "song",
        "shows": "show",
        "תוכניות": "show",
        "commercials": "commercial",
        "פרסומות": "commercial",
    }

    def __init__(
        self,
        db: AsyncIOMotorDatabase,
        drive_service: GoogleDriveService
    ):
        self.db = db
        self.drive = drive_service

    async def sync_all(self, download_files: bool = False) -> Dict[str, Any]:
        """
        Sync all content from Google Drive.

        Args:
            download_files: If True, download all files to cache

        Returns:
            Sync statistics
        """
        stats = {
            "folders_scanned": 0,
            "files_found": 0,
            "files_added": 0,
            "files_updated": 0,
            "files_downloaded": 0,
            "errors": []
        }

        try:
            # Get folder structure
            structure = await self.drive.get_folder_structure()
            logger.info(f"Found folder structure: {list(structure.get('children', {}).keys())}")

            # Process each top-level folder
            for folder_name, folder_info in structure.get("children", {}).items():
                folder_lower = folder_name.lower()
                content_type = self.CONTENT_TYPE_FOLDERS.get(folder_lower)

                if not content_type:
                    logger.info(f"Skipping unknown folder: {folder_name}")
                    continue

                logger.info(f"Processing {content_type} folder: {folder_name}")
                stats["folders_scanned"] += 1

                # For songs, process subfolders (genres)
                if content_type == "song" and folder_info.get("children"):
                    for genre_name, genre_info in folder_info["children"].items():
                        logger.info(f"Processing genre folder: {genre_name}")
                        # Recursively sync this genre folder and all subfolders
                        genre_stats = await self._sync_folder_recursive(
                            genre_info["id"],
                            content_type,
                            genre=genre_name,
                            download=download_files
                        )
                        self._merge_stats(stats, genre_stats)
                elif content_type == "show" and folder_info.get("children"):
                    # Process show subfolders (episodes)
                    for show_name, show_info in folder_info["children"].items():
                        logger.info(f"Processing show folder: {show_name}")
                        sub_stats = await self._sync_folder(
                            show_info["id"],
                            content_type,
                            show_name=show_name,
                            download=download_files
                        )
                        self._merge_stats(stats, sub_stats)
                        stats["folders_scanned"] += 1
                elif content_type == "commercial" and folder_info.get("children"):
                    # Process commercial batch subfolders
                    for batch_folder_name, batch_info in folder_info["children"].items():
                        # Extract batch number from folder name (e.g., "Batch-1", "batch1", "1")
                        batch_number = self._extract_batch_number(batch_folder_name)
                        logger.info(f"Processing commercial batch folder: {batch_folder_name} -> batch {batch_number}")
                        sub_stats = await self._sync_folder(
                            batch_info["id"],
                            content_type,
                            batch_number=batch_number,
                            download=download_files
                        )
                        self._merge_stats(stats, sub_stats)
                        stats["folders_scanned"] += 1
                else:
                    # Process directly (flat folder structure)
                    folder_stats = await self._sync_folder(
                        folder_info["id"],
                        content_type,
                        download=download_files
                    )
                    self._merge_stats(stats, folder_stats)

        except Exception as e:
            logger.error(f"Sync error: {e}")
            stats["errors"].append(str(e))

        logger.info(f"Sync complete: {stats}")
        return stats

    async def _sync_folder_recursive(
        self,
        folder_id: str,
        content_type: str,
        genre: Optional[str] = None,
        artist_name: Optional[str] = None,
        download: bool = False,
        depth: int = 0
    ) -> Dict[str, Any]:
        """
        Recursively sync a folder and all its subfolders.
        For songs: genre comes from top-level folder, artist from subfolders.
        """
        stats = {
            "folders_scanned": 1,
            "files_found": 0,
            "files_added": 0,
            "files_updated": 0,
            "files_downloaded": 0,
            "errors": []
        }

        indent = "  " * depth
        logger.info(f"{indent}Scanning folder (genre={genre}, artist={artist_name})")

        # Sync files in this folder
        folder_stats = await self._sync_folder(
            folder_id,
            content_type,
            genre=genre,
            artist_name=artist_name,
            download=download
        )
        self._merge_stats(stats, folder_stats)

        # Get subfolders and recursively process them
        try:
            subfolders = await self.drive.list_folders(folder_id)
            for subfolder in subfolders:
                subfolder_name = subfolder["name"]
                # Use subfolder name as artist if we don't already have one
                sub_artist = artist_name or subfolder_name
                logger.info(f"{indent}Found subfolder: {subfolder_name} (artist: {sub_artist})")

                sub_stats = await self._sync_folder_recursive(
                    subfolder["id"],
                    content_type,
                    genre=genre,
                    artist_name=sub_artist,
                    download=download,
                    depth=depth + 1
                )
                self._merge_stats(stats, sub_stats)
        except Exception as e:
            logger.error(f"Error listing subfolders: {e}")
            stats["errors"].append(str(e))

        return stats

    def _extract_batch_number(self, folder_name: str) -> Optional[int]:
        """Extract batch number from folder name like 'Batch-1', 'Batch-A', 'batch1', '1', etc."""
        import re
        # Try patterns: "Batch-1", "Batch1", "batch-1", "batch1", or just "1" (numbers)
        match = re.search(r'batch[_-]?(\d+)|^(\d+)$', folder_name, re.IGNORECASE)
        if match:
            return int(match.group(1) or match.group(2))

        # Try letter patterns: "Batch-A", "Batch-B" -> 1, 2, etc.
        match = re.search(r'batch[_-]?([A-Za-z])$', folder_name, re.IGNORECASE)
        if match:
            letter = match.group(1).upper()
            return ord(letter) - ord('A') + 1  # A=1, B=2, C=3, etc.

        return None

    async def _sync_folder(
        self,
        folder_id: str,
        content_type: str,
        genre: Optional[str] = None,
        show_name: Optional[str] = None,
        artist_name: Optional[str] = None,
        batch_number: Optional[int] = None,
        download: bool = False
    ) -> Dict[str, Any]:
        """Sync a single folder."""
        stats = {
            "files_found": 0,
            "files_added": 0,
            "files_updated": 0,
            "files_downloaded": 0,
            "errors": []
        }

        try:
            files = await self.drive.list_audio_files(folder_id)
            stats["files_found"] = len(files)

            for file_info in files:
                try:
                    result = await self._process_file(
                        file_info,
                        content_type,
                        genre=genre,
                        show_name=show_name,
                        artist_name=artist_name,
                        batch_number=batch_number,
                        download=download
                    )

                    if result == "added":
                        stats["files_added"] += 1
                    elif result == "updated":
                        stats["files_updated"] += 1

                    if download and result in ("added", "updated"):
                        stats["files_downloaded"] += 1

                except Exception as e:
                    logger.error(f"Error processing file {file_info['name']}: {e}")
                    stats["errors"].append(f"{file_info['name']}: {str(e)}")

        except Exception as e:
            logger.error(f"Error listing folder {folder_id}: {e}")
            stats["errors"].append(str(e))

        return stats

    async def _process_file(
        self,
        file_info: Dict[str, Any],
        content_type: str,
        genre: Optional[str] = None,
        show_name: Optional[str] = None,
        artist_name: Optional[str] = None,
        batch_number: Optional[int] = None,
        download: bool = False
    ) -> str:
        """
        Process a single file from Google Drive.

        Returns: "added", "updated", or "unchanged"
        """
        drive_id = file_info["id"]
        filename = file_info["name"]

        # Check if already in database
        existing = await self.db.content.find_one({"google_drive_id": drive_id})

        # Download file if requested or if we need metadata
        local_path = None
        if download or not existing:
            local_path = await self.drive.download_file(drive_id, filename)

        # Extract metadata if we have a local file
        metadata = {}
        if local_path and local_path.exists():
            metadata = self._extract_metadata(local_path)

        # Build content document
        # Use artist from metadata, or from folder name if provided
        content_doc = {
            "google_drive_id": drive_id,
            "google_drive_path": filename,
            "type": content_type,
            "title": metadata.get("title") or self._title_from_filename(filename),
            "artist": metadata.get("artist") or artist_name,
            "genre": genre or metadata.get("genre"),
            "duration_seconds": metadata.get("duration", 0),
            "local_cache_path": str(local_path) if local_path else None,
            "metadata": {
                "album": metadata.get("album"),
                "year": metadata.get("year"),
                "language": "hebrew",  # Default for this radio
                "tags": [],
            },
            "active": True,
            "updated_at": datetime.utcnow()
        }

        if show_name:
            content_doc["show_name"] = show_name

        if existing:
            # Update existing record
            update_ops = {"$set": content_doc}

            # For commercials with batch_number, add to batches array (not replace)
            if batch_number is not None and content_type == "commercial":
                update_ops["$addToSet"] = {"batches": batch_number}

            await self.db.content.update_one(
                {"_id": existing["_id"]},
                update_ops
            )
            return "updated"
        else:
            # Insert new record
            content_doc["created_at"] = datetime.utcnow()
            content_doc["play_count"] = 0
            content_doc["last_played"] = None

            # For commercials, initialize batches array
            if batch_number is not None and content_type == "commercial":
                content_doc["batches"] = [batch_number]

            await self.db.content.insert_one(content_doc)
            return "added"

    def _extract_metadata(self, file_path: Path) -> Dict[str, Any]:
        """Extract metadata from audio file using mutagen."""
        metadata = {}

        try:
            audio = MutagenFile(str(file_path), easy=True)
            if audio is None:
                return metadata

            # Get basic tags
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

            # Get duration
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

    def _title_from_filename(self, filename: str) -> str:
        """Extract title from filename."""
        # Remove extension
        name = Path(filename).stem
        # Replace underscores and dashes with spaces
        name = name.replace("_", " ").replace("-", " ")
        # Remove common prefixes like track numbers
        import re
        name = re.sub(r"^\d+[\s\.\-_]+", "", name)
        return name.strip()

    def _merge_stats(self, target: Dict, source: Dict):
        """Merge statistics dictionaries."""
        for key in ["files_found", "files_added", "files_updated", "files_downloaded"]:
            target[key] = target.get(key, 0) + source.get(key, 0)
        target["errors"].extend(source.get("errors", []))

    async def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync status."""
        total = await self.db.content.count_documents({})
        by_type = {}
        for content_type in ["song", "show", "commercial"]:
            by_type[content_type] = await self.db.content.count_documents({"type": content_type})

        cached = await self.db.content.count_documents({"local_cache_path": {"$ne": None}})

        return {
            "total_content": total,
            "by_type": by_type,
            "cached_locally": cached,
            "drive_folder_id": self.drive.root_folder_id
        }

    async def download_for_playback(self, content_id: str) -> Optional[Path]:
        """
        Ensure a content item is downloaded and ready for playback.

        Args:
            content_id: MongoDB content ID

        Returns:
            Path to the local file, or None if not found
        """
        from bson import ObjectId

        content = await self.db.content.find_one({"_id": ObjectId(content_id)})
        if not content:
            logger.error(f"Content not found: {content_id}")
            return None

        # Check if already cached
        if content.get("local_cache_path"):
            local_path = Path(content["local_cache_path"])
            if local_path.exists():
                return local_path

        # Download from Google Drive
        drive_id = content.get("google_drive_id")
        if not drive_id:
            logger.error(f"No Google Drive ID for content: {content_id}")
            return None

        try:
            local_path = await self.drive.download_file(drive_id)

            # Update database with cache path
            await self.db.content.update_one(
                {"_id": ObjectId(content_id)},
                {"$set": {"local_cache_path": str(local_path)}}
            )

            return local_path

        except Exception as e:
            logger.error(f"Failed to download content {content_id}: {e}")
            return None
