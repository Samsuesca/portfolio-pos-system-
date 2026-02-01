"""add_global_product_support_to_sale_changes

Revision ID: fc4f55cc0fd0
Revises: ec3e44bb9fc9
Create Date: 2026-01-17 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'fc4f55cc0fd0'
down_revision = 'ec3e44bb9fc9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new_global_product_id column (nullable FK to global_products)
    op.add_column(
        'sale_changes',
        sa.Column(
            'new_global_product_id',
            postgresql.UUID(as_uuid=True),
            nullable=True
        )
    )

    # Add is_new_global_product column (boolean, default False)
    op.add_column(
        'sale_changes',
        sa.Column(
            'is_new_global_product',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        )
    )

    # Create foreign key constraint
    op.create_foreign_key(
        'fk_sale_changes_new_global_product',
        'sale_changes',
        'global_products',
        ['new_global_product_id'],
        ['id'],
        ondelete='RESTRICT'
    )


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint(
        'fk_sale_changes_new_global_product',
        'sale_changes',
        type_='foreignkey'
    )

    # Drop columns
    op.drop_column('sale_changes', 'is_new_global_product')
    op.drop_column('sale_changes', 'new_global_product_id')
