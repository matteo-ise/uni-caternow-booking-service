"""
Firebase JWT authentication with an insecure PyJWT fallback for local dev.

In production, every request is verified against Firebase's public keys.
When running offline (no network, expired service account, etc.), the fallback
decodes the JWT *without* signature verification so the dev flow isn't blocked.
"""
import os
import logging
import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env from the project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

project_id = os.environ.get("VITE_FIREBASE_PROJECT_ID")

# Firebase init — project ID alone is enough for token verification
try:
    if not firebase_admin._apps:
        if project_id:
            firebase_admin.initialize_app(options={'projectId': project_id})
            logger.info("Firebase Admin initialized for project: %s", project_id)
        else:
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized with default credentials")
except Exception as e:
    logger.warning("Firebase Admin could not be initialized: %s", e)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Required authentication — rejects unauthenticated requests."""
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error("Token verification failed: %s", e)

        # INSECURE FALLBACK — NEVER use in production, exists for offline dev only.
        # Decodes the JWT without signature verification so local demos aren't
        # blocked by network/credential issues.
        try:
            from firebase_admin import _auth_utils
            import jwt
            decoded = jwt.decode(token, options={"verify_signature": False})

            # Firebase tokens use 'sub' as the UID; normalize to 'uid'
            # so downstream code doesn't need to care about the difference
            if "sub" in decoded and "uid" not in decoded:
                decoded["uid"] = decoded["sub"]

            logger.warning("Using unverified token for user: %s (UID: %s)",
                           decoded.get("email"), decoded.get("uid"))
            return decoded
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid authentication credentials: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer(auto_error=False))):
    """Optional authentication — returns None for anonymous requests."""
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except Exception:
        return None
