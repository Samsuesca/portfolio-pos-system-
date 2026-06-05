"""Sync school logos from `documentos/Photos/Logos/` to `backend/uploads/school-logos/`.

Para cada colegio activo, lee `schools.logo_url` (formato `/uploads/school-logos/<uuid>.ext`)
y verifica que el archivo exista en disco. Si falta, intenta resolverlo desde
`documentos/Photos/Logos/` con un mapping por slug -> filename, y lo copia con
el UUID + extensión que la DB ya espera.

Idempotente: re-correrlo no rompe nada, solo copia archivos que faltan.

Uso (desde la raíz del repo):
    backend/venv/bin/python backend/scripts/sync_school_logos.py

Si agregás un colegio nuevo: poné el archivo en `documentos/Photos/Logos/`,
agregalo al `SLUG_TO_FILENAME` map abajo, asegurate que `schools.logo_url`
apunte a `/uploads/school-logos/<uuid>.<ext>` y corré el script.
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Ubicaciones físicas — paths absolutos desde la raíz del repo.
REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = REPO_ROOT / "documentos" / "Photos" / "Logos"
TARGET_DIR = REPO_ROOT / "backend" / "uploads" / "school-logos"

# Mapping slug -> filename en SOURCE_DIR. Los slugs que no aparezcan aquí se
# saltan silenciosamente (asumimos que ya tienen logo en disco o no lo necesitan).
SLUG_TO_FILENAME: dict[str, str] = {
    "buen-comienzo": "buencomienzo.jpeg",
    "institucion-educativa-felix-henao-botero": "felixheano.jpeg",
    "institucion-educativa-hector-abad-gomez": "hectorabad.jpeg",
    "institucion-educativa-juan-de-la-cruz-posada": "juandelacruz.jpeg",
    "institucion-educativa-manuel-jose-caycedo": "caycedo.png",
    "jardin-infantil-fe-y-alegria": "feyalegria.png",
    "jardin-gota-de-leche": "GOTLECHE.jpeg",
}

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db",
)


async def main() -> int:
    if not SOURCE_DIR.exists():
        print(f"[sync_school_logos] SOURCE_DIR no existe: {SOURCE_DIR}", file=sys.stderr)
        return 2

    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(
            text(
                "SELECT slug, id::text AS id, logo_url "
                "FROM schools WHERE is_active = true ORDER BY name"
            )
        )
        rows = list(result)
    await engine.dispose()

    copied: list[str] = []
    skipped_already: list[str] = []
    skipped_no_url: list[str] = []
    missing_source: list[str] = []
    no_mapping: list[str] = []

    for row in rows:
        slug: str = row.slug
        logo_url: str | None = row.logo_url
        if not logo_url:
            skipped_no_url.append(slug)
            continue

        # logo_url es '/uploads/school-logos/<uuid>.<ext>'. La parte final es el target.
        target_name = Path(logo_url).name
        target_path = TARGET_DIR / target_name

        if target_path.exists():
            skipped_already.append(slug)
            continue

        source_filename = SLUG_TO_FILENAME.get(slug)
        if not source_filename:
            no_mapping.append(slug)
            continue

        source_path = SOURCE_DIR / source_filename
        if not source_path.exists():
            missing_source.append(f"{slug} -> {source_filename}")
            continue

        shutil.copy2(source_path, target_path)
        copied.append(f"{slug} -> {target_name}")

    print(f"[sync_school_logos] copiados ({len(copied)}):")
    for c in copied:
        print(f"  + {c}")
    if skipped_already:
        print(f"[sync_school_logos] ya existían en destino ({len(skipped_already)}):")
        for s in skipped_already:
            print(f"  = {s}")
    if no_mapping:
        print(f"[sync_school_logos] sin mapping en SLUG_TO_FILENAME ({len(no_mapping)}):")
        for n in no_mapping:
            print(f"  ? {n}")
    if missing_source:
        print(f"[sync_school_logos] mapping definido pero source no existe ({len(missing_source)}):")
        for m in missing_source:
            print(f"  ! {m}")
    if skipped_no_url:
        print(f"[sync_school_logos] sin logo_url en DB ({len(skipped_no_url)}):")
        for s in skipped_no_url:
            print(f"  - {s}")

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
