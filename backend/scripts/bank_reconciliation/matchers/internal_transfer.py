"""Detecta pares de transferencias entre las cuentas propias conocidas.

Lógica:
    Para cada transacción NEGATIVA en cuenta A (salida), busca en cuenta B
    una transacción POSITIVA del MISMO monto absoluto y fecha ±N días.

    Si encuentra contraparte única → confirma como pareja interna.
    Si encuentra múltiples → reporta ambigüedad, NO marca (decide manual).
    Si no encuentra → queda como unmatched (será gap para revisar).

Solo procesa transacciones donde category = 'internal_transfer' (candidatos
marcados por categorizer). Esto evita falsos positivos por coincidencia de
monto en transacciones no relacionadas.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

from ..config import (
    INTERNAL_TRANSFER_AMOUNT_EXACT,
    INTERNAL_TRANSFER_DATE_TOLERANCE_DAYS,
    KNOWN_ACCOUNTS,
)
from ..storage import get_connection


def _now_iso() -> str:
    tz_colombia = timezone(timedelta(hours=-5))
    return datetime.now(tz_colombia).replace(microsecond=0).isoformat()


@dataclass
class MatchStats:
    candidates_examined: int = 0
    pairs_matched: int = 0
    ambiguous: int = 0
    unmatched: int = 0


def run(db_path: str | None = None) -> MatchStats:
    """Ejecuta el matching. Idempotente: limpia pairs previos y re-corre."""
    if len(KNOWN_ACCOUNTS) < 2:
        return MatchStats()

    kwargs = {"db_path": db_path} if db_path else {}
    stats = MatchStats()

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # Reset state previo (limpio para re-correr)
        cur.execute("DELETE FROM internal_transfer_pairs")
        cur.execute(
            """
            UPDATE bank_transactions
            SET match_status = 'unmatched'
            WHERE match_status = 'internal_pair'
            """
        )

        # Cada transacción internal_transfer (de cualquier signo) busca contraparte
        # del signo opuesto en la OTRA cuenta. La contraparte puede tener
        # category 'internal_transfer' (Nequi→BC, "Recarga desde Bancolombia") O
        # category 'unknown' (BC→Nequi, "Para [NOMBRE]" en Nequi que está censurado).
        # Para evitar doble-procesar el mismo par, iteramos solo desde un lado:
        # el lado que tiene categoría 'internal_transfer' (siempre uno la tiene,
        # porque empezamos desde ahí).
        seeds = cur.execute(
            """
            SELECT id, bank_account_code, transaction_date, raw_description, amount
            FROM bank_transactions
            WHERE category = 'internal_transfer'
              AND match_status = 'unmatched'
            ORDER BY transaction_date, id
            """
        ).fetchall()

        for seed in seeds:
            stats.candidates_examined += 1

            target_amount_abs = abs(seed["amount"])
            seed_sign = "+" if seed["amount"] > 0 else "-"
            opposite_filter = "< 0" if seed_sign == "+" else "> 0"

            placeholders = ",".join("?" * (len(KNOWN_ACCOUNTS) - 1))
            other_account_codes = [
                a.code for a in KNOWN_ACCOUNTS if a.code != seed["bank_account_code"]
            ]

            # Buscar contraparte: signo opuesto, mismo monto abs, fecha ±N días,
            # cuenta diferente, NO matched ya.
            candidates = cur.execute(
                f"""
                SELECT id, bank_account_code, transaction_date, amount, category
                FROM bank_transactions
                WHERE amount {opposite_filter}
                  AND ABS(JULIANDAY(transaction_date) - JULIANDAY(?))
                      <= ?
                  AND bank_account_code IN ({placeholders})
                  AND match_status = 'unmatched'
                  AND ABS(CAST(amount AS REAL)) = ?
                """,
                (seed["transaction_date"],
                 INTERNAL_TRANSFER_DATE_TOLERANCE_DAYS,
                 *other_account_codes,
                 float(target_amount_abs)),
            ).fetchall()

            if not candidates:
                stats.unmatched += 1
                continue
            if len(candidates) > 1:
                # Ambigüedad. Si exactamente uno es internal_transfer también,
                # preferir ese (alta confidence). Sino marcar ambiguo.
                int_only = [c for c in candidates if c["category"] == "internal_transfer"]
                if len(int_only) == 1:
                    counterpart = int_only[0]
                else:
                    stats.ambiguous += 1
                    continue
            else:
                counterpart = candidates[0]

            # Resolver out/in según signos
            if seed["amount"] < 0:
                txn_out, txn_in = seed, counterpart
            else:
                txn_out, txn_in = counterpart, seed

            date_gap = abs(
                (_isodate(txn_in["transaction_date"])
                 - _isodate(txn_out["transaction_date"])).days
            )

            cur.execute(
                """
                INSERT INTO internal_transfer_pairs
                    (txn_out_id, txn_in_id, matched_at, amount, date_gap_days)
                VALUES (?, ?, ?, ?, ?)
                """,
                (txn_out["id"], txn_in["id"], _now_iso(),
                 target_amount_abs, date_gap),
            )
            cur.executemany(
                "UPDATE bank_transactions SET match_status = 'internal_pair' WHERE id = ?",
                [(txn_out["id"],), (txn_in["id"],)],
            )
            stats.pairs_matched += 1

    return stats


def _isodate(s):
    from datetime import date
    return date.fromisoformat(s)
