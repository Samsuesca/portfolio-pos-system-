"""
Unit Tests for PermissionInvalidator.

Verifica el contrato del coordinador de invalidacion:
  1. bump_user emite UPDATE permissions_version + 1 y registra para flush.
  2. bump_users_by_custom_role hace bulk update y registra todos los pares.
  3. flush_cache_after_commit invalida cache solo despues de llamarse.
  4. flush no invalida hasta que se llama explicitamente (defensa contra
     race del finding #21 del audit 2026-05-01).
"""
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import permission_cache as pc
from app.services.permission_invalidation import PermissionInvalidator


@pytest.fixture(autouse=True)
def _clear_caches():
    pc._permission_cache.clear()
    pc._constraint_cache.clear()
    yield
    pc._permission_cache.clear()
    pc._constraint_cache.clear()


def _uid():
    return uuid.uuid4()


def _mock_session_with_pairs(pairs: list[tuple]) -> AsyncMock:
    """Mock AsyncSession donde el primer execute() devuelve filas con .all()."""
    session = AsyncMock()
    select_result = MagicMock()
    select_result.all = MagicMock(return_value=pairs)
    update_result = MagicMock()
    session.execute = AsyncMock(side_effect=[select_result, update_result])
    return session


# ============================================================================
# bump_user
# ============================================================================


class TestBumpUser:

    @pytest.mark.asyncio
    async def test_emits_update_statement(self):
        # Arrange
        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        user_id = _uid()
        school_id = _uid()

        # Act
        await invalidator.bump_user(user_id, school_id)

        # Assert
        assert session.execute.await_count == 1

    @pytest.mark.asyncio
    async def test_registers_user_for_post_commit_flush(self):
        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        user_id = _uid()
        school_id = _uid()

        await invalidator.bump_user(user_id, school_id)

        assert invalidator._post_commit_users == [(user_id, school_id)]

    @pytest.mark.asyncio
    async def test_school_id_is_optional(self):
        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        user_id = _uid()

        await invalidator.bump_user(user_id)

        assert invalidator._post_commit_users == [(user_id, None)]


# ============================================================================
# bump_users_by_custom_role
# ============================================================================


class TestBumpUsersByCustomRole:

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_users_assigned(self):
        session = _mock_session_with_pairs([])
        invalidator = PermissionInvalidator(session)
        role_id = _uid()

        affected = await invalidator.bump_users_by_custom_role(role_id)

        assert affected == 0
        # Solo el SELECT, no el UPDATE
        assert session.execute.await_count == 1

    @pytest.mark.asyncio
    async def test_returns_count_of_distinct_users(self):
        u1, u2 = _uid(), _uid()
        s1, s2 = _uid(), _uid()
        # u1 esta en s1 y s2; u2 solo en s1. 2 users distintos.
        pairs = [(u1, s1), (u1, s2), (u2, s1)]
        session = _mock_session_with_pairs(pairs)
        invalidator = PermissionInvalidator(session)

        affected = await invalidator.bump_users_by_custom_role(_uid())

        assert affected == 2

    @pytest.mark.asyncio
    async def test_registers_all_pairs_for_flush(self):
        u1, u2 = _uid(), _uid()
        s1, s2 = _uid(), _uid()
        pairs = [(u1, s1), (u2, s2)]
        session = _mock_session_with_pairs(pairs)
        invalidator = PermissionInvalidator(session)

        await invalidator.bump_users_by_custom_role(_uid())

        assert sorted(invalidator._post_commit_users) == sorted(pairs)

    @pytest.mark.asyncio
    async def test_executes_bulk_update_when_users_present(self):
        pairs = [(_uid(), _uid()), (_uid(), _uid())]
        session = _mock_session_with_pairs(pairs)
        invalidator = PermissionInvalidator(session)

        await invalidator.bump_users_by_custom_role(_uid())

        # Un SELECT + un UPDATE en bulk
        assert session.execute.await_count == 2


# ============================================================================
# flush_cache_after_commit
# ============================================================================


class TestFlushCacheAfterCommit:

    @pytest.mark.asyncio
    async def test_clears_cache_entries_for_marked_users(self):
        user_id = _uid()
        school_id = _uid()
        pc.set_permissions(user_id, school_id, {"sales.view"})
        assert pc.get_permissions(user_id, school_id) == {"sales.view"}

        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        await invalidator.bump_user(user_id, school_id)
        invalidator.flush_cache_after_commit()

        assert pc.get_permissions(user_id, school_id) is None

    @pytest.mark.asyncio
    async def test_does_not_flush_before_being_called(self):
        # Defensa contra finding #21: invalidate before commit puede repoblar
        # cache con datos pre-commit en otros workers.
        user_id = _uid()
        school_id = _uid()
        pc.set_permissions(user_id, school_id, {"sales.view"})

        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        await invalidator.bump_user(user_id, school_id)
        # NO llamamos flush_cache_after_commit aun.

        assert pc.get_permissions(user_id, school_id) == {"sales.view"}

    @pytest.mark.asyncio
    async def test_idempotent_after_first_flush(self):
        user_id = _uid()
        school_id = _uid()
        session = AsyncMock()
        invalidator = PermissionInvalidator(session)
        await invalidator.bump_user(user_id, school_id)
        invalidator.flush_cache_after_commit()

        # Segundo flush sin nuevos bumps debe ser no-op.
        pc.set_permissions(user_id, school_id, {"sales.view"})
        invalidator.flush_cache_after_commit()

        assert pc.get_permissions(user_id, school_id) == {"sales.view"}

    @pytest.mark.asyncio
    async def test_no_op_when_nothing_was_bumped(self):
        session = AsyncMock()
        invalidator = PermissionInvalidator(session)

        # No raise.
        invalidator.flush_cache_after_commit()

        assert invalidator._post_commit_users == []
