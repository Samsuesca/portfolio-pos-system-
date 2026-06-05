"""global unique codes with school prefix

Migrates Sale.code and Order.code from per-school uniqueness to global
uniqueness by prepending the school's code as a prefix.

Before: VNT-2026-0042 (unique within school_id)
After:  CARACAS-001-VNT-2026-0042 (globally unique)

Synchronizes denormalized copies in:
- print_queue.sale_code
- transactions.reference_code (when it matches sale/order code pattern)
- email_logs.reference_code (when it equals a sale/order code)

Revision ID: v3codes001
Revises: merge_stab_001_unify_heads
Create Date: 2026-05-03 18:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v3codes001"
down_revision: Union[str, None] = "merge_stab_001_unify_heads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("sales", "code", type_=sa.String(40), existing_nullable=False)
    op.alter_column("orders", "code", type_=sa.String(40), existing_nullable=False)
    op.alter_column("print_queue", "sale_code", type_=sa.String(40), existing_nullable=False)

    op.drop_constraint("uq_school_sale_code", "sales", type_="unique")
    op.drop_constraint("uq_school_order_code", "orders", type_="unique")

    op.execute("""
        UPDATE sales s
        SET code = sc.code || '-' || s.code
        FROM schools sc
        WHERE s.school_id = sc.id
          AND s.code NOT LIKE sc.code || '-%'
    """)
    op.execute("""
        UPDATE orders o
        SET code = sc.code || '-' || o.code
        FROM schools sc
        WHERE o.school_id = sc.id
          AND o.code NOT LIKE sc.code || '-%'
    """)

    op.execute("""
        UPDATE print_queue pq
        SET sale_code = sc.code || '-' || pq.sale_code
        FROM sales s, schools sc
        WHERE pq.sale_id = s.id
          AND s.school_id = sc.id
          AND pq.sale_code NOT LIKE sc.code || '-%'
    """)

    op.execute("""
        UPDATE transactions tx
        SET reference_code = sc.code || '-' || tx.reference_code
        FROM schools sc
        WHERE tx.school_id = sc.id
          AND tx.reference_code IS NOT NULL
          AND (tx.reference_code LIKE 'VNT-%' OR tx.reference_code LIKE 'ENC-%')
          AND tx.reference_code NOT LIKE sc.code || '-%'
    """)

    op.execute("""
        UPDATE email_logs el
        SET reference_code = s.code
        FROM sales s
        WHERE el.sale_id = s.id
          AND el.reference_code IS NOT NULL
          AND el.reference_code NOT LIKE '%-VNT-%'
          AND s.code LIKE '%-' || el.reference_code
    """)
    op.execute("""
        UPDATE email_logs el
        SET reference_code = o.code
        FROM orders o
        WHERE el.order_id = o.id
          AND el.reference_code IS NOT NULL
          AND el.reference_code NOT LIKE '%-ENC-%'
          AND o.code LIKE '%-' || el.reference_code
    """)

    op.create_unique_constraint("uq_sale_code_global", "sales", ["code"])
    op.create_unique_constraint("uq_order_code_global", "orders", ["code"])

    conn = op.get_bind()
    bad_sales = conn.execute(sa.text(
        "SELECT COUNT(*) FROM sales WHERE code !~ '^[A-Z]+-[0-9]+-VNT-[0-9]{4}-[0-9]+$'"
    )).scalar()
    if bad_sales > 0:
        raise RuntimeError(
            f"Migration left {bad_sales} sales with invalid code format. "
            "Expected pattern: {SCHOOL}-VNT-YYYY-NNNN. Aborting."
        )
    bad_orders = conn.execute(sa.text(
        "SELECT COUNT(*) FROM orders WHERE code !~ '^[A-Z]+-[0-9]+-ENC-[0-9]{4}-[0-9]+$'"
    )).scalar()
    if bad_orders > 0:
        raise RuntimeError(
            f"Migration left {bad_orders} orders with invalid code format. "
            "Expected pattern: {SCHOOL}-ENC-YYYY-NNNN. Aborting."
        )

    desync = conn.execute(sa.text("""
        SELECT COUNT(*) FROM print_queue pq
        JOIN sales s ON s.id = pq.sale_id
        WHERE pq.sale_code <> s.code
    """)).scalar()
    if desync > 0:
        raise RuntimeError(
            f"Migration left {desync} print_queue rows desynchronized from sales.code. Aborting."
        )


def downgrade() -> None:
    op.drop_constraint("uq_sale_code_global", "sales", type_="unique")
    op.drop_constraint("uq_order_code_global", "orders", type_="unique")

    op.execute("""
        UPDATE sales s
        SET code = SUBSTRING(s.code FROM LENGTH(sc.code) + 2)
        FROM schools sc
        WHERE s.school_id = sc.id
          AND s.code LIKE sc.code || '-%'
    """)
    op.execute("""
        UPDATE orders o
        SET code = SUBSTRING(o.code FROM LENGTH(sc.code) + 2)
        FROM schools sc
        WHERE o.school_id = sc.id
          AND o.code LIKE sc.code || '-%'
    """)
    op.execute("""
        UPDATE print_queue pq
        SET sale_code = SUBSTRING(pq.sale_code FROM LENGTH(sc.code) + 2)
        FROM sales s, schools sc
        WHERE pq.sale_id = s.id
          AND s.school_id = sc.id
          AND pq.sale_code LIKE sc.code || '-%'
    """)
    op.execute("""
        UPDATE transactions tx
        SET reference_code = SUBSTRING(tx.reference_code FROM LENGTH(sc.code) + 2)
        FROM schools sc
        WHERE tx.school_id = sc.id
          AND tx.reference_code IS NOT NULL
          AND (tx.reference_code LIKE sc.code || '-VNT-%'
               OR tx.reference_code LIKE sc.code || '-ENC-%')
    """)
    op.execute("""
        UPDATE email_logs el
        SET reference_code = SUBSTRING(el.reference_code FROM POSITION('-VNT-' IN el.reference_code) + 1)
        WHERE el.reference_code LIKE '%-VNT-%'
    """)
    op.execute("""
        UPDATE email_logs el
        SET reference_code = SUBSTRING(el.reference_code FROM POSITION('-ENC-' IN el.reference_code) + 1)
        WHERE el.reference_code LIKE '%-ENC-%'
    """)

    op.create_unique_constraint(
        "uq_school_sale_code", "sales", ["school_id", "code"]
    )
    op.create_unique_constraint(
        "uq_school_order_code", "orders", ["school_id", "code"]
    )

    op.alter_column("sales", "code", type_=sa.String(30), existing_nullable=False)
    op.alter_column("orders", "code", type_=sa.String(30), existing_nullable=False)
    op.alter_column("print_queue", "sale_code", type_=sa.String(30), existing_nullable=False)
