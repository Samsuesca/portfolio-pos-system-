"""add wompi fee fields to payment_transactions

Revision ID: 37d300168e7a
Revises: b1c2d3e4f5g6
Create Date: 2026-03-18 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "37d300168e7a"
down_revision = "b1c2d3e4f5g6"
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
