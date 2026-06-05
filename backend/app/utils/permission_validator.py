"""
Startup-time validator: codes referenciados en rutas existen en DB.

Detecta typos como `require_permission("acouting.view")` antes de que
deployen a produccion silenciando el endpoint con 403 a todos excepto
superusers.

Uso:
    # En main.py lifespan startup:
    errors = await validate_permission_registry(app, db)
    if errors and settings.ENVIRONMENT == "production":
        raise RuntimeError(...)
"""
from typing import Iterable

from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _extract_codes(dependency) -> set[str]:
    """Inspect un closure tagged por las factories de require_*."""
    codes: set[str] = set()
    if dependency is None:
        return codes
    code = getattr(dependency, "__permission_code__", None)
    if isinstance(code, str):
        codes.add(code)
    multi = getattr(dependency, "__permission_codes__", None)
    if isinstance(multi, tuple):
        codes.update(c for c in multi if isinstance(c, str))
    return codes


def _walk_dependants(dependant, visited: set[int]) -> Iterable[set[str]]:
    """Recursively walk FastAPI Dependant tree extrayendo codes."""
    if id(dependant) in visited:
        return
    visited.add(id(dependant))
    yield _extract_codes(dependant.call)
    for sub in dependant.dependencies:
        yield from _walk_dependants(sub, visited)


def collect_referenced_codes(app: FastAPI) -> set[str]:
    """Walk all routes y retorna codes referenciados via require_* factories."""
    codes: set[str] = set()
    visited: set[int] = set()
    for route in app.routes:
        dependant = getattr(route, "dependant", None)
        if dependant is None:
            continue
        for chunk in _walk_dependants(dependant, visited):
            codes.update(chunk)
    return codes


async def validate_permission_registry(app: FastAPI, db: AsyncSession) -> list[str]:
    """Valida que cada code referenciado por rutas exista en DB.

    Returns:
        Lista de mensajes de error. Vacia si todo OK.
    """
    from app.models.permission import Permission

    referenced = collect_referenced_codes(app)
    if not referenced:
        return []

    db_result = await db.execute(select(Permission.code))
    db_codes = {row[0] for row in db_result.all()}

    missing = sorted(referenced - db_codes)
    if missing:
        return [
            "Permission codes referenciados en rutas pero ausentes en DB "
            f"(posible typo o seed faltante): {missing}"
        ]
    return []
