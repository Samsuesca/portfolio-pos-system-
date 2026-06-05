"""Add FK from expenses.category to expense_categories.code

Sprint stabilization 2026-Q2, Bug 5. expenses.category was a free-form
varchar with no referential integrity, allowing typos like 'mercdo' to slip
into production silently. As of the audit, all 24 distinct values in
expenses.category resolve in expense_categories, so we can add the FK
without orphan-resolution work.

The migration:
1. Adds an explicit UNIQUE constraint on expense_categories.code (the
   existing index was UNIQUE but FKs in some Postgres versions require a
   named constraint, not just an index).
2. Adds the FK with ON UPDATE CASCADE (rare-but-safe code rename) and
   ON DELETE RESTRICT (prevents orphaning historical expenses).

Pre-flight check is enforced inside upgrade(): the migration aborts with
a clear error if any expense.category does not resolve in the catalog.

Revision ID: exp_cat_fk_001
Revises: ar_due_date_001
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "exp_cat_fk_001"
down_revision: Union[str, Sequence[str], None] = "ar_due_date_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Refuse to add the FK if any expense category does not resolve.
    orphans = conn.execute(
        sa.text(
            """
            SELECT DISTINCT e.category
            FROM expenses e
            LEFT JOIN expense_categories ec ON ec.code = e.category
            WHERE ec.code IS NULL
            ORDER BY 1
            """
        )
    ).fetchall()
    if orphans:
        codes = ", ".join(repr(r[0]) for r in orphans)
        raise RuntimeError(
            f"Cannot add FK expenses.category -> expense_categories.code: "
            f"{len(orphans)} orphan code(s) in expenses: {codes}. "
            "Reclassify or insert these categories first."
        )

    # 2. Add a named UNIQUE constraint on code (was only a unique index before).
    # Idempotent: skip if a UNIQUE constraint with this name already exists.
    has_named_unique = conn.execute(
        sa.text(
            """
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_expense_categories_code'
              AND conrelid = 'expense_categories'::regclass
            """
        )
    ).fetchone()
    if not has_named_unique:
        op.create_unique_constraint(
            "uq_expense_categories_code",
            "expense_categories",
            ["code"],
        )

    # 3. Add the FK constraint expenses.category -> expense_categories.code.
    op.create_foreign_key(
        constraint_name="fk_expenses_category",
        source_table="expenses",
        referent_table="expense_categories",
        local_cols=["category"],
        remote_cols=["code"],
        onupdate="CASCADE",
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_expenses_category",
        "expenses",
        type_="foreignkey",
    )
    # Keep the UNIQUE constraint — no harm leaving it in place; the original
    # index was already UNIQUE so nothing functional changes either way.
    # If a strict revert is required, the constraint can be dropped manually.
