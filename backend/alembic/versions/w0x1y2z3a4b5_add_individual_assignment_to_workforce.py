"""Add individual employee assignment to checklists and responsibilities

Revision ID: w0x1y2z3a4b5
Revises: v0w1x2y3z4a5
Create Date: 2026-02-01

Adds assignment_type and employee_id fields to:
- checklist_templates: Allow assigning checklists to specific employees
- position_responsibilities: Allow assigning responsibilities to specific employees

This enables both "by position" (all employees with that position) and
"by employee" (specific individual) assignment modes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'w0x1y2z3a4b5'
down_revision = 'v0w1x2y3z4a5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # === ChecklistTemplate changes ===
    op.add_column(
        'checklist_templates',
        sa.Column('assignment_type', sa.String(20), server_default='position', nullable=False)
    )
    op.add_column(
        'checklist_templates',
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_checklist_template_employee',
        'checklist_templates',
        'employees',
        ['employee_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index(
        'ix_checklist_template_employee_id',
        'checklist_templates',
        ['employee_id']
    )
    op.create_index(
        'ix_checklist_template_assignment_type',
        'checklist_templates',
        ['assignment_type']
    )

    # === PositionResponsibility changes ===
    op.add_column(
        'position_responsibilities',
        sa.Column('assignment_type', sa.String(20), server_default='position', nullable=False)
    )
    op.add_column(
        'position_responsibilities',
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        'fk_position_responsibility_employee',
        'position_responsibilities',
        'employees',
        ['employee_id'],
        ['id'],
        ondelete='CASCADE'
    )
    op.create_index(
        'ix_position_responsibility_employee_id',
        'position_responsibilities',
        ['employee_id']
    )
    op.create_index(
        'ix_position_responsibility_assignment_type',
        'position_responsibilities',
        ['assignment_type']
    )


def downgrade() -> None:
    # === Revert PositionResponsibility ===
    op.drop_index('ix_position_responsibility_assignment_type', 'position_responsibilities')
    op.drop_index('ix_position_responsibility_employee_id', 'position_responsibilities')
    op.drop_constraint('fk_position_responsibility_employee', 'position_responsibilities', type_='foreignkey')
    op.drop_column('position_responsibilities', 'employee_id')
    op.drop_column('position_responsibilities', 'assignment_type')

    # === Revert ChecklistTemplate ===
    op.drop_index('ix_checklist_template_assignment_type', 'checklist_templates')
    op.drop_index('ix_checklist_template_employee_id', 'checklist_templates')
    op.drop_constraint('fk_checklist_template_employee', 'checklist_templates', type_='foreignkey')
    op.drop_column('checklist_templates', 'employee_id')
    op.drop_column('checklist_templates', 'assignment_type')
