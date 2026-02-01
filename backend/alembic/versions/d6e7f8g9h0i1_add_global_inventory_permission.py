"""Add global inventory permission

Adds the global_inventory.adjust permission for adjusting global product inventory.
This permission is assigned to admin and owner system roles by default.

Revision ID: d6e7f8g9h0i1
Revises: c5d6e7f8g9h0
Create Date: 2026-01-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime

# revision identifiers, used by Alembic.
revision: str = 'd6e7f8g9h0i1'
down_revision: Union[str, None] = 'c5d6e7f8g9h0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSION = {
    "code": "global_inventory.adjust",
    "name": "Ajustar inventario global",
    "description": "Realizar ajustes de stock en productos globales (compartidos entre colegios)",
    "category": "global_inventory",
    "is_sensitive": True
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Insert new permission
    perm_id = str(uuid.uuid4())
    now = datetime.utcnow()

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
            'created_at': now
        }
    )

    # 2. Assign to admin and owner system roles
    for role_code in ['admin', 'owner']:
        result = conn.execute(
            sa.text("SELECT id FROM custom_roles WHERE code = :code AND is_system = true AND school_id IS NULL"),
            {'code': role_code}
        )
        role = result.fetchone()

        if role:
            conn.execute(
                sa.text("""
                    INSERT INTO role_permissions (id, role_id, permission_id, requires_approval, created_at)
                    VALUES (:id, :role_id, :permission_id, false, :created_at)
                """),
                {
                    'id': str(uuid.uuid4()),
                    'role_id': role[0],
                    'permission_id': perm_id,
                    'created_at': now
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
        # Delete role_permissions first (foreign key)
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :perm_id"),
            {'perm_id': permission[0]}
        )
        # Delete permission
        conn.execute(
            sa.text("DELETE FROM permissions WHERE id = :id"),
            {'id': permission[0]}
        )
