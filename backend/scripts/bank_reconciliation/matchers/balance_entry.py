"""Matcher entre bank_transactions y balance_entries del sistema.

Lee balance_entries de prod_snapshot vía docker exec (read-only).
Para cada bank_transaction NO matched-internal, intenta encontrar entry
contable correspondiente.

Scoring (rango 0-1):
    1.0 = mismo monto exacto + misma fecha + descripción mismo head token
    0.8 = mismo monto + fecha ±3 días
    0.5 = mismo monto + descripción contiene mismo token + fecha ±7 días

Solo persiste matches con score >= 0.5 (configurable).
"""
from __future__ import annotations

import csv
import io
import re
import subprocess
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal

from ..config import (
    BALANCE_ENTRY_AMOUNT_TOLERANCE,
    BALANCE_ENTRY_DATE_TOLERANCE_DAYS,
    KNOWN_ACCOUNTS,
    PG_CONTAINER,
    PG_DATABASE,
    PG_USER,
)
from ..storage import get_connection


def _now_iso() -> str:
    tz_colombia = timezone(timedelta(hours=-5))
    return datetime.now(tz_colombia).replace(microsecond=0).isoformat()


@dataclass
class SystemEntry:
    id: str
    entry_date: date
    amount: Decimal
    description: str
    reference: str | None


@dataclass
class MatchStats:
    candidates_examined: int = 0
    matched_high: int = 0    # score >= 0.8
    matched_low: int = 0     # 0.5 <= score < 0.8
    unmatched_gap: int = 0


# ---------------------------------------------------------------------------
# Lectura de prod_snapshot via docker exec psql
# ---------------------------------------------------------------------------

def _query_psql(sql: str) -> str:
    """Ejecuta psql y devuelve CSV crudo. Read-only."""
    result = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", PG_USER, "-d", PG_DATABASE,
         "-At", "-F", "|", "-c", sql],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"psql falló (exit {result.returncode}): {result.stderr[:500]}"
        )
    return result.stdout


def fetch_system_entries(
    balance_account_id: str,
    period_start: date,
    period_end: date,
) -> list[SystemEntry]:
    """Trae balance_entries de la cuenta para el rango (con margen ±N días)."""
    margin = BALANCE_ENTRY_DATE_TOLERANCE_DAYS
    start = (period_start - timedelta(days=margin)).isoformat()
    end = (period_end + timedelta(days=margin)).isoformat()

    sql = f"""
        SELECT id::text, entry_date::text, amount::text,
               COALESCE(description, ''), COALESCE(reference, '')
        FROM balance_entries
        WHERE account_id = '{balance_account_id}'
          AND entry_date BETWEEN '{start}' AND '{end}'
        ORDER BY entry_date, id;
    """
    raw = _query_psql(sql)

    entries: list[SystemEntry] = []
    for line in raw.splitlines():
        if not line:
            continue
        # Splitting by '|' assumes descriptions don't contain '|' — verificar
        parts = line.split("|")
        if len(parts) < 5:
            continue
        entries.append(SystemEntry(
            id=parts[0],
            entry_date=date.fromisoformat(parts[1]),
            amount=Decimal(parts[2]),
            description=parts[3],
            reference=parts[4] or None,
        ))
    return entries


# ---------------------------------------------------------------------------
# Matching scoring
# ---------------------------------------------------------------------------

def _normalize(s: str) -> str:
    s = s.lower()
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s)


def _shared_tokens(desc_a: str, desc_b: str) -> set[str]:
    """Tokens de >=3 chars que aparecen en ambas descripciones."""
    a = set(t for t in _normalize(desc_a).split() if len(t) >= 3)
    b = set(t for t in _normalize(desc_b).split() if len(t) >= 3)
    return a & b


def score_match(
    bank_txn_amount: Decimal,
    bank_txn_date: date,
    bank_txn_desc: str,
    sys_entry: SystemEntry,
) -> float:
    """Score entre 0 y 1. Mayor = mejor match."""
    # Monto debe coincidir (con tolerancia de centavos)
    amount_diff = abs(bank_txn_amount - sys_entry.amount)
    if amount_diff > BALANCE_ENTRY_AMOUNT_TOLERANCE:
        return 0.0

    # Fecha
    date_gap = abs((bank_txn_date - sys_entry.entry_date).days)
    if date_gap > BALANCE_ENTRY_DATE_TOLERANCE_DAYS:
        return 0.0

    # Score base por monto exacto + fecha cercana
    if date_gap == 0:
        base_score = 1.0
    elif date_gap == 1:
        base_score = 0.9
    elif date_gap <= 3:
        base_score = 0.8
    else:
        base_score = 0.6

    # Bonus por tokens compartidos en descripción
    shared = _shared_tokens(bank_txn_desc, sys_entry.description)
    if not shared and len(_normalize(sys_entry.description).split()) > 1:
        # Descripción del sistema tiene contenido y NO comparte tokens
        # → penalizar
        base_score -= 0.2

    return max(0.0, min(1.0, base_score))


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def run(*, db_path: str | None = None, min_score: float = 0.5) -> MatchStats:
    """Itera bank_transactions unmatched no-internal y trata de match."""
    kwargs = {"db_path": db_path} if db_path else {}
    stats = MatchStats()

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # Limpieza previa para re-correr idempotente
        cur.execute("DELETE FROM balance_entry_matches")
        cur.execute(
            """
            UPDATE bank_transactions
            SET match_status = 'unmatched'
            WHERE match_status = 'balance_entry'
            """
        )

        # Por cuenta, traer rango de fechas a procesar
        for account in KNOWN_ACCOUNTS:
            # Rango de bank_transactions disponibles
            row = cur.execute(
                """
                SELECT MIN(transaction_date), MAX(transaction_date)
                FROM bank_transactions
                WHERE bank_account_code = ?
                """,
                (account.code,),
            ).fetchone()
            if not row or not row[0]:
                continue
            period_start = date.fromisoformat(row[0])
            period_end = date.fromisoformat(row[1])

            # Traer entries del sistema correspondientes
            system_entries = fetch_system_entries(
                account.system_balance_account_id,
                period_start, period_end,
            )

            # Para evitar matchear el mismo entry dos veces
            already_matched_entry_ids: set[str] = set()

            # Iterar bank_transactions unmatched
            bank_txns = cur.execute(
                """
                SELECT id, transaction_date, raw_description, amount
                FROM bank_transactions
                WHERE bank_account_code = ?
                  AND match_status = 'unmatched'
                ORDER BY transaction_date, id
                """,
                (account.code,),
            ).fetchall()

            for txn in bank_txns:
                stats.candidates_examined += 1
                txn_date = date.fromisoformat(txn["transaction_date"])
                txn_amount = Decimal(txn["amount"])

                # Mejor match
                best: tuple[float, SystemEntry] | None = None
                for entry in system_entries:
                    if entry.id in already_matched_entry_ids:
                        continue
                    s = score_match(txn_amount, txn_date,
                                    txn["raw_description"], entry)
                    if s >= min_score and (best is None or s > best[0]):
                        best = (s, entry)

                if not best:
                    stats.unmatched_gap += 1
                    continue

                score, entry = best
                already_matched_entry_ids.add(entry.id)

                method = ("exact_amount_date" if score >= 0.9
                          else "fuzzy_description")
                cur.execute(
                    """
                    INSERT INTO balance_entry_matches
                        (bank_transaction_id, balance_entry_id, confidence,
                         match_method, matched_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (txn["id"], entry.id, score, method, _now_iso()),
                )
                cur.execute(
                    "UPDATE bank_transactions SET match_status = 'balance_entry' WHERE id = ?",
                    (txn["id"],),
                )
                if score >= 0.8:
                    stats.matched_high += 1
                else:
                    stats.matched_low += 1

    return stats
