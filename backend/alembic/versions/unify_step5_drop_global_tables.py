"""unify step 5: drop legacy global product tables

Revision ID: unify_step5
Revises: unify_step4
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text

revision: str = "unify_step5"
down_revision: Union[str, None] = "unify_step4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop FKs that reference global tables from other global tables
    op.drop_constraint("global_inventory_product_id_fkey", "global_inventory", type_="foreignkey")
    op.drop_constraint("fk_global_garment_type_images_garment_type", "global_garment_type_images", type_="foreignkey")
    op.drop_constraint("global_products_garment_type_id_fkey", "global_products", type_="foreignkey")

    op.drop_table("global_inventory")
    op.drop_table("global_garment_type_images")
    op.drop_table("global_products")
    op.drop_table("global_garment_types")


def downgrade() -> None:
    # Recreate global_garment_types
    op.create_table(
        "global_garment_types",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("category", sa.String(50)),
        sa.Column("cost_type", sa.String(20), server_default="purchased", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Recreate global_garment_type_images
    op.create_table(
        "global_garment_type_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garment_type_id", UUID(as_uuid=True), sa.ForeignKey("global_garment_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_url", sa.Text, nullable=False),
        sa.Column("display_order", sa.Integer, server_default="0", nullable=False),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("garment_type_id", "image_url", name="uq_global_garment_type_image"),
    )

    # Recreate global_products
    op.create_table(
        "global_products",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("garment_type_id", UUID(as_uuid=True), sa.ForeignKey("global_garment_types.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("size", sa.String(10)),
        sa.Column("color", sa.String(50)),
        sa.Column("gender", sa.String(10)),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
        sa.Column("cost", sa.Numeric(10, 2)),
        sa.Column("description", sa.Text),
        sa.Column("image_url", sa.Text),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )

    # Recreate global_inventory
    op.create_table(
        "global_inventory",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("global_products.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("quantity", sa.Integer, server_default="0", nullable=False),
        sa.Column("min_stock_alert", sa.Integer, server_default="5", nullable=False),
        sa.Column("last_updated", sa.DateTime, nullable=False),
        sa.CheckConstraint("quantity >= 0", name="chk_global_inventory_quantity_positive"),
    )

    # Repopulate from unified tables
    conn = op.get_bind()
    conn.execute(text("""
        INSERT INTO global_garment_types (id, name, description, category, cost_type, is_active, created_at, updated_at)
        SELECT id, name, description, category, cost_type, is_active, created_at, updated_at
        FROM garment_types WHERE school_id IS NULL
    """))
    conn.execute(text("""
        INSERT INTO global_garment_type_images (id, garment_type_id, image_url, display_order, is_primary, created_at)
        SELECT id, garment_type_id, image_url, display_order, is_primary, created_at
        FROM garment_type_images WHERE school_id IS NULL
    """))
    conn.execute(text("""
        INSERT INTO global_products (id, garment_type_id, code, name, size, color, gender, price, cost, description, image_url, is_active, created_at, updated_at)
        SELECT id, garment_type_id, code, name, size, color, gender, price, cost, description, image_url, is_active, created_at, updated_at
        FROM products WHERE school_id IS NULL
    """))
    conn.execute(text("""
        INSERT INTO global_inventory (id, product_id, quantity, min_stock_alert, last_updated)
        SELECT id, product_id, quantity, min_stock_alert, last_updated
        FROM inventory WHERE school_id IS NULL
    """))
