"""Add fixed expenses and payroll tables

Revision ID: x8y9z0a1b2c3
Revises: w7x8y9z0a1b2
Create Date: 2026-01-11

Adds:
- fixed_expenses: Templates for recurring/periodic expenses
- fixed_expense_id FK on expenses table
- employees: Employee/worker records
- employee_bonuses: Bonus configurations per employee
- payroll_runs: Payroll period runs
- payroll_items: Individual employee payroll details
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'x8y9z0a1b2c3'
down_revision = 'w7x8y9z0a1b2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create fixed_expense_type_enum
    fixed_expense_type_enum = postgresql.ENUM(
        'exact', 'variable',
        name='fixed_expense_type_enum'
    )
    fixed_expense_type_enum.create(op.get_bind(), checkfirst=True)

    # Create expense_frequency_enum
    expense_frequency_enum = postgresql.ENUM(
        'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly',
        name='expense_frequency_enum'
    )
    expense_frequency_enum.create(op.get_bind(), checkfirst=True)

    # Create payment_frequency_enum (for employees)
    payment_frequency_enum = postgresql.ENUM(
        'weekly', 'biweekly', 'monthly',
        name='payment_frequency_enum'
    )
    payment_frequency_enum.create(op.get_bind(), checkfirst=True)

    # Create bonus_type_enum
    bonus_type_enum = postgresql.ENUM(
        'fixed', 'variable', 'one_time',
        name='bonus_type_enum'
    )
    bonus_type_enum.create(op.get_bind(), checkfirst=True)

    # Create payroll_status_enum
    payroll_status_enum = postgresql.ENUM(
        'draft', 'approved', 'paid', 'cancelled',
        name='payroll_status_enum'
    )
    payroll_status_enum.create(op.get_bind(), checkfirst=True)

    # ==========================================
    # Fixed Expenses Table
    # ==========================================
    op.create_table(
        'fixed_expenses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column(
            'category',
            postgresql.ENUM(
                'rent', 'utilities', 'payroll', 'supplies', 'inventory',
                'transport', 'maintenance', 'marketing', 'taxes', 'bank_fees', 'other',
                name='expense_category_enum',
                create_type=False  # Don't create enum, it already exists
            ),
            nullable=False
        ),
        sa.Column('expense_type', postgresql.ENUM('exact', 'variable', name='fixed_expense_type_enum', create_type=False), nullable=False, server_default='exact'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('min_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('max_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('frequency', postgresql.ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', name='expense_frequency_enum', create_type=False), nullable=False, server_default='monthly'),
        sa.Column('day_of_month', sa.Integer, nullable=True),
        sa.Column('auto_generate', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('next_generation_date', sa.Date, nullable=True),
        sa.Column('last_generated_date', sa.Date, nullable=True),
        sa.Column('vendor', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.CheckConstraint('amount > 0', name='chk_fixed_expense_amount_positive'),
        sa.CheckConstraint(
            "expense_type != 'variable' OR (min_amount IS NOT NULL AND max_amount IS NOT NULL)",
            name='chk_variable_expense_has_range'
        ),
        sa.CheckConstraint(
            'min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount',
            name='chk_expense_range_valid'
        ),
        sa.CheckConstraint(
            'day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)',
            name='chk_day_of_month_valid'
        ),
    )
    op.create_index('ix_fixed_expenses_category', 'fixed_expenses', ['category'])
    op.create_index('ix_fixed_expenses_is_active', 'fixed_expenses', ['is_active'])
    op.create_index('ix_fixed_expenses_next_generation_date', 'fixed_expenses', ['next_generation_date'])

    # Add fixed_expense_id to expenses table
    op.add_column('expenses', sa.Column('fixed_expense_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_expenses_fixed_expense_id',
        'expenses',
        'fixed_expenses',
        ['fixed_expense_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_expenses_fixed_expense_id', 'expenses', ['fixed_expense_id'])

    # ==========================================
    # Employees Table
    # ==========================================
    op.create_table(
        'employees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        # Personal info
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('document_type', sa.String(10), nullable=False, server_default='CC'),
        sa.Column('document_id', sa.String(50), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        # Employment info
        sa.Column('position', sa.String(255), nullable=False),
        sa.Column('hire_date', sa.Date, nullable=False),
        sa.Column('termination_date', sa.Date, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        # Compensation
        sa.Column('base_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('payment_frequency', postgresql.ENUM('weekly', 'biweekly', 'monthly', name='payment_frequency_enum', create_type=False), nullable=False, server_default='monthly'),
        sa.Column('payment_method', sa.String(20), nullable=False, server_default='transfer'),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('bank_account', sa.String(50), nullable=True),
        # Deductions (manual values)
        sa.Column('health_deduction', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('pension_deduction', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('other_deductions', sa.Numeric(12, 2), nullable=False, server_default='0'),
        # Audit
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.CheckConstraint('base_salary > 0', name='chk_employee_base_salary_positive'),
    )
    op.create_index('ix_employees_document_id', 'employees', ['document_id'])
    op.create_index('ix_employees_is_active', 'employees', ['is_active'])
    op.create_index('ix_employees_user_id', 'employees', ['user_id'])

    # ==========================================
    # Employee Bonuses Table
    # ==========================================
    op.create_table(
        'employee_bonuses',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('bonus_type', postgresql.ENUM('fixed', 'variable', 'one_time', name='bonus_type_enum', create_type=False), nullable=False, server_default='fixed'),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('is_recurring', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE'),
        sa.CheckConstraint('amount > 0', name='chk_bonus_amount_positive'),
    )
    op.create_index('ix_employee_bonuses_employee_id', 'employee_bonuses', ['employee_id'])
    op.create_index('ix_employee_bonuses_is_active', 'employee_bonuses', ['is_active'])

    # ==========================================
    # Payroll Runs Table
    # ==========================================
    op.create_table(
        'payroll_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('payment_date', sa.Date, nullable=True),
        sa.Column('status', postgresql.ENUM('draft', 'approved', 'paid', 'cancelled', name='payroll_status_enum', create_type=False), nullable=False, server_default='draft'),
        # Totals
        sa.Column('total_base_salary', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_bonuses', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_deductions', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_net', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('employee_count', sa.Integer, nullable=False, server_default='0'),
        # Link to expense
        sa.Column('expense_id', postgresql.UUID(as_uuid=True), nullable=True),
        # Audit
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime, nullable=True),
        sa.Column('paid_at', sa.DateTime, nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['expense_id'], ['expenses.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.CheckConstraint('period_end >= period_start', name='chk_payroll_period_valid'),
    )
    op.create_index('ix_payroll_runs_status', 'payroll_runs', ['status'])
    op.create_index('ix_payroll_runs_period_start', 'payroll_runs', ['period_start'])

    # ==========================================
    # Payroll Items Table
    # ==========================================
    op.create_table(
        'payroll_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        # Amounts
        sa.Column('base_salary', sa.Numeric(12, 2), nullable=False),
        sa.Column('total_bonuses', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('total_deductions', sa.Numeric(12, 2), nullable=False, server_default='0'),
        sa.Column('net_amount', sa.Numeric(12, 2), nullable=False),
        # Breakdown (JSON)
        sa.Column('bonus_breakdown', postgresql.JSONB, nullable=True),
        sa.Column('deduction_breakdown', postgresql.JSONB, nullable=True),
        # Payment status
        sa.Column('is_paid', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('paid_at', sa.DateTime, nullable=True),
        sa.Column('payment_method', sa.String(20), nullable=True),
        sa.Column('payment_reference', sa.String(100), nullable=True),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='RESTRICT'),
    )
    op.create_index('ix_payroll_items_payroll_run_id', 'payroll_items', ['payroll_run_id'])
    op.create_index('ix_payroll_items_employee_id', 'payroll_items', ['employee_id'])
    op.create_index('ix_payroll_items_is_paid', 'payroll_items', ['is_paid'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('payroll_items')
    op.drop_table('payroll_runs')
    op.drop_table('employee_bonuses')
    op.drop_table('employees')

    # Remove fixed_expense_id from expenses
    op.drop_index('ix_expenses_fixed_expense_id', table_name='expenses')
    op.drop_constraint('fk_expenses_fixed_expense_id', 'expenses', type_='foreignkey')
    op.drop_column('expenses', 'fixed_expense_id')

    # Drop fixed_expenses table
    op.drop_table('fixed_expenses')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS payroll_status_enum')
    op.execute('DROP TYPE IF EXISTS bonus_type_enum')
    op.execute('DROP TYPE IF EXISTS payment_frequency_enum')
    op.execute('DROP TYPE IF EXISTS expense_frequency_enum')
    op.execute('DROP TYPE IF EXISTS fixed_expense_type_enum')
