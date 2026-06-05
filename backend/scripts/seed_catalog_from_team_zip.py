"""Seed catalog images from team-provided ZIP into DB + filesystem.

Reads the team's "HERRAMIENTAS PARA ORGANIZAR LA PAGINA WEB" ZIP, matches image
filenames to garment_types in the database (post-v3_catalog_stab_001 migration),
copies images to /uploads/ and inserts rows into garment_type_images.

The matching is keyword-based and language-aware: filename → canonical gt name.
Run with --dry-run first to see the mapping. Then --apply to commit.

Usage:
    python -m backend.scripts.seed_catalog_from_team_zip --dry-run
    python -m backend.scripts.seed_catalog_from_team_zip --apply
    python -m backend.scripts.seed_catalog_from_team_zip --apply --zip /custom/path.zip

Assumes:
- Migration v3_catalog_stab_001 already applied (canonical naming)
- /uploads/garment-types/ writable by current process
- DB connection via DATABASE_URL env var (or default sqlalchemy config)
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import shutil
import sys
import unicodedata
import zipfile
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal


# ============================================================================
# CONFIG
# ============================================================================

DEFAULT_ZIP_PATH = Path(
    "documentos/Catalogo/HERRAMIENTAS PARA ORGANIZAR LA PAGINA WEB-20260524T061408Z-3-001.zip"
)
# In dev, FastAPI serves /uploads from backend/uploads/. In prod it's /var/www/.../uploads/.
# Default to backend/uploads (relative to repo root, matching main.py dev fallback).
UPLOADS_BASE = Path("backend/uploads")


# Mapping: keyword tokens in filename → (scope, canonical_gt_name)
# Scope is 'school:{slug}' for school-specific or 'global'.
# Keywords matched against normalized filename (lowercase, no accents/special chars).
KEYWORD_MAPPING: list[tuple[list[str], str, str]] = [
    # === GLOBALS (in PRODUCTOS GLOBALES folder OR by clear name) ===
    (["camiseta", "basica", "piel"], "global", "Camiseta blanca piel de durazno"),
    (["camiseta", "basica", "esqueleto"], "global", "Camiseta blanca tipo esqueleto"),
    (["blusa", "jomber"], "global", "Blusa"),
    (["blue", "jean"], "global", "Jean"),
    (["correa", "riata"], "global", "Correa"),
    (["medias", "canilleras"], "global", "Medias canilleras negro"),
    (["medias", "natalia"], "global", "Medias canilleras negro"),  # use closest existing gt
    (["bicicletero"], "global", "Bicicletero"),
    (["top", "nina"], "global", "Top deportivo"),
    (["zapatos", "for", "one", "blanco"], "global", "Tennis Nike blanco"),
    (["zapatos", "for", "one", "negro"], "global", "Tennis Nike negro"),
    (["zapatos", "goma"], "global", "Zapatos goma"),
    (["delantal", "cuadros"], "global", "Delantal para niña"),
    (["delantal", "buen", "comienzo"], "global", "Delantal para niña"),

    # === CARACAS ===
    (["caracas", "camiseta"], "school:institucion-educativa-caracas", "Camiseta"),
    (["caracas", "sudadera"], "school:institucion-educativa-caracas", "Sudadera"),
    (["caracas", "chompa", "diario"], "school:institucion-educativa-caracas", "Chompa azul"),
    (["caracas", "chompa", "fisica"], "school:institucion-educativa-caracas", "Chompa gris"),
    (["caracas", "jomber"], "school:institucion-educativa-caracas", "Jumper"),
    (["caracas", "mo", "diario"], "school:institucion-educativa-caracas", "Moño gala"),
    (["caracas", "mo", "fisica"], "school:institucion-educativa-caracas", "Moño gris"),

    # === PUMAREJO ===
    (["pumarejo", "camiseta", "diario"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Camiseta"),
    (["pumarejo", "camiseta", "fisica"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Camiseta de física"),
    (["pumarejo", "sudadera"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Sudadera"),
    (["pumarejo", "chompa"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Chompa"),
    (["pumarejo", "jomber"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Jumper"),
    (["pumarejo", "delantal"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Delantal"),
    (["pumarejo", "mo", "diario"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Moños"),
    (["pumarejo", "mo", "fisica"], "school:institucion-educativa-alfonso-lopez-pumarejo", "Moños"),

    # === PINAL ===
    (["pinal", "camiseta"], "school:institucion-educativa-el-pinal", "Camiseta"),
    (["pinal", "sudadera"], "school:institucion-educativa-el-pinal", "Sudadera"),
    (["pinal", "chompa"], "school:institucion-educativa-el-pinal", "Chompa"),
    (["pinal", "jomber"], "school:institucion-educativa-el-pinal", "Jumper"),
    (["pinal", "delantal", "nina"], "school:institucion-educativa-el-pinal", "Delantal de niña"),
    (["pinal", "delantal", "nino"], "school:institucion-educativa-el-pinal", "Delantal de niño"),
    (["pinal", "mo"], "school:institucion-educativa-el-pinal", "Moño"),

    # === COMFAMA — explicit color in filename ===
    (["comfama", "camiseta", "amarilla"], "school:comfama", "Camiseta amarillo"),
    (["comfama", "camiseta", "azul"], "school:comfama", "Camiseta azul"),
    (["comfama", "camiseta", "fucsia"], "school:comfama", "Camiseta fucsia"),
    (["comfama", "camiseta", "morada"], "school:comfama", "Camiseta morada"),
    (["comfama", "camiseta", "amarilla", "algod"], "school:comfama", "Camiseta de algodón amarillo"),
    (["comfama", "camiseta", "azul", "algod"], "school:comfama", "Camiseta de algodón azul"),
    (["comfama", "camiseta", "fucsia", "algod"], "school:comfama", "Camiseta de algodón fucsia"),
    (["comfama", "camiseta", "morada", "algod"], "school:comfama", "Camiseta de algodón morado"),
    (["comfama", "chompa", "amarilla"], "school:comfama", "Chompa amarillo"),
    (["comfama", "chompa", "azul"], "school:comfama", "Chompa azul"),
    (["comfama", "chompa", "fucsia"], "school:comfama", "Chompa fucsia"),
    (["comfama", "chompa", "morada"], "school:comfama", "Chompa morado"),
    (["comfama", "delantal", "amarillo"], "school:comfama", "Delantal comfama amarillo"),
    (["comfama", "delantal", "azul"], "school:comfama", "Delantal comfama azul"),
    (["comfama", "delantal", "fucsia"], "school:comfama", "Delantal comfama fucsia"),
    (["comfama", "delantal", "morado"], "school:comfama", "Delantal comfama morado"),
    (["comfama", "sudadera", "amarilla"], "school:comfama", "Sudadera amarillo"),
    (["comfama", "sudadera", "azul"], "school:comfama", "Sudadera azul"),
    (["comfama", "sudadera", "fucsia"], "school:comfama", "Sudadera fucsia"),
    (["comfama", "sudadera", "morada"], "school:comfama", "Sudadera morado"),
    (["comfama", "mo", "amarillo"], "school:comfama", "Moño amarillo"),
    (["comfama", "mo", "azul"], "school:comfama", "Moño azul"),
    (["comfama", "mo", "fucsia"], "school:comfama", "Moño fucsia"),
    (["comfama", "mo", "morado"], "school:comfama", "Moño morado"),
]


# ============================================================================
# DATA CLASSES
# ============================================================================

@dataclass
class ImageMatch:
    zip_path: str
    matched_keywords: list[str]
    scope: str  # 'global' or 'school:{slug}'
    gt_name: str
    gt_id: str | None = None
    school_id: str | None = None
    error: str | None = None


# ============================================================================
# HELPERS
# ============================================================================

def normalize(s: str) -> str:
    """Lowercase, strip accents, replace non-alphanumerics with spaces."""
    nfkd = unicodedata.normalize("NFKD", s)
    no_accents = "".join(c for c in nfkd if not unicodedata.combining(c))
    cleaned = "".join(c.lower() if c.isalnum() else " " for c in no_accents)
    return " ".join(cleaned.split())


def match_filename(filename: str) -> tuple[str, str, list[str]] | None:
    """Return (scope, gt_name, matched_keywords) for the longest keyword match.

    Returns None if no mapping matches.
    """
    normalized = normalize(filename)
    best_match = None
    best_score = 0

    for keywords, scope, gt_name in KEYWORD_MAPPING:
        if all(kw in normalized for kw in keywords):
            if len(keywords) > best_score:
                best_score = len(keywords)
                best_match = (scope, gt_name, keywords)

    return best_match


async def resolve_gt_id(session: AsyncSession, scope: str, gt_name: str) -> tuple[str | None, str | None]:
    """Resolve (gt_id, school_id) for a given scope and gt name. Returns (None, None) if not found."""
    if scope == "global":
        query = text(
            """
            SELECT id::text, NULL FROM garment_types
            WHERE school_id IS NULL AND name = :name
            LIMIT 1
            """
        )
        result = (await session.execute(query, {"name": gt_name})).fetchone()
    elif scope.startswith("school:"):
        slug = scope.split(":", 1)[1]
        query = text(
            """
            SELECT gt.id::text, gt.school_id::text
            FROM garment_types gt
            JOIN schools s ON s.id = gt.school_id
            WHERE s.slug = :slug AND gt.name = :name
            LIMIT 1
            """
        )
        result = (await session.execute(query, {"slug": slug, "name": gt_name})).fetchone()
    else:
        return None, None

    if result is None:
        return None, None
    return result[0], result[1]


async def has_existing_image(session: AsyncSession, gt_id: str, school_id: str | None) -> bool:
    """Check if gt already has at least one image registered."""
    gt_uuid = UUID(gt_id)
    if school_id is None:
        query = text(
            """
            SELECT EXISTS(
                SELECT 1 FROM garment_type_images
                WHERE garment_type_id = :gt_id AND school_id IS NULL
            )
            """
        )
        result = await session.execute(query, {"gt_id": gt_uuid})
        return bool(result.scalar())
    else:
        query = text(
            """
            SELECT EXISTS(
                SELECT 1 FROM garment_type_images
                WHERE garment_type_id = :gt_id AND school_id = :school_id
            )
            """
        )
        result = await session.execute(
            query, {"gt_id": gt_uuid, "school_id": UUID(school_id)}
        )
        return bool(result.scalar())


async def copy_image_and_register(
    session: AsyncSession,
    zip_file: zipfile.ZipFile,
    zip_path: str,
    gt_id: str,
    school_id: str | None,
    uploads_root: Path,
) -> str:
    """Extract image from ZIP, copy to uploads dir, register in DB. Returns image_url."""
    # Determine target dir + URL based on global vs school
    if school_id is None:
        target_dir = uploads_root / "garment-types" / "_global" / gt_id
        url_prefix = f"/uploads/garment-types/_global/{gt_id}"
    else:
        target_dir = uploads_root / "garment-types" / school_id / gt_id
        url_prefix = f"/uploads/garment-types/{school_id}/{gt_id}"

    target_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename with hash for uniqueness
    ext = Path(zip_path).suffix.lower() or ".png"
    hash_suffix = hashlib.md5(zip_path.encode()).hexdigest()[:8]
    filename = f"img_seed_{hash_suffix}{ext}"
    target_path = target_dir / filename

    # Extract from zip directly to target
    with zip_file.open(zip_path) as src, open(target_path, "wb") as dst:
        shutil.copyfileobj(src, dst)

    image_url = f"{url_prefix}/{filename}"

    # Register in DB (UUIDs as Python objects to avoid asyncpg :: cast parsing issue)
    gt_uuid = UUID(gt_id)
    if school_id is None:
        await session.execute(
            text(
                """
                INSERT INTO garment_type_images
                    (id, garment_type_id, school_id, image_url, display_order, is_primary, created_at)
                VALUES (gen_random_uuid(), :gt_id, NULL, :url, 0, true, NOW())
                """
            ),
            {"gt_id": gt_uuid, "url": image_url},
        )
    else:
        await session.execute(
            text(
                """
                INSERT INTO garment_type_images
                    (id, garment_type_id, school_id, image_url, display_order, is_primary, created_at)
                VALUES (gen_random_uuid(), :gt_id, :school_id, :url, 0, true, NOW())
                """
            ),
            {"gt_id": gt_uuid, "school_id": UUID(school_id), "url": image_url},
        )

    return image_url


# ============================================================================
# MAIN
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description="Seed catalog images from team ZIP")
    parser.add_argument("--zip", type=Path, default=DEFAULT_ZIP_PATH, help="Path to team ZIP")
    parser.add_argument("--uploads", type=Path, default=UPLOADS_BASE, help="Uploads root dir")
    parser.add_argument("--apply", action="store_true", help="Apply changes (default: dry-run)")
    parser.add_argument("--overwrite", action="store_true", help="Replace existing images")
    args = parser.parse_args()

    if not args.zip.exists():
        print(f"ERROR: ZIP not found: {args.zip}", file=sys.stderr)
        sys.exit(1)

    matches: list[ImageMatch] = []

    with zipfile.ZipFile(args.zip) as zf:
        image_files = [
            name for name in zf.namelist()
            if name.lower().endswith((".png", ".jpg", ".jpeg"))
        ]
        print(f"Found {len(image_files)} image files in ZIP")

        for fname in image_files:
            result = match_filename(fname)
            if result is None:
                matches.append(ImageMatch(
                    zip_path=fname, matched_keywords=[],
                    scope="?", gt_name="(no match)",
                    error="no keyword mapping matched"
                ))
                continue
            scope, gt_name, kws = result
            matches.append(ImageMatch(
                zip_path=fname, matched_keywords=kws,
                scope=scope, gt_name=gt_name
            ))

    # Resolve DB ids in session
    matched_ok = [m for m in matches if m.error is None]
    unmatched = [m for m in matches if m.error]

    async with AsyncSessionLocal() as session:
        for m in matched_ok:
            gt_id, school_id = await resolve_gt_id(session, m.scope, m.gt_name)
            if gt_id is None:
                m.error = f"gt not found: scope={m.scope} name={m.gt_name!r}"
            else:
                m.gt_id = gt_id
                m.school_id = school_id

        # Re-classify after resolution
        ready = [m for m in matched_ok if m.error is None and m.gt_id]
        failed_resolve = [m for m in matched_ok if m.error is not None]

        # Filter out ones that already have an image (unless --overwrite)
        if not args.overwrite:
            already_has = []
            actionable = []
            for m in ready:
                if await has_existing_image(session, m.gt_id, m.school_id):
                    already_has.append(m)
                else:
                    actionable.append(m)
            ready = actionable
        else:
            already_has = []

        # === REPORT ===
        print("\n" + "=" * 80)
        print(f"REPORT (mode: {'APPLY' if args.apply else 'DRY-RUN'})")
        print("=" * 80)
        print(f"\nMATCHED + READY TO UPLOAD ({len(ready)}):")
        for m in ready:
            print(f"  {m.zip_path}")
            print(f"     → {m.scope} / {m.gt_name} (gt_id={m.gt_id[:8]}...)")

        if already_has:
            print(f"\nMATCHED but already has image — skipped ({len(already_has)}):")
            for m in already_has:
                print(f"  {m.zip_path} → {m.gt_name}")

        if failed_resolve:
            print(f"\nMATCHED but gt not in DB ({len(failed_resolve)}):")
            for m in failed_resolve:
                print(f"  {m.zip_path}: {m.error}")

        if unmatched:
            print(f"\nUNMATCHED — no keyword mapping ({len(unmatched)}):")
            for m in unmatched:
                print(f"  {m.zip_path}")

        if not args.apply:
            print(f"\n(dry-run; pass --apply to commit {len(ready)} uploads)")
            return

        # === APPLY ===
        with zipfile.ZipFile(args.zip) as zf:
            uploads_root = args.uploads.resolve()
            uploaded = 0
            for m in ready:
                try:
                    url = await copy_image_and_register(
                        session, zf, m.zip_path, m.gt_id, m.school_id, uploads_root
                    )
                    print(f"  uploaded: {url}")
                    uploaded += 1
                except Exception as e:
                    print(f"  ERROR uploading {m.zip_path}: {e}", file=sys.stderr)

            await session.commit()
            print(f"\nApplied: {uploaded} uploads committed.")


if __name__ == "__main__":
    asyncio.run(main())
