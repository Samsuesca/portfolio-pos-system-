"""
Unit tests for the startup permission validator.

Verifica:
  1. collect_referenced_codes encuentra codes via __permission_code__ tag.
  2. collect_referenced_codes encuentra codes via __permission_codes__ tag.
  3. validate_permission_registry retorna [] cuando todo resuelve.
  4. validate_permission_registry retorna mensaje cuando hay codes faltantes.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import APIRouter, Depends, FastAPI

from app.utils.permission_validator import (
    collect_referenced_codes,
    validate_permission_registry,
)


def _factory_with_code(code: str):
    """Simula la factory require_permission tagging el closure."""
    async def _check(): ...
    _check.__permission_code__ = code  # type: ignore[attr-defined]
    return _check


def _factory_with_codes(*codes: str):
    async def _check(): ...
    _check.__permission_codes__ = tuple(codes)  # type: ignore[attr-defined]
    return _check


def _build_app_with_codes(*codes: str) -> FastAPI:
    app = FastAPI()
    router = APIRouter()
    for i, code in enumerate(codes):
        # Cada code en su propio endpoint con Depends(factory).
        async def endpoint(_=Depends(_factory_with_code(code))):
            return {"ok": True}
        router.add_api_route(f"/route_{i}", endpoint, methods=["GET"])
    app.include_router(router)
    return app


class TestCollectReferencedCodes:

    def test_finds_single_code_per_route(self):
        app = _build_app_with_codes("sales.view")
        codes = collect_referenced_codes(app)
        assert "sales.view" in codes

    def test_finds_codes_across_multiple_routes(self):
        app = _build_app_with_codes("sales.view", "orders.view", "inventory.adjust")
        codes = collect_referenced_codes(app)
        assert codes == {"sales.view", "orders.view", "inventory.adjust"}

    def test_finds_codes_via_permission_codes_tuple_tag(self):
        app = FastAPI()
        async def endpoint(_=Depends(_factory_with_codes("a.x", "b.y"))):
            return {"ok": True}
        app.add_api_route("/r", endpoint, methods=["GET"])
        codes = collect_referenced_codes(app)
        assert codes == {"a.x", "b.y"}

    def test_empty_when_no_tagged_dependencies(self):
        app = FastAPI()
        async def endpoint():
            return {"ok": True}
        app.add_api_route("/r", endpoint, methods=["GET"])
        codes = collect_referenced_codes(app)
        assert codes == set()


class TestValidatePermissionRegistry:

    @pytest.mark.asyncio
    async def test_returns_empty_when_all_codes_in_db(self):
        app = _build_app_with_codes("sales.view", "orders.view")
        db = AsyncMock()
        result_proxy = MagicMock()
        result_proxy.all = MagicMock(return_value=[("sales.view",), ("orders.view",)])
        db.execute = AsyncMock(return_value=result_proxy)

        errors = await validate_permission_registry(app, db)
        assert errors == []

    @pytest.mark.asyncio
    async def test_returns_error_when_code_missing_in_db(self):
        app = _build_app_with_codes("sales.view", "orders.typo")
        db = AsyncMock()
        result_proxy = MagicMock()
        # DB only contains sales.view, NOT orders.typo
        result_proxy.all = MagicMock(return_value=[("sales.view",)])
        db.execute = AsyncMock(return_value=result_proxy)

        errors = await validate_permission_registry(app, db)
        assert len(errors) == 1
        assert "orders.typo" in errors[0]

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_codes_referenced(self):
        app = FastAPI()
        async def endpoint():
            return {}
        app.add_api_route("/r", endpoint, methods=["GET"])
        db = AsyncMock()

        errors = await validate_permission_registry(app, db)
        assert errors == []
