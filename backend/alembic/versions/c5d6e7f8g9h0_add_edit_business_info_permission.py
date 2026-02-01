"""Add edit_business_info permission

Revision ID: c5d6e7f8g9h0
Revises: a2b3c4d5e6f7
Create Date: 2026-01-21

Adds the settings.edit_business_info permission for editing centralized
business information (name, contacts, address, hours, etc.)
This permission is assigned to the owner system role by default.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime

# revision identifiers
revision = 'c5d6e7f8g9h0'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None

# New permission to add
NEW_PERMISSION = {
    "code": "settings.edit_business_info",
    "name": "Editar información del negocio",
    "description": "Modificar nombre, contactos, dirección y horarios del negocio",
    "category": "settings",
    "is_sensitive": True
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Insert the new permission
    perm_id = str(uuid.uuid4())
    conn.execute(
        sa.text("""
            INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
            VALUES (:id, :code, :name, :description, :category, :is_sensitive, :created_at)
        """),
        {
            'id': perm_id,
            'code': NEW_PERMISSION['code'],
            'name': NEW_PERMISSION['name'],
            'description': NEW_PERMISSION['description'],
            'category': NEW_PERMISSION['category'],
            'is_sensitive': NEW_PERMISSION['is_sensitive'],
            'created_at': datetime.utcnow()
        }
    )

    # 2. Get the owner system role id
    result = conn.execute(
        sa.text("SELECT id FROM custom_roles WHERE code = 'owner' AND is_system = true AND school_id IS NULL")
    )
    owner_role = result.fetchone()

    if owner_role:
        # 3. Assign permission to owner role
        conn.execute(
            sa.text("""
                INSERT INTO role_permissions (id, role_id, permission_id, requires_approval, created_at)
                VALUES (:id, :role_id, :permission_id, false, :created_at)
            """),
            {
                'id': str(uuid.uuid4()),
                'role_id': owner_role[0],
                'permission_id': perm_id,
                'created_at': datetime.utcnow()
            }
        )


def downgrade() -> None:
    conn = op.get_bind()

    # Get permission id
    result = conn.execute(
        sa.text("SELECT id FROM permissions WHERE code = :code"),
        {'code': NEW_PERMISSION['code']}
    )
    permission = result.fetchone()

    if permission:
        # Remove role_permissions entries
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {'perm_id': permission[0]}
        )

        # Remove permission
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :id"),
            {'id': permission[0]}
        )
