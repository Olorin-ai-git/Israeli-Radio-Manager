"""File organization utilities."""

import logging
import shutil
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class FileOrganizer:
    """
    Organizes audio files into the appropriate folder structure.

    Maps content types and genres to Google Drive folder paths.
    """

    # Hebrew genre mappings
    GENRE_MAPPINGS = {
        # English to folder name
        "pop": "Pop",
        "rock": "Rock",
        "mizrahi": "Mizrahi",
        "mizrachi": "Mizrahi",
        "classical": "Classical",
        "classic israeli": "Classic Israeli",
        "religious": "Religious",
        "dance": "Dance",
        "hip hop": "Hip Hop",
        "rap": "Hip Hop",
        "electronic": "Electronic",
        "jazz": "Jazz",
        "folk": "Folk",
        "world": "World",
        "children": "Children",
        "kids": "Children",

        # Hebrew genre names
        "מזרחי": "Mizrahi",
        "פופ": "Pop",
        "רוק": "Rock",
        "קלאסי": "Classical",
        "ישראלי": "Classic Israeli",
        "דתי": "Religious",
        "ריקודים": "Dance",
        "היפ הופ": "Hip Hop",
        "ג'אז": "Jazz",
        "ילדים": "Children",
    }

    def __init__(self, base_path: str = "./content"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

        # Create standard folder structure
        self._ensure_structure()

    def _ensure_structure(self):
        """Ensure the standard folder structure exists."""
        folders = [
            "Songs",
            "Songs/Pop",
            "Songs/Rock",
            "Songs/Mizrahi",
            "Songs/Classical",
            "Songs/Classic Israeli",
            "Songs/Religious",
            "Songs/Dance",
            "Songs/Uncategorized",
            "Shows",
            "Commercials",
            "Commercials/Active",
            "Commercials/Archive",
            "Uploads",
            "Review",
        ]

        for folder in folders:
            (self.base_path / folder).mkdir(parents=True, exist_ok=True)

    def get_folder_path(
        self,
        content_type: str,
        genre: Optional[str] = None,
        show_name: Optional[str] = None
    ) -> Path:
        """
        Get the appropriate folder path for content.

        Args:
            content_type: "song", "show", or "commercial"
            genre: Genre name for songs
            show_name: Show name for shows

        Returns:
            Path to the folder
        """
        if content_type == "song":
            if genre:
                normalized = self._normalize_genre(genre)
                return self.base_path / "Songs" / normalized
            return self.base_path / "Songs" / "Uncategorized"

        elif content_type == "show":
            if show_name:
                show_folder = self.base_path / "Shows" / show_name
                show_folder.mkdir(parents=True, exist_ok=True)
                return show_folder
            return self.base_path / "Shows"

        elif content_type == "commercial":
            return self.base_path / "Commercials" / "Active"

        else:
            return self.base_path / "Review"

    def _normalize_genre(self, genre: str) -> str:
        """Normalize genre name to folder name."""
        genre_lower = genre.lower().strip()

        if genre_lower in self.GENRE_MAPPINGS:
            return self.GENRE_MAPPINGS[genre_lower]

        # Title case for unknown genres
        return genre.title()

    def move_file(
        self,
        source_path: str,
        content_type: str,
        genre: Optional[str] = None,
        new_name: Optional[str] = None
    ) -> Path:
        """
        Move a file to its appropriate folder.

        Args:
            source_path: Current file path
            content_type: Content type
            genre: Genre for songs
            new_name: Optional new filename

        Returns:
            New file path
        """
        source = Path(source_path)
        if not source.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")

        dest_folder = self.get_folder_path(content_type, genre)
        dest_name = new_name or source.name
        dest_path = dest_folder / dest_name

        # Handle name conflicts
        if dest_path.exists():
            base = dest_path.stem
            suffix = dest_path.suffix
            counter = 1
            while dest_path.exists():
                dest_path = dest_folder / f"{base}_{counter}{suffix}"
                counter += 1

        shutil.move(str(source), str(dest_path))
        logger.info(f"Moved {source.name} to {dest_path}")

        return dest_path

    def get_folder_contents(
        self,
        content_type: str,
        genre: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get contents of a folder.

        Returns:
            Dict with folder info and file list
        """
        folder = self.get_folder_path(content_type, genre)

        files = []
        for file_path in folder.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in [
                ".mp3", ".wav", ".m4a", ".aac", ".ogg"
            ]:
                files.append({
                    "name": file_path.name,
                    "path": str(file_path),
                    "size": file_path.stat().st_size,
                    "modified": file_path.stat().st_mtime
                })

        subfolders = []
        for item in folder.iterdir():
            if item.is_dir():
                subfolders.append(item.name)

        return {
            "path": str(folder),
            "files": sorted(files, key=lambda x: x["name"]),
            "file_count": len(files),
            "subfolders": sorted(subfolders)
        }

    def get_all_genres(self) -> list:
        """Get list of all genre folders."""
        songs_folder = self.base_path / "Songs"
        genres = []

        for item in songs_folder.iterdir():
            if item.is_dir():
                genres.append(item.name)

        return sorted(genres)
