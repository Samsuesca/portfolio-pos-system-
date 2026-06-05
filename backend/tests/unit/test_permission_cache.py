"""
Unit Tests for Permission Cache

Tests the application-level TTL cache for permission lookups:
cache key generation, get/set with expiry, eviction, and invalidation.
"""
import uuid
from unittest.mock import patch

import pytest

from app.services import permission_cache as pc


@pytest.fixture(autouse=True)
def _clear_caches():
    """Ensure caches are empty before and after each test."""
    pc._permission_cache.clear()
    pc._constraint_cache.clear()
    yield
    pc._permission_cache.clear()
    pc._constraint_cache.clear()


def _uid():
    return uuid.uuid4()


# ============================================================================
# TEST: _cache_key
# ============================================================================


class TestCacheKey:

    def test_format(self):
        user_id = _uid()
        school_id = _uid()
        key = pc._cache_key(user_id, school_id)
        assert key == f"{user_id}:{school_id}"

    def test_different_ids_produce_different_keys(self):
        u1, u2 = _uid(), _uid()
        s = _uid()
        assert pc._cache_key(u1, s) != pc._cache_key(u2, s)


# ============================================================================
# TEST: get_permissions / set_permissions
# ============================================================================


class TestPermissions:

    @patch("app.services.permission_cache.time")
    def test_store_and_retrieve(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        user_id, school_id = _uid(), _uid()
        perms = {"sales.create", "sales.read"}

        pc.set_permissions(user_id, school_id, perms)
        result = pc.get_permissions(user_id, school_id)

        assert result == perms

    @patch("app.services.permission_cache.time")
    def test_expired_entry_returns_none(self, mock_time):
        user_id, school_id = _uid(), _uid()

        mock_time.monotonic.return_value = 1000.0
        pc.set_permissions(user_id, school_id, {"sales.read"})

        mock_time.monotonic.return_value = 1000.0 + pc._DEFAULT_TTL + 1
        result = pc.get_permissions(user_id, school_id)

        assert result is None

    def test_missing_entry_returns_none(self):
        result = pc.get_permissions(_uid(), _uid())
        assert result is None

    @patch("app.services.permission_cache.time")
    def test_entry_just_at_ttl_boundary_returns_none(self, mock_time):
        user_id, school_id = _uid(), _uid()

        mock_time.monotonic.return_value = 500.0
        pc.set_permissions(user_id, school_id, {"x"})

        mock_time.monotonic.return_value = 500.0 + pc._DEFAULT_TTL + 0.001
        assert pc.get_permissions(user_id, school_id) is None


# ============================================================================
# TEST: get_constraints / set_constraints
# ============================================================================


class TestConstraints:

    @patch("app.services.permission_cache.time")
    def test_store_and_retrieve(self, mock_time):
        mock_time.monotonic.return_value = 2000.0
        user_id, school_id = _uid(), _uid()
        code = "sales.create"
        constraints = {"max_discount": 15, "requires_approval": True}

        pc.set_constraints(user_id, school_id, code, constraints)
        result = pc.get_constraints(user_id, school_id, code)

        assert result == constraints

    @patch("app.services.permission_cache.time")
    def test_permission_code_is_part_of_key(self, mock_time):
        mock_time.monotonic.return_value = 2000.0
        user_id, school_id = _uid(), _uid()

        pc.set_constraints(user_id, school_id, "sales.create", {"a": 1})
        pc.set_constraints(user_id, school_id, "sales.delete", {"b": 2})

        assert pc.get_constraints(user_id, school_id, "sales.create") == {"a": 1}
        assert pc.get_constraints(user_id, school_id, "sales.delete") == {"b": 2}

    @patch("app.services.permission_cache.time")
    def test_expired_returns_none(self, mock_time):
        user_id, school_id = _uid(), _uid()

        mock_time.monotonic.return_value = 100.0
        pc.set_constraints(user_id, school_id, "x", {"limit": 5})

        mock_time.monotonic.return_value = 100.0 + pc._DEFAULT_TTL + 1
        assert pc.get_constraints(user_id, school_id, "x") is None

    def test_missing_returns_none(self):
        assert pc.get_constraints(_uid(), _uid(), "nonexistent") is None


# ============================================================================
# TEST: _evict_expired
# ============================================================================


class TestEvictExpired:

    @patch("app.services.permission_cache.time")
    def test_removes_only_expired(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        pc._permission_cache["old"] = ({"a"}, 900.0)
        pc._permission_cache["fresh"] = ({"b"}, 1000.0)

        mock_time.monotonic.return_value = 1000.0 + pc._DEFAULT_TTL + 1
        pc._evict_expired(pc._permission_cache)

        assert "old" not in pc._permission_cache
        assert "fresh" not in pc._permission_cache

    @patch("app.services.permission_cache.time")
    def test_keeps_non_expired(self, mock_time):
        now = 5000.0
        mock_time.monotonic.return_value = now
        pc._permission_cache["recent"] = ({"x"}, now - 10)
        pc._permission_cache["ancient"] = ({"y"}, now - pc._DEFAULT_TTL - 5)

        pc._evict_expired(pc._permission_cache)

        assert "recent" in pc._permission_cache
        assert "ancient" not in pc._permission_cache


# ============================================================================
# TEST: invalidate
# ============================================================================


class TestInvalidate:

    @patch("app.services.permission_cache.time")
    def test_specific_user_and_school(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        u1, s1 = _uid(), _uid()
        u2, s2 = _uid(), _uid()

        pc.set_permissions(u1, s1, {"a"})
        pc.set_permissions(u2, s2, {"b"})
        pc.set_constraints(u1, s1, "code", {"x": 1})

        pc.invalidate(user_id=u1, school_id=s1)

        assert pc.get_permissions(u1, s1) is None
        assert pc.get_permissions(u2, s2) == {"b"}
        assert pc.get_constraints(u1, s1, "code") is None

    @patch("app.services.permission_cache.time")
    def test_user_only_invalidates_all_schools(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        u1 = _uid()
        s1, s2 = _uid(), _uid()

        pc.set_permissions(u1, s1, {"a"})
        pc.set_permissions(u1, s2, {"b"})
        pc.set_constraints(u1, s1, "c1", {"x": 1})
        pc.set_constraints(u1, s2, "c2", {"y": 2})

        pc.invalidate(user_id=u1)

        assert pc.get_permissions(u1, s1) is None
        assert pc.get_permissions(u1, s2) is None
        assert pc.get_constraints(u1, s1, "c1") is None
        assert pc.get_constraints(u1, s2, "c2") is None

    @patch("app.services.permission_cache.time")
    def test_no_args_clears_everything(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        for _ in range(5):
            pc.set_permissions(_uid(), _uid(), {"perm"})
            pc.set_constraints(_uid(), _uid(), "code", {"k": 1})

        pc.invalidate()

        assert len(pc._permission_cache) == 0
        assert len(pc._constraint_cache) == 0

    @patch("app.services.permission_cache.time")
    def test_invalidate_nonexistent_is_noop(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        pc.set_permissions(_uid(), _uid(), {"a"})
        before_count = len(pc._permission_cache)

        pc.invalidate(user_id=_uid(), school_id=_uid())

        assert len(pc._permission_cache) == before_count

    @patch("app.services.permission_cache.time")
    def test_school_only_clears_only_that_school(self, mock_time):
        # Regression for finding #5 of audit 2026-05-01:
        # invalidate(school_id=...) used to clear the entire cache.
        mock_time.monotonic.return_value = 1000.0
        u1, u2 = _uid(), _uid()
        s_target, s_other = _uid(), _uid()

        pc.set_permissions(u1, s_target, {"a"})
        pc.set_permissions(u2, s_target, {"b"})
        pc.set_permissions(u1, s_other, {"c"})
        pc.set_permissions(u2, s_other, {"d"})

        pc.invalidate(school_id=s_target)

        assert pc.get_permissions(u1, s_target) is None
        assert pc.get_permissions(u2, s_target) is None
        assert pc.get_permissions(u1, s_other) == {"c"}
        assert pc.get_permissions(u2, s_other) == {"d"}

    @patch("app.services.permission_cache.time")
    def test_school_only_clears_constraints_for_that_school(self, mock_time):
        mock_time.monotonic.return_value = 1000.0
        u = _uid()
        s_target, s_other = _uid(), _uid()

        pc.set_constraints(u, s_target, "code1", {"v": 1})
        pc.set_constraints(u, s_other, "code2", {"v": 2})

        pc.invalidate(school_id=s_target)

        assert pc.get_constraints(u, s_target, "code1") is None
        assert pc.get_constraints(u, s_other, "code2") == {"v": 2}

    @patch("app.services.permission_cache.time")
    def test_user_only_uses_separator_not_prefix_clash(self, mock_time):
        # Defense against a subtle bug: previous code used str(user_id) as
        # prefix without trailing colon, which would falsely match user_ids
        # that happen to share a prefix (extremely rare with UUIDs but
        # cleaner to enforce the separator).
        mock_time.monotonic.return_value = 1000.0
        u_target = _uid()
        s = _uid()
        pc.set_permissions(u_target, s, {"a"})

        # A different user that does NOT share the prefix.
        pc.set_permissions(_uid(), s, {"b"})

        pc.invalidate(user_id=u_target)

        assert pc.get_permissions(u_target, s) is None
        # The other user's entry must still exist.
        assert len(pc._permission_cache) == 1


# ============================================================================
# TEST: _max_entries eviction
# ============================================================================


class TestMaxEntries:

    @patch("app.services.permission_cache.time")
    def test_eviction_triggers_when_full(self, mock_time):
        original_max = pc._max_entries
        try:
            pc._max_entries = 5
            mock_time.monotonic.return_value = 1.0

            for i in range(5):
                pc.set_permissions(_uid(), _uid(), {f"perm_{i}"})

            assert len(pc._permission_cache) == 5

            mock_time.monotonic.return_value = 1.0 + pc._DEFAULT_TTL + 10
            pc.set_permissions(_uid(), _uid(), {"new_perm"})

            assert len(pc._permission_cache) == 1
        finally:
            pc._max_entries = original_max

    @patch("app.services.permission_cache.time")
    def test_constraint_cache_eviction(self, mock_time):
        original_max = pc._max_entries
        try:
            pc._max_entries = 3
            mock_time.monotonic.return_value = 100.0

            for i in range(3):
                pc.set_constraints(_uid(), _uid(), f"code_{i}", {"v": i})

            assert len(pc._constraint_cache) == 3

            mock_time.monotonic.return_value = 100.0 + pc._DEFAULT_TTL + 5
            pc.set_constraints(_uid(), _uid(), "new_code", {"v": 99})

            assert len(pc._constraint_cache) == 1
        finally:
            pc._max_entries = original_max

    @patch("app.services.permission_cache.time")
    def test_no_eviction_when_under_max(self, mock_time):
        mock_time.monotonic.return_value = 1000.0

        for i in range(3):
            pc.set_permissions(_uid(), _uid(), {f"p{i}"})

        assert len(pc._permission_cache) == 3
