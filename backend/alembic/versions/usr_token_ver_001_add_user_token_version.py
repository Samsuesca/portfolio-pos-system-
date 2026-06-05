"""Add User.token_version for forced JWT invalidation

Adds an integer column ``token_version`` (default 0) on ``users`` that the
JWT payload must match at validation time. When a user changes password
or completes an email change, ``token_version`` is incremented and any
JWT issued before the bump is rejected by ``get_current_user`` with 401.

Mirrors the existing ``permissions_version`` pattern but for authentication
(not authorization) — ``permissions_version`` invalidates the permission
cache; ``token_version`` invalidates the JWT itself.

Revision ID: usr_token_ver_001
Revises: alt_view_rev_001
Create Date: 2026-05-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "usr_token_ver_001"
down_revision: Union[str, Sequence[str], None] = "alt_view_rev_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
