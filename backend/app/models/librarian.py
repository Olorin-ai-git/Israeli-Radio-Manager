"""
Librarian AI Agent Database Models
Models for audit reports, actions, and stream validation cache
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AuditReport(BaseModel):
    """
    Comprehensive audit report for a librarian run.
    Stores all findings, fixes, and health metrics.
    """
    audit_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    audit_date: datetime = Field(default_factory=datetime.utcnow)
    audit_type: str  # "daily_incremental", "weekly_full", "manual", "ai_agent"
    execution_time_seconds: float = 0.0
    status: str = "in_progress"  # "in_progress", "completed", "failed", "partial"

    # Summary metrics
    summary: Dict[str, Any] = Field(default_factory=dict)

    # Detailed results by content type
    content_results: Dict[str, Any] = Field(default_factory=dict)
    live_channel_results: Dict[str, Any] = Field(default_factory=dict)
    podcast_results: Dict[str, Any] = Field(default_factory=dict)
    radio_results: Dict[str, Any] = Field(default_factory=dict)

    # Issues found
    broken_streams: List[Dict[str, Any]] = Field(default_factory=list)
    missing_metadata: List[Dict[str, Any]] = Field(default_factory=list)
    misclassifications: List[Dict[str, Any]] = Field(default_factory=list)
    orphaned_items: List[Dict[str, Any]] = Field(default_factory=list)

    # Actions taken
    fixes_applied: List[Dict[str, Any]] = Field(default_factory=list)
    manual_review_needed: List[Dict[str, Any]] = Field(default_factory=list)

    # Database health
    database_health: Dict[str, Any] = Field(default_factory=dict)

    # AI insights
    ai_insights: List[str] = Field(default_factory=list)

    # Execution logs (for real-time streaming to UI)
    execution_logs: List[Dict[str, Any]] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class LibrarianAction(BaseModel):
    """
    Individual action taken by the librarian agent.
    Includes rollback capability and audit trail.
    """
    action_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    audit_id: str  # Links to parent AuditReport
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Action classification
    action_type: str  # "add_poster", "update_metadata", "recategorize", "fix_url", "clean_title"
    content_id: str  # ID of the content item affected
    content_type: str  # "content", "schedule_slot", etc.
    issue_type: str  # "missing_poster", "broken_stream", "misclassification", "dirty_title", etc.

    # State tracking for rollback
    before_state: Dict[str, Any] = Field(default_factory=dict)
    after_state: Dict[str, Any] = Field(default_factory=dict)

    # Confidence and approval
    confidence_score: Optional[float] = None  # 0.0-1.0 for AI-driven actions
    auto_approved: bool = False  # Whether action was automatically approved
    rollback_available: bool = True  # Whether rollback is possible

    # Rollback tracking
    rolled_back: bool = False
    rollback_timestamp: Optional[datetime] = None
    rollback_reason: Optional[str] = None

    # Metadata
    description: Optional[str] = None  # Human-readable description of the action
    error_message: Optional[str] = None  # If action failed


class StreamValidationCache(BaseModel):
    """
    Cache for stream validation results to avoid redundant checks.
    TTL: 48 hours for valid streams, 4 hours for invalid streams.
    """
    stream_url: str  # Unique identifier
    last_validated: datetime = Field(default_factory=datetime.utcnow)
    is_valid: bool = False

    # Validation details
    status_code: Optional[int] = None  # HTTP status code
    response_time_ms: Optional[int] = None  # Response time in milliseconds
    error_message: Optional[str] = None  # Error details if validation failed

    # Stream details
    stream_type: Optional[str] = None  # "hls", "dash", "audio"
    content_type: Optional[str] = None  # Content-Type header

    # For HLS streams
    manifest_parsed: bool = False  # Whether m3u8 was successfully parsed
    segments_count: Optional[int] = None  # Number of segments found
    first_segment_accessible: Optional[bool] = None  # First .ts segment check

    # TTL management
    expires_at: datetime = Field(default_factory=datetime.utcnow)


class ClassificationVerificationCache(BaseModel):
    """
    Cache for AI classification verification results.
    TTL: 7 days to avoid redundant Claude API calls.
    """
    content_id: str
    category_id: str
    last_verified: datetime = Field(default_factory=datetime.utcnow)

    # Verification results
    fit_score: int = 5  # 1-10 scale
    is_correct: bool = True
    suggested_category_id: Optional[str] = None
    suggested_category_name: Optional[str] = None
    reasoning: Optional[str] = None  # Claude's explanation

    # Content snapshot (for reference)
    content_title: Optional[str] = None
    content_genre: Optional[str] = None
    category_name: Optional[str] = None

    # TTL management
    expires_at: datetime = Field(default_factory=datetime.utcnow)
