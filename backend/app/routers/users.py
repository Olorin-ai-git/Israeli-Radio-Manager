"""User management router - CRUD for users."""

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.user import (
    UserRole,
    UserUpdate,
    UserPreferencesUpdate,
    UserRoleUpdate,
    UserPreCreate
)
from app.services.firebase_auth import firebase_auth

router = APIRouter()
logger = logging.getLogger(__name__)
security = HTTPBearer()

# Protected super admin email - cannot be modified or deactivated by other users
PROTECTED_ADMIN_EMAIL = "admin@olorin.ai"


def get_user_service(request: Request):
    """Get user service from app state."""
    return request.app.state.user_service


# ==================== Current User Endpoints ====================

@router.get("/me")
async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """
    Get current user profile.

    Auto-creates user in database on first login.
    """
    # Verify Firebase token
    token = await firebase_auth.verify_token(credentials)

    user_service = get_user_service(request)

    # Get or create user
    user = await user_service.get_or_create_user(
        firebase_uid=token["uid"],
        email=token.get("email", ""),
        display_name=token.get("name", token.get("email", "Unknown")),
        photo_url=token.get("picture")
    )

    return user


@router.patch("/me")
async def update_current_user(
    request: Request,
    update: UserUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Update current user profile."""
    token = await firebase_auth.verify_token(credentials)

    user_service = get_user_service(request)
    user = await user_service.update_user(token["uid"], update)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.patch("/me/preferences")
async def update_current_user_preferences(
    request: Request,
    preferences: UserPreferencesUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Update current user preferences."""
    token = await firebase_auth.verify_token(credentials)

    user_service = get_user_service(request)
    user = await user_service.update_preferences(token["uid"], preferences)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


# ==================== Admin User Management Endpoints ====================

@router.get("/")
async def list_users(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None, description="Filter by role"),
    include_inactive: bool = Query(False, description="Include deactivated users"),
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """
    List all users (admin only).

    Returns paginated list with total count.
    """
    user_service = get_user_service(request)

    users = await user_service.list_users(
        skip=skip,
        limit=limit,
        role_filter=role,
        include_inactive=include_inactive
    )

    total = await user_service.count_users(
        role_filter=role,
        include_inactive=include_inactive
    )

    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.post("/")
async def create_user(
    request: Request,
    user_data: UserPreCreate,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """
    Pre-create a user by email (admin only).

    The user will be linked to their Firebase account when they first log in.
    Useful for setting up user roles before they access the system.
    """
    user_service = get_user_service(request)

    try:
        new_user = await user_service.pre_create_user(
            email=user_data.email,
            role=user_data.role,
            display_name=user_data.display_name
        )
        return new_user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
async def get_user_stats(
    request: Request,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """Get user statistics (admin only)."""
    user_service = get_user_service(request)

    total = await user_service.count_users(include_inactive=True)
    active = await user_service.count_users(include_inactive=False)
    admins = await user_service.count_users(role_filter="admin")
    editors = await user_service.count_users(role_filter="editor")
    viewers = await user_service.count_users(role_filter="viewer")

    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "by_role": {
            "admin": admins,
            "editor": editors,
            "viewer": viewers
        }
    }


@router.get("/{firebase_uid}")
async def get_user(
    request: Request,
    firebase_uid: str,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """Get user by Firebase UID (admin only)."""
    user_service = get_user_service(request)

    target_user = await user_service.get_user_by_uid(firebase_uid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    return target_user


@router.patch("/{firebase_uid}")
async def update_user(
    request: Request,
    firebase_uid: str,
    update: UserUpdate,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """Update user profile (admin only)."""
    user_service = get_user_service(request)

    # Check if target is the protected admin
    target_user = await user_service.get_user_by_uid(firebase_uid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent editing protected admin unless current user IS the protected admin
    if target_user.get("email", "").lower() == PROTECTED_ADMIN_EMAIL.lower():
        current_user_email = user.get("email", "").lower()
        if current_user_email != PROTECTED_ADMIN_EMAIL.lower():
            raise HTTPException(
                status_code=403,
                detail="Cannot modify the super admin account"
            )

    updated_user = await user_service.update_user(firebase_uid, update)
    return updated_user


@router.patch("/{firebase_uid}/role")
async def set_user_role(
    request: Request,
    firebase_uid: str,
    role_update: UserRoleUpdate,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """
    Change user role (admin only).

    Cannot demote yourself from admin.
    Cannot change the role of the protected super admin.
    """
    user_service = get_user_service(request)

    # Check if target is the protected admin
    target_user = await user_service.get_user_by_uid(firebase_uid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent changing role of protected admin unless current user IS the protected admin
    if target_user.get("email", "").lower() == PROTECTED_ADMIN_EMAIL.lower():
        current_user_email = user.get("email", "").lower()
        if current_user_email != PROTECTED_ADMIN_EMAIL.lower():
            raise HTTPException(
                status_code=403,
                detail="Cannot change the super admin's role"
            )

    # Prevent admin from demoting themselves
    if firebase_uid == user["uid"] and role_update.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=400,
            detail="Cannot change your own admin role. Ask another admin."
        )

    updated_user = await user_service.set_user_role(firebase_uid, role_update.role)
    return updated_user


@router.delete("/{firebase_uid}")
async def deactivate_user(
    request: Request,
    firebase_uid: str,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """
    Deactivate user (soft delete, admin only).

    Cannot deactivate yourself.
    Cannot deactivate the protected super admin.
    """
    user_service = get_user_service(request)

    # Check if target is the protected admin
    target_user = await user_service.get_user_by_uid(firebase_uid)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent deactivating protected admin - no one can do this
    if target_user.get("email", "").lower() == PROTECTED_ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=403,
            detail="Cannot deactivate the super admin account"
        )

    # Prevent admin from deactivating themselves
    if firebase_uid == user["uid"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate yourself"
        )

    success = await user_service.deactivate_user(firebase_uid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deactivated", "firebase_uid": firebase_uid}


@router.post("/{firebase_uid}/reactivate")
async def reactivate_user(
    request: Request,
    firebase_uid: str,
    user: Dict = Depends(firebase_auth.require_admin)
) -> Dict:
    """Reactivate a deactivated user (admin only)."""
    user_service = get_user_service(request)

    success = await user_service.reactivate_user(firebase_uid)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User reactivated", "firebase_uid": firebase_uid}
