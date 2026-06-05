"""Add OrderChange.original_item_disposal for tracking physical fate of items

Adds an enum column ``original_item_disposal`` (nullable) on ``order_changes``
that captures what happened to the original physical item when a change is
approved. This is required for items that did NOT come from stock
(``reserved_from_stock=False``), i.e. items that were either being produced or
already finished as made-to-order.

Possible values:
- ``cancel_production``: item was in production; production is cancelled, no
  physical garment to dispose. Trabajo abandonado, no se contabiliza.
- ``return_to_inventory``: item was finished but is a non-personalized
  catalog product (typically ``cost_type='purchased'``); the physical garment
  returns to ``Inventory``.
- ``register_loss``: item was finished and personalized (with embroidery,
  custom measurements); physical garment cannot be resold and is recorded
  as a loss.

Items reserved from stock (``reserved_from_stock=True``) do not need this
field — the existing ``release_stock`` flow handles them correctly.

Revision ID: order_chg_disp_001
Revises: usr_token_ver_001
Create Date: 2026-05-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "order_chg_disp_001"
down_revision: Union[str, Sequence[str], None] = "usr_token_ver_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DISPOSAL_VALUES = ("cancel_production", "return_to_inventory", "register_loss")


def upgrade() -> None:
    disposal_enum = postgresql.ENUM(
        *DISPOSAL_VALUES,
        name="original_item_disposal_enum",
        create_type=False,
    )
    disposal_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "order_changes",
        sa.Column(
            "original_item_disposal",
            postgresql.ENUM(
                *DISPOSAL_VALUES,
                name="original_item_disposal_enum",
                create_type=False,
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("order_changes", "original_item_disposal")
    op.execute("DROP TYPE IF EXISTS original_item_disposal_enum")
