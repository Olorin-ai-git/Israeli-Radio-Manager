"""User models for MongoDB-based user management."""

from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class NotificationPreferences(BaseModel):
    """User notification preferences."""
    email_enabled: bool = False
    push_enabled: bool = True
    sms_enabled: bool = False


class UserPreferences(BaseModel):
    """User preferences."""
    language: str = "he"  # "he" or "en"
    theme: str = "dark"   # "dark" or "light"
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)


class UserBase(BaseModel):
    """Base user model with common fields."""
    email: EmailStr
    display_name: str
    photo_url: Optional[str] = None
    role: UserRole = UserRole.VIEWER
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    is_active: bool = True


class UserCreate(BaseModel):
    """Model for creating a new user (from Firebase auth)."""
    firebase_uid: str
    email: EmailStr
    display_name: str
    photo_url: Optional[str] = None


class UserUpdate(BaseModel):
    """Model for updating user profile."""
    display_name: Optional[str] = None
    photo_url: Optional[str] = None


class UserPreferencesUpdate(BaseModel):
    """Model for updating user preferences."""
    language: Optional[str] = None
    theme: Optional[str] = None
    notifications: Optional[NotificationPreferences] = None


class UserRoleUpdate(BaseModel):
    """Model for updating user role (admin only)."""
    role: UserRole


class User(UserBase):
    """Full user model with all fields."""
    id: str = Field(alias="_id")
    firebase_uid: str
    created_at: datetime
    updated_at: datetime
    last_login: datetime

    class Config:
        populate_by_name = True


class UserInDB(BaseModel):
    """User document as stored in MongoDB."""
    firebase_uid: str
    email: str
    display_name: str
    photo_url: Optional[str] = None
    role: str = "viewer"
    preferences: dict = Field(default_factory=lambda: {
        "language": "he",
        "theme": "dark",
        "notifications": {
            "email_enabled": False,
            "push_enabled": True,
            "sms_enabled": False
        }
    })
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime = Field(default_factory=datetime.utcnow)
