"""Order audit overrides (encargos forensic audit — GATE 0)

Materializa el acta de la auditoría forense de encargos huérfanos
(`docs/v3/formalization/encargos-audit-2026-06-04.md`) sin tocar el estado
público de los encargos (`orders.status`), cuyo cambio dispararía
notificaciones de entrega al cliente.

Crea:
- enum `order_audit_disposition_enum` (payment_retro / phantom_exchange /
  cancelled / write_off / legit_receivable)
- tabla `order_audit_overrides` (una fila por encargo decidido; order_id UNIQUE
  para idempotencia del re-apply del acta)

Reusa el enum existente `order_status_enum` para `real_status`.

Revision ID: order_audit_override_001
Revises: catalog_order_001
Create Date: 2026-06-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision: str = "order_audit_override_001"
down_revision: Union[str, Sequence[str], None] = "catalog_order_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DISPOSITION_VALUES = (
    "payment_retro",
    "phantom_exchange",
    "cancelled",
    "write_off",
    "legit_receivable",
)


def upgrade() -> None:
    # create_type=False: lo creamos explícitamente abajo; así op.create_table
    # no intenta re-emitir CREATE TYPE (DuplicateObjectError).
    disposition_enum = postgresql.ENUM(
        *DISPOSITION_VALUES,
        name="order_audit_disposition_enum",
        create_type=False,
    )
    disposition_enum.create(op.get_bind(), checkfirst=True)

    # order_status_enum ya existe (tabla orders) y guarda los NOMBRES del enum
    # (MAYÚSCULAS). create_type=False ⇒ solo se referencia, no se recrea.
    order_status_enum = postgresql.ENUM(
        "PENDING", "IN_PRODUCTION", "READY", "DELIVERED", "CANCELLED",
        name="order_status_enum",
        create_type=False,
    )

    op.create_table(
        "order_audit_overrides",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "order_id",
            UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("order_code", sa.String(length=100), nullable=False),
        sa.Column(
            "disposition",
            disposition_enum,
            nullable=False,
        ),
        sa.Column("real_status", order_status_enum, nullable=True),
        sa.Column("real_paid_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("real_balance", sa.Numeric(12, 2), nullable=True),
        sa.Column("audit_explanation", sa.Text(), nullable=False),
        sa.Column("notify_client", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("external_evidence", sa.Text(), nullable=True),
        sa.Column(
            "transaction_id",
            UUID(as_uuid=True),
            sa.ForeignKey("transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "auditor_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("audited_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    # order_id UNIQUE → idempotencia del acta (upsert por encargo).
    op.create_index(
        "uq_order_audit_override_order_id",
        "order_audit_overrides",
        ["order_id"],
        unique=True,
    )
    op.create_index(
        "ix_order_audit_override_disposition",
        "order_audit_overrides",
        ["disposition"],
    )


def downgrade() -> None:
    op.drop_index("ix_order_audit_override_disposition", table_name="order_audit_overrides")
    op.drop_index("uq_order_audit_override_order_id", table_name="order_audit_overrides")
    op.drop_table("order_audit_overrides")
    postgresql.ENUM(name="order_audit_disposition_enum").drop(op.get_bind(), checkfirst=True)
