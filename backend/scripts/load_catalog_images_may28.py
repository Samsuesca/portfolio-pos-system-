"""Carga imágenes del zip de catálogo (28-may-2026) a garment types con 0 imágenes.

Idempotente: solo inserta para garment types que actualmente NO tienen ninguna
imagen. Copia el archivo físico al directorio de uploads y crea el registro
GarmentTypeImage (la primera de la lista = is_primary).

El garment type se resuelve por (colegio, nombre) — NO por UUID hardcodeado —
para evitar errores de transcripción. Tanto nombres de prenda como archivos se
matchean por forma normalizada (uppercase + sin acentos/ñ + espacios colapsados),
tolerando diferencias de encoding/espaciado.

Uso (en el server, desde la raíz del repo):
    backend/venv/bin/python backend/scripts/load_catalog_images_may28.py /tmp/ucr_imgs
"""

from __future__ import annotations

import asyncio
import os
import shutil
import sys
import unicodedata
import uuid as uuid_lib
from datetime import datetime
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

UPLOADS_BASE = Path("/var/www/uniformes-system-v2/uploads")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db",
)

# Subcarpetas del zip
BC = "APARTADO BUEN COMIENZO"
COMFAMA = "APARTADO COMFAMA"
HBG = "APARTADO HECTOR ABAD GOMEZ"
JDLCP = "APARTADO JUAN DE LA CRUZ POSADA"
PINAL = "APARTADO PINAL"
GLOB = "APARTADO PRODUCTOS GLOBALES"
FHB = "FOTOS FHB (FELIX HENAO BOTERO)"

GLOBAL = "__GLOBAL__"  # marcador para garment types globales (school_id IS NULL)

# Garment types donde queremos REEMPLAZAR la galería completa (borrar las
# imágenes existentes y cargar exactamente las del zip). Útil para prendas
# multi-vista donde la imagen vieja era una sola y queremos el set completo.
REPLACE_KEYS: set[tuple[str, str]] = {
    (GLOBAL, "Jean"),
    (GLOBAL, "Tennis Nike blanco"),
    (GLOBAL, "Tennis Nike negro"),
}

# (school_slug | GLOBAL, nombre_prenda) -> lista ordenada de (subcarpeta, filename).
# La primera = primary. Solo matches de ALTA confianza.
MAPPING: dict[tuple[str, str], list[tuple[str, str]]] = {
    # --- Juan de la Cruz Posada (prioridad explícita) ---
    ("institucion-educativa-juan-de-la-cruz-posada", "Camiseta Diario"): [(JDLCP, "CAMISETA DIARIO JUAN DE LA CRUZ POSADA.png")],
    ("institucion-educativa-juan-de-la-cruz-posada", "Camiseta"): [(JDLCP, "CAMISETA DIARIO JUAN DE LA CRUZ POSADA.png")],
    ("institucion-educativa-juan-de-la-cruz-posada", "Camisa fisica"): [(JDLCP, "CAMISETA ED.FISICA JUAN DE LA CRUZ POSADA.png")],
    ("institucion-educativa-juan-de-la-cruz-posada", "Chompa"): [(JDLCP, "CHOMPA JUAN DE LA CRUZ POSADA.png")],
    ("institucion-educativa-juan-de-la-cruz-posada", "Sudadera"): [(JDLCP, "SUDADERA JUAN DE LA CRUZ POSADA.png")],
    # --- Felix Henao Botero ---
    ("institucion-educativa-felix-henao-botero", "Camiseta fisica"): [(FHB, "CAMISETA DE ED.FISICA.png")],
    ("institucion-educativa-felix-henao-botero", "Chompa"): [(FHB, "CHOMPA FHB.png")],
    ("institucion-educativa-felix-henao-botero", "Sudadera"): [(FHB, "SUDADERA FHB.png")],
    # --- Héctor Abad Gómez ---
    ("institucion-educativa-hector-abad-gomez", "Chompa"): [(HBG, "CHOMPA HBG (HECTOR ABAD GOMEZ).png")],
    ("institucion-educativa-hector-abad-gomez", "Sudadera"): [(HBG, "SUDADERA HBG (HECTOR ABAD GOMEZ).png")],
    # --- Buen Comienzo ---
    ("buen-comienzo", "Camiseta"): [(BC, "CAMISETA BASICA PIEL DE DURAZNO.png")],
    # --- Comfama (delantal morado, único faltante con match claro) ---
    ("comfama", "Delantal comfama morado"): [(COMFAMA, "DELANTAL MORADO COMFAMA.png")],
    # --- El Pinal (único tipo Moño) ---
    ("institucion-educativa-el-pinal", "Moño"): [(PINAL, "MOÑOS DE DIARIO PINAL.png")],
    # --- Globales ---
    (GLOBAL, "Blusa"): [(GLOB, "BLUSA JOMBER.png")],
    (GLOBAL, "Camiseta blanca piel de durazno"): [(GLOB, "CAMISETA BASICA PIEL DE DURAZNO.png")],
    (GLOBAL, "Camiseta blanca tipo esqueleto"): [(GLOB, "CAMISETA BASICA (TIPO ESQUELETO).png")],
    (GLOBAL, "Top deportivo"): [
        (GLOB, "TOP DE NIÑA (PARTE DE ADELANTE).png"),
        (GLOB, "TOP DE NIÑA (PARTE DE ATRAS).png"),
    ],
    (GLOBAL, "Correa"): [
        (GLOB, "CORREA-RIATA 1 DE 3.png"),
        (GLOB, "CORREA-RIATA 2 DE 3.png"),
        (GLOB, "CORREA-RIATA 3 DE 3.png"),
    ],
    (GLOBAL, "Bicicletero"): [
        (GLOB, "BICICLETERO NIÑA NEGRO.png"),
        (GLOB, "BICICLETERO NIÑA AZUL OSCURO.png"),
        (GLOB, "BICICLETERO NIÑA BLANCO.png"),
    ],
    (GLOBAL, "Zapatos goma"): [
        (GLOB, "ZAPATOS DE GOMA PARA JOMBER 1 DE 3.png"),
        (GLOB, "ZAPATOS DE GOMA PARA JOMBER 2 DE 3.png"),
        (GLOB, "ZAPATOS DE GOMA PARA JOMBER 3 DE 3.png.jpeg"),
    ],
    # Tipo "Medias Natalia" creado por el owner para la línea Natalia (4 colores).
    (GLOBAL, "Medias Natalia"): [
        (GLOB, "MEDIAS NATALIA AZUL OSCURO.png"),
        (GLOB, "MEDIAS NATALIA BLANCA.png"),
        (GLOB, "MEDIAS NATALIA CAFES .png"),
        (GLOB, "MEDIAS NATALIA VERDE PINO.png"),
    ],
    # Reemplazo de fotos viejas/feas por las del zip (full cobertura).
    (GLOBAL, "Jean"): [(GLOB, "BLUE JEAN.png")],
    (GLOBAL, "Tennis Nike blanco"): [
        (GLOB, "ZAPATOS FOR ONE BLANCOS 1 DE 3.png"),
        (GLOB, "ZAPATOS FOR ONE BLANCOS 2 DE 3.png"),
        (GLOB, "ZAPATOS FOR ONE BLANCOS 3 DE 3.png"),
    ],
    (GLOBAL, "Tennis Nike negro"): [
        (GLOB, "ZAPATOS FOR ONE NEGROS 1 DE 3.png"),
        (GLOB, "ZAPATOS FOR ONE NEGROS 2 DE 3.png"),
        (GLOB, "ZAPATOS FOR ONE NEGROS 3 DE 3.png"),
    ],
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return " ".join(s.upper().split())


def gen_filename(ext: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"img_{ts}_{uuid_lib.uuid4().hex[:8]}{ext}"


async def resolve_gt(conn, school_key: str, gt_name: str):
    """Devuelve fila (id, school_id, name) del garment type, o None."""
    if school_key == GLOBAL:
        rows = (
            await conn.execute(
                text("SELECT id, school_id, name FROM garment_types WHERE school_id IS NULL AND is_active = true")
            )
        ).all()
    else:
        rows = (
            await conn.execute(
                text(
                    "SELECT gt.id, gt.school_id, gt.name FROM garment_types gt "
                    "JOIN schools s ON s.id = gt.school_id "
                    "WHERE s.slug = :slug AND gt.is_active = true"
                ),
                {"slug": school_key},
            )
        ).all()
    target = norm(gt_name)
    for r in rows:
        if norm(r.name) == target:
            return r
    return None


async def main() -> int:
    if len(sys.argv) < 2:
        print("Uso: load_catalog_images_may28.py <dir_extraido>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1])
    if not root.exists():
        print(f"No existe: {root}", file=sys.stderr)
        return 2

    index: dict[tuple[str, str], Path] = {}
    for p in root.rglob("*"):
        if p.is_file():
            index[(norm(p.parent.name), norm(p.name))] = p

    engine = create_async_engine(DATABASE_URL)
    created = 0
    skipped: list[str] = []
    missing_file: list[str] = []
    missing_gt: list[str] = []

    async with engine.begin() as conn:
        for (school_key, gt_name), files in MAPPING.items():
            gt = await resolve_gt(conn, school_key, gt_name)
            if gt is None:
                missing_gt.append(f"{school_key} / {gt_name}")
                continue

            if (school_key, gt_name) in REPLACE_KEYS:
                old = (
                    await conn.execute(
                        text("SELECT image_url FROM garment_type_images WHERE garment_type_id = :id"),
                        {"id": str(gt.id)},
                    )
                ).all()
                for row in old:
                    fpath = UPLOADS_BASE / row.image_url.lstrip("/").removeprefix("uploads/")
                    if fpath.exists():
                        try:
                            fpath.unlink()
                        except OSError:
                            pass
                await conn.execute(
                    text("DELETE FROM garment_type_images WHERE garment_type_id = :id"),
                    {"id": str(gt.id)},
                )
                print(f"  REPLACE [{school_key}] {gt.name}: borradas {len(old)} imagen(es) previas")
            else:
                existing = (
                    await conn.execute(
                        text("SELECT COUNT(*) FROM garment_type_images WHERE garment_type_id = :id"),
                        {"id": str(gt.id)},
                    )
                ).scalar()
                if existing and existing > 0:
                    skipped.append(f"{school_key} / {gt.name} (ya tiene {existing})")
                    continue

            school_id = gt.school_id
            if school_id is not None:
                target_dir = UPLOADS_BASE / "garment-types" / str(school_id) / str(gt.id)
                url_prefix = f"/uploads/garment-types/{school_id}/{gt.id}"
            else:
                target_dir = UPLOADS_BASE / "global-garment-types" / str(gt.id)
                url_prefix = f"/uploads/global-garment-types/{gt.id}"
            target_dir.mkdir(parents=True, exist_ok=True)

            order = 0
            for subfolder, fname in files:
                src = index.get((norm(subfolder), norm(fname)))
                if src is None:
                    missing_file.append(f"{subfolder}/{fname}")
                    continue
                ext = src.suffix.lower()
                out_name = gen_filename(ext)
                out_path = target_dir / out_name
                shutil.copyfile(src, out_path)
                os.chmod(out_path, 0o644)
                image_url = f"{url_prefix}/{out_name}"
                await conn.execute(
                    text(
                        "INSERT INTO garment_type_images "
                        "(id, garment_type_id, school_id, image_url, display_order, is_primary, created_at) "
                        "VALUES (:id, :gt, :sch, :url, :ord, :prim, now())"
                    ),
                    {
                        "id": str(uuid_lib.uuid4()),
                        "gt": str(gt.id),
                        "sch": str(school_id) if school_id else None,
                        "url": image_url,
                        "ord": order,
                        "prim": order == 0,
                    },
                )
                created += 1
                order += 1
            print(f"  OK  [{school_key}] {gt.name}: {order} imagen(es)")

    print("\n=== RESUMEN ===")
    print(f"Imágenes creadas: {created}")
    print(f"GT saltados (ya tenían imagen): {len(skipped)}")
    for s in skipped:
        print(f"   - {s}")
    if missing_file:
        print(f"Archivos NO encontrados en el zip: {len(missing_file)}")
        for f in missing_file:
            print(f"   - {f}")
    if missing_gt:
        print(f"GT NO encontrados en DB: {len(missing_gt)}")
        for g in missing_gt:
            print(f"   - {g}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
