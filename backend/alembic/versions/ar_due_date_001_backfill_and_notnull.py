"""Backfill accounts_receivable.due_date and enforce NOT NULL

Sprint stabilization 2026-Q2, Bug 4. ~163 of 190 receivables in production
have due_date IS NULL, breaking overdue detection and aging reports.

Backfill rule: when due_date is NULL, set it to
    COALESCE(invoice_date, created_at::date) + 30 days

(invoice_date is the canonical date the receivable was generated; only fall
back to created_at if some legacy row has invoice_date NULL too.)

After the backfill the column is altered to NOT NULL so future inserts
without an explicit due_date are rejected at the DB layer.

Revision ID: ar_due_date_001
Revises: perm_audit_001
Create Date: 2026-05-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "ar_due_date_001"
down_revision: Union[str, Sequence[str], None] = "perm_audit_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Backfill any receivable with NULL due_date.
    conn.execute(
        sa.text(
            """
            UPDATE accounts_receivable
            SET due_date = COALESCE(invoice_date, created_at::date) + INTERVAL '30 days'
            WHERE due_date IS NULL
            """
        )
    )

    # 2. Enforce NOT NULL at the DB layer.
    op.alter_column(
        "accounts_receivable",
        "due_date",
        existing_type=sa.Date(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "accounts_receivable",
        "due_date",
        existing_type=sa.Date(),
        nullable=True,
    )
