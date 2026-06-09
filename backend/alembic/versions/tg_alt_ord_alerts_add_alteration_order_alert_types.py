"""add alteration + order_created values to telegram_alert_type_enum

Adds four reactive alert types:
- order_created        (encargo creado en mostrador, distinto de web_order_created)
- alteration_received  (arreglo recibido)
- alteration_delivered (arreglo entregado)
- alteration_payment   (pago de arreglo registrado)

Revision ID: tg_alt_ord_alerts
Revises: order_audit_override_001
Create Date: 2026-06-07 00:00:00.000000

"""
from alembic import op


revision = "tg_alt_ord_alerts"
down_revision = "order_audit_override_001"
branch_labels = None
depends_on = None


_NEW_VALUES = (
    "order_created",
    "alteration_received",
    "alteration_delivered",
    "alteration_payment",
)


def upgrade() -> None:
    # IF NOT EXISTS hace cada ADD idempotente. Mismo patron que la migracion
    # tg_seller_dgst, validada en produccion (PostgreSQL 15).
    for value in _NEW_VALUES:
        op.execute(
            f"ALTER TYPE telegram_alert_type_enum ADD VALUE IF NOT EXISTS '{value}'"
        )


def downgrade() -> None:
    # PostgreSQL no soporta DROP VALUE en enums sin recrear el tipo (requiere
    # actualizar todas las columnas dependientes). Los valores extra no rompen
    # nada si no se usan, asi que el downgrade es no-op intencional.
    pass
