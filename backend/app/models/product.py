"""
Product and Inventory Models (unified — school_id=NULL means global)
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Index, Integer, Numeric, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class GarmentType(Base):
    __tablename__ = "garment_types"
    __table_args__ = (
        Index("uq_school_garment_type", "school_id", "name", unique=True, postgresql_where="school_id IS NOT NULL"),
        Index("uq_unified_global_garment_type_name", "name", unique=True, postgresql_where="school_id IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(50))

    requires_embroidery: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_custom_measurements: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cost_type: Mapped[str] = mapped_column(String(20), default="manufactured", nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    school: Mapped["School | None"] = relationship(back_populates="garment_types")
    products: Mapped[list["Product"]] = relationship(back_populates="garment_type", cascade="all, delete-orphan")
    images: Mapped[list["GarmentTypeImage"]] = relationship(
        back_populates="garment_type", cascade="all, delete-orphan", order_by="GarmentTypeImage.display_order"
    )
    cost_templates: Mapped[list["CostComponentTemplate"]] = relationship(
        back_populates="garment_type", cascade="all, delete-orphan"
    )

    @property
    def is_global(self) -> bool:
        return self.school_id is None

    def __repr__(self) -> str:
        return f"<GarmentType(name='{self.name}', school_id='{self.school_id}')>"


class GarmentTypeImage(Base):
    __tablename__ = "garment_type_images"
    __table_args__ = (
        Index("uq_school_garment_type_image", "garment_type_id", "school_id", "image_url", unique=True, postgresql_where="school_id IS NOT NULL"),
        Index("uq_unified_global_garment_type_image", "garment_type_id", "image_url", unique=True, postgresql_where="school_id IS NULL"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("garment_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )

    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    garment_type: Mapped["GarmentType"] = relationship(back_populates="images")
    school: Mapped["School | None"] = relationship()

    def __repr__(self) -> str:
        return f"<GarmentTypeImage(garment_type_id='{self.garment_type_id}', order={self.display_order}, primary={self.is_primary})>"


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("uq_school_product_code", "school_id", "code", unique=True, postgresql_where="school_id IS NOT NULL"),
        Index("uq_unified_global_product_code", "code", unique=True, postgresql_where="school_id IS NULL"),
        CheckConstraint('price >= 0', name='chk_product_price_positive'),
        CheckConstraint('cost >= 0', name='chk_product_cost_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("garment_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))

    size: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[str | None] = mapped_column(String(50))
    gender: Mapped[str | None] = mapped_column(String(10))

    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    school: Mapped["School | None"] = relationship(back_populates="products")
    garment_type: Mapped["GarmentType"] = relationship(back_populates="products")
    inventory: Mapped["Inventory | None"] = relationship(
        back_populates="product", uselist=False, cascade="all, delete-orphan"
    )
    sale_items: Mapped[list["SaleItem"]] = relationship(back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")
    cost_components: Mapped[list["ProductCostComponent"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    @property
    def is_global(self) -> bool:
        return self.school_id is None

    def __repr__(self) -> str:
        return f"<Product(code='{self.code}', size='{self.size}', price='{self.price}')>"


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        Index("uq_school_product_inventory", "school_id", "product_id", unique=True, postgresql_where="school_id IS NOT NULL"),
        Index("uq_unified_global_product_inventory", "product_id", unique=True, postgresql_where="school_id IS NULL"),
        CheckConstraint('quantity >= 0', name='chk_inventory_quantity_positive'),
        CheckConstraint('reserved_quantity >= 0', name='chk_inventory_reserved_positive'),
        CheckConstraint('reserved_quantity <= quantity', name='chk_inventory_reserved_lte_quantity'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=True, index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    last_updated: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    product: Mapped["Product"] = relationship(back_populates="inventory")

    @property
    def available(self) -> int:
        """Stock disponible para venta inmediata = quantity - reserved_quantity."""
        return self.quantity - self.reserved_quantity

    def __repr__(self) -> str:
        return (
            f"<Inventory(product_id='{self.product_id}', "
            f"quantity={self.quantity}, reserved={self.reserved_quantity})>"
        )


class CostComponentTemplate(Base):
    __tablename__ = "cost_component_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("garment_types.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    is_variable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    garment_type: Mapped["GarmentType"] = relationship(back_populates="cost_templates")
    cost_values: Mapped[list["ProductCostComponent"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<CostComponentTemplate(code='{self.code}', name='{self.name}')>"


class ProductCostComponent(Base):
    __tablename__ = "product_cost_components"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cost_component_templates.id", ondelete="CASCADE"),
        nullable=False, index=True
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    product: Mapped["Product"] = relationship(back_populates="cost_components")
    template: Mapped["CostComponentTemplate"] = relationship(back_populates="cost_values")

    def __repr__(self) -> str:
        return f"<ProductCostComponent(template_id='{self.template_id}', amount={self.amount})>"


class SchoolGlobalGarmentTypeExclusion(Base):
    """Excepciones de visibilidad de productos globales por colegio.

    La presencia de una fila significa que ese garment_type GLOBAL (school_id IS NULL)
    esta OCULTO en el catalogo publico de ese colegio. Sin fila = visible (default).
    Modelo de exclusion: por defecto todos los globales se ven en todos los colegios.
    """
    __tablename__ = "school_global_gt_exclusions"
    __table_args__ = (
        Index(
            "uq_school_global_gt_excl",
            "school_id",
            "global_garment_type_id",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    global_garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("garment_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    def __repr__(self) -> str:
        return (
            f"<SchoolGlobalGarmentTypeExclusion(school_id='{self.school_id}', "
            f"global_garment_type_id='{self.global_garment_type_id}')>"
        )


class SchoolGarmentTypeOrder(Base):
    """Orden de las cards del catalogo (por tipo de prenda) para cada colegio.

    El orden es SIEMPRE por colegio: `school_id` es el colegio cuyo catalogo se
    ordena, y `garment_type_id` puede ser propio del colegio o GLOBAL. Asi un mismo
    tipo global puede tener distinto orden en cada colegio (igual patron que
    GarmentTypeImage.school_id y SchoolGlobalGarmentTypeExclusion). Sin fila para un
    tipo, este cae al final del catalogo.
    """
    __tablename__ = "school_garment_type_order"
    __table_args__ = (
        Index(
            "uq_sgt_order_school_gt",
            "school_id",
            "garment_type_id",
            unique=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("garment_types.id", ondelete="CASCADE"), nullable=False, index=True
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=get_colombia_now_naive, onupdate=get_colombia_now_naive, nullable=False
    )

    def __repr__(self) -> str:
        return (
            f"<SchoolGarmentTypeOrder(school_id='{self.school_id}', "
            f"garment_type_id='{self.garment_type_id}', display_order={self.display_order})>"
        )
