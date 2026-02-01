"""Change orders.delivery_date from TIMESTAMP to DATE

Safely converts the delivery_date column from TIMESTAMP WITHOUT TIME ZONE
to DATE. Existing timestamp values are truncated to date (time portion is
discarded). This is a non-destructive operation - no data is lost because
the time component of delivery_date is not meaningful.

Revision ID: o3p4q5r6s7t8
Revises: n2o3p4q5r6s7
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'o3p4q5r6s7t8'
down_revision: Union[str, None] = 'n2o3p4q5r6s7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Truncate existing timestamps to date values (safe, no data loss)
    op.execute("""
        UPDATE orders
        SET delivery_date = delivery_date::date
        WHERE delivery_date IS NOT NULL
    """)

    # Step 2: Alter column type from TIMESTAMP to DATE
    op.alter_column(
        'orders',
        'delivery_date',
        existing_type=sa.DateTime(),
        type_=sa.Date(),
        existing_nullable=True,
        postgresql_using='delivery_date::date'
    )


def downgrade() -> None:
    # Revert from DATE back to TIMESTAMP WITHOUT TIME ZONE
    # The time portion will default to 00:00:00
    op.alter_column(
        'orders',
        'delivery_date',
        existing_type=sa.Date(),
        type_=sa.DateTime(),
        existing_nullable=True,
        postgresql_using='delivery_date::timestamp without time zone'
    )
