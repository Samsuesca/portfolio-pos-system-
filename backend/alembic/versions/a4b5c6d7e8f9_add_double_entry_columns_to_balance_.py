"""add double entry columns to balance entries

Revision ID: a4b5c6d7e8f9
Revises: 456cfdab7656
Create Date: 2026-04-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, None] = '456cfdab7656'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('balance_entries', sa.Column(
        'entry_type', sa.String(10), nullable=True,
        comment='debit or credit (NULL for legacy entries)'
    ))
    op.add_column('balance_entries', sa.Column(
        'counterpart_entry_id',
        postgresql.UUID(as_uuid=True),
        sa.ForeignKey('balance_entries.id', ondelete='SET NULL'),
        nullable=True,
        comment='Links to the other side of a double-entry pair'
    ))


def downgrade() -> None:
    op.drop_column('balance_entries', 'counterpart_entry_id')
    op.drop_column('balance_entries', 'entry_type')
