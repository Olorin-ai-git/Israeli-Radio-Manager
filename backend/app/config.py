"""Application configuration loaded from environment variables."""

from typing import Literal
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB
    mongodb_uri: str = Field(default="mongodb://localhost:27017")
    mongodb_db: str = Field(default="israeli_radio")

    # Google APIs
    google_client_id: str = Field(default="")
    google_client_secret: str = Field(default="")
    google_drive_root_folder_id: str = Field(default="")
    google_drive_music_folder_id: str = Field(default="")
    google_drive_shows_folder_id: str = Field(default="")
    google_drive_commercials_folder_id: str = Field(default="")
    google_service_account_file: str = Field(default="service-account.json")
    google_credentials_file: str = Field(default="credentials.json")
    google_token_file: str = Field(default="token.json")  # Calendar token
    google_drive_token_file: str = Field(default="drive-token.json")  # Drive token
    google_gmail_token_file: str = Field(default="gmail_token.json")  # Gmail token
    google_calendar_id: str = Field(default="primary")  # Calendar ID or "primary"

    # Claude AI
    anthropic_api_key: str = Field(default="")
    anthropic_model: str = Field(default="claude-sonnet-4-5-20250929")

    # Twilio
    twilio_account_sid: str = Field(default="")
    twilio_auth_token: str = Field(default="")
    twilio_phone_number: str = Field(default="")

    # Push Notifications
    vapid_public_key: str = Field(default="")
    vapid_private_key: str = Field(default="")
    vapid_claims_email: str = Field(default="")

    # Notifications
    admin_email: str = Field(default="")
    admin_phone: str = Field(default="")

    # App Settings
    environment: Literal["development", "production"] = Field(default="development")
    log_level: str = Field(default="INFO")
    cache_dir: str = Field(default="./cache")
    max_cache_size_gb: int = Field(default=10)

    # Google Cloud Storage
    gcs_bucket_name: str = Field(default="israeli-radio-475c9-audio")
    gcs_signed_url_expiry_hours: int = Field(default=24)  # Signed URLs valid for 24 hours

    # Agent Settings
    agent_mode: Literal["full_automation", "prompt"] = Field(default="prompt")
    auto_categorize_threshold: float = Field(default=0.8)
    commercial_interval_minutes: int = Field(default=15)
    max_song_repeat_hours: int = Field(default=4)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
