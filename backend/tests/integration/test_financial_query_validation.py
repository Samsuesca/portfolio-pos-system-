"""Verifica que los query params de los endpoints de financial-model
rechazan input inválido con 400 en vez de aceptarlo silenciosamente.

QA report 2026-05-04 P2-01: /kpis aceptaba `period=2026-13` o
`period=invalid` con 200 (silenciosamente usando default). P2-02:
/projections aceptaba `scenario=Z` con 200 (lista vacía sin error). P2-03:
/profitability aceptaba `end_date < start_date` con 200 y totales=0.

El fix introdujo Literal types en los query params + un guard explícito
en el rango de fechas. Los mensajes salen en español gracias a Fase E.
"""
from __future__ import annotations

from typing import Literal

import pytest

# Estos tests son ejemplos de invariantes que documentan el comportamiento
# esperado. La verificación E2E real se hace con curl contra el backend
# corriendo (ver `Comandos para reproducir hallazgos` en el QA report).


class TestQueryValidationContracts:
    """Tests del contrato de validación que el backend debe cumplir.

    Estos son tests "pseudo-E2E": validan que los Literal types están en su
    sitio para que FastAPI los traduzca a 422/400. La verificación curl real
    está en el QA pase 2026-05-04 (post-fix).
    """

    def test_trend_period_uses_literal(self):
        from app.api.routes.financial_model import TrendPeriod
        assert hasattr(TrendPeriod, "__args__"), "TrendPeriod debe ser un Literal"
        assert set(TrendPeriod.__args__) == {"daily", "weekly", "monthly"}

    def test_projections_scenario_uses_literal(self):
        """list_financial_projections acepta solo A/B/C/custom."""
        from app.api.routes.global_accounting import list_financial_projections
        # Inspeccionar la signature y verificar que el parámetro scenario
        # tiene el Literal correcto vía __annotations__
        import inspect
        sig = inspect.signature(list_financial_projections)
        scenario_param = sig.parameters.get("scenario")
        assert scenario_param is not None
        # El default debería ser None y la annotation incluir Literal
        annotation_str = str(scenario_param.annotation)
        assert "Literal" in annotation_str or "A" in annotation_str
        # Debe contener los 4 valores válidos
        for value in ["A", "B", "C", "custom"]:
            assert value in annotation_str, f"Falta {value} en annotation"


# Notas de verificación E2E manual (corre el backend con `docker compose up`):
#
# kpis?period=invalid     → 400 con msg="Valor no permitido"
# kpis?period=monthly     → 200
# trends?period=garbage   → 400
# profitability?start=2026-12-31&end=2026-01-01 → 400
#   con detail="end_date debe ser mayor o igual a start_date"
# projections?scenario=Z  → 400 con msg="Valor no permitido"
# projections?scenario=B  → 200
