"""Alinea los emails y nombres del equipo UCR con sus cuentas Google personales.

Necesario antes de activar Google Sign-In en producción: el auto-link de Google
matchea por email (lowercase), por lo cual cada cuenta de usuario debe tener su
Gmail real registrado y en minúsculas.

Idempotente — re-ejecutable sin efecto si ya está al valor objetivo.
Clave natural: `users.username`.
Salvaguardas:
  - Si el email objetivo colisiona con otro usuario distinto, aborta.
  - Si el username no existe, aborta (no crea cuentas nuevas).
  - Dry-run por defecto; requiere --commit para persistir.

Uso:
    cd backend
    venv/bin/python -m scripts.update_team_emails            # dry-run
    venv/bin/python -m scripts.update_team_emails --commit   # persiste

Para correrlo contra producción:
    DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:PORT/DB \\
        venv/bin/python -m scripts.update_team_emails --commit
"""
from __future__ import annotations

import argparse
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.user import User

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger("update_team_emails")


# username → cambios. email se guarda lowercase siempre. full_name opcional.
TEAM_EMAIL_UPDATES: dict[str, dict[str, str]] = {
    "samuel":    {"email": "suescapsam@gmail.com"},
    "chelorios": {"email": "chelorios74@gmail.com"},
    "felipe":    {"email": "felipesuescarios@gmail.com", "full_name": "Felipe Suesca"},
    "salome":    {"email": "salome@gmail.com"},
    "santimazo": {"email": "luissantiagog27@gmail.com"},
}


async def _validate_and_apply(db: AsyncSession) -> int:
    """Aplica updates con validación de colisión por email."""
    changed = 0
    for username, target in TEAM_EMAIL_UPDATES.items():
        new_email = target["email"].lower()
        new_full_name = target.get("full_name")

        user = (
            await db.execute(select(User).where(User.username == username))
        ).scalar_one_or_none()
        if user is None:
            raise RuntimeError(f"username '{username}' no existe — abortando")

        # Colisión: ¿hay otro usuario con este email?
        clash = (
            await db.execute(
                select(User).where(User.email == new_email, User.username != username)
            )
        ).scalar_one_or_none()
        if clash is not None:
            raise RuntimeError(
                f"email '{new_email}' ya lo usa '{clash.username}' — abortando"
            )

        email_changed = user.email != new_email
        name_changed = new_full_name is not None and user.full_name != new_full_name

        if not email_changed and not name_changed:
            logger.info("  = %s ya está al valor objetivo (skip)", username)
            continue

        before = (user.email, user.full_name)
        user.email = new_email
        if new_full_name is not None:
            user.full_name = new_full_name
        logger.info(
            "  ~ %s: %s → (%r, %r)",
            username, before, user.email, user.full_name,
        )
        changed += 1

    return changed


async def main(commit: bool) -> None:
    mode = "COMMIT (persiste)" if commit else "DRY-RUN (rollback)"
    logger.info("=== update_team_emails — %s ===", mode)
    async with AsyncSessionLocal() as db:
        try:
            n = await _validate_and_apply(db)
        except RuntimeError as e:
            await db.rollback()
            logger.error("ABORT: %s", e)
            raise SystemExit(1) from None

        if commit:
            await db.commit()
            logger.info("=== OK — %d cuentas actualizadas ===", n)
        else:
            await db.rollback()
            logger.info(
                "=== DRY-RUN — %d cambios simulados (rollback). "
                "Re-ejecuta con --commit para aplicar. ===",
                n,
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--commit", action="store_true", help="Persiste cambios.")
    args = parser.parse_args()
    asyncio.run(main(commit=args.commit))
