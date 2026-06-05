"""
Integration tests for DB-level constraints added in the 2026-Q2 stabilization
sprint. These hit a real PostgreSQL test DB because they verify constraints
enforced by Postgres (NOT NULL, FK), not by application code:

- Bug 4 (ar_due_date_001): accounts_receivable.due_date is NOT NULL.
- Bug 5 (exp_cat_fk_001): expenses.category is a FK -> expense_categories.code.

The positive cases also exercise the expense_categories seed in conftest, which
must be present for any Expense insert to succeed after Bug 5.
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import AccountsReceivable, Expense


pytestmark = pytest.mark.asyncio


# ============================================================================
# Bug 4 — accounts_receivable.due_date NOT NULL
# ============================================================================

async def test_receivable_without_due_date_is_rejected(db_session: AsyncSession):
    """Inserting an AR with due_date=None must violate the NOT NULL constraint."""
    ar = AccountsReceivable(
        id=uuid4(),
        amount=Decimal("100000"),
        description="Sin fecha de vencimiento",
        invoice_date=date(2026, 5, 1),
        due_date=None,
    )
    db_session.add(ar)

    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


async def test_receivable_with_due_date_is_accepted(db_session: AsyncSession):
    """An AR with a due_date persists normally."""
    ar = AccountsReceivable(
        id=uuid4(),
        amount=Decimal("100000"),
        description="Con fecha de vencimiento",
        invoice_date=date(2026, 5, 1),
        due_date=date(2026, 5, 1) + timedelta(days=30),
    )
    db_session.add(ar)
    await db_session.flush()

    persisted = await db_session.get(AccountsReceivable, ar.id)
    assert persisted is not None
    assert persisted.due_date == date(2026, 5, 31)


# ============================================================================
# Bug 5 — expenses.category FK -> expense_categories.code
# ============================================================================

async def test_expense_with_unknown_category_is_rejected(db_session: AsyncSession):
    """A category code absent from expense_categories must violate the FK."""
    expense = Expense(
        id=uuid4(),
        category="__categoria_inexistente__",
        description="Categoria sin catalogo",
        amount=Decimal("50000"),
        expense_date=date(2026, 5, 1),
    )
    db_session.add(expense)

    with pytest.raises(IntegrityError):
        await db_session.flush()

    await db_session.rollback()


async def test_expense_with_seeded_category_is_accepted(db_session: AsyncSession):
    """A category present in the seeded catalog ('rent') satisfies the FK."""
    expense = Expense(
        id=uuid4(),
        category="rent",
        description="Arriendo del local",
        amount=Decimal("50000"),
        expense_date=date(2026, 5, 1),
    )
    db_session.add(expense)
    await db_session.flush()

    persisted = await db_session.get(Expense, expense.id)
    assert persisted is not None
    assert persisted.category == "rent"
