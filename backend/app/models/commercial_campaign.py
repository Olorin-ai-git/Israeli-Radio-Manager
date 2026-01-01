"""Commercial Campaign models for ad scheduling."""

from datetime import datetime, date
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


class CampaignStatus(str, Enum):
    """Status of a commercial campaign."""
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    DELETED = "deleted"


class CampaignContentRef(BaseModel):
    """Reference to content for a campaign."""
    # Reference to existing content in library
    content_id: Optional[str] = None

    # OR campaign-specific uploaded file
    file_google_drive_id: Optional[str] = None
    file_local_path: Optional[str] = None
    file_title: Optional[str] = None
    file_duration_seconds: Optional[int] = None


class ScheduleSlot(BaseModel):
    """A single slot in the schedule grid - tied to a specific date."""
    slot_date: str  # YYYY-MM-DD format - the specific date for this slot
    slot_index: int = Field(ge=0, le=47)  # 0-47 (00:00, 00:30, ... 23:30)
    play_count: int = Field(default=0, ge=0)  # How many times to play


class CommercialCampaignBase(BaseModel):
    """Base model for commercial campaigns."""
    name: str
    name_he: Optional[str] = None
    campaign_type: str = ""  # Custom label (e.g., "Sponsor", "Holiday Sale")
    comment: Optional[str] = None

    # Campaign date range
    start_date: date
    end_date: date

    # Priority (1-9, higher = more important)
    priority: int = Field(default=5, ge=1, le=9)

    # Contract link (admin only - link to contract document)
    contract_link: Optional[str] = None

    # Content references (commercials in this campaign)
    content_refs: List[CampaignContentRef] = Field(default_factory=list)

    # Weekly schedule grid
    schedule_grid: List[ScheduleSlot] = Field(default_factory=list)


class CampaignCreate(CommercialCampaignBase):
    """Request model for creating a campaign."""
    pass


class CampaignUpdate(BaseModel):
    """Request model for updating a campaign."""
    name: Optional[str] = None
    name_he: Optional[str] = None
    campaign_type: Optional[str] = None
    comment: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    priority: Optional[int] = Field(default=None, ge=1, le=9)
    contract_link: Optional[str] = None
    content_refs: Optional[List[CampaignContentRef]] = None
    schedule_grid: Optional[List[ScheduleSlot]] = None
    status: Optional[CampaignStatus] = None


class CommercialCampaign(CommercialCampaignBase):
    """Full campaign model with database fields."""
    id: str = Field(alias="_id")

    # Status
    status: CampaignStatus = CampaignStatus.DRAFT

    # Google Calendar sync
    calendar_event_id: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None

    class Config:
        populate_by_name = True


class CommercialPlayLog(BaseModel):
    """Log entry for commercial playback tracking."""
    id: str = Field(alias="_id")
    campaign_id: str
    content_id: str
    played_at: datetime
    slot_date: date
    slot_index: int  # 0-47
    day_of_week: int  # 0-6
    triggered_by: str  # "scheduler", "flow", "manual"
    flow_id: Optional[str] = None

    class Config:
        populate_by_name = True


class DailyPreviewSlot(BaseModel):
    """Preview slot showing scheduled commercials."""
    slot_index: int
    time: str  # "HH:MM" format
    commercials: List[dict]  # List of campaign info with priority


class DailyPreview(BaseModel):
    """Daily preview showing all scheduled commercials."""
    date: date
    slots: List[DailyPreviewSlot]


# Helper function to convert slot_index to time string
def slot_index_to_time(slot_index: int) -> str:
    """Convert slot index (0-47) to time string (HH:MM)."""
    hours = slot_index // 2
    minutes = (slot_index % 2) * 30
    return f"{hours:02d}:{minutes:02d}"


def time_to_slot_index(hour: int, minute: int) -> int:
    """Convert hour and minute to slot index."""
    return hour * 2 + (1 if minute >= 30 else 0)
