"""
Tests for the login lockout service (brute-force mitigation).

Mocks Redis via ``patch.object(lockout_mod, "get_redis", ...)`` exactly like
``test_telegram_digest`` — ``patch`` auto-detects the async target and swaps in
an ``AsyncMock``, so ``await get_redis()`` resolves to our fake client.
"""
import pytest
from unittest.mock import AsyncMock, patch

import app.services.login_lockout as lockout_mod
from app.services.login_lockout import (
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_WINDOW_SECONDS,
    _INCR_WITH_TTL_LUA,
    get_lockout_remaining,
    register_failed_attempt,
    clear_failed_attempts,
)

IP = "1.2.3.4"


def _redis(**methods):
    mock = AsyncMock()
    for name, value in methods.items():
        setattr(mock, name, AsyncMock(return_value=value))
    return mock


class TestRegisterFailedAttempt:
    @pytest.mark.unit
    async def test_increments_atomically_with_window_ttl(self):
        """Registers via a single Lua eval carrying the key and the window TTL.

        The INCR+EXPIRE atomicity (and the 'only set TTL when missing' rule) lives
        inside the Lua script, so the unit asserts the eval is invoked correctly;
        the script body itself encodes the fixed-window + self-heal behavior.
        """
        mock_redis = _redis(eval=1)
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            await register_failed_attempt("admin", IP)

        mock_redis.eval.assert_awaited_once_with(
            _INCR_WITH_TTL_LUA, 1, f"login_fail:admin:{IP}", LOCKOUT_WINDOW_SECONDS
        )

    @pytest.mark.unit
    async def test_username_is_normalized(self):
        """Username is trimmed and lowercased so casing can't dodge the counter."""
        mock_redis = _redis(eval=1)
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            await register_failed_attempt("  ADMIN  ", IP)

        assert mock_redis.eval.await_args.args[2] == f"login_fail:admin:{IP}"

    @pytest.mark.unit
    async def test_fail_open_on_redis_error(self):
        """A Redis outage must not raise — registering is a no-op."""
        with patch.object(lockout_mod, "get_redis", side_effect=ConnectionError("down")):
            await register_failed_attempt("admin", IP)  # must not raise


class TestGetLockoutRemaining:
    @pytest.mark.unit
    async def test_below_threshold_returns_none(self):
        mock_redis = _redis(get=str(MAX_FAILED_ATTEMPTS - 1))
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            assert await get_lockout_remaining("admin", IP) is None
        mock_redis.ttl.assert_not_awaited()

    @pytest.mark.unit
    async def test_no_key_returns_none(self):
        mock_redis = _redis(get=None)
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            assert await get_lockout_remaining("admin", IP) is None

    @pytest.mark.unit
    async def test_at_threshold_returns_remaining_ttl(self):
        mock_redis = _redis(get=str(MAX_FAILED_ATTEMPTS), ttl=900)
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            assert await get_lockout_remaining("admin", IP) == 900

    @pytest.mark.unit
    async def test_at_threshold_but_expired_ttl_returns_none(self):
        """If the key has no positive TTL (-1/-2), treat as not locked."""
        mock_redis = _redis(get=str(MAX_FAILED_ATTEMPTS), ttl=-2)
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            assert await get_lockout_remaining("admin", IP) is None

    @pytest.mark.unit
    async def test_fail_open_on_redis_error(self):
        """A Redis outage must not lock anyone out — returns None (allow login)."""
        with patch.object(lockout_mod, "get_redis", side_effect=ConnectionError("down")):
            assert await get_lockout_remaining("admin", IP) is None


class TestClearFailedAttempts:
    @pytest.mark.unit
    async def test_deletes_counter_key(self):
        mock_redis = _redis()
        with patch.object(lockout_mod, "get_redis", return_value=mock_redis):
            await clear_failed_attempts("admin", IP)
        mock_redis.delete.assert_awaited_once_with(f"login_fail:admin:{IP}")

    @pytest.mark.unit
    async def test_fail_open_on_redis_error(self):
        with patch.object(lockout_mod, "get_redis", side_effect=ConnectionError("down")):
            await clear_failed_attempts("admin", IP)  # must not raise
