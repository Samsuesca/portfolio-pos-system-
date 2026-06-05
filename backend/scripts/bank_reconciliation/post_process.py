"""Post-procesamiento después del matching.

Reclasifica:
    - internal_transfer SIN par confirmado → transfer_external_via_nequi
      (porque es más probable que sea cliente/proveedor usando Nequi,
       no movimiento entre cuentas propias).
    - unknown SIN match contra balance_entries → needs_manual_review
      (flag explícito para que aparezca como pendiente de revisión humana).

Estos pasos NO tocan los matches confirmados, solo agregan claridad a lo no resuelto.
"""
from __future__ import annotations

from dataclasses import dataclass

from .storage import get_connection


@dataclass
class PostProcessStats:
    internal_no_pair: int = 0       # internal_transfer sin contraparte
    needs_review: int = 0           # unknown unmatched


def run(db_path: str | None = None) -> PostProcessStats:
    kwargs = {"db_path": db_path} if db_path else {}
    stats = PostProcessStats()

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # 1. internal_transfer sin par → transfer_external_via_nequi
        cur.execute(
            """
            UPDATE bank_transactions
            SET category = 'transfer_external_via_nequi'
            WHERE category = 'internal_transfer'
              AND match_status = 'unmatched'
            """
        )
        stats.internal_no_pair = cur.rowcount

        # 2. unknown unmatched → needs_manual_review
        cur.execute(
            """
            UPDATE bank_transactions
            SET category = 'needs_manual_review'
            WHERE category = 'unknown'
              AND match_status = 'unmatched'
            """
        )
        stats.needs_review = cur.rowcount

    return stats
