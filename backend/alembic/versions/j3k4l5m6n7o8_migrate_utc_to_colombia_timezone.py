"""
Migrate timestamps from UTC to Colombia timezone (UTC-5)

This migration converts all existing datetime columns from UTC to Colombia timezone
by subtracting 5 hours from each timestamp.

NOTE: Run this migration during a maintenance window when no transactions are occurring.

IMPORTANT EXCLUSIONS:
- inventory_logs and email_logs: Already use Colombia TZ (get_colombia_now_naive)
- sales.sale_date: Already in Colombia time (generated from frontend/service with local time)

Verified in production on 2026-01-23:
- sales.sale_date shows 15:01 (Colombia) while sales.created_at shows 20:01 (UTC)
- The 5-hour difference confirms sale_date is already Colombia time

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-01-23
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'j3k4l5m6n7o8'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None


# Tables and their datetime columns to migrate
# NOTE: inventory_logs and email_logs are EXCLUDED (already use Colombia TZ)
# NOTE: sales.sale_date is EXCLUDED (already in Colombia time from frontend)
TABLES_TO_MIGRATE = {
    # Sales - EXCLUDE sale_date (already Colombia time)
    'sales': ['created_at', 'updated_at'],
    'sale_changes': ['change_date', 'created_at', 'updated_at'],
    'sale_payments': ['created_at'],

    # Orders
    'orders': ['order_date', 'delivery_date', 'created_at', 'updated_at'],
    'order_items': ['status_updated_at'],

    # Accounting
    'transactions': ['created_at', 'updated_at'],
    'expenses': ['created_at', 'updated_at', 'paid_at'],
    'expense_categories': ['created_at', 'updated_at'],
    'expense_adjustments': ['adjusted_at'],
    'daily_cash_registers': ['closed_at', 'created_at', 'updated_at'],
    'balance_accounts': ['created_at', 'updated_at'],
    'balance_entries': ['created_at'],
    'accounts_receivable': ['created_at', 'updated_at'],
    'accounts_payable': ['created_at', 'updated_at'],
    'debt_payment_schedule': ['created_at', 'updated_at'],
    'fixed_expenses': ['created_at', 'updated_at'],

    # Clients
    'clients': ['verification_token_expires', 'last_login', 'welcome_email_sent_at', 'created_at', 'updated_at'],
    'client_students': ['created_at', 'updated_at'],

    # Users
    'users': ['created_at', 'updated_at', 'last_login'],
    'user_school_roles': ['created_at'],
    'email_verification_tokens': ['expires_at', 'created_at'],

    # Schools
    'schools': ['created_at', 'updated_at'],

    # Products and Inventory
    'garment_types': ['created_at', 'updated_at'],
    'garment_type_images': ['created_at'],
    'products': ['created_at', 'updated_at'],
    'inventory': ['last_updated'],
    'global_garment_types': ['created_at', 'updated_at'],
    'global_garment_type_images': ['created_at'],
    'global_products': ['created_at', 'updated_at'],
    'global_inventory': ['last_updated'],

    # Notifications
    'notifications': ['created_at', 'read_at'],

    # Alterations
    'alterations': ['created_at', 'updated_at'],
    'alteration_payments': ['created_at'],

    # Payroll
    'employees': ['created_at', 'updated_at'],
    'employee_bonuses': ['created_at', 'updated_at'],
    'payroll_runs': ['approved_at', 'paid_at', 'created_at'],
    'payroll_items': ['paid_at'],

    # Print Queue
    'print_queue': ['created_at', 'processed_at'],

    # Contacts
    'contacts': ['admin_response_date', 'created_at', 'updated_at'],

    # Business Settings
    'business_settings': ['updated_at'],

    # Cash Drawer
    'drawer_access_codes': ['expires_at', 'used_at', 'created_at'],

    # Permissions & Roles
    'permissions': ['created_at'],
    'custom_roles': ['created_at', 'updated_at'],
    'role_permissions': ['created_at'],

    # Delivery Zones
    'delivery_zones': ['created_at', 'updated_at'],

    # Payment Accounts
    'payment_accounts': ['created_at', 'updated_at'],

    # Documents
    'document_folders': ['created_at', 'updated_at'],
    'business_documents': ['created_at', 'updated_at'],
}


def upgrade():
    """Subtract 5 hours from all datetime columns to convert UTC to Colombia time"""
    for table, columns in TABLES_TO_MIGRATE.items():
        for column in columns:
            # Use INTERVAL to subtract 5 hours
            # Only update non-NULL values
            op.execute(f"""
                UPDATE {table}
                SET {column} = {column} - INTERVAL '5 hours'
                WHERE {column} IS NOT NULL
            """)


def downgrade():
    """Add 5 hours to revert back to UTC"""
    for table, columns in TABLES_TO_MIGRATE.items():
        for column in columns:
            op.execute(f"""
                UPDATE {table}
                SET {column} = {column} + INTERVAL '5 hours'
                WHERE {column} IS NOT NULL
            """)
