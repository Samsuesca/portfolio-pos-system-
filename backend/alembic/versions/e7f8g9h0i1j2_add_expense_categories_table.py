"""Add expense_categories table

Creates the expense_categories table for user-manageable expense categories.
Seeds the 11 existing system categories with is_system=True.

Revision ID: e7f8g9h0i1j2
Revises: d6e7f8g9h0i1
Create Date: 2026-01-22

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime

# revision identifiers, used by Alembic.
revision: str = 'e7f8g9h0i1j2'
down_revision: Union[str, None] = 'd6e7f8g9h0i1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# System expense categories - seeded from the existing ExpenseCategory enum
SYSTEM_CATEGORIES = [
    {
        "code": "rent",
        "name": "Arriendo",
        "description": "Pagos de arriendo y alquiler de locales",
        "color": "#EF4444",
        "icon": "home",
        "display_order": 1
    },
    {
        "code": "utilities",
        "name": "Servicios Públicos",
        "description": "Agua, luz, gas, internet, teléfono",
        "color": "#F59E0B",
        "icon": "zap",
        "display_order": 2
    },
    {
        "code": "payroll",
        "name": "Nómina",
        "description": "Salarios, prestaciones y seguridad social",
        "color": "#10B981",
        "icon": "users",
        "display_order": 3
    },
    {
        "code": "supplies",
        "name": "Insumos",
        "description": "Materiales y suministros de oficina",
        "color": "#3B82F6",
        "icon": "package",
        "display_order": 4
    },
    {
        "code": "inventory",
        "name": "Inventario",
        "description": "Compra de mercancía e inventario",
        "color": "#8B5CF6",
        "icon": "box",
        "display_order": 5
    },
    {
        "code": "transport",
        "name": "Transporte",
        "description": "Fletes, envíos y transporte",
        "color": "#EC4899",
        "icon": "truck",
        "display_order": 6
    },
    {
        "code": "maintenance",
        "name": "Mantenimiento",
        "description": "Reparaciones y mantenimiento de equipos",
        "color": "#6366F1",
        "icon": "wrench",
        "display_order": 7
    },
    {
        "code": "marketing",
        "name": "Marketing",
        "description": "Publicidad, promociones y redes sociales",
        "color": "#14B8A6",
        "icon": "megaphone",
        "display_order": 8
    },
    {
        "code": "taxes",
        "name": "Impuestos",
        "description": "Impuestos, tasas y contribuciones",
        "color": "#F97316",
        "icon": "receipt",
        "display_order": 9
    },
    {
        "code": "bank_fees",
        "name": "Comisiones Bancarias",
        "description": "Comisiones, cuotas de manejo y servicios bancarios",
        "color": "#64748B",
        "icon": "credit-card",
        "display_order": 10
    },
    {
        "code": "other",
        "name": "Otros",
        "description": "Gastos varios no clasificados",
        "color": "#9CA3AF",
        "icon": "more-horizontal",
        "display_order": 11
    },
]


def upgrade() -> None:
    # Create expense_categories table
    op.create_table(
        'expense_categories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('color', sa.String(7), nullable=False, server_default='#9CA3AF'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('is_system', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Seed system categories
    conn = op.get_bind()
    now = datetime.utcnow()

    for cat in SYSTEM_CATEGORIES:
        conn.execute(
            sa.text("""
                INSERT INTO expense_categories
                (id, code, name, description, color, icon, is_system, is_active, display_order, created_at, updated_at)
                VALUES
                (:id, :code, :name, :description, :color, :icon, true, true, :display_order, :created_at, :updated_at)
            """),
            {
                'id': str(uuid.uuid4()),
                'code': cat['code'],
                'name': cat['name'],
                'description': cat['description'],
                'color': cat['color'],
                'icon': cat['icon'],
                'display_order': cat['display_order'],
                'created_at': now,
                'updated_at': now
            }
        )


def downgrade() -> None:
    op.drop_table('expense_categories')
