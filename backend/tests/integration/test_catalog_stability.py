"""Catalog stability invariants — post v3_catalog_stab_001 migration.

These tests verify the post-state that v3_catalog_stab_001 enforces on the
catalog: naming conventions (Title Case), canonical renames (Jumper, Camiseta
blanca piel de durazno, etc.), Delantal Comfama 4 colors complete, orphan
globals populated, and no products without inventory.

Connects to the DEV DB (uniformes_db) by default — set CATALOG_TEST_DB_URL
to override. Skipped automatically if the DB is unreachable.

Run with:
    cd backend && venv/bin/pytest tests/integration/test_catalog_stability.py -v
"""
from __future__ import annotations

import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


pytestmark = pytest.mark.asyncio


# Default to dev v3 DB; override via env if needed.
CATALOG_DB_URL = os.getenv(
    "CATALOG_TEST_DB_URL",
    "postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db",
)


@pytest.fixture(scope="module")
async def catalog_session() -> AsyncSession:
    """Read-only async session to the catalog DB.

    Skips the test if the DB is unreachable (e.g. dev Docker is down or
    you're running tests in CI without the dev DB).
    """
    engine = create_async_engine(CATALOG_DB_URL, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        await engine.dispose()
        pytest.skip(f"Catalog DB unreachable at {CATALOG_DB_URL}: {e}")

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture(scope="module")
async def migration_applied(catalog_session: AsyncSession):
    """Skip the module if v3_catalog_stab_001 hasn't been applied yet.

    Detects application by checking for a canonical rename ('Jumper' exists)
    rather than the alembic head, because newer migrations may chain on top
    of ours.
    """
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM garment_types WHERE name = 'Jumper'")
    )
    jumper_count = result.scalar() or 0

    if jumper_count == 0:
        # Migration probably not applied yet (or no school had a Yomber→Jumper rename)
        head_result = await catalog_session.execute(
            text("SELECT version_num FROM alembic_version")
        )
        head = head_result.scalar()
        pytest.skip(
            f"Migration v3_catalog_stab_001 evidence not found in DB "
            f"(no 'Jumper' garment_types; current head: {head}). "
            "Run `alembic upgrade head` to apply the migration first."
        )
    return jumper_count


# ============================================================================
# SECTION 1 — Naming conventions (Title Case rule)
# ============================================================================


async def test_no_garment_type_starts_with_lowercase(
    migration_applied, catalog_session: AsyncSession
):
    """All garment_types.name must start with an uppercase letter (Title Case rule)."""
    result = await catalog_session.execute(
        text(
            """
            SELECT name FROM garment_types
            WHERE name ~ '^[a-z]'
            ORDER BY name
            """
        )
    )
    offenders = [row[0] for row in result.fetchall()]
    assert offenders == [], (
        f"Found garment_types with lowercase first letter: {offenders}"
    )


async def test_no_product_starts_with_lowercase(
    migration_applied, catalog_session: AsyncSession
):
    """All products.name must start with an uppercase letter."""
    result = await catalog_session.execute(
        text(
            """
            SELECT DISTINCT name FROM products
            WHERE name IS NOT NULL AND name ~ '^[a-z]'
            ORDER BY name
            LIMIT 20
            """
        )
    )
    offenders = [row[0] for row in result.fetchall()]
    assert offenders == [], (
        f"Found products with lowercase first letter: {offenders}"
    )


# ============================================================================
# SECTION 2 — Renames aplicados (Yomber, Interios, Camisillas, etc.)
# ============================================================================


async def test_no_yomber_remaining(migration_applied, catalog_session: AsyncSession):
    """'Yomber' must be renamed to 'Jumper' across all schools."""
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM garment_types WHERE LOWER(name) = 'yomber'")
    )
    assert result.scalar() == 0, "'Yomber' still present (should be 'Jumper')"


async def test_no_interios_remaining(migration_applied, catalog_session: AsyncSession):
    """'Interios' typo must be renamed to 'Interiores'."""
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM garment_types WHERE LOWER(name) = 'interios'")
    )
    assert result.scalar() == 0, "'Interios' typo still present"


async def test_canonical_global_names_exist(
    migration_applied, catalog_session: AsyncSession
):
    """The canonical global names from the owner's renames must exist."""
    expected = {
        "Camiseta blanca piel de durazno",
        "Camiseta blanca tipo esqueleto",
        "Medias canilleras negro",
        "Tennis Nike blanco",
        "Tennis Nike negro",
        "Bicicletero",
        "Top deportivo",
    }
    names_sql = ", ".join(f"'{n}'" for n in expected)
    result = await catalog_session.execute(
        text(
            f"""
            SELECT name FROM garment_types
            WHERE school_id IS NULL AND name IN ({names_sql})
            """
        )
    )
    found = {row[0] for row in result.fetchall()}
    missing = expected - found
    assert not missing, f"Canonical global names missing: {missing}"


async def test_deprecated_global_names_gone(
    migration_applied, catalog_session: AsyncSession
):
    """Old names ('Camisa basica', 'Camisillas', 'Bicicleteros', 'Top') must be gone."""
    result = await catalog_session.execute(
        text(
            """
            SELECT name FROM garment_types
            WHERE school_id IS NULL
              AND LOWER(name) IN ('camisa basica', 'camisillas', 'bicicleteros', 'top', 'medias')
            """
        )
    )
    deprecated = [row[0] for row in result.fetchall()]
    assert deprecated == [], f"Deprecated global names still present: {deprecated}"


# ============================================================================
# SECTION 3 — Delantal Comfama (sintoma reportado)
# ============================================================================

DELANTAL_COMFAMA_FUCSIA_ID = "a270367f-9465-4123-91fe-56f27c6d5b06"
DELANTAL_COMFAMA_MORADO_ID = "11111111-2222-3333-4444-555555555555"
DELANTAL_COMFAMA_AMARILLO_ID = "28ed07bd-35e0-468d-ad43-d9762a3d8394"
DELANTAL_COMFAMA_AZUL_ID = "bc2b8af2-38f7-4a66-a2dc-c917851e1485"
DELANTAL_COMFAMA_GENERICO_ID = "93858642-5bd5-4222-8aed-1b89af976aa1"


@pytest.mark.parametrize(
    "color, gt_id",
    [
        ("fucsia", DELANTAL_COMFAMA_FUCSIA_ID),
        ("morado", DELANTAL_COMFAMA_MORADO_ID),
        ("amarillo", DELANTAL_COMFAMA_AMARILLO_ID),
        ("azul", DELANTAL_COMFAMA_AZUL_ID),
    ],
)
async def test_delantal_comfama_color_has_five_products(
    color, gt_id, migration_applied, catalog_session: AsyncSession
):
    """Each Delantal Comfama color must have exactly 5 active products (sizes 2,4,6,8,10)."""
    result = await catalog_session.execute(
        text(
            f"""
            SELECT COUNT(*) FROM products
            WHERE garment_type_id = '{gt_id}'::uuid AND is_active
            """
        )
    )
    count = result.scalar()
    assert count == 5, (
        f"Delantal Comfama {color}: expected 5 products, found {count}"
    )


async def test_delantal_comfama_generico_is_inactive(
    migration_applied, catalog_session: AsyncSession
):
    """The generic 'Delantal' for Comfama must be inactive after migration (moved to colors)."""
    result = await catalog_session.execute(
        text(
            f"""
            SELECT is_active FROM garment_types
            WHERE id = '{DELANTAL_COMFAMA_GENERICO_ID}'::uuid
            """
        )
    )
    is_active = result.scalar()
    assert is_active is False, "Delantal genérico Comfama should be inactive"


async def test_delantal_comfama_generico_has_no_products(
    migration_applied, catalog_session: AsyncSession
):
    """Generic Delantal Comfama must have 0 products after color migration."""
    result = await catalog_session.execute(
        text(
            f"""
            SELECT COUNT(*) FROM products
            WHERE garment_type_id = '{DELANTAL_COMFAMA_GENERICO_ID}'::uuid
            """
        )
    )
    assert result.scalar() == 0, "Delantal genérico Comfama should have no products"


# ============================================================================
# SECTION 4 — Globales huérfanos poblados (Bicicletero/Top/Boxer)
# ============================================================================


async def test_bicicletero_has_twelve_variants(
    migration_applied, catalog_session: AsyncSession
):
    """Bicicletero: 9 niña (3 tallas × 3 colores) + 3 dama (1 talla × 3 colores) = 12."""
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-BIC-%'")
    )
    assert result.scalar() == 12


async def test_top_deportivo_has_four_variants(
    migration_applied, catalog_session: AsyncSession
):
    """Top deportivo: 3 niña + 1 dama = 4 variants."""
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-TOP-%'")
    )
    assert result.scalar() == 4


async def test_boxer_has_six_variants(
    migration_applied, catalog_session: AsyncSession
):
    """Boxer: 6 unisex tallas 6-16."""
    result = await catalog_session.execute(
        text("SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-BOX-%'")
    )
    assert result.scalar() == 6


async def test_new_global_variants_all_have_inventory(
    migration_applied, catalog_session: AsyncSession
):
    """The 22 new variants (Bicicletero + Top + Boxer) all have inventory rows."""
    result = await catalog_session.execute(
        text(
            """
            SELECT COUNT(*) FROM products p
            LEFT JOIN inventory i ON i.product_id = p.id
            WHERE p.code ~ '^GLB-(BIC|TOP|BOX)-' AND i.id IS NULL
            """
        )
    )
    assert result.scalar() == 0, "Some new global variants are missing inventory rows"


# ============================================================================
# SECTION 5 — Slug fix
# ============================================================================


async def test_manuel_caycedo_slug_has_no_typo(
    migration_applied, catalog_session: AsyncSession
):
    """Manuel Caycedo school slug must have 'caycedo' (not the typo 'caicedo')."""
    result = await catalog_session.execute(
        text(
            """
            SELECT slug FROM schools
            WHERE name = 'Institución Educativa Manuel José Caycedo'
            """
        )
    )
    slug = result.scalar()
    assert slug == "institucion-educativa-manuel-jose-caycedo", (
        f"Expected slug ending in 'caycedo', got '{slug}'"
    )


async def test_no_known_slug_typos_in_active_schools(
    migration_applied, catalog_session: AsyncSession
):
    """No active school should have a known typo slug (confama, buen-comiezo, etc.)."""
    result = await catalog_session.execute(
        text(
            """
            SELECT name, slug FROM schools
            WHERE is_active
              AND slug IN (
                  'confama',
                  'buen-comiezo',
                  'institucion-educativa-hector-abad-gomes',
                  'institucion-educativa-manuel-jose-caicedo'
              )
            """
        )
    )
    typos = [(row[0], row[1]) for row in result.fetchall()]
    assert typos == [], f"Schools with typo slugs still active: {typos}"


# ============================================================================
# SECTION 6 — Data integrity
# ============================================================================


async def test_no_product_without_inventory(
    migration_applied, catalog_session: AsyncSession
):
    """Every product must have an inventory row (backfilled by migration)."""
    result = await catalog_session.execute(
        text(
            """
            SELECT COUNT(*) FROM products p
            LEFT JOIN inventory i ON i.product_id = p.id
            WHERE i.id IS NULL
            """
        )
    )
    assert result.scalar() == 0, "Found products without inventory rows"


async def test_fe_y_alegria_prd_0006_reassigned_to_sudadera(
    migration_applied, catalog_session: AsyncSession
):
    """PRD-0006 (name='Sudadera') was reassigned from gt 'Camisa' to gt 'Sudadera'."""
    result = await catalog_session.execute(
        text(
            """
            SELECT gt.name FROM products p
            JOIN garment_types gt ON gt.id = p.garment_type_id
            JOIN schools s ON s.id = p.school_id
            WHERE s.name = 'Jardin Infantil Fe y Alegria'
              AND p.code = 'PRD-0006'
            """
        )
    )
    gt_name = result.scalar()
    assert gt_name == "Sudadera", (
        f"PRD-0006 should be under 'Sudadera' gt, found: {gt_name}"
    )
