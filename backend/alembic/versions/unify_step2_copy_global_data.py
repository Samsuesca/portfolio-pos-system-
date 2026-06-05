"""unify step 2: copy global data into unified tables preserving UUIDs

Revision ID: unify_step2
Revises: unify_step1
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "unify_step2"
down_revision: Union[str, None] = "unify_step1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Verify no UUID collisions before copying
    collisions_gt = conn.execute(text(
        "SELECT COUNT(*) FROM global_garment_types ggt "
        "JOIN garment_types gt ON gt.id = ggt.id"
    )).scalar()
    assert collisions_gt == 0, f"UUID collision in garment_types: {collisions_gt} rows"

    collisions_p = conn.execute(text(
        "SELECT COUNT(*) FROM global_products gp "
        "JOIN products p ON p.id = gp.id"
    )).scalar()
    assert collisions_p == 0, f"UUID collision in products: {collisions_p} rows"

    collisions_i = conn.execute(text(
        "SELECT COUNT(*) FROM global_inventory gi "
        "JOIN inventory i ON i.id = gi.id"
    )).scalar()
    assert collisions_i == 0, f"UUID collision in inventory: {collisions_i} rows"

    collisions_img = conn.execute(text(
        "SELECT COUNT(*) FROM global_garment_type_images ggi "
        "JOIN garment_type_images gi ON gi.id = ggi.id"
    )).scalar()
    assert collisions_img == 0, f"UUID collision in garment_type_images: {collisions_img} rows"

    # Step 1: Copy global_garment_types -> garment_types (school_id=NULL)
    conn.execute(text("""
        INSERT INTO garment_types (id, school_id, name, description, category, cost_type,
                                   requires_embroidery, has_custom_measurements, is_active,
                                   created_at, updated_at)
        SELECT id, NULL, name, description, category, cost_type,
               false, false, is_active,
               created_at, updated_at
        FROM global_garment_types
    """))

    # Step 2: Copy global_garment_type_images -> garment_type_images (school_id=NULL)
    conn.execute(text("""
        INSERT INTO garment_type_images (id, garment_type_id, school_id, image_url,
                                         display_order, is_primary, created_at)
        SELECT id, garment_type_id, NULL, image_url,
               display_order, is_primary, created_at
        FROM global_garment_type_images
    """))

    # Step 3: Copy global_products -> products (school_id=NULL)
    # garment_type_id already points to IDs we just inserted in Step 1
    conn.execute(text("""
        INSERT INTO products (id, school_id, garment_type_id, code, name, size, color, gender,
                              price, cost, description, image_url, is_active,
                              created_at, updated_at)
        SELECT id, NULL, garment_type_id, code, name, size, color, gender,
               price, cost, description, image_url, is_active,
               created_at, updated_at
        FROM global_products
    """))

    # Step 4: Copy global_inventory -> inventory (school_id=NULL)
    conn.execute(text("""
        INSERT INTO inventory (id, school_id, product_id, quantity, min_stock_alert, last_updated)
        SELECT id, NULL, product_id, quantity, min_stock_alert, last_updated
        FROM global_inventory
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM inventory WHERE school_id IS NULL"))
    conn.execute(text("DELETE FROM products WHERE school_id IS NULL"))
    conn.execute(text("DELETE FROM garment_type_images WHERE school_id IS NULL"))
    conn.execute(text("DELETE FROM garment_types WHERE school_id IS NULL"))
