"""
Cost Change Log Model — audit trail para cambios en costos por componente.

Sigue el patrón de InventoryLog (audit by-domain, append-only). Cada cambio
en un `ProductCostComponent` genera una fila acá: who, when, amount_before,
amount_after, change_type, reason.

DISEÑO EXTENSIBLE para modelación dinámica futura:
- El enum `CostChangeType` ya contempla `bulk_apply` y `import`; futuro
  `input_price_change` se agrega vía `ALTER TYPE ... ADD VALUE` sin migración
  intrusiva. Esto deja preparado el sistema para cuando se modelen insumos
  compartidos (ej: "Tela Lacost") con precio histórico.
- `reason` es Text libre — absorbe contexto cuando se introduzcan inputs:
  `reason="Tela Lacost: $5000→$5500/m"`.
- FK `template_id` con ON DELETE SET NULL: aunque se borre el template,
  el historial permanece (auditoría siempre se preserva).
- FK `product_id` con ON DELETE CASCADE: coherente con
  `product_cost_components.product_id ON DELETE CASCADE`.
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, Numeric, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class CostChangeType(str, enum.Enum):
    """Tipos de cambio en costos por componente."""
    CREATED = "created"                              # Componente nuevo
    UPDATED = "updated"                              # Cambio de amount/notes
    DELETED = "deleted"                              # Componente eliminado
    TEMPLATE_ACTIVATED = "template_activated"        # Template reactivado (entra a la suma)
    TEMPLATE_DEACTIVATED = "template_deactivated"    # Template desactivado (sale de la suma)
    BULK_APPLY = "bulk_apply"                        # Cambio masivo via bulk_apply_component
    IMPORT = "import"                                # Import desde xlsx u otra fuente externa


class CostChangeLog(Base):
    """
    Audit trail append-only para cambios en costos por componente.

    Cada cambio en `product_cost_components` (o desactivación/reactivación de
    `cost_component_templates` que afecten un producto) genera un row acá.
    """
    __tablename__ = "cost_change_log"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Producto afectado (requerido — agrupador principal del historial)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Template del componente. Nullable para sobrevivir a borrado del template.
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cost_component_templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ProductCostComponent. Nullable porque puede ser un DELETED.
    product_cost_component_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_cost_components.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Multi-tenant: NULL = producto global
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    change_type: Mapped[CostChangeType] = mapped_column(
        SQLEnum(
            CostChangeType,
            name="cost_change_type_enum",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )

    amount_before: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    amount_after: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    notes_before: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes_after: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Free-form: "manual edit", "Bulk apply: Tela", "import 2026-05-17", etc.
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False,
    )

    # Relaciones (lazy, foreign_keys explícito como en InventoryLog)
    product: Mapped["Product"] = relationship(
        "Product", foreign_keys=[product_id]
    )
    template: Mapped["CostComponentTemplate | None"] = relationship(
        "CostComponentTemplate", foreign_keys=[template_id]
    )
    product_cost_component: Mapped["ProductCostComponent | None"] = relationship(
        "ProductCostComponent", foreign_keys=[product_cost_component_id]
    )
    school: Mapped["School | None"] = relationship(
        "School", foreign_keys=[school_id]
    )
    changed_by_user: Mapped["User | None"] = relationship(
        "User", foreign_keys=[changed_by]
    )

    def __repr__(self) -> str:
        return (
            f"<CostChangeLog(type='{self.change_type.value}', "
            f"product={self.product_id}, before={self.amount_before}, after={self.amount_after})>"
        )
