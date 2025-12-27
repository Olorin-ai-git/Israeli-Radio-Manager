"""Schedule models for time slot management."""

from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, Field

from app.models.content import ContentType


class ScheduleSlotBase(BaseModel):
    """Base schedule slot model."""
    day_of_week: List[int] | Literal["all"] = "all"  # 0=Monday, 6=Sunday
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")  # HH:MM format
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    content_type: ContentType
    genre: Optional[str] = None  # For songs - which genre to play
    specific_content_id: Optional[str] = None  # For specific shows
    priority: int = Field(default=0, ge=0)
    enabled: bool = True


class ScheduleSlotCreate(ScheduleSlotBase):
    """Model for creating schedule slots."""
    pass


class ScheduleSlotUpdate(BaseModel):
    """Model for updating schedule slots."""
    day_of_week: Optional[List[int] | Literal["all"]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    content_type: Optional[ContentType] = None
    genre: Optional[str] = None
    specific_content_id: Optional[str] = None
    priority: Optional[int] = None
    enabled: Optional[bool] = None


class ScheduleSlot(ScheduleSlotBase):
    """Full schedule slot model with database fields."""
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class GenreHourMapping(BaseModel):
    """Maps hours of the day to preferred genres."""
    hour: int = Field(ge=0, le=23)
    genres: List[str]
    weight: float = Field(default=1.0, ge=0.0, le=1.0)


class ScheduleConfig(BaseModel):
    """Overall schedule configuration."""
    commercial_interval_minutes: int = 15
    max_commercials_per_break: int = 3
    genre_hour_mappings: List[GenreHourMapping] = Field(default_factory=list)
    dead_air_fallback_genre: str = "pop"
