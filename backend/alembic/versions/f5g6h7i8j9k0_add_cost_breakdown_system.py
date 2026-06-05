"""add cost breakdown system

Revision ID: f5g6h7i8j9k0
Revises: d3e4f5g6h7i8
Create Date: 2026-04-12

Adds cost_type to garment_types and global_garment_types,
creates cost_component_templates and product_cost_components tables,
and seeds default templates for manufactured garment types.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid


revision = "f5g6h7i8j9k0"
down_revision = "d3e4f5g6h7i8"
branch_labels = None
depends_on = None


# Default component templates for manufactured products
TEMPLATES_WITH_EMBROIDERY = [
    ("Tela", "fabric", True, 1),
    ("Confección", "tailoring", False, 2),
    ("Bordado", "embroidery", False, 3),
    ("Cuellos/Puños", "collars_cuffs", False, 4),
    ("Marquillas", "labels", False, 5),
    ("Bolsas", "bags", False, 6),
    ("Hilos", "thread", True, 7),
    ("Otros", "other", False, 8),
]

TEMPLATES_WITHOUT_EMBROIDERY = [
    ("Tela", "fabric", True, 1),
    ("Confección", "tailoring", False, 2),
    ("Marquillas", "labels", False, 3),
    ("Bolsas", "bags", False, 4),
    ("Hilos", "thread", True, 5),
    ("Otros", "other", False, 6),
]

# Global garment types that are clearly purchased (not manufactured)
PURCHASED_GLOBAL_NAMES = [
    "Zapatos Goma", "Tennis Nike Blanco", "Tennis Nike Negro",
    "Medias", "Medias Tobilleras", "Jean", "Blusa",
    "Boxer", "Camisillas", "Correa", "Top", "Bicicleteros",
]


def upgrade() -> None:
    # 1. Add cost_type to garment_types
    op.add_column(
        "garment_types",
        sa.Column("cost_type", sa.String(20), nullable=False, server_default="manufactured"),
    )

    # 2. Add cost_type to global_garment_types (default purchased for globals)
    op.add_column(
        "global_garment_types",
        sa.Column("cost_type", sa.String(20), nullable=False, server_default="purchased"),
    )

    # 3. Create cost_component_templates table
    op.create_table(
        "cost_component_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("garment_type_id", UUID(as_uuid=True), sa.ForeignKey("garment_types.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("global_garment_type_id", UUID(as_uuid=True), sa.ForeignKey("global_garment_types.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("is_variable", sa.Boolean, nullable=False, default=False),
        sa.Column("display_order", sa.Integer, nullable=False, default=0),
        sa.Column("is_active", sa.Boolean, nullable=False, default=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("garment_type_id", "code", name="uq_garment_cost_template_code"),
        sa.UniqueConstraint("global_garment_type_id", "code", name="uq_global_garment_cost_template_code"),
        sa.CheckConstraint(
            "(garment_type_id IS NOT NULL AND global_garment_type_id IS NULL) OR "
            "(garment_type_id IS NULL AND global_garment_type_id IS NOT NULL)",
            name="chk_cost_template_one_parent",
        ),
    )

    # 4. Create product_cost_components table
    op.create_table(
        "product_cost_components",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("global_product_id", UUID(as_uuid=True), sa.ForeignKey("global_products.id", ondelete="CASCADE"), nullable=True, index=True),
        sa.Column("template_id", UUID(as_uuid=True), sa.ForeignKey("cost_component_templates.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("product_id", "template_id", name="uq_product_cost_component"),
        sa.UniqueConstraint("global_product_id", "template_id", name="uq_global_product_cost_component"),
        sa.CheckConstraint(
            "(product_id IS NOT NULL AND global_product_id IS NULL) OR "
            "(product_id IS NULL AND global_product_id IS NOT NULL)",
            name="chk_cost_component_one_product",
        ),
        sa.CheckConstraint("amount >= 0", name="chk_cost_component_amount_positive"),
    )

    # 5. Global garment types default to 'purchased'. Mark non-purchased ones as 'manufactured'.
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE global_garment_types SET cost_type = 'manufactured' "
            "WHERE name IN ('Camisa basica', 'Delantal para niña')"
        )
    )

    # 6. Seed default templates for all manufactured school garment types
    from datetime import datetime
    now = datetime.utcnow()

    garment_types = conn.execute(
        sa.text("SELECT id, requires_embroidery FROM garment_types WHERE is_active = true AND cost_type = 'manufactured'")
    ).fetchall()

    for gt_id, requires_emb in garment_types:
        templates = TEMPLATES_WITH_EMBROIDERY if requires_emb else TEMPLATES_WITHOUT_EMBROIDERY
        for name, code, is_variable, display_order in templates:
            conn.execute(
                sa.text(
                    "INSERT INTO cost_component_templates "
                    "(id, garment_type_id, global_garment_type_id, name, code, is_variable, display_order, is_active, created_at, updated_at) "
                    "VALUES (:id, :gt_id, NULL, :name, :code, :is_variable, :display_order, true, :now, :now)"
                ),
                {
                    "id": str(uuid.uuid4()), "gt_id": str(gt_id),
                    "name": name, "code": code, "is_variable": is_variable,
                    "display_order": display_order, "now": now,
                },
            )

    # 7. Seed templates for manufactured global garment types
    global_garment_types = conn.execute(
        sa.text("SELECT id, name FROM global_garment_types WHERE is_active = true AND cost_type = 'manufactured'")
    ).fetchall()

    for ggt_id, ggt_name in global_garment_types:
        templates = TEMPLATES_WITHOUT_EMBROIDERY
        for name, code, is_variable, display_order in templates:
            conn.execute(
                sa.text(
                    "INSERT INTO cost_component_templates "
                    "(id, garment_type_id, global_garment_type_id, name, code, is_variable, display_order, is_active, created_at, updated_at) "
                    "VALUES (:id, NULL, :ggt_id, :name, :code, :is_variable, :display_order, true, :now, :now)"
                ),
                {
                    "id": str(uuid.uuid4()), "ggt_id": str(ggt_id),
                    "name": name, "code": code, "is_variable": is_variable,
                    "display_order": display_order, "now": now,
                },
            )


def downgrade() -> None:
    op.drop_table("product_cost_components")
    op.drop_table("cost_component_templates")
    op.drop_column("global_garment_types", "cost_type")
    op.drop_column("garment_types", "cost_type")
