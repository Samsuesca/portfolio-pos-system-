"""SQLite local para staging de extractos bancarios.

Volátil por diseño: vive en /tmp. Re-buildable corriendo `cli.py load` de nuevo.
Sin Alembic. Sin sincronización con prod. Sin riesgo a otros desarrollos.

Tablas:
  bank_accounts          — copia local de cuentas conocidas (de config.py)
  statement_imports      — 1 fila por archivo cargado
  bank_transactions      — 1 fila por movimiento del extracto
  internal_transfer_pairs — match confirmado entre 2 transacciones propias
  balance_entry_matches  — match entre transacción bancaria y balance_entry de prod
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from decimal import Decimal
from pathlib import Path
from typing import Iterator

from .config import DB_PATH, KNOWN_ACCOUNTS


# Decimal <-> SQLite: SQLite no tiene Decimal nativo. Guardamos como TEXT
# y aplicamos converter para Decimal. Garantiza precisión sin float.
sqlite3.register_adapter(Decimal, str)
sqlite3.register_converter("DECIMAL", lambda b: Decimal(b.decode()))


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS bank_accounts (
    code TEXT PRIMARY KEY,
    bank TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL,
    holder_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statement_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_account_code TEXT NOT NULL REFERENCES bank_accounts(code),
    period_start TEXT NOT NULL,         -- ISO date
    period_end TEXT NOT NULL,
    source_format TEXT NOT NULL,        -- 'xlsx' | 'pdf' | 'manual'
    source_file TEXT NOT NULL,          -- ruta relativa al repo
    opening_balance DECIMAL,
    closing_balance DECIMAL,
    total_credits DECIMAL,
    total_debits DECIMAL,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_imports_account_period
    ON statement_imports(bank_account_code, period_start, period_end);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES statement_imports(id) ON DELETE CASCADE,
    bank_account_code TEXT NOT NULL REFERENCES bank_accounts(code),
    transaction_date TEXT NOT NULL,         -- ISO date
    raw_description TEXT NOT NULL,
    normalized_description TEXT,            -- lowercase, sin acentos
    amount DECIMAL NOT NULL,                -- signed: + abono, - cargo
    running_balance DECIMAL,
    -- categorization
    category TEXT NOT NULL DEFAULT 'unknown',
    category_rule TEXT,                     -- regla que disparó la categoría
    -- matching state
    match_status TEXT NOT NULL DEFAULT 'unmatched',
        -- 'unmatched' | 'internal_pair' | 'balance_entry' | 'manual_ignored' | 'gap'
    notes TEXT,
    UNIQUE(import_id, transaction_date, raw_description, amount, running_balance)
);

CREATE INDEX IF NOT EXISTS idx_txn_account_date
    ON bank_transactions(bank_account_code, transaction_date);
CREATE INDEX IF NOT EXISTS idx_txn_category
    ON bank_transactions(category);
CREATE INDEX IF NOT EXISTS idx_txn_match_status
    ON bank_transactions(match_status);

CREATE TABLE IF NOT EXISTS internal_transfer_pairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txn_out_id INTEGER NOT NULL REFERENCES bank_transactions(id),
    txn_in_id INTEGER NOT NULL REFERENCES bank_transactions(id),
    matched_at TEXT NOT NULL,
    amount DECIMAL NOT NULL,
    date_gap_days INTEGER NOT NULL,
    notes TEXT,
    UNIQUE(txn_out_id, txn_in_id)
);

CREATE TABLE IF NOT EXISTS balance_entry_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_transaction_id INTEGER NOT NULL REFERENCES bank_transactions(id),
    balance_entry_id TEXT NOT NULL,          -- UUID de prod
    confidence REAL NOT NULL,                -- 0.0 a 1.0
    match_method TEXT NOT NULL,
        -- 'exact_amount_date' | 'fuzzy_description' | 'manual'
    matched_at TEXT NOT NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_match_txn ON balance_entry_matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_match_entry ON balance_entry_matches(balance_entry_id);
"""


@contextmanager
def get_connection(db_path: str = DB_PATH) -> Iterator[sqlite3.Connection]:
    """Conexión con foreign keys + Decimal converter activos."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(db_path: str = DB_PATH, *, drop_first: bool = False) -> None:
    """Crea schema. Si drop_first, borra el archivo antes — útil para reset."""
    if drop_first and os.path.exists(db_path):
        os.remove(db_path)

    with get_connection(db_path) as conn:
        conn.executescript(SCHEMA_SQL)
        # Seed bank_accounts desde config
        for acc in KNOWN_ACCOUNTS:
            conn.execute(
                """
                INSERT OR REPLACE INTO bank_accounts
                    (code, bank, account_number, account_type, holder_name)
                VALUES (?, ?, ?, ?, ?)
                """,
                (acc.code, acc.bank, acc.account_number, acc.account_type, acc.holder_name),
            )


def stats(db_path: str = DB_PATH) -> dict:
    """Snapshot del estado del staging."""
    with get_connection(db_path) as conn:
        cur = conn.cursor()
        out = {}
        out["accounts"] = cur.execute("SELECT COUNT(*) FROM bank_accounts").fetchone()[0]
        out["imports"] = cur.execute("SELECT COUNT(*) FROM statement_imports").fetchone()[0]
        out["transactions"] = cur.execute("SELECT COUNT(*) FROM bank_transactions").fetchone()[0]
        out["internal_pairs"] = cur.execute("SELECT COUNT(*) FROM internal_transfer_pairs").fetchone()[0]
        out["balance_matches"] = cur.execute("SELECT COUNT(*) FROM balance_entry_matches").fetchone()[0]
        out["unmatched"] = cur.execute(
            "SELECT COUNT(*) FROM bank_transactions WHERE match_status = 'unmatched'"
        ).fetchone()[0]
        out["by_category"] = dict(cur.execute(
            "SELECT category, COUNT(*) FROM bank_transactions GROUP BY category"
        ).fetchall())
        return out
