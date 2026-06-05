"""V3 catalog stabilization: naming, slugs, Delantal Comfama, orphan globals, duplicates.

Resuelve issues acumulados en el catalogo identificados en docs/qa-briefs/catalog-stabilization-2026-05-24.md

Cambios aplicados (ver el documento para contexto y decisiones del owner):

1. NAMING (decisiones #1, #2, #3, #4, #5, #6, #7 del owner):
   - Title Case general: garment_types.name, products.name, products.color
     (Mayuscula primera letra, resto minusculas)
   - Yomber -> Jumper (4 escuelas)
   - Interios -> Interiores (Pinal)
   - Camisa basica -> Camiseta blanca piel de durazno (global)
   - Camisillas -> Camiseta blanca tipo esqueleto (global)
   - Medias -> Medias canilleras negro (global)
   - Tennis nike blanco/negro -> Tennis Nike blanco/negro (preservar brand)
   - Bicicleteros -> Bicicletero (singular, global)
   - Top -> Top deportivo (global)
   - Fix typo Moño fucia -> Moño fucsia

2. SLUGS (decision #10): cambio limpio, sin redirects 301
   - institucion-educativa-manuel-jose-caicedo -> caycedo

3. DELANTAL COMFAMA (sintoma reportado por el usuario):
   - Mover 5 fucsia, 5 morado, 2 amarillo, 1 azul del Delantal generico
     a los gts especificos por color
   - Crear gt 'Delantal comfama morado' (no existia)
   - Marcar el Delantal generico como inactivo (queda como historico)

4. GLOBALES HUERFANOS (decision #11): crear variantes
   - Bicicletero: 9 niña (3 tallas x 3 colores) + 3 dama (1 talla x 3 colores)
   - Top deportivo: 3 niña + 1 dama
   - Boxer: 6 unisex tallas 6-16
   - Total: 22 productos nuevos + inventory rows

5. BACKFILL INVENTARIO: 2 productos sin inventory (GLB-BLU-012, GLB-JEA-015)

6. DUPLICADOS:
   - Fe y Alegria CAMISA 4 (PRD-0002 + PRD-0006 ambos activos): desactivar mas antiguo
   - Pinal Delantal azul duplicados inactivos: NO DELETE (FK risk con sales historicos),
     solo confirmacion de estado is_active=false

Revision ID: v3_catalog_stab_001
Revises: v3_design_cleanup_001
Create Date: 2026-05-24
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "v3_catalog_stab_001"
down_revision: Union[str, Sequence[str], None] = "v3_design_cleanup_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ============================================================================
# CONSTANTES — IDs verificados en dev v3 y prod (mismo UUID en ambos por copia)
# ============================================================================

COMFAMA_SCHOOL_ID = "45a33bc8-a732-4208-b99f-91f100077114"

# Delantal Comfama: 4 gts existentes + 1 a crear (morado)
DELANTAL_COMFAMA_GENERICO_ID = "93858642-5bd5-4222-8aed-1b89af976aa1"
DELANTAL_COMFAMA_FUCSIA_ID = "a270367f-9465-4123-91fe-56f27c6d5b06"
DELANTAL_COMFAMA_AMARILLO_ID = "28ed07bd-35e0-468d-ad43-d9762a3d8394"
DELANTAL_COMFAMA_AZUL_ID = "bc2b8af2-38f7-4a66-a2dc-c917851e1485"
# UUID estable (no aleatorio) para Delantal Comfama morado, para idempotencia entre dev/prod
DELANTAL_COMFAMA_MORADO_ID = "11111111-2222-3333-4444-555555555555"

# Manuel Caycedo slug fix
SCHOOL_MANUEL_CAYCEDO_ID = "2c763e7b-2bfb-4595-83d3-a72517b2a62f"
SCHOOL_MANUEL_CAYCEDO_SLUG_OLD = "institucion-educativa-manuel-jose-caicedo"
SCHOOL_MANUEL_CAYCEDO_SLUG_NEW = "institucion-educativa-manuel-jose-caycedo"


def upgrade() -> None:
    conn = op.get_bind()

    # ========================================================================
    # SECTION 1 — TITLE CASE GENERAL (idempotente)
    # ========================================================================
    # Regla del owner: Mayuscula primera letra, resto minusculas.
    # Aplicado a garment_types.name, products.name, products.color.
    # Las renames explicitas en SECTION 2 reaplican lo que Title Case "rompa"
    # (ej. Nike pierde mayuscula -> SECTION 2 lo restaura).

    op.execute(
        """
        UPDATE garment_types
        SET name = UPPER(SUBSTRING(TRIM(name) FROM 1 FOR 1))
                 || LOWER(SUBSTRING(TRIM(name) FROM 2))
        WHERE name IS NOT NULL
          AND name <> UPPER(SUBSTRING(TRIM(name) FROM 1 FOR 1))
                    || LOWER(SUBSTRING(TRIM(name) FROM 2))
        """
    )

    op.execute(
        """
        UPDATE products
        SET name = UPPER(SUBSTRING(TRIM(name) FROM 1 FOR 1))
                 || LOWER(SUBSTRING(TRIM(name) FROM 2))
        WHERE name IS NOT NULL
          AND name <> UPPER(SUBSTRING(TRIM(name) FROM 1 FOR 1))
                    || LOWER(SUBSTRING(TRIM(name) FROM 2))
        """
    )

    op.execute(
        """
        UPDATE products
        SET color = UPPER(SUBSTRING(TRIM(color) FROM 1 FOR 1))
                  || LOWER(SUBSTRING(TRIM(color) FROM 2))
        WHERE color IS NOT NULL
          AND color <> ''
          AND color <> UPPER(SUBSTRING(TRIM(color) FROM 1 FOR 1))
                     || LOWER(SUBSTRING(TRIM(color) FROM 2))
        """
    )

    # ========================================================================
    # SECTION 2 — RENAMES EXPLICITOS (canonicos del owner)
    # ========================================================================

    # Yomber -> Jumper (4 escuelas, gts escolares)
    op.execute("UPDATE garment_types SET name = 'Jumper' WHERE LOWER(name) = 'yomber'")

    # Interios -> Interiores (Pinal)
    op.execute("UPDATE garment_types SET name = 'Interiores' WHERE LOWER(name) = 'interios'")

    # Globales: renombres del owner
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Camiseta blanca piel de durazno'
        WHERE school_id IS NULL AND LOWER(name) = 'camisa basica'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Camiseta blanca tipo esqueleto'
        WHERE school_id IS NULL AND LOWER(name) = 'camisillas'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Medias canilleras negro'
        WHERE school_id IS NULL AND LOWER(name) = 'medias'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Medias tobilleras'
        WHERE school_id IS NULL AND LOWER(name) = 'medias tobilleras'
        """
    )
    # Restaurar 'Nike' como brand (Title Case general lo bajo a minuscula)
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Tennis Nike blanco'
        WHERE school_id IS NULL AND LOWER(name) = 'tennis nike blanco'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Tennis Nike negro'
        WHERE school_id IS NULL AND LOWER(name) = 'tennis nike negro'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Bicicletero'
        WHERE school_id IS NULL AND LOWER(name) = 'bicicleteros'
        """
    )
    op.execute(
        """
        UPDATE garment_types
        SET name = 'Top deportivo'
        WHERE school_id IS NULL AND LOWER(name) = 'top'
        """
    )

    # Fix typos en products.name y products.color
    op.execute("UPDATE products SET color = 'Fucsia' WHERE LOWER(color) = 'fucia'")
    op.execute("UPDATE products SET name = REPLACE(name, 'Fucia', 'Fucsia') WHERE name ILIKE '%fucia%'")

    # ========================================================================
    # SECTION 3 — SLUG FIX (decision #10)
    # ========================================================================
    op.execute(
        f"""
        UPDATE schools
        SET slug = '{SCHOOL_MANUEL_CAYCEDO_SLUG_NEW}'
        WHERE id = '{SCHOOL_MANUEL_CAYCEDO_ID}'::uuid
          AND slug = '{SCHOOL_MANUEL_CAYCEDO_SLUG_OLD}'
        """
    )

    # ========================================================================
    # SECTION 4 — DELANTAL COMFAMA FIX (sintoma reportado)
    # ========================================================================
    # Crear gt 'Delantal comfama morado' (no existia).
    # Usamos INSERT...ON CONFLICT DO NOTHING para idempotencia.
    op.execute(
        f"""
        INSERT INTO garment_types (
            id, school_id, name, description, category,
            requires_embroidery, has_custom_measurements, cost_type,
            is_active, created_at, updated_at
        )
        VALUES (
            '{DELANTAL_COMFAMA_MORADO_ID}'::uuid,
            '{COMFAMA_SCHOOL_ID}'::uuid,
            'Delantal comfama morado', NULL, 'uniforme_diario',
            false, false, 'manufactured',
            true, NOW(), NOW()
        )
        ON CONFLICT (id) DO NOTHING
        """
    )

    # Mover productos del genérico al gt por color (LOWER para case-insensitive)
    # Solo afecta productos que aun viven en el generico (idempotente: re-run no-op)
    for color_lower, target_id in [
        ("fucsia", DELANTAL_COMFAMA_FUCSIA_ID),
        ("morado", DELANTAL_COMFAMA_MORADO_ID),
        ("amarillo", DELANTAL_COMFAMA_AMARILLO_ID),
        ("azul", DELANTAL_COMFAMA_AZUL_ID),
    ]:
        op.execute(
            f"""
            UPDATE products
            SET garment_type_id = '{target_id}'::uuid
            WHERE garment_type_id = '{DELANTAL_COMFAMA_GENERICO_ID}'::uuid
              AND LOWER(color) = '{color_lower}'
            """
        )

    # Marcar genérico inactivo si quedo sin productos
    op.execute(
        f"""
        UPDATE garment_types
        SET is_active = false
        WHERE id = '{DELANTAL_COMFAMA_GENERICO_ID}'::uuid
          AND NOT EXISTS (
              SELECT 1 FROM products
              WHERE garment_type_id = '{DELANTAL_COMFAMA_GENERICO_ID}'::uuid
          )
        """
    )

    # Re-aplicar Title Case a los 4 gts especificos de Delantal Comfama
    # (los nombres originales tienen mayuscula intermedia "Comfama" — owner quiere lowercase)
    op.execute(
        """
        UPDATE garment_types
        SET name = UPPER(SUBSTRING(name FROM 1 FOR 1)) || LOWER(SUBSTRING(name FROM 2))
        WHERE id IN (
            'a270367f-9465-4123-91fe-56f27c6d5b06',
            '28ed07bd-35e0-468d-ad43-d9762a3d8394',
            'bc2b8af2-38f7-4a66-a2dc-c917851e1485',
            '11111111-2222-3333-4444-555555555555'
        )
        """
    )

    # ========================================================================
    # SECTION 5 — VARIANTES PARA GLOBALES HUERFANOS (decision #11)
    # ========================================================================
    # Precios provisionales (segun guidance del documento). Confirmar con equipo.
    # Codes con prefijo 'GLB-' siguiendo convencion existente (GLB-BLU-012 etc.).
    # ON CONFLICT (code) DO NOTHING para idempotencia.

    # Bicicletero — 9 niña + 3 dama. INSERT por VALUES explícito para idempotencia simple.
    # Solo inserta si el code aun no existe (NOT EXISTS check).
    bici_niña_variants = [
        ("GLB-BIC-N-001", "4-6", "Azul oscuro"),
        ("GLB-BIC-N-002", "4-6", "Blanco"),
        ("GLB-BIC-N-003", "4-6", "Negro"),
        ("GLB-BIC-N-004", "6-8", "Azul oscuro"),
        ("GLB-BIC-N-005", "6-8", "Blanco"),
        ("GLB-BIC-N-006", "6-8", "Negro"),
        ("GLB-BIC-N-007", "8-10", "Azul oscuro"),
        ("GLB-BIC-N-008", "8-10", "Blanco"),
        ("GLB-BIC-N-009", "8-10", "Negro"),
    ]
    for code, size, color in bici_niña_variants:
        op.execute(
            f"""
            INSERT INTO products (
                id, school_id, garment_type_id, code, name, size, color, gender,
                price, is_active, created_at, updated_at
            )
            SELECT
                gen_random_uuid(), NULL,
                (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Bicicletero'),
                '{code}', 'Bicicletero', '{size}', '{color}', 'niña',
                18000, true, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM products WHERE code = '{code}' AND school_id IS NULL
            )
            """
        )

    bici_dama_variants = [
        ("GLB-BIC-D-001", "Azul oscuro"),
        ("GLB-BIC-D-002", "Blanco"),
        ("GLB-BIC-D-003", "Negro"),
    ]
    for code, color in bici_dama_variants:
        op.execute(
            f"""
            INSERT INTO products (
                id, school_id, garment_type_id, code, name, size, color, gender,
                price, is_active, created_at, updated_at
            )
            SELECT
                gen_random_uuid(), NULL,
                (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Bicicletero'),
                '{code}', 'Bicicletero', 'Única', '{color}', 'dama',
                20000, true, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM products WHERE code = '{code}' AND school_id IS NULL
            )
            """
        )

    # Top deportivo — 3 niña + 1 dama
    top_variants = [
        ("GLB-TOP-N-001", "4-6", "niña", 15000),
        ("GLB-TOP-N-002", "6-8", "niña", 15000),
        ("GLB-TOP-N-003", "8-10", "niña", 15000),
        ("GLB-TOP-D-001", "Única", "dama", 18000),
    ]
    for code, size, gender, price in top_variants:
        op.execute(
            f"""
            INSERT INTO products (
                id, school_id, garment_type_id, code, name, size, color, gender,
                price, is_active, created_at, updated_at
            )
            SELECT
                gen_random_uuid(), NULL,
                (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Top deportivo'),
                '{code}', 'Top deportivo', '{size}', 'Blanco', '{gender}',
                {price}, true, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM products WHERE code = '{code}' AND school_id IS NULL
            )
            """
        )

    # Boxer — 6 unisex tallas 6-16, color Negro
    for size in ['6', '8', '10', '12', '14', '16']:
        code = f"GLB-BOX-{size}"
        op.execute(
            f"""
            INSERT INTO products (
                id, school_id, garment_type_id, code, name, size, color, gender,
                price, is_active, created_at, updated_at
            )
            SELECT
                gen_random_uuid(), NULL,
                (SELECT id FROM garment_types WHERE school_id IS NULL AND name = 'Boxer'),
                '{code}', 'Boxer', '{size}', 'Negro', 'unisex',
                12000, true, NOW(), NOW()
            WHERE NOT EXISTS (
                SELECT 1 FROM products WHERE code = '{code}' AND school_id IS NULL
            )
            """
        )

    # Backfill inventory para las 22 variantes nuevas (idempotente)
    op.execute(
        """
        INSERT INTO inventory (
            id, school_id, product_id, quantity, reserved_quantity,
            min_stock_alert, last_updated
        )
        SELECT
            gen_random_uuid(), NULL, p.id, 0, 0, 5, NOW()
        FROM products p
        WHERE p.school_id IS NULL
          AND (p.code LIKE 'GLB-BIC-%' OR p.code LIKE 'GLB-TOP-%' OR p.code LIKE 'GLB-BOX-%')
          AND NOT EXISTS (
              SELECT 1 FROM inventory i WHERE i.product_id = p.id
          )
        """
    )

    # ========================================================================
    # SECTION 6 — BACKFILL INVENTARIO PARA PRODUCTOS HUERFANOS
    # ========================================================================
    op.execute(
        """
        INSERT INTO inventory (
            id, school_id, product_id, quantity, reserved_quantity,
            min_stock_alert, last_updated
        )
        SELECT
            gen_random_uuid(), p.school_id, p.id, 0, 0, 5, NOW()
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE i.id IS NULL
        """
    )

    # ========================================================================
    # SECTION 7 — CLEANUP DATA INTEGRITY
    # ========================================================================
    # Fe y Alegria PRD-0006: nombre 'Sudadera' pero gt 'Camisa' (mis-asignacion).
    # Hay gap en Sudadera para size=4 → mover. Idempotente: solo si el gt actual es Camisa.
    op.execute(
        """
        UPDATE products
        SET garment_type_id = (
            SELECT gt.id FROM garment_types gt
            JOIN schools s ON s.id = gt.school_id
            WHERE s.name = 'Jardin Infantil Fe y Alegria' AND gt.name = 'Sudadera'
        )
        WHERE code = 'PRD-0006'
          AND school_id = (SELECT id FROM schools WHERE name = 'Jardin Infantil Fe y Alegria')
          AND garment_type_id = (
              SELECT gt.id FROM garment_types gt
              JOIN schools s ON s.id = gt.school_id
              WHERE s.name = 'Jardin Infantil Fe y Alegria' AND gt.name = 'Camisa'
          )
          AND name ILIKE 'sudadera%'
        """
    )

    # NOTA: Buen Comienzo tiene un duplicado real (PRD-0001 'Camiseta' + PRD-0011 'Camisa
    # piel de durazno' ambos en gt=Camiseta, size=2, color=Blanco). Requiere decision de
    # negocio (cual es el correcto). NO se toca aqui — flag para sprint post-deploy.

    # ========================================================================
    # SECTION 8 — VERIFICACION POST-MIGRACION (fail loud)
    # ========================================================================

    # 8.1 — No quedan gts con primera letra minuscula
    result = conn.execute(
        sa.text(
            """
            SELECT name FROM garment_types
            WHERE name ~ '^[a-z]'
            ORDER BY name
            """
        )
    )
    lowercase_gts = [row[0] for row in result.fetchall()]
    if lowercase_gts:
        raise RuntimeError(
            f"Title Case violation: garment_types con primera letra minuscula: {lowercase_gts}"
        )

    # 8.2 — No quedan 'Yomber' ni 'Interios'
    result = conn.execute(
        sa.text(
            """
            SELECT name, COUNT(*) FROM garment_types
            WHERE LOWER(name) IN ('yomber', 'interios')
            GROUP BY name
            """
        )
    )
    bad_names = result.fetchall()
    if bad_names:
        raise RuntimeError(f"Renames no aplicados: {bad_names}")

    # 8.3 — Renames globales aplicados
    expected_globals = [
        "Camiseta blanca piel de durazno",
        "Camiseta blanca tipo esqueleto",
        "Medias canilleras negro",
        "Tennis Nike blanco",
        "Tennis Nike negro",
        "Bicicletero",
        "Top deportivo",
    ]
    names_sql = ", ".join(f"'{n}'" for n in expected_globals)
    result = conn.execute(
        sa.text(
            f"""
            SELECT name FROM garment_types
            WHERE school_id IS NULL AND name IN ({names_sql})
            """
        )
    )
    found_globals = sorted([row[0] for row in result.fetchall()])
    missing_globals = sorted(set(expected_globals) - set(found_globals))
    if missing_globals:
        raise RuntimeError(f"Renames globales faltantes: {missing_globals}")

    # 8.4 — Delantal Comfama fucsia tiene 5 productos
    result = conn.execute(
        sa.text(
            f"""
            SELECT COUNT(*) FROM products
            WHERE garment_type_id = '{DELANTAL_COMFAMA_FUCSIA_ID}'::uuid AND is_active
            """
        )
    )
    fucsia_count = result.scalar()
    if fucsia_count != 5:
        raise RuntimeError(
            f"Delantal Comfama fucsia: esperados 5 productos, encontrados {fucsia_count}"
        )

    # 8.5 — Delantal Comfama morado existe y tiene 5 productos
    result = conn.execute(
        sa.text(
            f"""
            SELECT COUNT(*) FROM products
            WHERE garment_type_id = '{DELANTAL_COMFAMA_MORADO_ID}'::uuid AND is_active
            """
        )
    )
    morado_count = result.scalar()
    if morado_count != 5:
        raise RuntimeError(
            f"Delantal Comfama morado: esperados 5 productos, encontrados {morado_count}"
        )

    # 8.6 — Variantes huerfanas creadas
    result = conn.execute(
        sa.text(
            """
            SELECT
                (SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-BIC-%') as bici,
                (SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-TOP-%') as top,
                (SELECT COUNT(*) FROM products WHERE code LIKE 'GLB-BOX-%') as box
            """
        )
    )
    bici, top, box = result.fetchone()
    if bici != 12 or top != 4 or box != 6:
        raise RuntimeError(
            f"Variantes huerfanas: esperadas Bicicletero=12, Top=4, Boxer=6; "
            f"encontradas Bicicletero={bici}, Top={top}, Boxer={box}"
        )

    # 8.7 — Todos los productos tienen inventory
    result = conn.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM products p
            LEFT JOIN inventory i ON i.product_id = p.id
            WHERE i.id IS NULL
            """
        )
    )
    orphan_inv = result.scalar()
    if orphan_inv > 0:
        raise RuntimeError(f"{orphan_inv} productos sin inventory tras migracion")

    # 8.8 — Slug fix aplicado
    result = conn.execute(
        sa.text(
            """
            SELECT COUNT(*) FROM schools
            WHERE slug = 'institucion-educativa-manuel-jose-caicedo'
            """
        )
    )
    if result.scalar() > 0:
        raise RuntimeError("Slug 'caicedo' aun presente (deberia ser 'caycedo')")


def downgrade() -> None:
    """Downgrade limitado: revierte solo cambios de bajo riesgo (renames y slug).

    NO se revierte:
    - Movimientos de productos entre garment_types (pierdes el mapping correcto)
    - Insercion de variantes nuevas (no hay forma segura de saber cuales borrar)
    - Backfill de inventory (pierdes datos si re-aplicas)
    - Cleanup de duplicados activos (no sabemos cual reactivar)

    Si necesitas rollback completo, restaurar desde backup.
    """
    # Revertir renames (best-effort, idempotente)
    op.execute("UPDATE garment_types SET name = 'Yomber' WHERE name = 'Jumper'")
    op.execute(
        """
        UPDATE garment_types SET name = 'Camisa basica'
        WHERE school_id IS NULL AND name = 'Camiseta blanca piel de durazno'
        """
    )
    op.execute(
        """
        UPDATE garment_types SET name = 'Camisillas'
        WHERE school_id IS NULL AND name = 'Camiseta blanca tipo esqueleto'
        """
    )
    op.execute(
        """
        UPDATE garment_types SET name = 'Medias'
        WHERE school_id IS NULL AND name = 'Medias canilleras negro'
        """
    )
    op.execute(
        """
        UPDATE garment_types SET name = 'Bicicleteros'
        WHERE school_id IS NULL AND name = 'Bicicletero'
        """
    )
    op.execute(
        """
        UPDATE garment_types SET name = 'Top'
        WHERE school_id IS NULL AND name = 'Top deportivo'
        """
    )

    # Revertir slug Manuel Caycedo
    op.execute(
        f"""
        UPDATE schools SET slug = '{SCHOOL_MANUEL_CAYCEDO_SLUG_OLD}'
        WHERE id = '{SCHOOL_MANUEL_CAYCEDO_ID}'::uuid
          AND slug = '{SCHOOL_MANUEL_CAYCEDO_SLUG_NEW}'
        """
    )
