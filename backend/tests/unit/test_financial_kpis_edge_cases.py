"""Tests para los helpers numéricos del módulo Modelo Financiero.

Cubre los edge cases que producían valores centinela visibles al usuario
antes del fix (999, 43.971.599, $0 en breakeven, ROE 0%).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.services.accounting.financial_model._math import (
    EPSILON,
    days_elapsed_in_month,
    is_partial_month,
    safe_ratio,
)


class TestSafeRatio:
    def test_normal_division(self):
        assert safe_ratio(10, 2) == Decimal("5")

    def test_decimal_inputs(self):
        assert safe_ratio(Decimal("3"), Decimal("4")) == Decimal("0.75")

    def test_division_by_zero_returns_none(self):
        assert safe_ratio(100, 0) is None

    def test_division_by_zero_decimal_returns_none(self):
        assert safe_ratio(Decimal("100"), Decimal("0")) is None

    def test_division_by_near_zero_returns_none(self):
        # Cualquier valor por debajo de EPSILON debe tratarse como cero
        # para evitar ratios astronómicos (ej. revenue / Decimal("1") al
        # padding-with-1 producía 43.971.599).
        assert safe_ratio(100, EPSILON / 2) is None

    def test_negative_denominator_works_when_above_epsilon(self):
        # abs() del denominador para que un denominador negativo grande
        # no se confunda con cero.
        assert safe_ratio(10, -2) == Decimal("-5")

    def test_none_numerator_returns_default(self):
        assert safe_ratio(None, 5) is None

    def test_none_denominator_returns_default(self):
        assert safe_ratio(10, None) is None

    def test_custom_default(self):
        assert safe_ratio(1, 0, default=Decimal("0")) == Decimal("0")

    def test_chained_calculation_propagates_none(self):
        """Patrón usado para DSO = 365 / ar_turnover y DPO = 365 / ap_turnover."""
        ar_turnover = safe_ratio(0, 0)  # None
        dso = safe_ratio(Decimal("365"), ar_turnover)
        assert dso is None


class TestPartialMonth:
    def test_mid_month_is_partial(self):
        end = date(2026, 5, 4)
        today = date(2026, 5, 4)
        assert is_partial_month(end, today) is True

    def test_last_day_is_not_partial(self):
        end = date(2026, 5, 31)
        today = date(2026, 5, 31)
        assert is_partial_month(end, today) is False

    def test_different_month_is_not_partial(self):
        end = date(2026, 4, 30)
        today = date(2026, 5, 4)
        assert is_partial_month(end, today) is False

    def test_february_leap_year(self):
        end = date(2024, 2, 15)
        today = date(2024, 2, 15)
        assert is_partial_month(end, today) is True
        # 2024 es bisiesto: febrero tiene 29 días
        end = date(2024, 2, 29)
        today = date(2024, 2, 29)
        assert is_partial_month(end, today) is False


class TestDaysElapsed:
    def test_returns_tuple(self):
        elapsed, total = days_elapsed_in_month(date(2026, 5, 4))
        assert elapsed == 4
        assert total == 31

    def test_february_non_leap(self):
        elapsed, total = days_elapsed_in_month(date(2025, 2, 10))
        assert elapsed == 10
        assert total == 28


@pytest.mark.parametrize(
    "scenario,num,denom,expect_none",
    [
        # Patologías reportadas en QA 2026-05-04
        ("current_ratio sin pasivos", 12_000_000, 0, True),
        ("acid_test sin pasivos", 5_000_000, 0, True),
        ("ap_turnover sin AP", 50_000_000, 0, True),
        ("ap_turnover con AP=0.0001 (padding antes)", 50_000_000, Decimal("0.0000001"), True),
        ("debt_coverage sin deuda", 30_000_000, 0, True),
        ("roe sin equity", 10_000_000, 0, True),
        # Casos que SÍ deben calcular (no edge case)
        ("liquidez normal", 12_000_000, 8_000_000, False),
        ("ar_turnover positivo", 80_000_000, 7_000_000, False),
    ],
)
def test_kpi_edge_cases_consolidated(scenario, num, denom, expect_none):
    """Tabla consolidada de los KPI edge cases reportados en QA."""
    result = safe_ratio(num, denom)
    if expect_none:
        assert result is None, f"{scenario}: esperaba None, recibió {result}"
    else:
        assert result is not None, f"{scenario}: esperaba número, recibió None"
