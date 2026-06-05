"""add unit_cost to sale_items and order_items

Revision ID: d3e4f5g6h7i8
Revises: c2d3e4f5g6h7
Create Date: 2026-04-12

Snapshots Product.cost at sale/order creation time so that
changing a product's cost later does not alter historical reports.
"""
from alembic import op
import sqlalchemy as sa


revision = "d3e4f5g6h7i8"
down_revision = "c2d3e4f5g6h7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sale_items",
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "order_items",
        sa.Column("unit_cost", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("order_items", "unit_cost")
    op.drop_column("sale_items", "unit_cost")
