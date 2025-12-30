"""Firebase Authentication service for verifying ID tokens and managing user roles."""

import firebase_admin
from firebase_admin import credentials, auth
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Optional
import os

# Admin email whitelist
ADMIN_EMAILS = {
    "gil@olorin.ai",
    "admin@olorin.ai",
    "gil.klainert@gmail.com",
    "music909023@gmail.com"
}


class FirebaseAuth:
    """Firebase authentication service."""

    def __init__(self):
        """Initialize Firebase Admin SDK with service account or Application Default Credentials."""
        self._initialized = False
        self.security = HTTPBearer()

        import logging
        logger = logging.getLogger(__name__)

        # Check if Firebase is already initialized
        if firebase_admin._apps:
            self._initialized = True
            return

        # Get service account file path from environment or use default
        service_account_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service-account.json")

        # Try to initialize Firebase Admin SDK
        # First, try with service account file
        if os.path.exists(service_account_path):
            try:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                self._initialized = True
                logger.info(f"Firebase Auth initialized with service account file: {service_account_path}")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize with service account file: {e}")

        # Second, try with Application Default Credentials (works in Cloud Run, GKE, etc.)
        try:
            firebase_admin.initialize_app()
            self._initialized = True
            logger.info("Firebase Auth initialized with Application Default Credentials")
            return
        except Exception as e:
            logger.warning(f"Failed to initialize with Application Default Credentials: {e}")

        logger.error("Firebase Auth could not be initialized - admin endpoints will be unavailable")

    @property
    def is_available(self) -> bool:
        """Check if Firebase Auth is available."""
        return self._initialized

    async def verify_token(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
    ) -> Dict:
        """
        Verify Firebase ID token and return decoded token.

        Args:
            credentials: HTTP Bearer token credentials

        Returns:
            Decoded token dictionary with user info

        Raises:
            HTTPException: If token is invalid or expired
        """
        if not self._initialized:
            raise HTTPException(
                status_code=503,
                detail="Authentication service unavailable"
            )

        try:
            token = credentials.credentials
            decoded_token = auth.verify_id_token(token)
            return decoded_token
        except auth.InvalidIdTokenError:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication token"
            )
        except auth.ExpiredIdTokenError:
            raise HTTPException(
                status_code=401,
                detail="Authentication token has expired"
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Authentication error: {str(e)}"
            )

    def get_user_role(self, email: Optional[str]) -> str:
        """
        Determine user role based on email.

        Args:
            email: User email address

        Returns:
            "admin" if email is in admin whitelist, otherwise "viewer"
        """
        if not email:
            return "viewer"
        return "admin" if email in ADMIN_EMAILS else "viewer"

    async def require_auth(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
    ) -> Dict:
        """
        Dependency to require any authenticated user.

        Args:
            credentials: HTTP Bearer token credentials

        Returns:
            Dictionary with uid, email, and role

        Raises:
            HTTPException: If authentication fails
        """
        token = await self.verify_token(credentials)
        return {
            "uid": token["uid"],
            "email": token.get("email"),
            "role": self.get_user_role(token.get("email"))
        }

    async def require_admin(
        self,
        credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
    ) -> Dict:
        """
        Dependency to require admin role.

        Args:
            credentials: HTTP Bearer token credentials

        Returns:
            Dictionary with uid, email, and role

        Raises:
            HTTPException: If user is not authenticated or not an admin
        """
        user = await self.require_auth(credentials)
        if user["role"] != "admin":
            raise HTTPException(
                status_code=403,
                detail="Admin access required. You do not have permission to access this resource."
            )
        return user


# Singleton instance
firebase_auth = FirebaseAuth()
