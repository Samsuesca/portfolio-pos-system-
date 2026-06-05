"""
Helpers numéricos del módulo Modelo Financiero.

`safe_ratio` evita el patrón previo de devolver centinelas (`Decimal("999")`,
`Decimal("0")`) cuando el denominador es cero o casi-cero. En su lugar
devuelve `None`, que el frontend renderiza como `—` con tooltip explicativo.
"""
from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal

EPSILON = Decimal("0.000001")


def safe_ratio(
    numerator: Decimal | int | float | None,
    denominator: Decimal | int | float | None,
    *,
    default: Decimal | None = None,
) -> Decimal | None:
    """Cociente que devuelve `default` (None por defecto) si el denominador
    es None, cero, o tan cercano a cero que el resultado sería ruido."""
    if numerator is None or denominator is None:
        return default
    denom = Decimal(str(denominator))
    if abs(denom) < EPSILON:
        return default
    return Decimal(str(numerator)) / denom


def is_partial_month(end_date: date, today: date | None = None) -> bool:
    """True si `end_date` cae en el mes en curso y aún no ha terminado."""
    today = today or date.today()
    if end_date.year != today.year or end_date.month != today.month:
        return False
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.day < last_day


def days_elapsed_in_month(today: date | None = None) -> tuple[int, int]:
    """Devuelve (días transcurridos, días totales) del mes en curso."""
    today = today or date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    return today.day, last_day
