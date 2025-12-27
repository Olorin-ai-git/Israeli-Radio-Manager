"""Audio metadata extraction utilities."""

import logging
from pathlib import Path
from typing import Dict, Any, Optional

from mutagen import File as MutagenFile
from mutagen.easyid3 import EasyID3
from mutagen.mp3 import MP3

logger = logging.getLogger(__name__)


def extract_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract metadata from an audio file.

    Supports MP3, WAV, M4A, OGG, and other formats via mutagen.

    Args:
        file_path: Path to the audio file

    Returns:
        Dictionary with extracted metadata
    """
    path = Path(file_path)
    metadata: Dict[str, Any] = {
        "filename": path.name,
        "extension": path.suffix.lower(),
        "file_size": path.stat().st_size if path.exists() else 0
    }

    try:
        audio = MutagenFile(str(path), easy=True)

        if audio is None:
            logger.warning(f"Could not read audio file: {file_path}")
            return metadata

        # Basic metadata
        metadata["title"] = _get_tag(audio, "title")
        metadata["artist"] = _get_tag(audio, "artist")
        metadata["album"] = _get_tag(audio, "album")
        metadata["genre"] = _get_tag(audio, "genre")
        metadata["year"] = _get_tag(audio, "date")
        metadata["track_number"] = _get_tag(audio, "tracknumber")

        # Duration
        if hasattr(audio, "info") and audio.info:
            metadata["duration_seconds"] = int(audio.info.length)
            if hasattr(audio.info, "bitrate"):
                metadata["bitrate"] = audio.info.bitrate
            if hasattr(audio.info, "sample_rate"):
                metadata["sample_rate"] = audio.info.sample_rate

        # For MP3, get additional info
        if path.suffix.lower() == ".mp3":
            try:
                mp3 = MP3(str(path))
                metadata["duration_seconds"] = int(mp3.info.length)
                metadata["bitrate"] = mp3.info.bitrate
                metadata["sample_rate"] = mp3.info.sample_rate
            except Exception as e:
                logger.debug(f"MP3 specific extraction failed: {e}")

        logger.info(f"Extracted metadata from {path.name}: {metadata.get('title', 'Unknown')}")

    except Exception as e:
        logger.error(f"Error extracting metadata from {file_path}: {e}")

    return metadata


def _get_tag(audio, tag_name: str) -> Optional[str]:
    """Safely get a tag value."""
    try:
        value = audio.get(tag_name)
        if value:
            if isinstance(value, list):
                return str(value[0]) if value else None
            return str(value)
    except Exception:
        pass
    return None


def get_duration_formatted(seconds: int) -> str:
    """
    Format duration in human-readable format.

    Args:
        seconds: Duration in seconds

    Returns:
        Formatted string like "3:45" or "1:23:45"
    """
    if seconds < 0:
        return "0:00"

    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes}:{secs:02d}"


def estimate_content_type(metadata: Dict[str, Any]) -> str:
    """
    Make an initial guess at content type based on metadata.

    Args:
        metadata: Extracted metadata dict

    Returns:
        "song", "show", or "commercial"
    """
    duration = metadata.get("duration_seconds", 0)
    filename = metadata.get("filename", "").lower()
    title = (metadata.get("title") or "").lower()

    # Commercials are typically short
    if duration < 90:
        if any(word in filename for word in ["commercial", "ad", "sponsor", "פרסומת"]):
            return "commercial"
        if any(word in title for word in ["commercial", "ad", "sponsor", "פרסומת"]):
            return "commercial"
        # Short audio with no clear indicators - likely commercial
        if duration < 60:
            return "commercial"

    # Shows are typically long
    if duration > 600:  # More than 10 minutes
        if any(word in filename for word in ["show", "episode", "תוכנית", "פרק"]):
            return "show"
        if any(word in title for word in ["show", "episode", "תוכנית", "פרק"]):
            return "show"
        # Long audio - likely a show
        if duration > 900:  # More than 15 minutes
            return "show"

    # Default to song for medium-length content
    return "song"
