"""add delivery zones and order delivery fields

Revision ID: n8o9p0q1r2s3
Revises: m7n8o9p0q1r2
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'n8o9p0q1r2s3'
down_revision = 'm7n8o9p0q1r2'
branch_labels = None
depends_on = None


def upgrade():
    # Crear tabla delivery_zones
    op.create_table(
        'delivery_zones',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('delivery_fee', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('estimated_days', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # Crear enum para delivery_type
    delivery_type_enum = sa.Enum('pickup', 'delivery', name='delivery_type_enum')
    delivery_type_enum.create(op.get_bind(), checkfirst=True)

    # Agregar campos a orders
    op.add_column('orders', sa.Column('delivery_type',
        sa.Enum('pickup', 'delivery', name='delivery_type_enum', create_type=False),
        nullable=False, server_default='pickup'))
    op.add_column('orders', sa.Column('delivery_address', sa.String(300), nullable=True))
    op.add_column('orders', sa.Column('delivery_neighborhood', sa.String(100), nullable=True))
    op.add_column('orders', sa.Column('delivery_city', sa.String(100), nullable=True))
    op.add_column('orders', sa.Column('delivery_references', sa.Text(), nullable=True))
    op.add_column('orders', sa.Column('delivery_zone_id', UUID(as_uuid=True), nullable=True))
    op.add_column('orders', sa.Column('delivery_fee', sa.Numeric(10, 2), nullable=False, server_default='0'))

    # Crear FK constraint
    op.create_foreign_key(
        'fk_orders_delivery_zone',
        'orders', 'delivery_zones',
        ['delivery_zone_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_orders_delivery_zone', 'orders', type_='foreignkey')
    op.drop_column('orders', 'delivery_fee')
    op.drop_column('orders', 'delivery_zone_id')
    op.drop_column('orders', 'delivery_references')
    op.drop_column('orders', 'delivery_city')
    op.drop_column('orders', 'delivery_neighborhood')
    op.drop_column('orders', 'delivery_address')
    op.drop_column('orders', 'delivery_type')

    op.execute("DROP TYPE IF EXISTS delivery_type_enum")
    op.drop_table('delivery_zones')
