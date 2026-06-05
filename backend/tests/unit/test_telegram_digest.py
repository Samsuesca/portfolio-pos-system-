"""
Tests for telegram_digest._already_ran with Redis persistence.
"""
import pytest
from unittest.mock import AsyncMock, patch

import app.services.telegram_digest as digest_mod


def _reset_ran_today():
    digest_mod._ran_today.clear()


class TestAlreadyRan:
    """Test the _already_ran dedup function with Redis and memory fallback."""

    @pytest.mark.unit
    async def test_first_call_returns_false_and_sets_redis_key(self):
        """First call for a task+date sets a Redis key and returns False."""
        _reset_ran_today()

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)
        mock_redis.setex = AsyncMock()

        with patch.object(digest_mod, "get_redis", return_value=mock_redis):
            result = await digest_mod._already_ran("morning", "2026-04-12")

        assert result is False
        mock_redis.setex.assert_called_once_with("tg_digest:morning:2026-04-12", 86400, "1")

    @pytest.mark.unit
    async def test_second_call_returns_true_from_redis(self):
        """Second call for same task+date finds the Redis key and returns True."""
        _reset_ran_today()

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=1)

        with patch.object(digest_mod, "get_redis", return_value=mock_redis):
            result = await digest_mod._already_ran("morning", "2026-04-12")

        assert result is True
        mock_redis.setex.assert_not_called()

    @pytest.mark.unit
    async def test_falls_back_to_memory_when_redis_fails(self):
        """When Redis is unavailable, falls back to in-memory dict."""
        _reset_ran_today()

        with patch.object(digest_mod, "get_redis", side_effect=ConnectionError("Redis down")):
            result1 = await digest_mod._already_ran("morning", "2026-04-12")
            assert result1 is False

            result2 = await digest_mod._already_ran("morning", "2026-04-12")
            assert result2 is True

    @pytest.mark.unit
    async def test_different_dates_are_independent(self):
        """Different date strings are tracked independently."""
        _reset_ran_today()

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)
        mock_redis.setex = AsyncMock()

        with patch.object(digest_mod, "get_redis", return_value=mock_redis):
            r1 = await digest_mod._already_ran("morning", "2026-04-12")
            r2 = await digest_mod._already_ran("morning", "2026-04-13")

        assert r1 is False
        assert r2 is False
        assert mock_redis.setex.call_count == 2

    @pytest.mark.unit
    async def test_different_tasks_are_independent(self):
        """Different task keys are tracked independently."""
        _reset_ran_today()

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=0)
        mock_redis.setex = AsyncMock()

        with patch.object(digest_mod, "get_redis", return_value=mock_redis):
            r1 = await digest_mod._already_ran("morning", "2026-04-12")
            r2 = await digest_mod._already_ran("daily_digest", "2026-04-12")

        assert r1 is False
        assert r2 is False
