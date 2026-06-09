"""B2B data model (B1) — clientes, cotizaciones, contratos

Crea el modelo de datos del tercer pilar (B2B contractual):
- enums: b2b_segment_enum, quotation_status_enum, contract_status_enum,
  contract_milestone_status_enum (valores en minúscula)
- tablas: b2b_clients, quotations, quotation_items, contracts,
  contract_milestones
- ALTER aditivos (nullable, no rompen datos en conciliación):
  accounts_receivable.b2b_client_id, payment_transactions.contract_id

Todas las tablas llevan branch_id nullable → branches (Fase 0a). El IVA se
modela explícito en quotations.tax_amount (dotación corporativa grava).

Ver `docs/v3/v3-branch-architecture/b2b-contracts-model.md`.

Revision ID: b2b_model_001
Revises: branches_foundation_001
Create Date: 2026-06-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision: str = "b2b_model_001"
down_revision: Union[str, Sequence[str], None] = "branches_foundation_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


SEGMENT_VALUES = ("restaurant", "corporate", "sports", "event", "institutional")
QUOTATION_STATUS_VALUES = ("draft", "sent", "negotiation", "accepted", "rejected", "expired")
CONTRACT_STATUS_VALUES = (
    "pending_deposit", "in_production", "partial_delivery", "delivered", "closed", "cancelled"
)
MILESTONE_STATUS_VALUES = ("pending", "delivered", "invoiced", "paid")


def upgrade() -> None:
    # --- Enums: crear explícitamente (create_type=False evita CREATE TYPE doble) ---
    segment_enum = postgresql.ENUM(*SEGMENT_VALUES, name="b2b_segment_enum", create_type=False)
    quotation_status_enum = postgresql.ENUM(
        *QUOTATION_STATUS_VALUES, name="quotation_status_enum", create_type=False
    )
    contract_status_enum = postgresql.ENUM(
        *CONTRACT_STATUS_VALUES, name="contract_status_enum", create_type=False
    )
    milestone_status_enum = postgresql.ENUM(
        *MILESTONE_STATUS_VALUES, name="contract_milestone_status_enum", create_type=False
    )
    for e in (segment_enum, quotation_status_enum, contract_status_enum, milestone_status_enum):
        e.create(op.get_bind(), checkfirst=True)

    # --- b2b_clients ---
    op.create_table(
        "b2b_clients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("legal_name", sa.String(length=250), nullable=False),
        sa.Column("trade_name", sa.String(length=250), nullable=True),
        sa.Column("tax_id", sa.String(length=50), nullable=False),
        sa.Column("segment", segment_enum, nullable=False),
        sa.Column("contact_name", sa.String(length=200), nullable=True),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("contact_email", sa.String(length=200), nullable=True),
        sa.Column("billing_address", sa.Text(), nullable=True),
        sa.Column("credit_limit", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("payment_terms_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_b2b_clients_branch_id", "b2b_clients", ["branch_id"])
    op.create_index("ix_b2b_clients_tax_id", "b2b_clients", ["tax_id"])

    # --- quotations ---
    op.create_table(
        "quotations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("b2b_client_id", UUID(as_uuid=True), sa.ForeignKey("b2b_clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quotation_number", sa.String(length=50), nullable=False),
        sa.Column("status", quotation_status_enum, nullable=False),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date(), nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tax_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("deposit_pct", sa.Numeric(5, 2), nullable=False, server_default="50"),
        sa.Column("estimated_delivery_days", sa.Integer(), nullable=True),
        sa.Column("terms", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("quotation_number", name="uq_quotation_number"),
        sa.CheckConstraint("total >= 0", name="chk_quotation_total_nonneg"),
    )
    op.create_index("ix_quotations_branch_id", "quotations", ["branch_id"])
    op.create_index("ix_quotations_b2b_client_id", "quotations", ["b2b_client_id"])
    op.create_index("ix_quotations_status", "quotations", ["status"])

    # --- quotation_items ---
    op.create_table(
        "quotation_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("quotation_id", UUID(as_uuid=True), sa.ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="SET NULL"), nullable=True),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(14, 2), nullable=False),
        sa.Column("unit_cost_estimate", sa.Numeric(14, 2), nullable=True),
        sa.Column("customization", sa.Text(), nullable=True),
        sa.Column("line_total", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("quantity > 0", name="chk_quotation_item_quantity_positive"),
    )
    op.create_index("ix_quotation_items_quotation_id", "quotation_items", ["quotation_id"])
    op.create_index("ix_quotation_items_product_id", "quotation_items", ["product_id"])

    # --- contracts ---
    op.create_table(
        "contracts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("branch_id", UUID(as_uuid=True), sa.ForeignKey("branches.id", ondelete="SET NULL"), nullable=True),
        sa.Column("b2b_client_id", UUID(as_uuid=True), sa.ForeignKey("b2b_clients.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("quotation_id", UUID(as_uuid=True), sa.ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("contract_number", sa.String(length=50), nullable=False),
        sa.Column("status", contract_status_enum, nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("deposit_received_at", sa.DateTime(), nullable=True),
        sa.Column("deposit_payment_method", sa.String(length=20), nullable=True),
        sa.Column("balance_amount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("delivery_date", sa.Date(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("has_milestones", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("signed_document_url", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("contract_number", name="uq_contract_number"),
        sa.CheckConstraint("total >= 0", name="chk_contract_total_nonneg"),
        sa.CheckConstraint("deposit_amount >= 0", name="chk_contract_deposit_nonneg"),
        sa.CheckConstraint("balance_amount >= 0", name="chk_contract_balance_nonneg"),
    )
    op.create_index("ix_contracts_branch_id", "contracts", ["branch_id"])
    op.create_index("ix_contracts_b2b_client_id", "contracts", ["b2b_client_id"])
    op.create_index("ix_contracts_quotation_id", "contracts", ["quotation_id"])
    op.create_index("ix_contracts_status", "contracts", ["status"])
    op.create_index("ix_contracts_delivered_at", "contracts", ["delivered_at"])

    # --- contract_milestones ---
    op.create_table(
        "contract_milestones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("invoiced_at", sa.DateTime(), nullable=True),
        sa.Column("status", milestone_status_enum, nullable=False),
        sa.CheckConstraint("amount >= 0", name="chk_milestone_amount_nonneg"),
    )
    op.create_index("ix_contract_milestones_contract_id", "contract_milestones", ["contract_id"])

    # --- ALTER aditivos sobre tablas existentes ---
    op.add_column(
        "accounts_receivable",
        sa.Column("b2b_client_id", UUID(as_uuid=True), sa.ForeignKey("b2b_clients.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_accounts_receivable_b2b_client_id", "accounts_receivable", ["b2b_client_id"])

    op.add_column(
        "payment_transactions",
        sa.Column("contract_id", UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_payment_transactions_contract_id", "payment_transactions", ["contract_id"])


def downgrade() -> None:
    op.drop_index("ix_payment_transactions_contract_id", table_name="payment_transactions")
    op.drop_column("payment_transactions", "contract_id")
    op.drop_index("ix_accounts_receivable_b2b_client_id", table_name="accounts_receivable")
    op.drop_column("accounts_receivable", "b2b_client_id")

    op.drop_table("contract_milestones")
    op.drop_table("contracts")
    op.drop_table("quotation_items")
    op.drop_table("quotations")
    op.drop_table("b2b_clients")

    for name in (
        "contract_milestone_status_enum",
        "contract_status_enum",
        "quotation_status_enum",
        "b2b_segment_enum",
    ):
        postgresql.ENUM(name=name).drop(op.get_bind(), checkfirst=True)
