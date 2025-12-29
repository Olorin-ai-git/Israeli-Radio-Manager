"""Settings router for notification preferences and admin configuration."""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from app.models.settings import (
    AppSettings,
    SettingsUpdate,
    NotificationSettings,
    AdminContactSettings,
)
from app.config import settings as env_settings
from app.services.notifications import NotificationLevel, NotificationChannel

logger = logging.getLogger(__name__)
router = APIRouter()

SETTINGS_DOC_ID = "app_settings"


@router.get("/")
async def get_settings(request: Request):
    """Get current application settings."""
    db = request.app.state.db

    doc = await db.settings.find_one({"_id": SETTINGS_DOC_ID})

    if not doc:
        # Return defaults with VAPID public key
        return {
            "_id": SETTINGS_DOC_ID,
            "notifications": NotificationSettings().model_dump(),
            "admin_contact": AdminContactSettings().model_dump(),
            "vapid_public_key": env_settings.vapid_public_key or None,
            "updated_at": datetime.utcnow().isoformat()
        }

    # Always include VAPID public key from env (needed for frontend push subscription)
    doc["vapid_public_key"] = env_settings.vapid_public_key or None
    return doc


@router.put("/")
async def update_settings(request: Request, update: SettingsUpdate):
    """Update application settings."""
    db = request.app.state.db

    update_doc = {"updated_at": datetime.utcnow()}

    if update.notifications is not None:
        update_doc["notifications"] = update.notifications.model_dump()

    if update.admin_contact is not None:
        update_doc["admin_contact"] = update.admin_contact.model_dump()

        # Also update NotificationService with new admin contacts
        notification_service = getattr(request.app.state, 'notification_service', None)
        if notification_service:
            if update.admin_contact.email:
                notification_service._admin_email = update.admin_contact.email
            if update.admin_contact.phone:
                notification_service._admin_phone = update.admin_contact.phone
            logger.info("Updated NotificationService admin contacts")

    await db.settings.update_one(
        {"_id": SETTINGS_DOC_ID},
        {"$set": update_doc},
        upsert=True
    )

    logger.info("Settings updated")
    return await get_settings(request)


@router.post("/push-subscription")
async def register_push_subscription(request: Request, subscription: dict):
    """Register a web push subscription."""
    notification_service = getattr(request.app.state, 'notification_service', None)

    if not notification_service:
        raise HTTPException(status_code=503, detail="Notification service not available")

    await notification_service.add_push_subscription(subscription)
    return {"status": "subscribed"}


@router.delete("/push-subscription")
async def remove_push_subscription(request: Request, endpoint: str):
    """Remove a push subscription by endpoint."""
    notification_service = getattr(request.app.state, 'notification_service', None)

    if notification_service:
        await notification_service.remove_push_subscription(endpoint)

    return {"status": "unsubscribed"}


@router.post("/test-notification")
async def test_notification(request: Request, channel: str = "push"):
    """Send a test notification to verify configuration."""
    notification_service = getattr(request.app.state, 'notification_service', None)

    if not notification_service:
        raise HTTPException(status_code=503, detail="Notification service not available")

    channel_map = {
        "email": NotificationChannel.EMAIL,
        "push": NotificationChannel.PUSH,
        "sms": NotificationChannel.SMS
    }

    if channel not in channel_map:
        raise HTTPException(status_code=400, detail=f"Invalid channel: {channel}. Use: email, push, or sms")

    result = await notification_service.send_notification(
        message="This is a test notification from Israeli Radio Manager. If you received this, notifications are working correctly!",
        title="Test Notification",
        level=NotificationLevel.INFO,
        channels=[channel_map[channel]]
    )

    success = result.get(channel, False)

    if success:
        logger.info(f"Test {channel} notification sent successfully")
    else:
        logger.warning(f"Test {channel} notification failed")

    return {"success": success, "channel": channel, "result": result}
