"""fix broken school slugs

Revision ID: 20ec9c1bb001
Revises: f5g6h7i8j9k0
Create Date: 2026-04-12 19:15:59.685108

"""
from alembic import op
import sqlalchemy as sa
import unicodedata
import re


revision = '20ec9c1bb001'
down_revision = 'f5g6h7i8j9k0'
branch_labels = None
depends_on = None


def generate_slug(name: str) -> str:
    normalized = unicodedata.normalize('NFKD', name)
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    slug = ascii_text.lower()
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'[^a-z0-9-]', '', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug


SLUG_FIXES = {
    'instituci-n-educativa-caracas': 'institucion-educativa-caracas',
    'instituci-n-educativa-alfonso-l-pez-pumarejo': 'institucion-educativa-alfonso-lopez-pumarejo',
    'instituci-n-educativa-el-pinal': 'institucion-educativa-el-pinal',
    'buen-comiezo': 'buen-comienzo',
    'institucion-educativa-hector-abad-gomes': 'institucion-educativa-hector-abad-gomez',
    'confama': 'comfama',
}

SLUG_REVERSE = {v: k for k, v in SLUG_FIXES.items()}


def upgrade() -> None:
    conn = op.get_bind()
    for old_slug, new_slug in SLUG_FIXES.items():
        conn.execute(
            sa.text("UPDATE schools SET slug = :new WHERE slug = :old"),
            {"new": new_slug, "old": old_slug}
        )


def downgrade() -> None:
    conn = op.get_bind()
    for new_slug, old_slug in SLUG_REVERSE.items():
        conn.execute(
            sa.text("UPDATE schools SET slug = :old WHERE slug = :new"),
            {"old": old_slug, "new": new_slug}
        )
