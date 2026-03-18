"""
Product and Inventory Models
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, Integer, Numeric, Text, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class GarmentType(Base):
    """Types of garments (each school defines their own)"""
    __tablename__ = "garment_types"
    __table_args__ = (
        UniqueConstraint('school_id', 'name', name='uq_school_garment_type'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(50))  # uniforme_diario, uniforme_deportivo, accesorios

    # Configuration
    requires_embroidery: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_custom_measurements: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship(back_populates="garment_types")
    products: Mapped[list["Product"]] = relationship(
        back_populates="garment_type",
        cascade="all, delete-orphan"
    )
    images: Mapped[list["GarmentTypeImage"]] = relationship(
        back_populates="garment_type",
        cascade="all, delete-orphan",
        order_by="GarmentTypeImage.display_order"
    )

    def __repr__(self) -> str:
        return f"<GarmentType(name='{self.name}', school_id='{self.school_id}')>"


class GarmentTypeImage(Base):
    """Images for garment types - multiple images per type for gallery display"""
    __tablename__ = "garment_type_images"
    __table_args__ = (
        UniqueConstraint('garment_type_id', 'school_id', 'image_url', name='uq_garment_type_image'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("garment_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    # Relationships
    garment_type: Mapped["GarmentType"] = relationship(back_populates="images")
    school: Mapped["School"] = relationship()

    def __repr__(self) -> str:
        return f"<GarmentTypeImage(garment_type_id='{self.garment_type_id}', order={self.display_order}, primary={self.is_primary})>"


class Product(Base):
    """Individual SKUs (combination of garment type + size + color)"""
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint('school_id', 'code', name='uq_school_product_code'),
        CheckConstraint('price >= 0', name='chk_product_price_positive'),
        CheckConstraint('cost >= 0', name='chk_product_cost_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("garment_types.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False)  # Auto-generated: CAM-T8-001
    name: Mapped[str | None] = mapped_column(String(255))  # Full display name

    # Attributes
    size: Mapped[str] = mapped_column(String(10), nullable=False)  # 6, 8, 10, S, M, L, XL
    color: Mapped[str | None] = mapped_column(String(50))  # Blanco, Azul, Gris
    gender: Mapped[str | None] = mapped_column(String(10))  # unisex, male, female

    # Pricing (each school sets their own)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))  # Purchase/production cost

    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    school: Mapped["School"] = relationship(back_populates="products")
    garment_type: Mapped["GarmentType"] = relationship(back_populates="products")
    inventory: Mapped["Inventory | None"] = relationship(
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan"
    )
    sale_items: Mapped[list["SaleItem"]] = relationship(back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")

    def __repr__(self) -> str:
        return f"<Product(code='{self.code}', size='{self.size}', price='{self.price}')>"


class GlobalGarmentType(Base):
    """Global garment types for shared products (zapatos, medias, jeans, blusas)"""
    __tablename__ = "global_garment_types"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(50))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    products: Mapped[list["GlobalProduct"]] = relationship(
        back_populates="garment_type",
        cascade="all, delete-orphan"
    )
    images: Mapped[list["GlobalGarmentTypeImage"]] = relationship(
        back_populates="garment_type",
        cascade="all, delete-orphan",
        order_by="GlobalGarmentTypeImage.display_order"
    )

    def __repr__(self) -> str:
        return f"<GlobalGarmentType(name='{self.name}')>"


class GlobalGarmentTypeImage(Base):
    """Images for global garment types"""
    __tablename__ = "global_garment_type_images"
    __table_args__ = (
        UniqueConstraint('garment_type_id', 'image_url', name='uq_global_garment_type_image'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_garment_types.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)

    # Relationships
    garment_type: Mapped["GlobalGarmentType"] = relationship(back_populates="images")

    def __repr__(self) -> str:
        return f"<GlobalGarmentTypeImage(garment_type_id='{self.garment_type_id}', is_primary={self.is_primary})>"


class GlobalProduct(Base):
    """Global products shared across all schools (zapatos, medias, jeans, blusas)"""
    __tablename__ = "global_products"
    __table_args__ = (
        UniqueConstraint('code', name='uq_global_product_code'),
        CheckConstraint('price >= 0', name='chk_global_product_price_positive'),
        CheckConstraint('cost >= 0', name='chk_global_product_cost_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    garment_type_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_garment_types.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False)  # GLB-TEN-001
    name: Mapped[str | None] = mapped_column(String(255))

    # Attributes
    size: Mapped[str] = mapped_column(String(20), nullable=False)  # T27-T34, Única, Niño, Hombre
    color: Mapped[str | None] = mapped_column(String(50))
    gender: Mapped[str | None] = mapped_column(String(10))

    # Pricing (same for all schools)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=get_colombia_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    garment_type: Mapped["GlobalGarmentType"] = relationship(back_populates="products")
    inventory: Mapped["GlobalInventory | None"] = relationship(
        back_populates="product",
        uselist=False,
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<GlobalProduct(code='{self.code}', size='{self.size}', price='{self.price}')>"


class GlobalInventory(Base):
    """Shared inventory for global products"""
    __tablename__ = "global_inventory"
    __table_args__ = (
        UniqueConstraint('product_id', name='uq_global_product_inventory'),
        CheckConstraint('quantity >= 0', name='chk_global_inventory_quantity_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("global_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=5, nullable=False)

    last_updated: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    product: Mapped["GlobalProduct"] = relationship(back_populates="inventory")

    def __repr__(self) -> str:
        return f"<GlobalInventory(product_id='{self.product_id}', quantity={self.quantity})>"


class Inventory(Base):
    """Available stock per product"""
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint('school_id', 'product_id', name='uq_school_product_inventory'),
        CheckConstraint('quantity >= 0', name='chk_inventory_quantity_positive'),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=5, nullable=False)  # Low stock alert

    last_updated: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="inventory")

    def __repr__(self) -> str:
        return f"<Inventory(product_id='{self.product_id}', quantity={self.quantity})>"
