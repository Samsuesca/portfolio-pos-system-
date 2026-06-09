"""B2B (B3.5) — FE DIAN para contratos: 4to tipo de documento + contract_id

- Agrega el valor 'contract' al enum invoice_document_type_enum (idempotente).
- Agrega columna contract_id (FK contracts) a electronic_invoices.
- Reescribe el CHECK chk_electronic_invoice_single_document a "exactamente 1 de 4"
  (sale/order/alteration/contract).

La dotación corporativa B2B grava IVA (≠ uniforme escolar excluido); el IVA se
arma en el payload de Alegra (no en este esquema).

Revision ID: b2b_fe_contract_001
Revises: b2b_anticipos_account_001
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "b2b_fe_contract_001"
down_revision: Union[str, Sequence[str], None] = "b2b_anticipos_account_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_CHECK_NAME = "chk_electronic_invoice_single_document"
_CHECK_4 = (
    "(CASE WHEN sale_id IS NOT NULL THEN 1 ELSE 0 END + "
    "CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END + "
    "CASE WHEN alteration_id IS NOT NULL THEN 1 ELSE 0 END + "
    "CASE WHEN contract_id IS NOT NULL THEN 1 ELSE 0 END) = 1"
)
_CHECK_3 = (
    "(CASE WHEN sale_id IS NOT NULL THEN 1 ELSE 0 END + "
    "CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END + "
    "CASE WHEN alteration_id IS NOT NULL THEN 1 ELSE 0 END) = 1"
)


def upgrade() -> None:
    # IF NOT EXISTS → idempotente (mismo patrón validado en prod, PostgreSQL 15).
    op.execute(
        "ALTER TYPE invoice_document_type_enum ADD VALUE IF NOT EXISTS 'contract'"
    )

    op.add_column(
        "electronic_invoices",
        sa.Column(
            "contract_id",
            UUID(as_uuid=True),
            sa.ForeignKey("contracts.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_electronic_invoices_contract_id", "electronic_invoices", ["contract_id"]
    )

    op.drop_constraint(_CHECK_NAME, "electronic_invoices", type_="check")
    op.create_check_constraint(_CHECK_NAME, "electronic_invoices", _CHECK_4)


def downgrade() -> None:
    op.drop_constraint(_CHECK_NAME, "electronic_invoices", type_="check")
    op.create_check_constraint(_CHECK_NAME, "electronic_invoices", _CHECK_3)
    op.drop_index("ix_electronic_invoices_contract_id", table_name="electronic_invoices")
    op.drop_column("electronic_invoices", "contract_id")
    # El valor 'contract' del enum permanece: PostgreSQL no soporta DROP VALUE
    # sin recrear el tipo; es inofensivo si no se usa.
