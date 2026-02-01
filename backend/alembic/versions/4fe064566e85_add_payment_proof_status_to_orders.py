"""add_payment_proof_status_to_orders

Revision ID: 4fe064566e85
Revises: c1d2e3f4g5h6
Create Date: 2026-01-12 20:59:04.893719

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4fe064566e85'
down_revision = 'c1d2e3f4g5h6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type first
    op.execute("CREATE TYPE payment_proof_status_enum AS ENUM ('pending', 'approved', 'rejected')")

    # Add column to orders table
    op.add_column('orders', sa.Column(
        'payment_proof_status',
        sa.Enum('pending', 'approved', 'rejected', name='payment_proof_status_enum', create_type=False),
        nullable=True
    ))


def downgrade() -> None:
    op.drop_column('orders', 'payment_proof_status')
    op.execute("DROP TYPE payment_proof_status_enum")