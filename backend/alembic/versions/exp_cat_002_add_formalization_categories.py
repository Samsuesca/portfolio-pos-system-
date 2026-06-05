"""add formalization expense categories: payroll_in_kind, owner_drawings, intereses_financieros

Revision ID: exp_cat_002
Revises: fp_proj_001
Create Date: 2026-05-03

Adds 3 new categories to expense_categories table required for accounting
formalization (see docs/formalization/migration-plan-hybrid.md):

- payroll_in_kind: Compensacion en especie (historico pre-formalizacion)
- owner_drawings: Retiros del propietario (van contra patrimonio, no P&L)
- intereses_financieros: Intereses sobre prestamos (gasto financiero)

Categories are inserted as is_system=true so users cannot delete them
accidentally. Existing expenses with categories like 'mercado', 'ocio',
'comida', 'viaticos' must be reclassified manually via the planned migration
process (see docs/formalization/migration-plan-hybrid.md).
"""
from typing import Sequence, Union
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "exp_cat_002"
down_revision: Union[str, None] = "fp_proj_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_CATEGORIES = [
    {
        "code": "payroll_in_kind",
        "name": "Compensacion en especie",
        "description": (
            "Compensacion no salarial entregada a empleados (alimentacion, "
            "auxilios). Historico pre-formalizacion."
        ),
        "color": "#14B8A6",
        "icon": "gift",
        "display_order": 50,
    },
    {
        "code": "owner_drawings",
        "name": "Retiros del propietario",
        "description": (
            "Dinero o bienes retirados por el propietario para uso personal. "
            "NO va al P&L; reduce el patrimonio."
        ),
        "color": "#A855F7",
        "icon": "user-minus",
        "display_order": 51,
    },
    {
        "code": "intereses_financieros",
        "name": "Intereses Financieros",
        "description": (
            "Intereses pagados sobre prestamos y obligaciones financieras. "
            "Solo la porcion de interes; el capital reduce el pasivo (no es gasto)."
        ),
        "color": "#DC2626",
        "icon": "trending-down",
        "display_order": 52,
    },
]


def upgrade() -> None:
    expense_categories = sa.table(
        "expense_categories",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("description", sa.String),
        sa.column("color", sa.String),
        sa.column("icon", sa.String),
        sa.column("is_system", sa.Boolean),
        sa.column("is_active", sa.Boolean),
        sa.column("display_order", sa.Integer),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )

    rows = [
        {
            "id": uuid4(),
            "code": cat["code"],
            "name": cat["name"],
            "description": cat["description"],
            "color": cat["color"],
            "icon": cat["icon"],
            "is_system": True,
            "is_active": True,
            "display_order": cat["display_order"],
            "created_at": sa.func.now(),
            "updated_at": sa.func.now(),
        }
        for cat in NEW_CATEGORIES
    ]

    # Use INSERT ... ON CONFLICT DO NOTHING to be idempotent in case migration
    # is re-run (codes are unique).
    conn = op.get_bind()
    for row in rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO expense_categories
                (id, code, name, description, color, icon, is_system, is_active,
                 display_order, created_at, updated_at)
                VALUES
                (:id, :code, :name, :description, :color, :icon, :is_system,
                 :is_active, :display_order, NOW(), NOW())
                ON CONFLICT (code) DO NOTHING
                """
            ),
            row,
        )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM expense_categories
        WHERE code IN ('payroll_in_kind', 'owner_drawings', 'intereses_financieros')
          AND is_system = TRUE
        """
    )
