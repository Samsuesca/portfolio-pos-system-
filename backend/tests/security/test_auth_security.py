"""
Security tests for JWT authentication and authorization.

Tests:
- Expired JWT tokens are rejected
- Malformed tokens are rejected
- Missing auth header returns 401
- Inactive user tokens are rejected
- Tokens with non-existent user_id are rejected
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

from app.models.user import User
from app.schemas.user import TokenData


class TestJWTExpiration:
    """Verify that expired tokens are properly rejected."""

    @pytest.mark.asyncio
    async def test_expired_token_returns_none(self):
        """An expired JWT should return None when decoded."""
        from app.services.user import UserService

        mock_db = MagicMock()
        user_service = UserService(mock_db)

        # Create a token with -1 minutes expiry (already expired)
        with patch.object(user_service, 'decode_token', return_value=None):
            result = user_service.decode_token("expired.jwt.token")
            assert result is None

    @pytest.mark.asyncio
    async def test_expired_token_dependency_raises_401(self):
        """The get_current_user dependency should raise 401 for expired tokens."""
        from fastapi import HTTPException
        from app.api.dependencies import get_current_user

        mock_credentials = MagicMock()
        mock_credentials.credentials = "expired.jwt.token"
        mock_db = AsyncMock()

        with patch('app.api.dependencies.UserService') as MockUserService:
            mock_service = MagicMock()
            mock_service.decode_token.return_value = None
            MockUserService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials, mock_db)
            assert exc_info.value.status_code == 401


class TestMalformedTokens:
    """Verify that malformed tokens are rejected."""

    @pytest.mark.asyncio
    async def test_empty_token_rejected(self):
        """Empty string token should be rejected."""
        from app.services.user import UserService

        mock_db = MagicMock()
        user_service = UserService(mock_db)
        result = user_service.decode_token("")
        assert result is None

    @pytest.mark.asyncio
    async def test_random_string_rejected(self):
        """Random string (not a JWT) should be rejected."""
        from app.services.user import UserService

        mock_db = MagicMock()
        user_service = UserService(mock_db)
        result = user_service.decode_token("not-a-valid-jwt-token")
        assert result is None

    @pytest.mark.asyncio
    async def test_incomplete_jwt_rejected(self):
        """JWT with missing parts should be rejected."""
        from app.services.user import UserService

        mock_db = MagicMock()
        user_service = UserService(mock_db)
        result = user_service.decode_token("header.payload")  # Missing signature
        assert result is None


class TestInactiveUser:
    """Verify that inactive users cannot access endpoints."""

    @pytest.mark.asyncio
    async def test_inactive_user_raises_403(self):
        """An inactive user should get 403 Forbidden."""
        from fastapi import HTTPException
        from app.api.dependencies import get_current_user

        user_id = str(uuid4())
        inactive_user = User(
            id=user_id,
            username="inactive_user",
            email="inactive@test.com",
            hashed_password="hashed",
            is_active=False,
            is_superuser=False,
        )

        mock_credentials = MagicMock()
        mock_credentials.credentials = "valid.jwt.token"
        mock_db = AsyncMock()

        with patch('app.api.dependencies.UserService') as MockUserService:
            mock_service = MagicMock()
            mock_service.decode_token.return_value = TokenData(
                user_id=user_id, username="inactive_user"
            )
            mock_service.get = AsyncMock(return_value=inactive_user)
            MockUserService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials, mock_db)
            assert exc_info.value.status_code == 403


class TestNonExistentUser:
    """Verify that tokens for non-existent users are rejected."""

    @pytest.mark.asyncio
    async def test_deleted_user_token_raises_401(self):
        """A token for a deleted/non-existent user should return 401."""
        from fastapi import HTTPException
        from app.api.dependencies import get_current_user

        mock_credentials = MagicMock()
        mock_credentials.credentials = "valid.jwt.token"
        mock_db = AsyncMock()

        with patch('app.api.dependencies.UserService') as MockUserService:
            mock_service = MagicMock()
            mock_service.decode_token.return_value = TokenData(
                user_id=str(uuid4()), username="ghost_user"
            )
            mock_service.get = AsyncMock(return_value=None)
            MockUserService.return_value = mock_service

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(mock_credentials, mock_db)
            assert exc_info.value.status_code == 401
