"""unify step 4: drop global FK columns and is_global_product flags from downstream tables

Revision ID: unify_step4
Revises: unify_step3
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "unify_step4"
down_revision: Union[str, None] = "unify_step3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Drop FK constraints referencing global tables ---
    op.drop_constraint("fk_sale_items_global_product", "sale_items", type_="foreignkey")
    op.drop_constraint("fk_order_items_global_product", "order_items", type_="foreignkey")
    op.drop_constraint("order_items_global_garment_type_id_fkey", "order_items", type_="foreignkey")
    op.drop_constraint("fk_sale_changes_new_global_product", "sale_changes", type_="foreignkey")
    op.drop_constraint("order_changes_new_global_product_id_fkey", "order_changes", type_="foreignkey")
    op.drop_constraint("cost_component_templates_global_garment_type_id_fkey", "cost_component_templates", type_="foreignkey")
    op.drop_constraint("product_cost_components_global_product_id_fkey", "product_cost_components", type_="foreignkey")
    op.drop_constraint("inventory_logs_global_inventory_id_fkey", "inventory_logs", type_="foreignkey")

    # --- Drop indexes on global columns ---
    op.drop_index("ix_sale_items_global_product_id", "sale_items")
    op.drop_index("ix_order_items_global_product_id", "order_items")
    op.drop_index("ix_order_items_global_garment_type_id", "order_items")
    op.drop_index("ix_cost_component_templates_global_garment_type_id", "cost_component_templates")
    op.drop_index("ix_product_cost_components_global_product_id", "product_cost_components")
    op.drop_index("ix_inventory_logs_global_inventory_id", "inventory_logs")

    # --- sale_items: drop global columns ---
    op.drop_column("sale_items", "global_product_id")
    op.drop_column("sale_items", "is_global_product")
    op.alter_column("sale_items", "product_id", nullable=False)

    # --- order_items: drop global columns ---
    op.drop_column("order_items", "global_product_id")
    op.drop_column("order_items", "global_garment_type_id")
    op.drop_column("order_items", "is_global_product")

    # --- sale_changes: drop global columns ---
    op.drop_column("sale_changes", "new_global_product_id")
    op.drop_column("sale_changes", "is_new_global_product")

    # --- order_changes: drop global columns ---
    op.drop_column("order_changes", "new_global_product_id")
    op.drop_column("order_changes", "is_new_global_product")

    # --- cost_component_templates: drop global column, make garment_type_id NOT NULL ---
    op.drop_column("cost_component_templates", "global_garment_type_id")
    op.alter_column("cost_component_templates", "garment_type_id", nullable=False)

    # --- product_cost_components: drop global column, make product_id NOT NULL ---
    op.drop_column("product_cost_components", "global_product_id")
    op.alter_column("product_cost_components", "product_id", nullable=False)

    # --- inventory_logs: drop global column ---
    op.drop_column("inventory_logs", "global_inventory_id")


def downgrade() -> None:
    # Re-add all dropped columns
    op.add_column("inventory_logs", sa.Column("global_inventory_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_inventory_logs_global_inventory_id", "inventory_logs", ["global_inventory_id"])
    op.create_foreign_key("inventory_logs_global_inventory_id_fkey", "inventory_logs", "global_inventory", ["global_inventory_id"], ["id"])

    op.alter_column("product_cost_components", "product_id", nullable=True)
    op.add_column("product_cost_components", sa.Column("global_product_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_product_cost_components_global_product_id", "product_cost_components", ["global_product_id"])
    op.create_foreign_key("product_cost_components_global_product_id_fkey", "product_cost_components", "global_products", ["global_product_id"], ["id"], ondelete="CASCADE")

    op.alter_column("cost_component_templates", "garment_type_id", nullable=True)
    op.add_column("cost_component_templates", sa.Column("global_garment_type_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_cost_component_templates_global_garment_type_id", "cost_component_templates", ["global_garment_type_id"])
    op.create_foreign_key("cost_component_templates_global_garment_type_id_fkey", "cost_component_templates", "global_garment_types", ["global_garment_type_id"], ["id"], ondelete="CASCADE")

    op.add_column("order_changes", sa.Column("is_new_global_product", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("order_changes", sa.Column("new_global_product_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("order_changes_new_global_product_id_fkey", "order_changes", "global_products", ["new_global_product_id"], ["id"], ondelete="SET NULL")

    op.add_column("sale_changes", sa.Column("is_new_global_product", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("sale_changes", sa.Column("new_global_product_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_sale_changes_new_global_product", "sale_changes", "global_products", ["new_global_product_id"], ["id"], ondelete="SET NULL")

    op.add_column("order_items", sa.Column("is_global_product", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("order_items", sa.Column("global_garment_type_id", UUID(as_uuid=True), nullable=True))
    op.add_column("order_items", sa.Column("global_product_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_order_items_global_product_id", "order_items", ["global_product_id"])
    op.create_index("ix_order_items_global_garment_type_id", "order_items", ["global_garment_type_id"])
    op.create_foreign_key("fk_order_items_global_product", "order_items", "global_products", ["global_product_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("order_items_global_garment_type_id_fkey", "order_items", "global_garment_types", ["global_garment_type_id"], ["id"], ondelete="RESTRICT")

    op.alter_column("sale_items", "product_id", nullable=True)
    op.add_column("sale_items", sa.Column("is_global_product", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("sale_items", sa.Column("global_product_id", UUID(as_uuid=True), nullable=True))
    op.create_index("ix_sale_items_global_product_id", "sale_items", ["global_product_id"])
    op.create_foreign_key("fk_sale_items_global_product", "sale_items", "global_products", ["global_product_id"], ["id"], ondelete="RESTRICT")
