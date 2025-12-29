"""Settings models for notification preferences and admin configuration."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NotificationSettings(BaseModel):
    """Notification channel preferences."""
    email_enabled: bool = True
    push_enabled: bool = True
    sms_enabled: bool = False  # Disabled by default (requires Twilio setup)


class AdminContactSettings(BaseModel):
    """Admin contact information for notifications."""
    email: Optional[str] = None
    phone: Optional[str] = None  # E.164 format for Twilio (+1234567890)


class AppSettings(BaseModel):
    """Full application settings document (singleton)."""
    notifications: NotificationSettings = Field(default_factory=NotificationSettings)
    admin_contact: AdminContactSettings = Field(default_factory=AdminContactSettings)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SettingsUpdate(BaseModel):
    """Request model for updating settings."""
    notifications: Optional[NotificationSettings] = None
    admin_contact: Optional[AdminContactSettings] = None


class PushSubscription(BaseModel):
    """Web push subscription for persistent storage."""
    endpoint: str
    keys: dict  # {p256dh: ..., auth: ...}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used: datetime = Field(default_factory=datetime.utcnow)
