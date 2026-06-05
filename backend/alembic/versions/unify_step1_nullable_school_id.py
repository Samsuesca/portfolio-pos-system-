"""unify step 1: make school_id nullable and replace unique constraints with partial indexes

Revision ID: unify_step1
Revises: eca80d86c730
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op

revision: str = "unify_step1"
down_revision: Union[str, None] = "eca80d86c730"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- garment_types: school_id nullable ---
    op.alter_column("garment_types", "school_id", nullable=True)
    op.drop_constraint("uq_school_garment_type", "garment_types", type_="unique")
    op.create_index(
        "uq_school_garment_type",
        "garment_types",
        ["school_id", "name"],
        unique=True,
        postgresql_where="school_id IS NOT NULL",
    )
    op.create_index(
        "uq_unified_global_garment_type_name",
        "garment_types",
        ["name"],
        unique=True,
        postgresql_where="school_id IS NULL",
    )

    # --- garment_type_images: school_id nullable ---
    op.alter_column("garment_type_images", "school_id", nullable=True)
    op.drop_constraint("uq_garment_type_image", "garment_type_images", type_="unique")
    op.create_index(
        "uq_school_garment_type_image",
        "garment_type_images",
        ["garment_type_id", "school_id", "image_url"],
        unique=True,
        postgresql_where="school_id IS NOT NULL",
    )
    op.create_index(
        "uq_unified_global_garment_type_image",
        "garment_type_images",
        ["garment_type_id", "image_url"],
        unique=True,
        postgresql_where="school_id IS NULL",
    )

    # --- products: school_id nullable ---
    op.alter_column("products", "school_id", nullable=True)
    op.drop_constraint("uq_school_product_code", "products", type_="unique")
    op.create_index(
        "uq_school_product_code",
        "products",
        ["school_id", "code"],
        unique=True,
        postgresql_where="school_id IS NOT NULL",
    )
    op.create_index(
        "uq_unified_global_product_code",
        "products",
        ["code"],
        unique=True,
        postgresql_where="school_id IS NULL",
    )

    # --- inventory: school_id nullable ---
    op.alter_column("inventory", "school_id", nullable=True)
    op.drop_constraint("uq_school_product_inventory", "inventory", type_="unique")
    op.create_index(
        "uq_school_product_inventory",
        "inventory",
        ["school_id", "product_id"],
        unique=True,
        postgresql_where="school_id IS NOT NULL",
    )
    op.create_index(
        "uq_unified_global_product_inventory",
        "inventory",
        ["product_id"],
        unique=True,
        postgresql_where="school_id IS NULL",
    )


def downgrade() -> None:
    # --- inventory ---
    op.drop_index("uq_unified_global_product_inventory", "inventory")
    op.drop_index("uq_school_product_inventory", "inventory")
    op.create_unique_constraint("uq_school_product_inventory", "inventory", ["school_id", "product_id"])
    op.alter_column("inventory", "school_id", nullable=False)

    # --- products ---
    op.drop_index("uq_unified_global_product_code", "products")
    op.drop_index("uq_school_product_code", "products")
    op.create_unique_constraint("uq_school_product_code", "products", ["school_id", "code"])
    op.alter_column("products", "school_id", nullable=False)

    # --- garment_type_images ---
    op.drop_index("uq_unified_global_garment_type_image", "garment_type_images")
    op.drop_index("uq_school_garment_type_image", "garment_type_images")
    op.create_unique_constraint("uq_garment_type_image", "garment_type_images", ["garment_type_id", "school_id", "image_url"])
    op.alter_column("garment_type_images", "school_id", nullable=False)

    # --- garment_types ---
    op.drop_index("uq_unified_global_garment_type_name", "garment_types")
    op.drop_index("uq_school_garment_type", "garment_types")
    op.create_unique_constraint("uq_school_garment_type", "garment_types", ["school_id", "name"])
    op.alter_column("garment_types", "school_id", nullable=False)
