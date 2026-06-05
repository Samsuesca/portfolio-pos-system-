"""Remove external alteration clients (v3)

Revision ID: alt_no_ext_v3
Revises: inv_reserved_qty
Create Date: 2026-05-02 10:00:00.000000

Eliminates the "external client" concept from alterations:
- Migrates every alteration with `external_client_name` (and `client_id IS NULL`)
  into a real `clients` row (creating one if needed, matching by phone first
  then by name when no phone is available).
- Reassigns `alterations.client_id` to point to that registered client.
- Drops `external_client_name`, `external_client_phone` columns and the
  CHECK constraint that allowed either-or.
- Promotes `alterations.client_id` to NOT NULL.

The downgrade restores the columns as nullable and relaxes the FK back to
SET NULL, but cannot reconstruct which alterations were originally external
(that signal is lost once data is consolidated).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'alt_no_ext_v3'
down_revision: Union[str, None] = 'inv_reserved_qty'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # 1. Data migration: convert every external alteration into a real Client
    # ------------------------------------------------------------------
    # Strategy:
    #   For each (external_client_name, external_client_phone) pair:
    #     - If phone is non-empty AND a client already has that phone -> reuse.
    #     - Else create a new Client (type=regular, school_id=NULL).
    #   Then set alterations.client_id to that client's id.
    #
    # We do this in a single SQL block so it runs atomically inside the
    # migration transaction. Codes follow the existing CLI-NNNNN pattern
    # generated from MAX(code).

    # Reuse existing clients by phone match
    bind.execute(sa.text("""
        UPDATE alterations a
        SET client_id = c.id
        FROM clients c
        WHERE a.client_id IS NULL
          AND a.external_client_phone IS NOT NULL
          AND a.external_client_phone <> ''
          AND c.phone = a.external_client_phone
          AND c.is_active = TRUE
    """))

    # For the remaining rows, create one Client per distinct (name, phone) pair.
    # We dedupe by COALESCE(phone, '') + lower(trim(name)) so two arreglos for
    # the same external person collapse into a single new client.
    bind.execute(sa.text("""
        WITH next_seq AS (
            SELECT COALESCE(
                MAX(CAST(SUBSTRING(code FROM 'CLI-(\\d+)$') AS INTEGER)),
                0
            ) AS start_num
            FROM clients
            WHERE code ~ '^CLI-\\d+$'
        ),
        distinct_externals AS (
            SELECT DISTINCT ON (
                COALESCE(NULLIF(TRIM(external_client_phone), ''), 'NOPHONE'),
                LOWER(TRIM(external_client_name))
            )
                external_client_name AS name,
                NULLIF(TRIM(external_client_phone), '') AS phone
            FROM alterations
            WHERE client_id IS NULL
              AND external_client_name IS NOT NULL
              AND TRIM(external_client_name) <> ''
            ORDER BY
                COALESCE(NULLIF(TRIM(external_client_phone), ''), 'NOPHONE'),
                LOWER(TRIM(external_client_name)),
                created_at ASC
        ),
        numbered AS (
            SELECT
                name,
                phone,
                ROW_NUMBER() OVER (ORDER BY name) AS rn
            FROM distinct_externals
        ),
        inserted AS (
            INSERT INTO clients (
                id, code, name, phone, client_type, is_active,
                is_verified, welcome_email_sent, whatsapp_opted_in,
                notification_preference, auth_provider,
                created_at, updated_at
            )
            SELECT
                gen_random_uuid(),
                'CLI-' || LPAD(((SELECT start_num FROM next_seq) + n.rn)::text, 5, '0'),
                n.name,
                n.phone,
                'regular',
                TRUE,
                FALSE,
                FALSE,
                FALSE,
                'auto',
                'local',
                NOW(),
                NOW()
            FROM numbered n
            RETURNING id, name, phone
        )
        UPDATE alterations a
        SET client_id = i.id
        FROM inserted i
        WHERE a.client_id IS NULL
          AND a.external_client_name IS NOT NULL
          AND LOWER(TRIM(a.external_client_name)) = LOWER(TRIM(i.name))
          AND COALESCE(NULLIF(TRIM(a.external_client_phone), ''), '') =
              COALESCE(i.phone, '')
    """))

    # Safety net: any alteration that still has no client_id is a data bug
    # (e.g. external_client_name was NULL despite the old CHECK constraint).
    # Fail loudly rather than silently dropping rows.
    leftover = bind.execute(sa.text(
        "SELECT COUNT(*) FROM alterations WHERE client_id IS NULL"
    )).scalar_one()
    if leftover:
        raise RuntimeError(
            f"Migration aborted: {leftover} alterations could not be linked "
            "to a client. Inspect the alterations table manually before retrying."
        )

    # ------------------------------------------------------------------
    # 2. Schema changes
    # ------------------------------------------------------------------
    op.drop_constraint(
        'chk_alteration_has_client', 'alterations', type_='check'
    )

    op.drop_constraint(
        'alterations_client_id_fkey', 'alterations', type_='foreignkey'
    )
    op.create_foreign_key(
        'alterations_client_id_fkey',
        'alterations', 'clients',
        ['client_id'], ['id'],
        ondelete='RESTRICT'
    )

    op.alter_column(
        'alterations', 'client_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=False
    )

    op.drop_column('alterations', 'external_client_name')
    op.drop_column('alterations', 'external_client_phone')


def downgrade() -> None:
    op.add_column(
        'alterations',
        sa.Column('external_client_name', sa.String(255), nullable=True)
    )
    op.add_column(
        'alterations',
        sa.Column('external_client_phone', sa.String(20), nullable=True)
    )

    op.alter_column(
        'alterations', 'client_id',
        existing_type=postgresql.UUID(as_uuid=True),
        nullable=True
    )

    op.drop_constraint(
        'alterations_client_id_fkey', 'alterations', type_='foreignkey'
    )
    op.create_foreign_key(
        'alterations_client_id_fkey',
        'alterations', 'clients',
        ['client_id'], ['id'],
        ondelete='SET NULL'
    )

    op.create_check_constraint(
        'chk_alteration_has_client',
        'alterations',
        'client_id IS NOT NULL OR external_client_name IS NOT NULL'
    )
