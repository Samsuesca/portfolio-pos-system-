"""Add production expense categories and rename supplies/inventory

Renames:
- supplies -> "Insumos de Oficina" (office supplies only)
- inventory -> "Produccion: General" (general production costs)

Creates 5 new production subcategories:
- prod_fabric: Tela
- prod_tailoring: Confeccion
- prod_embroidery: Bordado
- prod_accessories: Accesorios
- prod_other: Otros costos de produccion

All production categories (inventory + prod_*) are excluded from the
Income Statement to avoid double-counting with COGS.

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import uuid
from datetime import datetime

# revision identifiers, used by Alembic.
revision: str = 'n2o3p4q5r6s7'
down_revision: Union[str, None] = 'm1n2o3p4q5r6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_PRODUCTION_CATEGORIES = [
    {
        "code": "prod_fabric",
        "name": "Producción: Tela",
        "description": "Compra de tela y materiales textiles para producción de uniformes",
        "color": "#7C3AED",
        "icon": "scissors",
        "is_system": True,
        "is_active": True,
        "display_order": 12,
    },
    {
        "code": "prod_tailoring",
        "name": "Producción: Confección",
        "description": "Pago de confección, costura y mano de obra de producción",
        "color": "#2563EB",
        "icon": "shirt",
        "is_system": True,
        "is_active": True,
        "display_order": 13,
    },
    {
        "code": "prod_embroidery",
        "name": "Producción: Bordado",
        "description": "Bordado de escudos, insignias y personalización de uniformes",
        "color": "#0891B2",
        "icon": "pen-tool",
        "is_system": True,
        "is_active": True,
        "display_order": 14,
    },
    {
        "code": "prod_accessories",
        "name": "Producción: Accesorios",
        "description": "Botones, cremalleras, hilos, elásticos y otros accesorios de confección",
        "color": "#059669",
        "icon": "paperclip",
        "is_system": True,
        "is_active": True,
        "display_order": 15,
    },
    {
        "code": "prod_other",
        "name": "Producción: Otros",
        "description": "Otros costos de producción no clasificados en las categorías anteriores",
        "color": "#6B7280",
        "icon": "package",
        "is_system": True,
        "is_active": True,
        "display_order": 16,
    },
]


def upgrade() -> None:
    # 1. Rename existing categories
    op.execute("""
        UPDATE expense_categories
        SET name = 'Insumos de Oficina',
            description = 'Materiales de oficina y suministros NO relacionados con producción (papelería, tintas, artículos de aseo). Para materia prima usar categorías de Producción.'
        WHERE code = 'supplies'
    """)

    op.execute("""
        UPDATE expense_categories
        SET name = 'Producción: General',
            description = 'Compras de producción generales. Se EXCLUYE del Estado de Resultados porque se refleja en el Costo de Venta (COGS) vía el costo del producto.'
        WHERE code = 'inventory'
    """)

    # 2. Insert new production categories
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')

    for cat in NEW_PRODUCTION_CATEGORIES:
        cat_id = str(uuid.uuid4())
        code = cat["code"]
        name = cat["name"].replace("'", "''")
        desc = cat["description"].replace("'", "''")
        color = cat["color"]
        icon = cat["icon"]
        is_system = cat["is_system"]
        is_active = cat["is_active"]
        order = cat["display_order"]
        op.execute(sa.text(
            f"INSERT INTO expense_categories (id, code, name, description, color, icon, is_system, is_active, display_order, created_at, updated_at) "
            f"VALUES ('{cat_id}', '{code}', '{name}', '{desc}', '{color}', '{icon}', {is_system}, {is_active}, {order}, '{now}', '{now}')"
        ))


def downgrade() -> None:
    # Remove new production categories
    for cat in NEW_PRODUCTION_CATEGORIES:
        op.execute(f"DELETE FROM expense_categories WHERE code = '{cat['code']}'")

    # Revert renames
    op.execute("""
        UPDATE expense_categories
        SET name = 'Insumos',
            description = 'Materiales y suministros de oficina'
        WHERE code = 'supplies'
    """)

    op.execute("""
        UPDATE expense_categories
        SET name = 'Inventario',
            description = 'Compra de mercancía e inventario'
        WHERE code = 'inventory'
    """)
