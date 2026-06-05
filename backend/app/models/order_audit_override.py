"""
Order Audit Override Model — capa de verdad contable para encargos huérfanos.

Materializa el acta de la auditoría forense de encargos (GATE 0,
`docs/v3/formalization/encargos-audit-2026-06-04.md`) SIN tocar el estado
público del encargo (`orders.status`), cuyo cambio dispararía notificaciones
de entrega al cliente.

Principio de diseño (tres capas):
- **Pública** (`orders.status`): NUNCA se toca. Es lo que ve cliente/vendedora
  y lo que dispara emails.
- **Tesorería** (`transactions` + balance): solo para la disposición
  ``PAYMENT_RETRO`` se materializa la caja real que entró pero nunca se
  registró, reusando el flujo canónico ``OrderService.add_payment``. El resto
  de disposiciones NO mueve plata.
- **Auditoría** (esta tabla): registra la realidad auditada por encargo
  (``real_status``, ``real_balance``, ``disposition``) + el porqué. Los
  reportes que necesitan la verdad a nivel de encargo (revenue accrual de
  ``OrdersStreamCalculator`` y AR aging) hacen ``LEFT JOIN`` contra esta tabla
  y honran ``real_status`` / ``real_balance`` cuando existe override.

Idempotencia: ``order_id`` es UNIQUE — re-aplicar el acta hace upsert, no
duplica. La caja del grupo A se protege por ``reference_code`` en la
``Transaction`` (mismo patrón que el resto de pagos).
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    DateTime,
    Numeric,
    String,
    Text,
    Boolean,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.models.order import OrderStatus
from app.utils.timezone import get_colombia_now_naive


class OrderAuditDisposition(str, enum.Enum):
    """Resolución contable de un encargo anómalo (del acta forense)."""

    PAYMENT_RETRO = "payment_retro"          # A — pago entró sin registrar; se materializa caja real
    PHANTOM_EXCHANGE = "phantom_exchange"    # E — saldo fantasma de cambio; ya cobrado en venta original
    CANCELLED = "cancelled"                  # D — cliente no llevó / sin ingreso
    WRITE_OFF = "write_off"                  # C — castigo (centavos / incobrable)
    LEGIT_RECEIVABLE = "legit_receivable"    # B — CxC real vigente; override solo informativo


class OrderAuditOverride(Base):
    """
    Verdad contable auditada de un encargo, sin alterar su estado público.

    Una fila por encargo decidido en la sesión forense. Los reportes la
    consultan vía ``LEFT JOIN`` y usan ``real_status``/``real_balance`` cuando
    está presente; si ``real_status`` es NULL, el encargo conserva su estado.
    """

    __tablename__ = "order_audit_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    # Código prefijado (<SCHOOL>-ENC-…) duplicado por legibilidad/auditoría.
    order_code: Mapped[str] = mapped_column(String(100), nullable=False)

    disposition: Mapped[OrderAuditDisposition] = mapped_column(
        SQLEnum(
            OrderAuditDisposition,
            name="order_audit_disposition_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )

    # Realidad auditada. real_status NULL = el encargo conserva su orders.status.
    real_status: Mapped[OrderStatus | None] = mapped_column(
        SQLEnum(OrderStatus, name="order_status_enum", create_type=False),
        nullable=True,
    )
    real_paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    real_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)

    audit_explanation: Mapped[str] = mapped_column(Text, nullable=False)

    # CRÍTICO: false ⇒ materializar la realidad NUNCA notifica al cliente.
    notify_client: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    external_evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Para grupo A: la Transaction de ingreso creada al materializar la caja.
    transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True,
    )

    auditor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    audited_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False,
    )

    # Relationships
    order: Mapped["Order"] = relationship()  # noqa: F821
    transaction: Mapped["Transaction | None"] = relationship()  # noqa: F821
    auditor: Mapped["User | None"] = relationship()  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<OrderAuditOverride(code='{self.order_code}', "
            f"disposition='{self.disposition.value}')>"
        )
