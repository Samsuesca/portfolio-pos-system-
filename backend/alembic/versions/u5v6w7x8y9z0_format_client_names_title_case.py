"""Format existing client names to Title Case

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-01-10

This migration updates all existing client and student names to Title Case format.
New records will be automatically formatted by Pydantic validators in the schema.
"""
from typing import Sequence, Union
from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'u5v6w7x8y9z0'
down_revision: Union[str, None] = 't4u5v6w7x8y9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Update all client names and student names to Title Case using INITCAP.
    PostgreSQL's INITCAP function capitalizes the first letter of each word.
    """
    connection = op.get_bind()

    # Update client names in clients table
    connection.execute(text("""
        UPDATE clients
        SET name = INITCAP(TRIM(name))
        WHERE name IS NOT NULL AND name != ''
    """))

    # Update legacy student_name field in clients table
    connection.execute(text("""
        UPDATE clients
        SET student_name = INITCAP(TRIM(student_name))
        WHERE student_name IS NOT NULL AND student_name != ''
    """))

    # Update student names in client_students table
    connection.execute(text("""
        UPDATE client_students
        SET student_name = INITCAP(TRIM(student_name))
        WHERE student_name IS NOT NULL AND student_name != ''
    """))


def downgrade() -> None:
    """
    No downgrade needed - name formatting is non-destructive.
    Original casing cannot be recovered, so we leave names as-is.
    """
    pass
