"""Add workforce management tables (shifts, attendance, checklists, performance)

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-01-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === Shift Templates ===
    op.create_table(
        'shift_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('shift_type', sa.String(20), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('break_minutes', sa.Integer(), server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # === Employee Schedules ===
    op.create_table(
        'employee_schedules',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shift_template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('shift_templates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('schedule_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('employee_id', 'schedule_date', name='uq_employee_schedule_date'),
    )
    op.create_index('ix_employee_schedule_date', 'employee_schedules', ['employee_id', 'schedule_date'])

    # === Attendance Records ===
    op.create_table(
        'attendance_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('check_in_time', sa.Time(), nullable=True),
        sa.Column('check_out_time', sa.Time(), nullable=True),
        sa.Column('scheduled_start', sa.Time(), nullable=True),
        sa.Column('scheduled_end', sa.Time(), nullable=True),
        sa.Column('minutes_late', sa.Integer(), server_default='0'),
        sa.Column('minutes_early_departure', sa.Integer(), server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('employee_id', 'record_date', name='uq_attendance_employee_date'),
    )
    op.create_index('ix_attendance_employee_date', 'attendance_records', ['employee_id', 'record_date'])

    # === Absence Records ===
    op.create_table(
        'absence_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('attendance_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('attendance_records.id', ondelete='SET NULL'), nullable=True),
        sa.Column('absence_type', sa.String(30), nullable=False),
        sa.Column('absence_date', sa.Date(), nullable=False),
        sa.Column('justification', sa.Text(), nullable=True),
        sa.Column('evidence_url', sa.String(500), nullable=True),
        sa.Column('is_deductible', sa.Boolean(), server_default='true'),
        sa.Column('deduction_amount', sa.Numeric(15, 2), server_default='0'),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_absence_employee_date', 'absence_records', ['employee_id', 'absence_date'])

    # === Checklist Templates ===
    op.create_table(
        'checklist_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('position', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )

    # === Checklist Template Items ===
    op.create_table(
        'checklist_template_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('checklist_templates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_required', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # === Daily Checklists ===
    op.create_table(
        'daily_checklists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('checklist_templates.id', ondelete='SET NULL'), nullable=True),
        sa.Column('checklist_date', sa.Date(), nullable=False),
        sa.Column('total_items', sa.Integer(), server_default='0'),
        sa.Column('completed_items', sa.Integer(), server_default='0'),
        sa.Column('completion_rate', sa.Numeric(5, 2), server_default='0'),
        sa.Column('verified_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('employee_id', 'checklist_date', name='uq_daily_checklist_employee_date'),
    )
    op.create_index('ix_checklist_employee_date', 'daily_checklists', ['employee_id', 'checklist_date'])

    # === Daily Checklist Items ===
    op.create_table(
        'daily_checklist_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('checklist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('daily_checklists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('is_required', sa.Boolean(), server_default='true'),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # === Performance Reviews ===
    op.create_table(
        'performance_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('review_period', sa.String(20), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('attendance_rate', sa.Numeric(5, 2), server_default='0'),
        sa.Column('punctuality_rate', sa.Numeric(5, 2), server_default='0'),
        sa.Column('checklist_completion_rate', sa.Numeric(5, 2), server_default='0'),
        sa.Column('total_sales_amount', sa.Numeric(15, 2), server_default='0'),
        sa.Column('total_sales_count', sa.Integer(), server_default='0'),
        sa.Column('overall_score', sa.Numeric(5, 2), server_default='0'),
        sa.Column('reviewer_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_performance_employee_period', 'performance_reviews', ['employee_id', 'period_start'])


def downgrade() -> None:
    op.drop_table('performance_reviews')
    op.drop_table('daily_checklist_items')
    op.drop_table('daily_checklists')
    op.drop_table('checklist_template_items')
    op.drop_table('checklist_templates')
    op.drop_table('absence_records')
    op.drop_table('attendance_records')
    op.drop_table('employee_schedules')
    op.drop_table('shift_templates')
