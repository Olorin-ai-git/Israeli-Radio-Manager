"""Content models for songs, shows, and commercials."""

from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


class ContentType(str, Enum):
    """Type of radio content."""
    SONG = "song"
    SHOW = "show"
    COMMERCIAL = "commercial"
    JINGLE = "jingle"
    SAMPLE = "sample"
    NEWSFLASH = "newsflash"


class AIClassification(BaseModel):
    """AI-generated classification for content."""
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_type: ContentType
    suggested_genre: Optional[str] = None


class ContentMetadata(BaseModel):
    """Metadata for content items."""
    language: str = "hebrew"
    year: Optional[int] = None
    tags: List[str] = Field(default_factory=list)
    ai_classification: Optional[AIClassification] = None


class ContentBase(BaseModel):
    """Base content model."""
    type: ContentType
    title: str
    title_he: Optional[str] = None
    artist: Optional[str] = None
    genre: Optional[str] = None
    duration_seconds: int = 0
    metadata: ContentMetadata = Field(default_factory=ContentMetadata)
    active: bool = True


class ContentCreate(ContentBase):
    """Model for creating new content."""
    google_drive_id: str
    google_drive_path: str


class ContentUpdate(BaseModel):
    """Model for updating content."""
    title: Optional[str] = None
    title_he: Optional[str] = None
    artist: Optional[str] = None
    genre: Optional[str] = None
    metadata: Optional[ContentMetadata] = None
    active: Optional[bool] = None


class Content(ContentBase):
    """Full content model with database fields."""
    id: str = Field(alias="_id")
    google_drive_id: str
    google_drive_path: str
    local_cache_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_played: Optional[datetime] = None
    play_count: int = 0

    class Config:
        populate_by_name = True


class PlaybackLog(BaseModel):
    """Log entry for content playback."""
    id: str = Field(alias="_id")
    content_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    triggered_by: str  # "ai_agent", "manual", "schedule"
    ai_reasoning: Optional[str] = None

    class Config:
        populate_by_name = True
