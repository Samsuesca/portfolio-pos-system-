"""add wompi fee fields to payment_transactions

Revision ID: a1b2c3d4e5f6
Revises: z0a1b2c3d4e5
Create Date: 2026-03-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "z0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "payment_transactions",
        sa.Column("wompi_fee_cents", sa.Integer(), nullable=True),
    )
    op.add_column(
        "payment_transactions",
        sa.Column("wompi_fee_tax_cents", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payment_transactions", "wompi_fee_tax_cents")
    op.drop_column("payment_transactions", "wompi_fee_cents")
