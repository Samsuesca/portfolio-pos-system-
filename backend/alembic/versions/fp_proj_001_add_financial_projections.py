"""add financial_projections table

Revision ID: fp_proj_001
Revises: inv_failed_logs
Create Date: 2026-05-02

Stores multi-month financial projections with their assumptions and results.
Used by ProjectionService for scenario modeling (formalization A/B/C, expansion,
SaaS revenue, etc.).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "fp_proj_001"
down_revision: Union[str, None] = "inv_failed_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "financial_projections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("scenario_label", sa.String(length=50), nullable=True),
        sa.Column("months_count", sa.Integer(), nullable=False),
        sa.Column("start_year", sa.Integer(), nullable=False),
        sa.Column("start_month", sa.Integer(), nullable=False),
        sa.Column("assumptions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("results", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("summary", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_financial_projections_created_by"),
        "financial_projections",
        ["created_by"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_projections_created_at"),
        "financial_projections",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        "ix_financial_projections_scenario",
        "financial_projections",
        ["scenario_label"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_financial_projections_scenario", table_name="financial_projections")
    op.drop_index(
        op.f("ix_financial_projections_created_at"), table_name="financial_projections"
    )
    op.drop_index(
        op.f("ix_financial_projections_created_by"), table_name="financial_projections"
    )
    op.drop_table("financial_projections")
