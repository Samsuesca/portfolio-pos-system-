"""Loader: parsea extracto → categoriza → persiste en SQLite.

Auto-detecta formato por extensión y banco por nombre/path:
    .xlsx en path con 'Bancolombia' → bancolombia_xlsx parser
    .pdf  en path con 'Nequi'       → nequi_pdf parser (requiere password)

Idempotente: si el mismo import (account + period_start + source_file) ya existe,
hace UPDATE; las transacciones se insertan con UNIQUE constraint
(import_id, date, desc, amount, balance) — duplicados se ignoran.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

from .categorizer import categorize, normalize_description
from .config import KNOWN_ACCOUNTS, PG_CONTAINER  # noqa: F401
from .parsers import bancolombia_xlsx, nequi_pdf
from .storage import get_connection


def _now_iso() -> str:
    """Timestamp Colombia, sin microsegundos. Standalone, no importa app.utils."""
    tz_colombia = timezone(timedelta(hours=-5))
    return datetime.now(tz_colombia).replace(microsecond=0).isoformat()


@dataclass
class LoadResult:
    import_id: int
    bank_account_code: str
    source_file: str
    transactions_inserted: int
    transactions_skipped_duplicate: int
    period_start: str
    period_end: str
    opening_balance: Decimal
    closing_balance: Decimal


def _detect_account_code(path: Path) -> str:
    """Heurística por path. Falla loud si no se reconoce."""
    s = str(path).lower()
    if "bancolombia" in s:
        # Asumimos la cuenta principal conocida
        return "BC_AHORROS_7338"
    if "nequi" in s:
        return "NEQUI_3001234567"
    raise ValueError(
        f"No puedo inferir el banco para {path}. "
        f"Esperaba 'Bancolombia' o 'Nequi' en el path."
    )


def load_bancolombia_xlsx(
    path: str | Path,
    *,
    account_code: str | None = None,
    source_file_override: str | None = None,
    db_path: str | None = None,
) -> LoadResult:
    """
    account_code: si None, se infiere del path (debe contener 'Bancolombia').
        Útil para zips extraídos a /tmp donde el path ya no tiene el nombre.
    source_file_override: path lógico para guardar en DB (en vez del temp path).
    """
    path = Path(path)
    code = account_code or _detect_account_code(path)
    statement = bancolombia_xlsx.parse(path)
    return _persist(
        path=Path(source_file_override) if source_file_override else path,
        account_code=code,
        source_format="xlsx",
        header=statement.header,
        transactions=[
            (t.transaction_date, t.raw_description, t.amount, t.running_balance)
            for t in statement.transactions
        ],
        db_path=db_path,
    )


def load_nequi_pdf(
    path: str | Path,
    password: str,
    *,
    account_code: str | None = None,
    db_path: str | None = None,
) -> LoadResult:
    path = Path(path)
    code = account_code or _detect_account_code(path)
    statement = nequi_pdf.parse(path, password)
    return _persist(
        path=path,
        account_code=code,
        source_format="pdf",
        header=statement.header,
        transactions=[
            (t.transaction_date, t.raw_description, t.amount, t.running_balance)
            for t in statement.transactions
        ],
        db_path=db_path,
    )


def _persist(
    *,
    path: Path,
    account_code: str,
    source_format: str,
    header,
    transactions: list[tuple],
    db_path: str | None,
) -> LoadResult:
    """Inserta el import + las transacciones. Categoriza on-the-fly."""
    rel_path = _relative_to_repo(path)

    kwargs = {"db_path": db_path} if db_path else {}
    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # Totales del header (Bancolombia y Nequi usan los mismos nombres)
        opening = Decimal(header.opening_balance)
        closing = Decimal(header.closing_balance)
        credits = Decimal(header.total_credits)
        debits = Decimal(header.total_debits)

        # Upsert del import (por account + period + source_file)
        cur.execute(
            """
            SELECT id FROM statement_imports
            WHERE bank_account_code = ? AND period_start = ? AND period_end = ?
              AND source_file = ?
            """,
            (account_code, header.period_start.isoformat(),
             header.period_end.isoformat(), rel_path),
        )
        existing = cur.fetchone()

        if existing:
            import_id = existing["id"]
            cur.execute(
                """
                UPDATE statement_imports SET
                    opening_balance = ?, closing_balance = ?,
                    total_credits = ?, total_debits = ?,
                    transaction_count = ?, imported_at = ?
                WHERE id = ?
                """,
                (opening, closing, credits, debits, len(transactions), _now_iso(), import_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO statement_imports
                    (bank_account_code, period_start, period_end, source_format,
                     source_file, opening_balance, closing_balance,
                     total_credits, total_debits, transaction_count, imported_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (account_code, header.period_start.isoformat(),
                 header.period_end.isoformat(), source_format, rel_path,
                 opening, closing, credits, debits, len(transactions), _now_iso()),
            )
            import_id = cur.lastrowid

        # Inserta transacciones (UNIQUE constraint protege duplicados)
        inserted = 0
        skipped = 0
        for txn_date, raw_desc, amount, balance in transactions:
            cat_result = categorize(raw_desc, amount)
            try:
                cur.execute(
                    """
                    INSERT INTO bank_transactions
                        (import_id, bank_account_code, transaction_date,
                         raw_description, normalized_description, amount,
                         running_balance, category, category_rule)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (import_id, account_code, txn_date.isoformat(),
                     raw_desc, normalize_description(raw_desc),
                     amount, balance,
                     cat_result.category, cat_result.rule_keywords),
                )
                inserted += 1
            except Exception as e:
                if "UNIQUE constraint" in str(e):
                    skipped += 1
                else:
                    raise

    return LoadResult(
        import_id=import_id,
        bank_account_code=account_code,
        source_file=rel_path,
        transactions_inserted=inserted,
        transactions_skipped_duplicate=skipped,
        period_start=header.period_start.isoformat(),
        period_end=header.period_end.isoformat(),
        opening_balance=opening,
        closing_balance=closing,
    )


def _relative_to_repo(path: Path) -> str:
    """Devuelve path relativo al repo si está dentro; absoluto si no."""
    try:
        cwd = Path.cwd()
        return str(path.resolve().relative_to(cwd))
    except (ValueError, FileNotFoundError):
        return str(path)
