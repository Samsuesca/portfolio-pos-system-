"""Add cost_change_log table for cost audit trail

Revision ID: cost_change_001
Revises: gender_norm_001
Create Date: 2026-05-24

Crea la tabla cost_change_log para auditar cambios en costos por componente,
siguiendo el patrón de inventory_logs (audit by-domain, append-only).

Capta: quién cambió un component (changed_by), cuándo, de cuánto a cuánto
(amount_before / amount_after), por qué (reason), y de qué tipo es el cambio
(created/updated/deleted/template_activated/template_deactivated/bulk_apply/import).

Diseñado extensible: el enum acepta agregar `input_price_change` u otros tipos
en el futuro vía `ALTER TYPE ... ADD VALUE` sin migración intrusiva. Esto
prepara el modelo para modelación dinámica de costos (insumos compartidos con
precio histórico).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'cost_change_001'
down_revision = 'gender_norm_001'
branch_labels = None
depends_on = None


COST_CHANGE_TYPES = (
    'created',
    'updated',
    'deleted',
    'template_activated',
    'template_deactivated',
    'bulk_apply',
    'import',
)


def upgrade() -> None:
    cost_change_type_enum = postgresql.ENUM(
        *COST_CHANGE_TYPES,
        name='cost_change_type_enum',
        create_type=False,
    )
    cost_change_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'cost_change_log',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('product_cost_component_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            'change_type',
            postgresql.ENUM(
                *COST_CHANGE_TYPES,
                name='cost_change_type_enum',
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('amount_before', sa.Numeric(10, 2), nullable=True),
        sa.Column('amount_after', sa.Numeric(10, 2), nullable=True),
        sa.Column('notes_before', sa.Text(), nullable=True),
        sa.Column('notes_after', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),

        # FKs
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['cost_component_templates.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(
            ['product_cost_component_id'], ['product_cost_components.id'], ondelete='SET NULL',
        ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
    )

    # Índices para queries comunes
    op.create_index(
        'ix_cost_change_log_product_created',
        'cost_change_log',
        ['product_id', sa.text('created_at DESC')],
    )
    op.create_index(
        'ix_cost_change_log_template_created',
        'cost_change_log',
        ['template_id', sa.text('created_at DESC')],
    )
    op.create_index(
        'ix_cost_change_log_changed_by_created',
        'cost_change_log',
        ['changed_by', sa.text('created_at DESC')],
    )
    op.create_index('ix_cost_change_log_school_id', 'cost_change_log', ['school_id'])
    op.create_index('ix_cost_change_log_change_type', 'cost_change_log', ['change_type'])


def downgrade() -> None:
    op.drop_index('ix_cost_change_log_change_type', table_name='cost_change_log')
    op.drop_index('ix_cost_change_log_school_id', table_name='cost_change_log')
    op.drop_index('ix_cost_change_log_changed_by_created', table_name='cost_change_log')
    op.drop_index('ix_cost_change_log_template_created', table_name='cost_change_log')
    op.drop_index('ix_cost_change_log_product_created', table_name='cost_change_log')

    op.drop_table('cost_change_log')

    op.execute('DROP TYPE IF EXISTS cost_change_type_enum CASCADE')
