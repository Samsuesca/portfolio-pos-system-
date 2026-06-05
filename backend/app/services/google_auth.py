import logging

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
    _GOOGLE_AVAILABLE = True
except ImportError:
    _GOOGLE_AVAILABLE = False

from app.core.config import Settings

logger = logging.getLogger(__name__)


class GoogleAuthService:
    def __init__(self, settings: Settings):
        if not _GOOGLE_AVAILABLE:
            logger.warning("google-auth not installed — Google OAuth disabled")
        self._client_ids = settings.google_client_ids if _GOOGLE_AVAILABLE else []
        self._request = google_requests.Request() if _GOOGLE_AVAILABLE else None

    def verify_id_token(self, token: str) -> dict | None:
        if not _GOOGLE_AVAILABLE or not self._client_ids:
            logger.error("Google OAuth no configurado: no hay client IDs")
            return None

        try:
            idinfo = id_token.verify_oauth2_token(
                token, self._request, clock_skew_in_seconds=10
            )

            if idinfo.get("aud") not in self._client_ids:
                logger.warning("Google token con audience invalido: %s", idinfo.get("aud"))
                return None

            if not idinfo.get("email_verified", False):
                logger.warning("Google token con email no verificado: %s", idinfo.get("email"))
                return None

            return {
                "sub": idinfo["sub"],
                "email": idinfo["email"],
                "name": idinfo.get("name", ""),
                "given_name": idinfo.get("given_name", ""),
                "family_name": idinfo.get("family_name", ""),
                "picture": idinfo.get("picture"),
                "email_verified": idinfo.get("email_verified", False),
            }
        except ValueError as e:
            logger.warning("Google ID token invalido: %s", e)
            return None
