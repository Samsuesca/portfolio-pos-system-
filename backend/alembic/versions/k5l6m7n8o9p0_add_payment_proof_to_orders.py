"""add payment proof to orders

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2025-12-16 18:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'k5l6m7n8o9p0'
down_revision = 'j4k5l6m7n8o9'
branch_labels = None
depends_on = None


def upgrade():
    """Add payment proof fields to orders table"""
    op.add_column('orders', sa.Column('payment_proof_url', sa.String(500), nullable=True))
    op.add_column('orders', sa.Column('payment_notes', sa.Text(), nullable=True))


def downgrade():
    """Remove payment proof fields from orders table"""
    op.drop_column('orders', 'payment_notes')
    op.drop_column('orders', 'payment_proof_url')
