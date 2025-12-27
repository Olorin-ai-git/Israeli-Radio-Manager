"""Notification Service for sending alerts via Email, Push, and SMS."""

import logging
import json
from typing import Optional, List, Dict, Any
from enum import Enum

from twilio.rest import Client as TwilioClient
from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)


class NotificationLevel(str, Enum):
    """Notification importance levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class NotificationChannel(str, Enum):
    """Available notification channels."""
    EMAIL = "email"
    PUSH = "push"
    SMS = "sms"


class NotificationService:
    """
    Service for sending notifications through multiple channels.

    Supports Email (via Gmail API), Web Push, and SMS (via Twilio).
    """

    def __init__(
        self,
        # Twilio config
        twilio_sid: Optional[str] = None,
        twilio_token: Optional[str] = None,
        twilio_phone: Optional[str] = None,
        # VAPID config for web push
        vapid_public_key: Optional[str] = None,
        vapid_private_key: Optional[str] = None,
        vapid_email: Optional[str] = None,
        # Default recipients
        admin_email: Optional[str] = None,
        admin_phone: Optional[str] = None
    ):
        # Twilio client
        self._twilio_client = None
        if twilio_sid and twilio_token:
            self._twilio_client = TwilioClient(twilio_sid, twilio_token)
        self._twilio_phone = twilio_phone

        # VAPID keys for web push
        self._vapid_public = vapid_public_key
        self._vapid_private = vapid_private_key
        self._vapid_email = vapid_email

        # Default recipients
        self._admin_email = admin_email
        self._admin_phone = admin_phone

        # Push subscriptions (in production, store in DB)
        self._push_subscriptions: List[Dict[str, Any]] = []

    def add_push_subscription(self, subscription: Dict[str, Any]):
        """
        Register a web push subscription.

        Args:
            subscription: Push subscription object from browser
        """
        if subscription not in self._push_subscriptions:
            self._push_subscriptions.append(subscription)
            logger.info("Added push subscription")

    def remove_push_subscription(self, endpoint: str):
        """Remove a push subscription by endpoint."""
        self._push_subscriptions = [
            s for s in self._push_subscriptions
            if s.get('endpoint') != endpoint
        ]

    async def send_notification(
        self,
        message: str,
        title: str = "Israeli Radio Manager",
        level: NotificationLevel = NotificationLevel.INFO,
        channels: Optional[List[NotificationChannel]] = None,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, bool]:
        """
        Send a notification through specified channels.

        Args:
            message: Notification message
            title: Notification title
            level: Importance level
            channels: Channels to use (defaults based on level)
            data: Additional data to include

        Returns:
            Dict of channel -> success status
        """
        # Default channels based on level
        if channels is None:
            if level == NotificationLevel.CRITICAL:
                channels = [
                    NotificationChannel.EMAIL,
                    NotificationChannel.PUSH,
                    NotificationChannel.SMS
                ]
            elif level == NotificationLevel.ERROR:
                channels = [NotificationChannel.EMAIL, NotificationChannel.PUSH]
            else:
                channels = [NotificationChannel.PUSH]

        results = {}

        for channel in channels:
            try:
                if channel == NotificationChannel.EMAIL:
                    success = await self._send_email(title, message, data)
                elif channel == NotificationChannel.PUSH:
                    success = await self._send_push(title, message, data)
                elif channel == NotificationChannel.SMS:
                    success = await self._send_sms(message)
                else:
                    success = False

                results[channel.value] = success

            except Exception as e:
                logger.error(f"Failed to send {channel.value} notification: {e}")
                results[channel.value] = False

        return results

    async def _send_email(
        self,
        subject: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send email notification via Gmail API."""
        if not self._admin_email:
            logger.warning("No admin email configured")
            return False

        try:
            from app.services.gmail import GmailService
            from app.config import settings
            import asyncio

            # Get or create Gmail service
            if not hasattr(self, '_gmail_service') or self._gmail_service is None:
                credentials_path = settings.google_credentials_path
                token_path = settings.google_token_path

                self._gmail_service = GmailService(
                    credentials_path=credentials_path,
                    token_path=token_path
                )

            # Build email content
            email_body = body
            if data:
                email_body += f"\n\nAdditional data:\n{json.dumps(data, indent=2, default=str)}"

            # Send the email
            result = await self._gmail_service.send_email(
                to=self._admin_email,
                subject=f"[Israeli Radio Manager] {subject}",
                body=email_body
            )

            if result:
                logger.info(f"Email sent to {self._admin_email}: {subject}")
                return True
            else:
                logger.error(f"Failed to send email to {self._admin_email}")
                return False

        except ImportError:
            logger.warning("Gmail service not available - email not sent")
            return False
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False

    async def _send_push(
        self,
        title: str,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Send web push notifications."""
        if not self._vapid_private or not self._vapid_public:
            logger.warning("VAPID keys not configured for push notifications")
            return False

        if not self._push_subscriptions:
            logger.debug("No push subscriptions registered")
            return True  # Not an error, just no subscribers

        payload = json.dumps({
            "title": title,
            "body": message,
            "data": data or {},
            "icon": "/icon.png"
        })

        vapid_claims = {"sub": f"mailto:{self._vapid_email}"}
        success_count = 0
        failed_endpoints = []

        for subscription in self._push_subscriptions:
            try:
                webpush(
                    subscription_info=subscription,
                    data=payload,
                    vapid_private_key=self._vapid_private,
                    vapid_claims=vapid_claims
                )
                success_count += 1
            except WebPushException as e:
                logger.error(f"Push failed: {e}")
                if e.response and e.response.status_code == 410:
                    # Subscription expired
                    failed_endpoints.append(subscription.get('endpoint'))

        # Clean up expired subscriptions
        for endpoint in failed_endpoints:
            self.remove_push_subscription(endpoint)

        logger.info(f"Sent push to {success_count}/{len(self._push_subscriptions)} subscribers")
        return success_count > 0

    async def _send_sms(self, message: str) -> bool:
        """Send SMS notification via Twilio."""
        if not self._twilio_client or not self._twilio_phone:
            logger.warning("Twilio not configured")
            return False

        if not self._admin_phone:
            logger.warning("No admin phone configured")
            return False

        try:
            self._twilio_client.messages.create(
                body=message,
                from_=self._twilio_phone,
                to=self._admin_phone
            )
            logger.info(f"SMS sent to {self._admin_phone}")
            return True
        except Exception as e:
            logger.error(f"SMS failed: {e}")
            return False

    async def send_confirmation_request(
        self,
        action_id: str,
        action_type: str,
        description: str,
        description_he: str
    ) -> Dict[str, bool]:
        """
        Send a confirmation request notification.

        Used when the agent needs user approval for an action.
        """
        message = f"Action required: {description}\n\nReply YES to approve or NO to reject."

        return await self.send_notification(
            message=message,
            title=f"Confirm: {action_type}",
            level=NotificationLevel.WARNING,
            channels=[NotificationChannel.PUSH, NotificationChannel.SMS],
            data={
                "action_id": action_id,
                "action_type": action_type,
                "requires_response": True
            }
        )

    async def send_daily_summary(
        self,
        songs_played: int,
        shows_played: int,
        commercials_played: int,
        new_content: int,
        issues: List[str]
    ) -> Dict[str, bool]:
        """Send daily summary notification."""
        message = f"""
Daily Radio Summary:
- Songs played: {songs_played}
- Shows played: {shows_played}
- Commercials: {commercials_played}
- New content added: {new_content}
{"" if not issues else f"- Issues: {len(issues)}"}
"""
        return await self.send_notification(
            message=message.strip(),
            title="Daily Radio Summary",
            level=NotificationLevel.INFO,
            channels=[NotificationChannel.EMAIL]
        )
