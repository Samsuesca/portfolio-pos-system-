"""Categorización automática de transacciones bancarias por reglas en config.

NO decide owner_drawing vs expense — marca candidatos como
`owner_drawing_candidate` para review manual.

NO confirma `internal_transfer` — solo marca candidatos; el matcher
`matchers/internal_transfer.py` confirma con la contraparte.
"""
from __future__ import annotations

import unicodedata
from decimal import Decimal
from typing import NamedTuple

from .config import (
    CATEGORIZATION_RULES,
    CategoryRule,
    alteration_candidate_rules,
    supplier_rules,
)


class CategoryResult(NamedTuple):
    category: str
    rule_keywords: str | None    # qué keyword triggeró (debugging)


def _normalize(s: str) -> str:
    """Lowercase + remove accents, para matching robusto."""
    s = s.lower()
    return "".join(
        c for c in unicodedata.normalize("NFKD", s)
        if not unicodedata.combining(c)
    )


# Combinamos reglas dinámicas (proveedores, clientes recurrentes) + estáticas.
# Las dinámicas van PRIMERO (matching más específico que las genéricas).
def _all_rules() -> tuple[CategoryRule, ...]:
    return (
        supplier_rules()
        + alteration_candidate_rules()
        + CATEGORIZATION_RULES
    )


def categorize(raw_description: str, amount: Decimal) -> CategoryResult:
    """Aplica reglas en orden. Primera que matchea gana."""
    desc_norm = _normalize(raw_description)
    sign = "+" if amount > 0 else "-" if amount < 0 else "any"

    for rule in _all_rules():
        if rule.sign != "any" and rule.sign != sign:
            continue
        for kw in rule.keywords:
            if _normalize(kw) in desc_norm:
                return CategoryResult(rule.category, kw)
    return CategoryResult("unknown", None)


def normalize_description(raw_description: str) -> str:
    """Versión pública usada por loader para persistir."""
    return _normalize(raw_description)
