"""Auto Flow models for automated radio scheduling workflows."""

from datetime import datetime, time
from typing import List, Optional, Literal
from enum import Enum

from pydantic import BaseModel, Field


class FlowActionType(str, Enum):
    """Types of actions in a flow."""
    PLAY_GENRE = "play_genre"
    PLAY_CONTENT = "play_content"
    PLAY_COMMERCIALS = "play_commercials"
    PLAY_SHOW = "play_show"
    WAIT = "wait"
    SET_VOLUME = "set_volume"
    ANNOUNCEMENT = "announcement"


class FlowAction(BaseModel):
    """A single action within a flow."""
    action_type: FlowActionType

    # For play_genre
    genre: Optional[str] = None

    # For play_content / play_show
    content_id: Optional[str] = None
    content_title: Optional[str] = None

    # For play_commercials
    commercial_count: Optional[int] = None

    # Duration in minutes (for genre playback or wait)
    duration_minutes: Optional[int] = None

    # For set_volume
    volume_level: Optional[int] = None

    # For announcement
    announcement_text: Optional[str] = None

    # Description for display
    description: Optional[str] = None
    description_he: Optional[str] = None


class FlowTriggerType(str, Enum):
    """How a flow is triggered."""
    SCHEDULED = "scheduled"  # Runs at specific times
    MANUAL = "manual"  # Triggered manually
    EVENT = "event"  # Triggered by an event (e.g., show ends)


class FlowSchedule(BaseModel):
    """Schedule configuration for a flow."""
    # Days of week (0=Sunday, 6=Saturday)
    days_of_week: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])

    # Start time (HH:MM format)
    start_time: str

    # Optional end time
    end_time: Optional[str] = None

    # Google Calendar event ID (for syncing)
    calendar_event_id: Optional[str] = None


class FlowStatus(str, Enum):
    """Current status of a flow."""
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    RUNNING = "running"


class AutoFlow(BaseModel):
    """An automated flow/workflow for radio scheduling."""
    name: str
    name_he: Optional[str] = None
    description: Optional[str] = None
    description_he: Optional[str] = None

    # Flow actions in order
    actions: List[FlowAction]

    # Trigger configuration
    trigger_type: FlowTriggerType = FlowTriggerType.SCHEDULED
    schedule: Optional[FlowSchedule] = None

    # Status
    status: FlowStatus = FlowStatus.ACTIVE

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_run: Optional[datetime] = None
    run_count: int = 0

    # Priority (higher = runs first if conflicts)
    priority: int = 0

    # Whether to loop the flow
    loop: bool = False


class FlowCreate(BaseModel):
    """Request model for creating a flow."""
    name: str
    name_he: Optional[str] = None
    description: Optional[str] = None
    description_he: Optional[str] = None
    actions: List[FlowAction]
    trigger_type: FlowTriggerType = FlowTriggerType.SCHEDULED
    schedule: Optional[FlowSchedule] = None
    priority: int = 0
    loop: bool = False


class FlowUpdate(BaseModel):
    """Request model for updating a flow."""
    name: Optional[str] = None
    name_he: Optional[str] = None
    description: Optional[str] = None
    description_he: Optional[str] = None
    actions: Optional[List[FlowAction]] = None
    trigger_type: Optional[FlowTriggerType] = None
    schedule: Optional[FlowSchedule] = None
    status: Optional[FlowStatus] = None
    priority: Optional[int] = None
    loop: Optional[bool] = None


class FlowExecutionLog(BaseModel):
    """Log entry for flow execution."""
    flow_id: str
    flow_name: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    status: Literal["running", "completed", "failed", "cancelled"]
    actions_completed: int = 0
    total_actions: int = 0
    error_message: Optional[str] = None
    triggered_by: Literal["schedule", "manual", "event", "chat"]
