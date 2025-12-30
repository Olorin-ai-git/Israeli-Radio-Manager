"""User service for MongoDB-based user management."""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.user import (
    UserRole,
    UserCreate,
    UserUpdate,
    UserPreferencesUpdate,
    UserInDB
)

logger = logging.getLogger(__name__)

# Initial admin email - seeded on first startup
INITIAL_ADMIN_EMAIL = "admin@olorin.ai"


class UserService:
    """Service for user CRUD operations."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.users

    async def get_or_create_user(
        self,
        firebase_uid: str,
        email: str,
        display_name: str,
        photo_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get existing user or create new one on first login.

        If a user was pre-created by admin (has email but no firebase_uid),
        this will update them with the firebase_uid on first login.

        Returns the user document with _id as string.
        """
        # Try to find existing user by Firebase UID
        user = await self.collection.find_one({"firebase_uid": firebase_uid})

        if user:
            # Update last login time
            await self.collection.update_one(
                {"firebase_uid": firebase_uid},
                {
                    "$set": {
                        "last_login": datetime.utcnow(),
                        "display_name": display_name,  # Update in case it changed
                        "photo_url": photo_url
                    }
                }
            )
            user["last_login"] = datetime.utcnow()
            user["_id"] = str(user["_id"])
            return user

        # Check if user was pre-created by admin (has email but no firebase_uid)
        pre_created = await self.collection.find_one({
            "email": {"$regex": f"^{email}$", "$options": "i"},
            "$or": [
                {"firebase_uid": None},
                {"firebase_uid": ""},
                {"firebase_uid": {"$exists": False}}
            ]
        })

        if pre_created:
            # Update pre-created user with Firebase UID
            await self.collection.update_one(
                {"_id": pre_created["_id"]},
                {
                    "$set": {
                        "firebase_uid": firebase_uid,
                        "display_name": display_name,
                        "photo_url": photo_url,
                        "last_login": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            pre_created["firebase_uid"] = firebase_uid
            pre_created["display_name"] = display_name
            pre_created["photo_url"] = photo_url
            pre_created["last_login"] = datetime.utcnow()
            pre_created["_id"] = str(pre_created["_id"])
            logger.info(f"Linked pre-created user {email} with Firebase UID")
            return pre_created

        # Check if this is the initial admin email
        is_initial_admin = email.lower() == INITIAL_ADMIN_EMAIL.lower()

        # Create new user
        now = datetime.utcnow()
        new_user = UserInDB(
            firebase_uid=firebase_uid,
            email=email,
            display_name=display_name,
            photo_url=photo_url,
            role=UserRole.ADMIN.value if is_initial_admin else UserRole.VIEWER.value,
            created_at=now,
            updated_at=now,
            last_login=now
        )

        result = await self.collection.insert_one(new_user.model_dump())

        user_doc = new_user.model_dump()
        user_doc["_id"] = str(result.inserted_id)

        if is_initial_admin:
            logger.info(f"Created initial admin user: {email}")
        else:
            logger.info(f"Created new user: {email} with role: viewer")

        return user_doc

    async def pre_create_user(
        self,
        email: str,
        role: UserRole,
        display_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Pre-create a user by email (admin only).

        The user will be linked to their Firebase account on first login.
        """
        # Check if user already exists
        existing = await self.collection.find_one({
            "email": {"$regex": f"^{email}$", "$options": "i"}
        })

        if existing:
            raise ValueError(f"User with email {email} already exists")

        now = datetime.utcnow()
        new_user = UserInDB(
            firebase_uid=None,  # Will be set on first login
            email=email.lower(),
            display_name=display_name or email.split("@")[0],
            photo_url=None,
            role=role.value,
            created_at=now,
            updated_at=now,
            last_login=None  # Never logged in yet
        )

        result = await self.collection.insert_one(new_user.model_dump())

        user_doc = new_user.model_dump()
        user_doc["_id"] = str(result.inserted_id)

        logger.info(f"Pre-created user: {email} with role: {role.value}")
        return user_doc

    async def get_user_by_uid(self, firebase_uid: str) -> Optional[Dict[str, Any]]:
        """Get user by Firebase UID."""
        user = await self.collection.find_one({"firebase_uid": firebase_uid})
        if user:
            user["_id"] = str(user["_id"])
        return user

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email address."""
        user = await self.collection.find_one({"email": email.lower()})
        if user:
            user["_id"] = str(user["_id"])
        return user

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 100,
        role_filter: Optional[str] = None,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """List all users with optional filters."""
        query = {}

        if role_filter:
            query["role"] = role_filter

        if not include_inactive:
            query["is_active"] = True

        cursor = self.collection.find(query).skip(skip).limit(limit).sort("created_at", -1)

        users = []
        async for user in cursor:
            user["_id"] = str(user["_id"])
            users.append(user)

        return users

    async def count_users(
        self,
        role_filter: Optional[str] = None,
        include_inactive: bool = False
    ) -> int:
        """Count users with optional filters."""
        query = {}

        if role_filter:
            query["role"] = role_filter

        if not include_inactive:
            query["is_active"] = True

        return await self.collection.count_documents(query)

    async def update_user(
        self,
        firebase_uid: str,
        update: UserUpdate
    ) -> Optional[Dict[str, Any]]:
        """Update user profile fields."""
        update_data = {k: v for k, v in update.model_dump().items() if v is not None}

        if not update_data:
            return await self.get_user_by_uid(firebase_uid)

        update_data["updated_at"] = datetime.utcnow()

        result = await self.collection.update_one(
            {"firebase_uid": firebase_uid},
            {"$set": update_data}
        )

        if result.matched_count == 0:
            return None

        return await self.get_user_by_uid(firebase_uid)

    async def update_preferences(
        self,
        firebase_uid: str,
        preferences: UserPreferencesUpdate
    ) -> Optional[Dict[str, Any]]:
        """Update user preferences."""
        update_data = {}

        if preferences.language is not None:
            update_data["preferences.language"] = preferences.language

        if preferences.theme is not None:
            update_data["preferences.theme"] = preferences.theme

        if preferences.notifications is not None:
            notif = preferences.notifications.model_dump()
            update_data["preferences.notifications"] = notif

        if not update_data:
            return await self.get_user_by_uid(firebase_uid)

        update_data["updated_at"] = datetime.utcnow()

        await self.collection.update_one(
            {"firebase_uid": firebase_uid},
            {"$set": update_data}
        )

        return await self.get_user_by_uid(firebase_uid)

    async def set_user_role(
        self,
        firebase_uid: str,
        role: UserRole
    ) -> Optional[Dict[str, Any]]:
        """Set user role (admin only operation)."""
        result = await self.collection.update_one(
            {"firebase_uid": firebase_uid},
            {
                "$set": {
                    "role": role.value,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count == 0:
            return None

        logger.info(f"Updated user {firebase_uid} role to: {role.value}")
        return await self.get_user_by_uid(firebase_uid)

    async def deactivate_user(self, firebase_uid: str) -> bool:
        """Deactivate a user (soft delete)."""
        result = await self.collection.update_one(
            {"firebase_uid": firebase_uid},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count > 0:
            logger.info(f"Deactivated user: {firebase_uid}")
            return True
        return False

    async def reactivate_user(self, firebase_uid: str) -> bool:
        """Reactivate a deactivated user."""
        result = await self.collection.update_one(
            {"firebase_uid": firebase_uid},
            {
                "$set": {
                    "is_active": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count > 0:
            logger.info(f"Reactivated user: {firebase_uid}")
            return True
        return False

    async def get_user_role(self, firebase_uid: str) -> str:
        """Get user role by Firebase UID."""
        user = await self.collection.find_one(
            {"firebase_uid": firebase_uid},
            {"role": 1}
        )

        if user:
            return user.get("role", "viewer")

        return "viewer"

    async def ensure_admin_exists(self) -> None:
        """Ensure at least one admin exists (for initial setup)."""
        admin_count = await self.collection.count_documents({"role": "admin"})

        if admin_count == 0:
            logger.warning(
                f"No admin users found. First user with email {INITIAL_ADMIN_EMAIL} "
                "will be granted admin role on login."
            )
