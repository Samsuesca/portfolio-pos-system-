"""add permissions_version to users

Revision ID: c2d3e4f5g6h7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-12

"""
from alembic import op
import sqlalchemy as sa

revision = "c2d3e4f5g6h7"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("permissions_version", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("users", "permissions_version")
