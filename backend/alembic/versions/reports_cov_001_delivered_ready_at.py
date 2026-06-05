"""Add delivered_at to orders and ready_at to alterations.

Aditiva, idempotente, backward-compatible. Habilita los KPIs de:
  - Lead time real de encargos  (delivered_at - order_date)
  - Tiempo de respuesta de arreglos (ready_at - received_date)
  - Cumplimiento de fechas de entrega (delivered_at <= delivery_date)
  - Vencidos sin retirar (ready_at < today - threshold AND status != DELIVERED)

Antes de esta migracion los reportes usaban `updated_at` como fallback, lo
cual se sobreescribe en cualquier modificacion no relacionada (cambio de
notas, recalculo de saldo, etc.), dando metricas incorrectas.

Backfill: NULL para todos los registros historicos. Los endpoints excluyen
filas NULL en agregaciones de tiempo (no aproximan) y documentan que las
metricas son confiables solo desde la fecha de deploy.

Revision ID: reports_cov_001
Revises: v3_catalog_stab_001
Create Date: 2026-05-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'reports_cov_001'
down_revision: Union[str, None] = 'v3_catalog_stab_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'orders',
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
    )
    op.create_index(
        'ix_orders_delivered_at',
        'orders',
        ['delivered_at'],
    )

    op.add_column(
        'alterations',
        sa.Column('ready_at', sa.DateTime(), nullable=True),
    )
    op.create_index(
        'ix_alterations_ready_at',
        'alterations',
        ['ready_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_alterations_ready_at', table_name='alterations')
    op.drop_column('alterations', 'ready_at')

    op.drop_index('ix_orders_delivered_at', table_name='orders')
    op.drop_column('orders', 'delivered_at')
