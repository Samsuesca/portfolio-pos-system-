"""Add failed_inventory_logs DLQ table

Revision ID: inv_failed_logs
Revises: inv_reserved_qty
Create Date: 2026-05-02

Dead-letter queue para logs de movimientos de inventario que fallaron al
escribirse despues de los reintentos. Permite reprocesar mas tarde via
cron y preservar la auditoria sin bloquear ventas/operaciones.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'inv_failed_logs'
down_revision = 'inv_reserved_qty'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'failed_inventory_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('inventory_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('movement_type', sa.String(length=50), nullable=False),
        sa.Column('movement_date', sa.Date(), nullable=False),
        sa.Column('quantity_delta', sa.Integer(), nullable=False),
        sa.Column('quantity_after', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=True),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sale_change_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('original_created_at', sa.DateTime(), nullable=False),
        sa.Column('failed_at', sa.DateTime(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=False),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_retry_at', sa.DateTime(), nullable=True),
        sa.Column('resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_log_id', postgresql.UUID(as_uuid=True), nullable=True),
    )

    op.create_index(
        'ix_failed_inventory_logs_resolved',
        'failed_inventory_logs',
        ['resolved'],
        postgresql_where=sa.text('resolved = false'),
    )
    op.create_index(
        'ix_failed_inventory_logs_failed_at',
        'failed_inventory_logs',
        ['failed_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_failed_inventory_logs_failed_at', table_name='failed_inventory_logs')
    op.drop_index('ix_failed_inventory_logs_resolved', table_name='failed_inventory_logs')
    op.drop_table('failed_inventory_logs')
