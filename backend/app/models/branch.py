"""
Branch & School Identity Models (v3.1 — Sucursales)

`Branch` es una sucursal física de UCR. Es una dimensión **ortogonal** a
`school_id`: una sucursal vende los uniformes de varios colegios, y el mismo
colegio en dos sucursales se modela como dos registros `School` distintos
agrupados por `school_identity_id`.

`SchoolIdentity` agrupa esas sedes bajo el colegio real para reportes
consolidados ("cuánto vendimos del Colegio San José en TODAS las sucursales").

Fase 0a: tablas standalone (sin FKs salientes todavía). El retrofit que añade
`branch_id`/`school_identity_id` a `schools`, `sales`, `orders` y la
contabilidad es la Fase 0b. Ver `docs/v3/v3-branch-architecture/branch-architecture.md`.
"""
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.db.base import Base
from app.utils.timezone import get_colombia_now_naive


class Branch(Base):
    """Sucursal física de UCR (tienda)."""
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    phone: Mapped[str | None] = mapped_column(String(50))

    # Una sola sucursal marca la sede principal (la tienda actual = "Central").
    is_headquarters: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<Branch(code='{self.code}', name='{self.name}')>"


class SchoolIdentity(Base):
    """Identidad del colegio real — agrupa sedes (registros `School`) bajo un
    mismo nombre para reportes consolidados cross-sucursal."""
    __tablename__ = "school_identities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=get_colombia_now_naive,
        onupdate=get_colombia_now_naive,
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<SchoolIdentity(name='{self.name}')>"
