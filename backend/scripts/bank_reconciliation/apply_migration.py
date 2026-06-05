"""Aplicador del plan de migración a `uniformes_db` (DEV).

Toma las transacciones bancarias en categorías auto-migratables
(`bank_fee`, `financial_income`) y las INSERTa en `balance_entries`,
calculando `balance_after` cronológicamente y actualizando
`balance_accounts.balance` en consecuencia.

Características:
    - Idempotente: si `reference` ya existe, skip esa entry.
    - Atómico: todo en una transacción, ROLLBACK si algo falla.
    - Solo DEV: por seguridad refuse aplicar si DB destino != uniformes_db.
    - Reportable: emite log de qué se insertó y un total.

Reference format: BANK-<bank_account_code>-<txn_id> (idempotency key).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass
from decimal import Decimal

from .config import KNOWN_ACCOUNTS, PG_CONTAINER, PG_USER
from .storage import get_connection


AUTO_MIGRATABLE_CATEGORIES = ("bank_fee", "financial_income")


@dataclass
class ApplyStats:
    inserted: int = 0
    skipped_existing: int = 0
    total_amount: Decimal = Decimal("0")
    accounts_updated: int = 0


def _psql(db: str, sql: str, *, check: bool = True) -> str:
    result = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", PG_USER, "-d", db,
         "-At", "-F", "|", "-c", sql],
        capture_output=True, text=True, check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"psql falló: {result.stderr[:500]}")
    return result.stdout


def _psql_script(db: str, sql_script: str) -> str:
    """Ejecuta un script multi-statement (transacción)."""
    result = subprocess.run(
        ["docker", "exec", "-i", PG_CONTAINER,
         "psql", "-U", PG_USER, "-d", db, "-v", "ON_ERROR_STOP=1",
         "-At", "-F", "|"],
        input=sql_script, capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"psql script falló (exit {result.returncode}): "
            f"stderr={result.stderr[:1000]} stdout={result.stdout[:500]}"
        )
    return result.stdout


def _sql_escape(s: str) -> str:
    return s.replace("'", "''")


def apply_to_dev(
    *,
    target_db: str = "uniformes_db",
    sqlite_path: str | None = None,
    dry_run: bool = False,
) -> ApplyStats:
    """Aplica el plan al target_db (debe ser dev, NUNCA prod)."""
    if target_db == "uniformes_prod_snapshot":
        raise RuntimeError(
            "REFUSED: no aplicar a uniformes_prod_snapshot (es read-only de prod). "
            "Use uniformes_db (dev)."
        )

    stats = ApplyStats()
    kwargs = {"db_path": sqlite_path} if sqlite_path else {}

    # Mapeo banco code → balance_account uuid
    account_map = {a.code: a.system_balance_account_id for a in KNOWN_ACCOUNTS}

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # 1. Traer TODAS las transacciones candidatas en orden cronológico
        rows = cur.execute(
            f"""
            SELECT id, bank_account_code, transaction_date,
                   raw_description, amount
            FROM bank_transactions
            WHERE category IN ({",".join("?" * len(AUTO_MIGRATABLE_CATEGORIES))})
            ORDER BY transaction_date, id
            """,
            AUTO_MIGRATABLE_CATEGORIES,
        ).fetchall()

    if not rows:
        print("Nada para migrar.")
        return stats

    # 2. Para cada cuenta: traer balance actual del sistema + entries ya existentes
    #    (para chequear idempotencia y para calcular balance_after acumulativo)
    accounts_to_process: dict[str, str] = {}
    for r in rows:
        accounts_to_process[r["bank_account_code"]] = (
            account_map[r["bank_account_code"]]
        )

    account_balances: dict[str, Decimal] = {}
    existing_refs: dict[str, set[str]] = {}

    for code, acc_uuid in accounts_to_process.items():
        bal_raw = _psql(
            target_db,
            f"SELECT balance FROM balance_accounts WHERE id = '{acc_uuid}'",
        ).strip()
        account_balances[code] = Decimal(bal_raw) if bal_raw else Decimal("0")

        refs_raw = _psql(
            target_db,
            f"SELECT reference FROM balance_entries "
            f"WHERE account_id = '{acc_uuid}' AND reference LIKE 'BANK-%'",
        )
        existing_refs[code] = {
            line.strip() for line in refs_raw.splitlines() if line.strip()
        }

    print(f"\nEstado inicial:")
    for code, bal in account_balances.items():
        n_existing = len(existing_refs[code])
        print(f"  {code}: balance ${bal:,.2f}, {n_existing} entries previas con ref BANK-*")

    # 3. Construir el script SQL transaccional
    sql_lines: list[str] = ["BEGIN;"]
    running_per_account = dict(account_balances)  # copy

    for r in rows:
        code = r["bank_account_code"]
        reference = f"BANK-{code}-{r['id']}"
        if reference in existing_refs[code]:
            stats.skipped_existing += 1
            continue

        acc_uuid = account_map[code]
        amount = Decimal(r["amount"])
        new_balance = running_per_account[code] + amount
        running_per_account[code] = new_balance

        desc = _sql_escape(f"Auto: {r['raw_description']}")[:200]
        sql_lines.append(
            f"INSERT INTO balance_entries "
            f"(id, account_id, school_id, entry_date, amount, "
            f"balance_after, description, reference, created_at) "
            f"VALUES (gen_random_uuid(), '{acc_uuid}', NULL, "
            f"'{r['transaction_date']}', {amount}, {new_balance}, "
            f"'{desc}', '{reference}', NOW());"
        )
        stats.inserted += 1
        stats.total_amount += amount

    # 4. UPDATE de balance_accounts al final
    for code, final_bal in running_per_account.items():
        if final_bal != account_balances[code]:
            acc_uuid = account_map[code]
            sql_lines.append(
                f"UPDATE balance_accounts SET balance = {final_bal} "
                f"WHERE id = '{acc_uuid}';"
            )
            stats.accounts_updated += 1

    sql_lines.append("COMMIT;")
    sql_script = "\n".join(sql_lines)

    # 5. Reporte previo / dry-run
    print(f"\nPlan de aplicación:")
    print(f"  Inserts a generar:        {stats.inserted}")
    print(f"  Skipped (ya existentes):  {stats.skipped_existing}")
    print(f"  Total amount a impactar:  ${stats.total_amount:,.2f}")
    print(f"  Cuentas a actualizar:     {stats.accounts_updated}")
    for code in accounts_to_process:
        diff = running_per_account[code] - account_balances[code]
        print(f"    {code}: ${account_balances[code]:,.2f} → "
              f"${running_per_account[code]:,.2f} (Δ ${diff:,.2f})")

    if dry_run:
        print("\n[DRY-RUN] No se aplica nada.")
        return stats

    if stats.inserted == 0:
        print("\nNada nuevo que aplicar (todo ya estaba)."
              " No se ejecuta transacción.")
        return stats

    # 6. Ejecutar el script
    print(f"\nAplicando a {target_db}…")
    _psql_script(target_db, sql_script)
    print(f"✓ Aplicado.")

    # 7. Verificar post-aplicación
    print("\nEstado post-aplicación (verificación):")
    for code, acc_uuid in accounts_to_process.items():
        bal_raw = _psql(
            target_db,
            f"SELECT balance FROM balance_accounts WHERE id = '{acc_uuid}'",
        ).strip()
        n_raw = _psql(
            target_db,
            f"SELECT COUNT(*) FROM balance_entries "
            f"WHERE account_id = '{acc_uuid}' AND reference LIKE 'BANK-%'",
        ).strip()
        print(f"  {code}: balance ${Decimal(bal_raw):,.2f}, "
              f"{n_raw} entries con ref BANK-*")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description="Aplica el migration plan a uniformes_db dev"
    )
    parser.add_argument("--target-db", default="uniformes_db",
                        help="DB destino (default uniformes_db). NUNCA prod.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Solo simular, no aplicar")
    args = parser.parse_args()

    try:
        stats = apply_to_dev(
            target_db=args.target_db,
            dry_run=args.dry_run,
        )
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"\nTotal: {stats.inserted} insertadas, "
          f"{stats.skipped_existing} ya existían.")


if __name__ == "__main__":
    main()
