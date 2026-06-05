"""Verifica que los errores 400/422 de Pydantic se devuelven en español.

Cumple regla CLAUDE.md global: "Mensajes de error al usuario SIEMPRE en
español". El handler de validation se extendió en main.py:286+ con un
diccionario de traducción de los `type` de Pydantic v2 a strings en español.

QA report 2026-05-04 P1-04 reportó "Field required", "Input should be a
valid integer", etc. exhibidos al usuario.
"""
from __future__ import annotations

import pytest

from app.main import _translate_pydantic_error


class TestTranslatePydanticError:
    def test_missing_field(self):
        err = {"type": "missing", "msg": "Field required", "loc": ["body", "name"]}
        assert _translate_pydantic_error(err) == "Campo requerido"

    def test_value_error(self):
        err = {"type": "value_error", "msg": "Value is invalid"}
        assert _translate_pydantic_error(err) == "Valor inválido"

    def test_int_parsing(self):
        err = {"type": "int_parsing", "msg": "Input should be a valid integer"}
        assert _translate_pydantic_error(err) == "Debe ser un número entero"

    def test_string_pattern_mismatch(self):
        err = {"type": "string_pattern_mismatch", "msg": "..."}
        assert _translate_pydantic_error(err) == "Formato inválido"

    def test_uuid_parsing(self):
        err = {"type": "uuid_parsing", "msg": "Invalid UUID"}
        assert _translate_pydantic_error(err) == "Identificador inválido"

    def test_greater_than_with_ctx(self):
        # Pydantic adjunta el límite en `ctx` para que se interpole
        err = {
            "type": "greater_than",
            "msg": "Input should be greater than 0",
            "ctx": {"gt": 0},
        }
        assert _translate_pydantic_error(err) == "Debe ser mayor que 0"

    def test_less_than_equal_with_ctx(self):
        err = {
            "type": "less_than_equal",
            "msg": "...",
            "ctx": {"le": 100},
        }
        assert _translate_pydantic_error(err) == "Debe ser menor o igual a 100"

    def test_unknown_type_falls_back_to_original(self):
        err = {"type": "some_future_type_we_dont_know", "msg": "Original message"}
        assert _translate_pydantic_error(err) == "Original message"

    def test_template_with_missing_ctx_returns_template(self):
        # Si el template tiene placeholder pero no hay ctx, devuelve la
        # template tal cual sin crashear.
        err = {"type": "greater_than", "msg": "..."}  # sin ctx
        result = _translate_pydantic_error(err)
        # No debería crashear; el resultado contiene "mayor"
        assert "mayor" in result.lower()


@pytest.mark.skip(reason="Requiere TestClient + app context. Verificación E2E manual cubierta abajo.")
class TestPydanticI18nE2E:
    """Reproducción manual con curl (verificada 2026-05-04):

    curl -X POST -H 'Authorization: Bearer ...' -H 'Content-Type: application/json' \\
        -d '{}' http://localhost:8001/api/v1/global/accounting/projections/run \\
        | jq '.detail[0].msg'
    Esperado: "Campo requerido" (antes era "Field required")
    """
    pass
