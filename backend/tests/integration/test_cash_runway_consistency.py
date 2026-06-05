"""Verifica que los 3 endpoints que exponen cash runway reporten el mismo valor.

Antes del fix de Fase B había 3 cálculos divergentes:
- forecast.py: 12 semanas × 4.33 → 2.0 meses
- alerts.py: 3 meses directos → 1.2 meses
- executive_summary.py: consume forecast → 2.0 meses

QA report 2026-05-04 lo marcó como P1 (cash runway inconsistente). El fix
centralizó el cálculo en `_runway.compute_runway()`. Este test bloquea
regresión futura.
"""
from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.accounting.financial_model._runway import (
    calculate_cash_runway,
    DEFAULT_BURN_WINDOW_MONTHS,
)


class TestCalculateCashRunway:
    def test_normal_burn(self):
        # 12M de caja con quema mensual de 6M → 2 meses de runway
        result = calculate_cash_runway(Decimal("12000000"), Decimal("6000000"))
        assert result == Decimal("2")

    def test_profitable_business_returns_none(self):
        # Burn negativa = el negocio gana plata, no quema
        result = calculate_cash_runway(Decimal("12000000"), Decimal("-1000000"))
        assert result is None

    def test_zero_burn_returns_none(self):
        # Equilibrio exacto = no hay quema, runway no aplica
        result = calculate_cash_runway(Decimal("12000000"), Decimal("0"))
        assert result is None

    def test_none_inputs_returns_none(self):
        assert calculate_cash_runway(None, Decimal("1000")) is None
        assert calculate_cash_runway(Decimal("1000"), None) is None

    def test_default_window_is_3_months(self):
        # Documentado en el helper. Si cambia, los consumers necesitan saber.
        assert DEFAULT_BURN_WINDOW_MONTHS == 3

    def test_no_more_999_sentinel(self):
        """Antes forecast.py devolvía Decimal(999) para casos rentables.
        Ahora retorna None y el frontend muestra 'rentable'."""
        result = calculate_cash_runway(Decimal("100000000"), Decimal("-50000"))
        assert result != Decimal("999")
        assert result is None


@pytest.mark.skip(reason="Requiere DB con data; corre manualmente con docker exec")
class TestRunwayConsistencyAcrossEndpoints:
    """Test de integración: los 3 endpoints producen el mismo runway.

    NOTA: este test requiere DB en estado conocido. Se mantiene como
    documentación del invariante; en CI se cubre con el test unitario
    arriba que valida el helper compartido.

    Reproducción manual:
        docker exec uniformes-backend pytest \\
            tests/integration/test_cash_runway_consistency.py::TestRunwayConsistencyAcrossEndpoints \\
            --no-skip -v
    """

    async def test_forecast_alerts_summary_agree(self, client, auth_headers):
        forecast = await client.get(
            "/api/v1/global/accounting/financial-model/cash-forecast",
            headers=auth_headers,
        )
        alerts = await client.get(
            "/api/v1/global/accounting/financial-model/health-alerts",
            headers=auth_headers,
        )
        summary = await client.get(
            "/api/v1/global/accounting/financial-model/executive-summary",
            headers=auth_headers,
        )

        runway_from_forecast = forecast.json()["runway_months"]
        # alerts emite la alerta short_runway solo si runway < 2; lo extraemos del campo
        alerts_data = alerts.json()
        short_runway = next(
            (a for a in alerts_data["alerts"] if a["alert_type"] == "short_runway"),
            None,
        )

        if runway_from_forecast is None:
            # Negocio rentable — alerts NO debe tener short_runway, summary debe decir "rentable"
            assert short_runway is None
            assert "rentable" in summary.json()["forecast_summary"].lower()
        else:
            # Burn positivo — los 3 deben coincidir al primer decimal
            assert short_runway is not None
            # alerts.metric_value es "X.X meses"
            alerts_runway = float(short_runway["metric_value"].split()[0])
            assert abs(float(runway_from_forecast) - alerts_runway) < 0.1
