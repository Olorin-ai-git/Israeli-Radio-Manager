"""AI Agent models for orchestration and decision-making."""

from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field


class AgentMode(str, Enum):
    """Operating mode for the AI agent."""
    FULL_AUTOMATION = "full_automation"
    PROMPT = "prompt"


class ActionType(str, Enum):
    """Types of actions the agent can take."""
    SELECT_NEXT_TRACK = "select_next_track"
    CATEGORIZE_CONTENT = "categorize_content"
    DELETE_CONTENT = "delete_content"
    OVERRIDE_SCHEDULE = "override_schedule"
    MODIFY_RULES = "modify_rules"
    PROCESS_EMAIL = "process_email"
    INSERT_COMMERCIAL = "insert_commercial"
    SKIP_TRACK = "skip_track"
    HANDLE_ERROR = "handle_error"


class ActionStatus(str, Enum):
    """Status of a pending action."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    EXECUTED = "executed"


class TimeoutDefaults(BaseModel):
    """Default actions when confirmation times out."""
    categorize_content: str = "approve"
    delete_content: str = "reject"
    override_schedule: str = "reject"
    modify_rules: str = "reject"
    process_email: str = "approve"


class AutomationRules(BaseModel):
    """Rules for automatic operation."""
    dead_air_prevention: bool = True
    max_song_repeat_hours: int = 4
    commercial_interval_minutes: int = 15
    auto_categorize_threshold: float = 0.8
    max_consecutive_songs_same_artist: int = 2
    min_songs_between_commercials: int = 3


class AgentConfig(BaseModel):
    """Configuration for the AI orchestration agent."""
    id: str = Field(alias="_id", default="default")
    mode: AgentMode = AgentMode.PROMPT
    confirmation_required_actions: List[ActionType] = Field(
        default_factory=lambda: [
            ActionType.CATEGORIZE_CONTENT,
            ActionType.DELETE_CONTENT,
            ActionType.OVERRIDE_SCHEDULE,
            ActionType.MODIFY_RULES,
        ]
    )
    timeouts: Dict[str, int] = Field(
        default_factory=lambda: {
            "default": 300,      # 5 minutes
            "critical": 600,     # 10 minutes
            "categorize": 1800,  # 30 minutes
        }
    )
    timeout_defaults: TimeoutDefaults = Field(default_factory=TimeoutDefaults)
    automation_rules: AutomationRules = Field(default_factory=AutomationRules)
    notification_level: str = "all"  # "all", "critical_only", "summary_only"
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class PendingAction(BaseModel):
    """A pending action waiting for user confirmation."""
    id: str = Field(alias="_id")
    action_type: ActionType
    description: str
    description_he: str
    ai_reasoning: str
    suggested_action: Dict[str, Any]
    alternatives: List[Dict[str, Any]] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    status: ActionStatus = ActionStatus.PENDING
    responded_by: Optional[str] = None  # "user" or "timeout"
    response_channel: Optional[str] = None  # "dashboard", "sms", "push"
    final_action: Optional[Dict[str, Any]] = None
    executed_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class AgentDecision(BaseModel):
    """A decision made by the AI agent."""
    id: str = Field(alias="_id")
    action_type: ActionType
    decision: Dict[str, Any]
    reasoning: str
    mode: AgentMode
    required_confirmation: bool
    pending_action_id: Optional[str] = None
    executed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
