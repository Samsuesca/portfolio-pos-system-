"""Add granular permissions system

Revision ID: b8d918cf1a56
Revises: fc4f55cc0fd0
Create Date: 2026-01-19

This migration adds:
1. permissions table - catalog of available permissions
2. custom_roles table - custom roles per school
3. role_permissions table - M2M between roles and permissions
4. New columns on user_school_roles for custom roles and permission overrides
5. Seeds initial permissions and system roles
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid
from datetime import datetime

# revision identifiers
revision = 'b8d918cf1a56'
down_revision = 'fc4f55cc0fd0'
branch_labels = None
depends_on = None

# Permission catalog - organized by category
PERMISSIONS_CATALOG = [
    # Sales
    {"code": "sales.view", "name": "Ver ventas", "description": "Ver listado y detalles de ventas", "category": "sales", "is_sensitive": False},
    {"code": "sales.create", "name": "Crear ventas", "description": "Crear nuevas ventas", "category": "sales", "is_sensitive": False},
    {"code": "sales.edit", "name": "Editar ventas", "description": "Modificar ventas existentes (pendientes)", "category": "sales", "is_sensitive": False},
    {"code": "sales.cancel", "name": "Anular ventas", "description": "Anular/cancelar ventas", "category": "sales", "is_sensitive": True},
    {"code": "sales.view_cost", "name": "Ver costos en ventas", "description": "Ver precios de costo en ventas", "category": "sales", "is_sensitive": True},
    {"code": "sales.apply_discount", "name": "Aplicar descuentos", "description": "Aplicar descuentos a ventas (con limite)", "category": "sales", "is_sensitive": False},
    {"code": "sales.view_all_sellers", "name": "Ver ventas de todos", "description": "Ver ventas de otros vendedores", "category": "sales", "is_sensitive": False},
    {"code": "sales.add_payment", "name": "Agregar pagos", "description": "Agregar pagos a ventas existentes", "category": "sales", "is_sensitive": False},

    # Sale Changes
    {"code": "changes.view", "name": "Ver cambios", "description": "Ver solicitudes de cambio/devolucion", "category": "changes", "is_sensitive": False},
    {"code": "changes.create", "name": "Crear cambios", "description": "Crear solicitudes de cambio/devolucion", "category": "changes", "is_sensitive": False},
    {"code": "changes.approve", "name": "Aprobar cambios", "description": "Aprobar solicitudes de cambio", "category": "changes", "is_sensitive": False},
    {"code": "changes.reject", "name": "Rechazar cambios", "description": "Rechazar solicitudes de cambio", "category": "changes", "is_sensitive": False},

    # Inventory
    {"code": "inventory.view", "name": "Ver inventario", "description": "Ver stock y disponibilidad", "category": "inventory", "is_sensitive": False},
    {"code": "inventory.view_cost", "name": "Ver costos inventario", "description": "Ver precios de costo en inventario", "category": "inventory", "is_sensitive": True},
    {"code": "inventory.adjust", "name": "Ajustar inventario", "description": "Realizar ajustes de stock", "category": "inventory", "is_sensitive": False},
    {"code": "inventory.report", "name": "Reportes inventario", "description": "Generar reportes de inventario", "category": "inventory", "is_sensitive": False},

    # Products
    {"code": "products.view", "name": "Ver productos", "description": "Ver catalogo de productos", "category": "products", "is_sensitive": False},
    {"code": "products.create", "name": "Crear productos", "description": "Crear nuevos productos", "category": "products", "is_sensitive": False},
    {"code": "products.edit", "name": "Editar productos", "description": "Modificar productos existentes", "category": "products", "is_sensitive": False},
    {"code": "products.delete", "name": "Eliminar productos", "description": "Eliminar/desactivar productos", "category": "products", "is_sensitive": False},
    {"code": "products.set_price", "name": "Establecer precios", "description": "Modificar precios de venta", "category": "products", "is_sensitive": True},
    {"code": "products.set_cost", "name": "Establecer costos", "description": "Modificar precios de costo", "category": "products", "is_sensitive": True},

    # Clients
    {"code": "clients.view", "name": "Ver clientes", "description": "Ver listado y detalles de clientes", "category": "clients", "is_sensitive": False},
    {"code": "clients.create", "name": "Crear clientes", "description": "Registrar nuevos clientes", "category": "clients", "is_sensitive": False},
    {"code": "clients.edit", "name": "Editar clientes", "description": "Modificar datos de clientes", "category": "clients", "is_sensitive": False},
    {"code": "clients.delete", "name": "Eliminar clientes", "description": "Eliminar/desactivar clientes", "category": "clients", "is_sensitive": False},
    {"code": "clients.view_balance", "name": "Ver saldos clientes", "description": "Ver balance y deudas de clientes", "category": "clients", "is_sensitive": False},

    # Orders
    {"code": "orders.view", "name": "Ver pedidos", "description": "Ver listado y detalles de pedidos", "category": "orders", "is_sensitive": False},
    {"code": "orders.create", "name": "Crear pedidos", "description": "Crear nuevos pedidos", "category": "orders", "is_sensitive": False},
    {"code": "orders.edit", "name": "Editar pedidos", "description": "Modificar pedidos existentes", "category": "orders", "is_sensitive": False},
    {"code": "orders.cancel", "name": "Cancelar pedidos", "description": "Cancelar pedidos pendientes", "category": "orders", "is_sensitive": False},
    {"code": "orders.change_status", "name": "Cambiar estado pedidos", "description": "Actualizar estado de pedidos", "category": "orders", "is_sensitive": False},
    {"code": "orders.view_all_sellers", "name": "Ver pedidos de todos", "description": "Ver pedidos de otros vendedores", "category": "orders", "is_sensitive": False},
    {"code": "orders.add_payment", "name": "Agregar pagos pedido", "description": "Registrar pagos en pedidos", "category": "orders", "is_sensitive": False},
    {"code": "orders.deliver", "name": "Marcar entregado", "description": "Marcar pedidos como entregados", "category": "orders", "is_sensitive": False},

    # Accounting
    {"code": "accounting.view_cash", "name": "Ver caja", "description": "Ver saldos de caja y banco", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.view_expenses", "name": "Ver gastos", "description": "Ver listado de gastos", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.create_expense", "name": "Crear gastos", "description": "Registrar nuevos gastos", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.pay_expense", "name": "Pagar gastos", "description": "Registrar pagos de gastos", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.adjust_expense", "name": "Ajustar gastos", "description": "Revertir/ajustar pagos de gastos", "category": "accounting", "is_sensitive": True},
    {"code": "accounting.view_receivables", "name": "Ver CxC", "description": "Ver cuentas por cobrar", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.manage_receivables", "name": "Gestionar CxC", "description": "Crear/cobrar cuentas por cobrar", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.view_payables", "name": "Ver CxP", "description": "Ver cuentas por pagar", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.manage_payables", "name": "Gestionar CxP", "description": "Crear/pagar cuentas por pagar", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.view_transactions", "name": "Ver transacciones", "description": "Ver historial de transacciones", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.view_balance", "name": "Ver balance general", "description": "Ver balance general", "category": "accounting", "is_sensitive": False},
    {"code": "accounting.set_initial_balance", "name": "Ajustar saldos", "description": "Establecer saldos iniciales", "category": "accounting", "is_sensitive": True},

    # Alterations
    {"code": "alterations.view", "name": "Ver arreglos", "description": "Ver listado de arreglos", "category": "alterations", "is_sensitive": False},
    {"code": "alterations.create", "name": "Crear arreglos", "description": "Registrar nuevos arreglos", "category": "alterations", "is_sensitive": False},
    {"code": "alterations.edit", "name": "Editar arreglos", "description": "Modificar arreglos existentes", "category": "alterations", "is_sensitive": False},
    {"code": "alterations.change_status", "name": "Cambiar estado arreglos", "description": "Actualizar estado de arreglos", "category": "alterations", "is_sensitive": False},
    {"code": "alterations.add_payment", "name": "Cobrar arreglos", "description": "Registrar pagos de arreglos", "category": "alterations", "is_sensitive": False},

    # Reports
    {"code": "reports.sales", "name": "Reportes ventas", "description": "Generar reportes de ventas", "category": "reports", "is_sensitive": False},
    {"code": "reports.inventory", "name": "Reportes inventario", "description": "Generar reportes de inventario", "category": "reports", "is_sensitive": False},
    {"code": "reports.financial", "name": "Reportes financieros", "description": "Generar reportes financieros", "category": "reports", "is_sensitive": True},
    {"code": "reports.dashboard", "name": "Ver dashboard", "description": "Acceder al dashboard de metricas", "category": "reports", "is_sensitive": False},
    {"code": "reports.export", "name": "Exportar datos", "description": "Exportar datos a Excel/CSV", "category": "reports", "is_sensitive": False},

    # Users (school-level management)
    {"code": "users.view", "name": "Ver usuarios", "description": "Ver usuarios del colegio", "category": "users", "is_sensitive": False},
    {"code": "users.invite", "name": "Invitar usuarios", "description": "Invitar nuevos usuarios al colegio", "category": "users", "is_sensitive": False},
    {"code": "users.edit_role", "name": "Editar roles", "description": "Cambiar rol de usuarios", "category": "users", "is_sensitive": False},
    {"code": "users.remove", "name": "Remover usuarios", "description": "Remover acceso de usuarios", "category": "users", "is_sensitive": False},
    {"code": "users.create_custom_role", "name": "Crear roles", "description": "Crear roles personalizados", "category": "users", "is_sensitive": False},

    # Settings
    {"code": "settings.view", "name": "Ver configuracion", "description": "Ver configuracion del colegio", "category": "settings", "is_sensitive": False},
    {"code": "settings.edit", "name": "Editar configuracion", "description": "Modificar configuracion del colegio", "category": "settings", "is_sensitive": False},
    {"code": "settings.manage_garment_types", "name": "Gestionar tipos prenda", "description": "Gestionar tipos de prenda", "category": "settings", "is_sensitive": False},
]

# System roles with their default permissions
SYSTEM_ROLES = {
    "viewer": {
        "name": "Visualizador",
        "description": "Acceso de solo lectura a ventas, productos y clientes",
        "color": "#6B7280",
        "icon": "eye",
        "priority": 1,
        "permissions": [
            "sales.view", "products.view", "clients.view", "orders.view",
            "inventory.view", "changes.view", "alterations.view", "reports.dashboard"
        ]
    },
    "seller": {
        "name": "Vendedor",
        "description": "Crear ventas, gestionar clientes y pedidos",
        "color": "#10B981",
        "icon": "shopping-cart",
        "priority": 2,
        "permissions": [
            # Viewer permissions
            "sales.view", "products.view", "clients.view", "orders.view",
            "inventory.view", "changes.view", "alterations.view", "reports.dashboard",
            # Seller permissions
            "sales.create", "sales.apply_discount", "sales.add_payment",
            "clients.create", "clients.edit",
            "orders.create", "orders.edit", "orders.add_payment",
            "changes.create",
            "reports.sales"
        ]
    },
    "admin": {
        "name": "Administrador",
        "description": "Gestion completa del negocio, inventario y contabilidad",
        "color": "#3B82F6",
        "icon": "briefcase",
        "priority": 3,
        "permissions": [
            # All seller permissions
            "sales.view", "products.view", "clients.view", "orders.view",
            "inventory.view", "changes.view", "alterations.view", "reports.dashboard",
            "sales.create", "sales.apply_discount", "sales.add_payment",
            "clients.create", "clients.edit",
            "orders.create", "orders.edit", "orders.add_payment",
            "changes.create", "reports.sales",
            # Admin permissions
            "sales.edit", "sales.cancel", "sales.view_cost", "sales.view_all_sellers",
            "changes.approve", "changes.reject",
            "products.create", "products.edit", "products.delete", "products.set_price", "products.set_cost",
            "inventory.view_cost", "inventory.adjust", "inventory.report",
            "clients.delete", "clients.view_balance",
            "orders.cancel", "orders.change_status", "orders.view_all_sellers", "orders.deliver",
            "accounting.view_cash", "accounting.view_expenses", "accounting.create_expense",
            "accounting.pay_expense", "accounting.view_receivables", "accounting.manage_receivables",
            "accounting.view_payables", "accounting.manage_payables", "accounting.view_transactions",
            "accounting.view_balance",
            "alterations.create", "alterations.edit", "alterations.change_status", "alterations.add_payment",
            "reports.inventory", "reports.financial", "reports.export"
        ]
    },
    "owner": {
        "name": "Propietario",
        "description": "Control total incluyendo gestion de usuarios y configuracion",
        "color": "#8B5CF6",
        "icon": "crown",
        "priority": 4,
        "permissions": "all"  # Special marker: owner gets all permissions
    }
}


def upgrade() -> None:
    # 1. Create permissions table
    op.create_table(
        'permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('category', sa.String(50), nullable=False, index=True),
        sa.Column('is_sensitive', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # 2. Create custom_roles table
    op.create_table(
        'custom_roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('color', sa.String(7), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('priority', sa.Integer, nullable=False, default=0),
        sa.Column('is_system', sa.Boolean, nullable=False, default=False),
        sa.Column('is_active', sa.Boolean, nullable=False, default=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('school_id', 'code', name='uq_custom_role_school_code'),
    )

    # 3. Create role_permissions table
    op.create_table(
        'role_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('custom_roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('permissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('max_discount_percent', sa.Integer, nullable=True),
        sa.Column('max_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('requires_approval', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
    )

    # 4. Modify user_school_roles table
    op.add_column('user_school_roles',
        sa.Column('custom_role_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('custom_roles.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column('user_school_roles',
        sa.Column('permission_overrides', postgresql.JSONB, nullable=True)
    )
    op.add_column('user_school_roles',
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default='false')
    )

    # Make role column nullable (since we now support custom_role_id)
    op.alter_column('user_school_roles', 'role', nullable=True)

    # Add check constraint: at least one of role or custom_role_id must be set
    op.create_check_constraint(
        'ck_user_school_role_has_role',
        'user_school_roles',
        '(role IS NOT NULL) OR (custom_role_id IS NOT NULL)'
    )

    # 5. Seed permissions
    conn = op.get_bind()
    permission_ids = {}

    for perm in PERMISSIONS_CATALOG:
        perm_id = str(uuid.uuid4())
        permission_ids[perm['code']] = perm_id
        conn.execute(
            sa.text("""
                INSERT INTO permissions (id, code, name, description, category, is_sensitive, created_at)
                VALUES (:id, :code, :name, :description, :category, :is_sensitive, :created_at)
            """),
            {
                'id': perm_id,
                'code': perm['code'],
                'name': perm['name'],
                'description': perm['description'],
                'category': perm['category'],
                'is_sensitive': perm['is_sensitive'],
                'created_at': datetime.utcnow()
            }
        )

    # 6. Create system roles (global, no school_id)
    role_ids = {}
    for code, role_data in SYSTEM_ROLES.items():
        role_id = str(uuid.uuid4())
        role_ids[code] = role_id
        conn.execute(
            sa.text("""
                INSERT INTO custom_roles (id, school_id, code, name, description, color, icon, priority, is_system, is_active, created_at, updated_at)
                VALUES (:id, NULL, :code, :name, :description, :color, :icon, :priority, true, true, :created_at, :updated_at)
            """),
            {
                'id': role_id,
                'code': code,
                'name': role_data['name'],
                'description': role_data['description'],
                'color': role_data['color'],
                'icon': role_data['icon'],
                'priority': role_data['priority'],
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
        )

    # 7. Assign permissions to system roles
    for code, role_data in SYSTEM_ROLES.items():
        role_id = role_ids[code]

        if role_data['permissions'] == 'all':
            # Owner gets all permissions
            perms_to_assign = list(permission_ids.keys())
        else:
            perms_to_assign = role_data['permissions']

        for perm_code in perms_to_assign:
            if perm_code in permission_ids:
                # Set max_discount_percent based on role
                max_discount = None
                if perm_code == 'sales.apply_discount':
                    if code == 'seller':
                        max_discount = 10
                    elif code == 'admin':
                        max_discount = 25
                    elif code == 'owner':
                        max_discount = 100

                conn.execute(
                    sa.text("""
                        INSERT INTO role_permissions (id, role_id, permission_id, max_discount_percent, requires_approval, created_at)
                        VALUES (:id, :role_id, :permission_id, :max_discount, false, :created_at)
                    """),
                    {
                        'id': str(uuid.uuid4()),
                        'role_id': role_id,
                        'permission_id': permission_ids[perm_code],
                        'max_discount': max_discount,
                        'created_at': datetime.utcnow()
                    }
                )


def downgrade() -> None:
    conn = op.get_bind()

    # First, set role='seller' for any records that have custom_role_id but no system role
    # This ensures we can make role NOT NULL again
    conn.execute(
        sa.text("""
            UPDATE user_school_roles
            SET role = 'seller'
            WHERE role IS NULL AND custom_role_id IS NOT NULL
        """)
    )

    # Remove check constraint
    op.drop_constraint('ck_user_school_role_has_role', 'user_school_roles')

    # Remove columns from user_school_roles
    op.drop_column('user_school_roles', 'is_primary')
    op.drop_column('user_school_roles', 'permission_overrides')
    op.drop_column('user_school_roles', 'custom_role_id')

    # Make role column required again
    op.alter_column('user_school_roles', 'role', nullable=False)

    # Drop tables (in reverse order due to foreign keys)
    op.drop_table('role_permissions')
    op.drop_table('custom_roles')
    op.drop_table('permissions')
