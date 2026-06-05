"""migrate legacy Sale.payment_method to SalePayment records

Revision ID: sal3paym3nt
Revises: pos1t10n5
Create Date: 2026-04-13

Migrates 34 legacy sales that have payment_method set but no SalePayment records.
Creates corresponding SalePayment rows and nullifies the legacy field.
"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'sal3paym3nt'
down_revision: Union[str, None] = 'pos1t10n5'
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # Create SalePayment records for legacy sales that have payment_method but no sale_payments
    connection.execute(sa.text("""
        INSERT INTO sale_payments (id, sale_id, amount, payment_method, created_at)
        SELECT gen_random_uuid(), s.id, s.paid_amount, s.payment_method, s.created_at
        FROM sales s
        LEFT JOIN sale_payments sp ON sp.sale_id = s.id
        WHERE s.payment_method IS NOT NULL
          AND sp.id IS NULL
          AND s.paid_amount > 0
    """))

    # Clear the legacy field
    connection.execute(sa.text("""
        UPDATE sales SET payment_method = NULL
        WHERE payment_method IS NOT NULL
    """))


def downgrade() -> None:
    connection = op.get_bind()
    # Restore payment_method from the migrated sale_payments for sales with exactly 1 payment
    connection.execute(sa.text("""
        UPDATE sales s
        SET payment_method = sp.payment_method
        FROM sale_payments sp
        WHERE sp.sale_id = s.id
          AND s.payment_method IS NULL
          AND (SELECT COUNT(*) FROM sale_payments WHERE sale_id = s.id) = 1
    """))
