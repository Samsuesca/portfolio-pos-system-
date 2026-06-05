"""Add reserved_quantity to inventory + backfill from pending orders

Revision ID: inv_reserved_qty
Revises: tg_seller_dgst
Create Date: 2026-05-02

Refactor del sistema de inventario para distinguir stock total (`quantity`) de
stock reservado (`reserved_quantity`). El sistema viejo descontaba `quantity`
al crear un Order pendiente; el sistema nuevo mantiene `quantity` y solo
incrementa `reserved_quantity`. El consumo real (`quantity` baja) ocurre
cuando el item pasa a DELIVERED.

Backfill: por cada OrderItem con `reserved_from_stock=True` y
`Order.status IN ('pending', 'in_production', 'ready')` se devuelve el stock
descontado por el sistema viejo y se crea la reserva en la columna nueva.
"""
from alembic import op
import sqlalchemy as sa


revision = 'inv_reserved_qty'
down_revision = 'tg_seller_dgst'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'inventory',
        sa.Column('reserved_quantity', sa.Integer(), nullable=False, server_default='0')
    )

    op.execute("""
        WITH pending_reservations AS (
            SELECT
                oi.product_id,
                o.school_id,
                SUM(oi.quantity_reserved)::int AS total_reserved
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.reserved_from_stock = true
              AND oi.quantity_reserved > 0
              AND o.status IN ('PENDING', 'IN_PRODUCTION', 'READY')
            GROUP BY oi.product_id, o.school_id
        )
        UPDATE inventory inv
        SET
            quantity = inv.quantity + pr.total_reserved,
            reserved_quantity = pr.total_reserved
        FROM pending_reservations pr
        WHERE inv.product_id = pr.product_id
          AND (
              (inv.school_id IS NULL AND pr.school_id IS NULL)
              OR inv.school_id = pr.school_id
          );
    """)

    op.create_check_constraint(
        'chk_inventory_reserved_positive',
        'inventory',
        'reserved_quantity >= 0'
    )
    op.create_check_constraint(
        'chk_inventory_reserved_lte_quantity',
        'inventory',
        'reserved_quantity <= quantity'
    )


def downgrade() -> None:
    op.drop_constraint('chk_inventory_reserved_lte_quantity', 'inventory', type_='check')
    op.drop_constraint('chk_inventory_reserved_positive', 'inventory', type_='check')

    op.execute("""
        UPDATE inventory
        SET quantity = quantity - reserved_quantity
        WHERE reserved_quantity > 0;
    """)

    op.drop_column('inventory', 'reserved_quantity')
