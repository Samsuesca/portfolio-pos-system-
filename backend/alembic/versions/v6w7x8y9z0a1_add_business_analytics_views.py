"""Add business analytics SQL views

Revision ID: v6w7x8y9z0a1
Revises: u5v6w7x8y9z0
Create Date: 2026-01-10

Creates 7 read-only SQL views for business analytics:
- v_sales_daily_summary: Daily sales by payment method and school
- v_top_products_by_school: Top selling products ranked by quantity/revenue
- v_inventory_alerts: Products with low/critical stock
- v_client_lifetime_value: Historical value per client
- v_pending_receivables: Pending/overdue accounts receivable
- v_daily_cash_flow: Daily income minus expenses
- v_school_performance: Monthly performance metrics per school
"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'v6w7x8y9z0a1'
down_revision: Union[str, None] = 'u5v6w7x8y9z0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all business analytics views"""

    # 1. v_sales_daily_summary - Daily sales summary by payment method and school
    # Note: Cast payment_method to TEXT to compare with string literals
    op.execute("""
    CREATE OR REPLACE VIEW v_sales_daily_summary AS
    SELECT
        DATE(s.sale_date) as sale_date,
        s.school_id,
        sch.name as school_name,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total), 0) as total_revenue,
        COALESCE(SUM(s.paid_amount), 0) as total_collected,
        COALESCE(SUM(s.total - s.paid_amount), 0) as total_pending,
        COUNT(CASE WHEN s.payment_method::TEXT = 'cash' THEN 1 END) as cash_count,
        COALESCE(SUM(CASE WHEN s.payment_method::TEXT = 'cash' THEN s.paid_amount ELSE 0 END), 0) as cash_amount,
        COUNT(CASE WHEN s.payment_method::TEXT = 'nequi' THEN 1 END) as nequi_count,
        COALESCE(SUM(CASE WHEN s.payment_method::TEXT = 'nequi' THEN s.paid_amount ELSE 0 END), 0) as nequi_amount,
        COUNT(CASE WHEN s.payment_method::TEXT = 'transfer' THEN 1 END) as transfer_count,
        COALESCE(SUM(CASE WHEN s.payment_method::TEXT = 'transfer' THEN s.paid_amount ELSE 0 END), 0) as transfer_amount,
        COUNT(CASE WHEN s.payment_method::TEXT = 'card' THEN 1 END) as card_count,
        COALESCE(SUM(CASE WHEN s.payment_method::TEXT = 'card' THEN s.paid_amount ELSE 0 END), 0) as card_amount,
        COUNT(CASE WHEN s.payment_method::TEXT = 'credit' THEN 1 END) as credit_count,
        COALESCE(SUM(CASE WHEN s.payment_method::TEXT = 'credit' THEN s.total ELSE 0 END), 0) as credit_amount
    FROM sales s
    LEFT JOIN schools sch ON s.school_id = sch.id
    WHERE s.status::TEXT = 'completed' AND (s.is_historical = false OR s.is_historical IS NULL)
    GROUP BY DATE(s.sale_date), s.school_id, sch.name
    ORDER BY sale_date DESC, school_name;
    """)

    # 2. v_top_products_by_school - Top selling products per school
    op.execute("""
    CREATE OR REPLACE VIEW v_top_products_by_school AS
    SELECT
        p.school_id,
        sch.name as school_name,
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        gt.name as garment_type,
        p.size,
        p.price,
        COUNT(si.id) as times_sold,
        COALESCE(SUM(si.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(si.subtotal), 0) as total_revenue,
        RANK() OVER (PARTITION BY p.school_id ORDER BY COALESCE(SUM(si.quantity), 0) DESC) as rank_by_quantity,
        RANK() OVER (PARTITION BY p.school_id ORDER BY COALESCE(SUM(si.subtotal), 0) DESC) as rank_by_revenue
    FROM products p
    JOIN schools sch ON p.school_id = sch.id
    JOIN garment_types gt ON p.garment_type_id = gt.id
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON si.sale_id = s.id AND s.status::TEXT = 'completed'
    WHERE p.is_active = true
    GROUP BY p.school_id, sch.name, p.id, p.code, p.name, gt.name, p.size, p.price
    ORDER BY p.school_id, total_quantity_sold DESC;
    """)

    # 3. v_inventory_alerts - Products with low or critical stock
    op.execute("""
    CREATE OR REPLACE VIEW v_inventory_alerts AS
    SELECT
        i.school_id,
        sch.name as school_name,
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        gt.name as garment_type,
        p.size,
        i.quantity as current_stock,
        COALESCE(i.min_stock_alert, 5) as min_stock_alert,
        CASE
            WHEN i.quantity = 0 THEN 'out_of_stock'
            WHEN i.quantity <= COALESCE(i.min_stock_alert, 5) * 0.5 THEN 'critical'
            WHEN i.quantity <= COALESCE(i.min_stock_alert, 5) THEN 'low'
            ELSE 'ok'
        END as stock_status,
        GREATEST(COALESCE(i.min_stock_alert, 5) - i.quantity, 0) as units_needed,
        i.last_updated
    FROM inventory i
    JOIN products p ON i.product_id = p.id
    JOIN schools sch ON i.school_id = sch.id
    JOIN garment_types gt ON p.garment_type_id = gt.id
    WHERE p.is_active = true AND i.quantity <= COALESCE(i.min_stock_alert, 5)
    ORDER BY
        CASE
            WHEN i.quantity = 0 THEN 1
            WHEN i.quantity <= COALESCE(i.min_stock_alert, 5) * 0.5 THEN 2
            ELSE 3
        END,
        sch.name, p.name;
    """)

    # 4. v_client_lifetime_value - Total historical value per client
    op.execute("""
    CREATE OR REPLACE VIEW v_client_lifetime_value AS
    SELECT
        c.id as client_id,
        c.code as client_code,
        c.name as client_name,
        c.phone,
        c.email,
        c.school_id,
        sch.name as school_name,
        COUNT(DISTINCT s.id) as total_purchases,
        COALESCE(SUM(s.total), 0) as lifetime_value,
        COALESCE(SUM(s.paid_amount), 0) as total_paid,
        COALESCE(SUM(s.total - s.paid_amount), 0) as total_owed,
        MIN(s.sale_date) as first_purchase,
        MAX(s.sale_date) as last_purchase,
        EXTRACT(days FROM (NOW() - MAX(s.sale_date)))::integer as days_since_last_purchase,
        COALESCE(AVG(s.total), 0) as avg_purchase_value
    FROM clients c
    LEFT JOIN schools sch ON c.school_id = sch.id
    LEFT JOIN sales s ON s.client_id = c.id AND s.status::TEXT = 'completed'
    WHERE c.is_active = true
    GROUP BY c.id, c.code, c.name, c.phone, c.email, c.school_id, sch.name
    ORDER BY lifetime_value DESC NULLS LAST;
    """)

    # 5. v_pending_receivables - Pending and overdue accounts receivable
    op.execute("""
    CREATE OR REPLACE VIEW v_pending_receivables AS
    SELECT
        ar.id as receivable_id,
        ar.school_id,
        sch.name as school_name,
        ar.client_id,
        c.name as client_name,
        c.phone as client_phone,
        ar.amount as original_amount,
        ar.amount_paid,
        ar.amount - ar.amount_paid as balance,
        ar.description,
        ar.invoice_date,
        ar.due_date,
        CASE
            WHEN ar.due_date IS NULL THEN 'no_due_date'
            WHEN ar.due_date < CURRENT_DATE THEN 'overdue'
            WHEN ar.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
            ELSE 'on_time'
        END as status,
        CASE
            WHEN ar.due_date IS NOT NULL AND ar.due_date < CURRENT_DATE
            THEN (CURRENT_DATE - ar.due_date)
            ELSE 0
        END as days_overdue,
        ar.created_at
    FROM accounts_receivable ar
    LEFT JOIN schools sch ON ar.school_id = sch.id
    LEFT JOIN clients c ON ar.client_id = c.id
    WHERE ar.is_paid = false
    ORDER BY
        CASE WHEN ar.due_date < CURRENT_DATE THEN 0 ELSE 1 END,
        ar.due_date NULLS LAST,
        ar.amount - ar.amount_paid DESC;
    """)

    # 6. v_daily_cash_flow - Daily income minus expenses
    op.execute("""
    CREATE OR REPLACE VIEW v_daily_cash_flow AS
    WITH daily_income AS (
        SELECT
            DATE(s.sale_date) as flow_date,
            COALESCE(SUM(s.paid_amount), 0) as total_income
        FROM sales s
        WHERE s.status::TEXT = 'completed' AND (s.is_historical = false OR s.is_historical IS NULL)
        GROUP BY DATE(s.sale_date)
    ),
    daily_expenses AS (
        SELECT
            e.expense_date as flow_date,
            COALESCE(SUM(e.amount_paid), 0) as total_expenses
        FROM expenses e
        WHERE e.is_paid = true AND e.is_active = true
        GROUP BY e.expense_date
    ),
    all_dates AS (
        SELECT flow_date FROM daily_income
        UNION
        SELECT flow_date FROM daily_expenses
    )
    SELECT
        ad.flow_date,
        COALESCE(di.total_income, 0) as income,
        COALESCE(de.total_expenses, 0) as expenses,
        COALESCE(di.total_income, 0) - COALESCE(de.total_expenses, 0) as net_flow,
        SUM(COALESCE(di.total_income, 0) - COALESCE(de.total_expenses, 0))
            OVER (ORDER BY ad.flow_date) as cumulative_flow
    FROM all_dates ad
    LEFT JOIN daily_income di ON ad.flow_date = di.flow_date
    LEFT JOIN daily_expenses de ON ad.flow_date = de.flow_date
    ORDER BY ad.flow_date DESC;
    """)

    # 7. v_school_performance - Monthly performance metrics per school
    op.execute("""
    CREATE OR REPLACE VIEW v_school_performance AS
    SELECT
        sch.id as school_id,
        sch.code as school_code,
        sch.name as school_name,
        DATE_TRUNC('month', s.sale_date)::date as month,
        COUNT(DISTINCT s.id) as total_sales,
        COUNT(DISTINCT s.client_id) as unique_clients,
        COALESCE(SUM(s.total), 0) as total_revenue,
        COALESCE(SUM(s.paid_amount), 0) as collected_revenue,
        COALESCE(AVG(s.total), 0) as avg_sale_value,
        COALESCE(SUM(si.quantity), 0) as total_items_sold,
        COUNT(DISTINCT si.product_id) as unique_products_sold,
        RANK() OVER (
            PARTITION BY DATE_TRUNC('month', s.sale_date)
            ORDER BY COALESCE(SUM(s.total), 0) DESC
        ) as rank_by_revenue
    FROM schools sch
    LEFT JOIN sales s ON s.school_id = sch.id
        AND s.status::TEXT = 'completed'
        AND (s.is_historical = false OR s.is_historical IS NULL)
    LEFT JOIN sale_items si ON si.sale_id = s.id
    WHERE sch.is_active = true
    GROUP BY sch.id, sch.code, sch.name, DATE_TRUNC('month', s.sale_date)
    ORDER BY month DESC NULLS LAST, total_revenue DESC;
    """)


def downgrade() -> None:
    """Drop all business analytics views"""
    op.execute("DROP VIEW IF EXISTS v_school_performance;")
    op.execute("DROP VIEW IF EXISTS v_daily_cash_flow;")
    op.execute("DROP VIEW IF EXISTS v_pending_receivables;")
    op.execute("DROP VIEW IF EXISTS v_client_lifetime_value;")
    op.execute("DROP VIEW IF EXISTS v_inventory_alerts;")
    op.execute("DROP VIEW IF EXISTS v_top_products_by_school;")
    op.execute("DROP VIEW IF EXISTS v_sales_daily_summary;")
