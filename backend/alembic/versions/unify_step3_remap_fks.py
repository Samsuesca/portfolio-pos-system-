"""unify step 3: remap global FKs to unified product_id in downstream tables

Revision ID: unify_step3
Revises: unify_step2
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

revision: str = "unify_step3"
down_revision: Union[str, None] = "unify_step2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Drop XOR check constraints that would block the remap
    op.drop_constraint("chk_cost_template_one_parent", "cost_component_templates", type_="check")
    op.drop_constraint("chk_cost_component_one_product", "product_cost_components", type_="check")

    # sale_items: global_product_id -> product_id
    result = conn.execute(text(
        "UPDATE sale_items SET product_id = global_product_id "
        "WHERE global_product_id IS NOT NULL AND product_id IS NULL"
    ))
    print(f"  sale_items remapped: {result.rowcount}")

    # order_items: global_product_id -> product_id
    result = conn.execute(text(
        "UPDATE order_items SET product_id = global_product_id "
        "WHERE global_product_id IS NOT NULL AND product_id IS NULL"
    ))
    print(f"  order_items product_id remapped: {result.rowcount}")

    # order_items: global_garment_type_id -> garment_type_id
    result = conn.execute(text(
        "UPDATE order_items SET garment_type_id = global_garment_type_id "
        "WHERE global_garment_type_id IS NOT NULL AND garment_type_id IS NULL"
    ))
    print(f"  order_items garment_type_id remapped: {result.rowcount}")

    # sale_changes: new_global_product_id -> new_product_id
    result = conn.execute(text(
        "UPDATE sale_changes SET new_product_id = new_global_product_id "
        "WHERE new_global_product_id IS NOT NULL AND new_product_id IS NULL"
    ))
    print(f"  sale_changes remapped: {result.rowcount}")

    # order_changes: new_global_product_id -> new_product_id
    result = conn.execute(text(
        "UPDATE order_changes SET new_product_id = new_global_product_id "
        "WHERE new_global_product_id IS NOT NULL AND new_product_id IS NULL"
    ))
    print(f"  order_changes remapped: {result.rowcount}")

    # cost_component_templates: global_garment_type_id -> garment_type_id
    result = conn.execute(text(
        "UPDATE cost_component_templates SET garment_type_id = global_garment_type_id "
        "WHERE global_garment_type_id IS NOT NULL AND garment_type_id IS NULL"
    ))
    print(f"  cost_component_templates remapped: {result.rowcount}")

    # product_cost_components: global_product_id -> product_id
    result = conn.execute(text(
        "UPDATE product_cost_components SET product_id = global_product_id "
        "WHERE global_product_id IS NOT NULL AND product_id IS NULL"
    ))
    print(f"  product_cost_components remapped: {result.rowcount}")

    # inventory_logs: global_inventory_id -> inventory_id
    result = conn.execute(text(
        "UPDATE inventory_logs SET inventory_id = global_inventory_id "
        "WHERE global_inventory_id IS NOT NULL AND inventory_id IS NULL"
    ))
    print(f"  inventory_logs remapped: {result.rowcount}")

    # Null out the remapped global columns (data is now in unified columns)
    conn.execute(text("UPDATE cost_component_templates SET global_garment_type_id = NULL WHERE global_garment_type_id IS NOT NULL"))
    conn.execute(text("UPDATE product_cost_components SET global_product_id = NULL WHERE global_product_id IS NOT NULL"))


def downgrade() -> None:
    conn = op.get_bind()

    # Reverse using is_global_product flags and code-prefix detection
    # sale_items
    conn.execute(text(
        "UPDATE sale_items SET global_product_id = product_id, product_id = NULL "
        "WHERE is_global_product = true"
    ))

    # order_items
    conn.execute(text(
        "UPDATE order_items SET global_product_id = product_id, product_id = NULL "
        "WHERE is_global_product = true"
    ))
    conn.execute(text(
        "UPDATE order_items oi SET global_garment_type_id = garment_type_id, garment_type_id = NULL "
        "FROM garment_types gt WHERE oi.garment_type_id = gt.id AND gt.school_id IS NULL "
        "AND oi.is_global_product = true"
    ))

    # sale_changes
    conn.execute(text(
        "UPDATE sale_changes SET new_global_product_id = new_product_id, new_product_id = NULL "
        "WHERE is_new_global_product = true"
    ))

    # order_changes
    conn.execute(text(
        "UPDATE order_changes SET new_global_product_id = new_product_id, new_product_id = NULL "
        "WHERE is_new_global_product = true"
    ))

    # cost_component_templates: reverse by detecting global garment types (school_id IS NULL)
    conn.execute(text(
        "UPDATE cost_component_templates cct "
        "SET global_garment_type_id = garment_type_id, garment_type_id = NULL "
        "FROM garment_types gt WHERE cct.garment_type_id = gt.id AND gt.school_id IS NULL"
    ))

    # product_cost_components: reverse by detecting global products (school_id IS NULL)
    conn.execute(text(
        "UPDATE product_cost_components pcc "
        "SET global_product_id = product_id, product_id = NULL "
        "FROM products p WHERE pcc.product_id = p.id AND p.school_id IS NULL"
    ))

    # inventory_logs: reverse by detecting global inventory (school_id IS NULL)
    conn.execute(text(
        "UPDATE inventory_logs il "
        "SET global_inventory_id = inventory_id, inventory_id = NULL "
        "FROM inventory i WHERE il.inventory_id = i.id AND i.school_id IS NULL"
    ))

    # Restore XOR check constraints
    op.create_check_constraint(
        "chk_cost_template_one_parent", "cost_component_templates",
        "(garment_type_id IS NOT NULL AND global_garment_type_id IS NULL) OR "
        "(garment_type_id IS NULL AND global_garment_type_id IS NOT NULL)"
    )
    op.create_check_constraint(
        "chk_cost_component_one_product", "product_cost_components",
        "(product_id IS NOT NULL AND global_product_id IS NULL) OR "
        "(product_id IS NULL AND global_product_id IS NOT NULL)"
    )
