"""merge school_slugs and sale_payment heads

Revision ID: eca80d86c730
Revises: 20ec9c1bb001, sal3paym3nt
Create Date: 2026-04-13 03:05:48.628667

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'eca80d86c730'
down_revision = ('20ec9c1bb001', 'sal3paym3nt')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
