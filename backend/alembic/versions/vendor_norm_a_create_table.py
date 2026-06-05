"""vendor normalization step A: create vendors table and add vendor_id FKs

Revision ID: vendor_norm_a
Revises: unify_step5
Create Date: 2026-04-13
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text

revision: str = "vendor_norm_a"
down_revision: Union[str, None] = "unify_step5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create vendors table (Enum type created automatically by sa.Enum)
    op.create_table(
        "vendors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("normalized_name", sa.String(255), nullable=False, unique=True),
        sa.Column("type", sa.Enum("person", "business", "internal", name="vendor_type_enum"), nullable=False, server_default="person"),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=text("now()")),
    )
    op.create_index("ix_vendors_name", "vendors", ["name"])
    op.create_index("ix_vendors_normalized_name", "vendors", ["normalized_name"])
    op.create_index("ix_vendors_is_active", "vendors", ["is_active"])

    # Add vendor_id nullable FK to expenses (old vendor column still exists)
    op.add_column("expenses", sa.Column("vendor_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_expenses_vendor_id", "expenses", "vendors", ["vendor_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_expenses_vendor_id", "expenses", ["vendor_id"])

    # Add vendor_id nullable FK to accounts_payable
    op.add_column("accounts_payable", sa.Column("vendor_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_accounts_payable_vendor_id", "accounts_payable", "vendors", ["vendor_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_accounts_payable_vendor_id", "accounts_payable", ["vendor_id"])

    # Add vendor_id nullable FK to fixed_expenses
    op.add_column("fixed_expenses", sa.Column("vendor_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_fixed_expenses_vendor_id", "fixed_expenses", "vendors", ["vendor_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_fixed_expenses_vendor_id", "fixed_expenses", ["vendor_id"])

    # Seed permission
    op.execute(text("""
        INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
        VALUES (gen_random_uuid(), 'accounting.manage_vendors', 'Gestionar Proveedores',
                'Crear, editar y desactivar proveedores del sistema', 'accounting', false, now())
        ON CONFLICT (code) DO NOTHING
    """))

    # Assign to existing admin custom roles
    op.execute(text("""
        INSERT INTO role_permissions (id, role_id, permission_id, requires_approval, created_at)
        SELECT gen_random_uuid(), rp.role_id, p.id, false, now()
        FROM permissions p
        CROSS JOIN (SELECT DISTINCT role_id FROM role_permissions) rp
        WHERE p.code = 'accounting.manage_vendors'
        AND NOT EXISTS (
            SELECT 1 FROM role_permissions rp2
            WHERE rp2.role_id = rp.role_id AND rp2.permission_id = p.id
        )
    """))


def downgrade() -> None:
    op.drop_index("ix_fixed_expenses_vendor_id", table_name="fixed_expenses")
    op.drop_constraint("fk_fixed_expenses_vendor_id", "fixed_expenses", type_="foreignkey")
    op.drop_column("fixed_expenses", "vendor_id")

    op.drop_index("ix_accounts_payable_vendor_id", table_name="accounts_payable")
    op.drop_constraint("fk_accounts_payable_vendor_id", "accounts_payable", type_="foreignkey")
    op.drop_column("accounts_payable", "vendor_id")

    op.drop_index("ix_expenses_vendor_id", table_name="expenses")
    op.drop_constraint("fk_expenses_vendor_id", "expenses", type_="foreignkey")
    op.drop_column("expenses", "vendor_id")

    op.execute(text("DELETE FROM permissions WHERE code = 'accounting.manage_vendors'"))

    op.drop_table("vendors")
    op.execute("DROP TYPE IF EXISTS vendor_type_enum")
