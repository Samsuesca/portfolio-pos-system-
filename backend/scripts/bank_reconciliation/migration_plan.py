"""Generador de plan de migración automática.

Toma las categorías que el owner aprobó migrar automáticamente
(`bank_fee`, `financial_income`) y emite SQL INSERTs propuestos
contra `balance_entries` del sistema.

NO ejecuta nada. NO conecta a prod. Solo emite SQL en un markdown
para que el owner revise y aplique en otra sesión.

Diseño del SQL emitido:
    -- 1 INSERT por transacción bancaria
    -- account_id = la cuenta del banco correspondiente
    -- entry_date = transaction_date
    -- amount = signed (igual al banco)
    -- description = "Auto: <descripción del banco>"
    -- reference = un id derivado del banco (para idempotencia)
    -- created_by = NULL (o un user fijo del owner)
    -- entry_type = NULL (deja que el sistema decida)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

from .config import KNOWN_ACCOUNTS, REPORTS_DIR
from .storage import get_connection


def _money(value) -> str:
    if value is None:
        return "—"
    return f"${Decimal(value):,.2f}"


def _now_str() -> str:
    tz_colombia = timezone(timedelta(hours=-5))
    return datetime.now(tz_colombia).replace(microsecond=0).isoformat()


def _sql_escape(s: str) -> str:
    """Escape simple para strings en SQL — solo single quotes."""
    return s.replace("'", "''")


# Categorías que se migran automáticamente (aprobadas por el owner)
AUTO_MIGRATABLE_CATEGORIES = ("bank_fee", "financial_income")


def build(db_path: str | None = None) -> str:
    """Genera el markdown completo del plan de migración."""
    kwargs = {"db_path": db_path} if db_path else {}
    out: list[str] = []
    out.append("# Plan de Migración Automática — Conciliación Bancaria")
    out.append(f"\nGenerado: {_now_str()} (Colombia)\n")
    out.append("> Este documento contiene INSERTs propuestos para registrar en "
               "`balance_entries` movimientos bancarios que el owner aprobó migrar "
               "automáticamente: comisiones (`bank_fee`) e intereses (`financial_income`).")
    out.append("> **NO ejecutar sin revisar primero.** Probar en `uniformes_db` "
               "(dev) antes de prod. Idempotencia: el campo `reference` lleva "
               "un id derivado del banco para evitar duplicados.\n")

    # Lookup de account_id por código de banco
    bank_to_acc = {a.code: a.system_balance_account_id for a in KNOWN_ACCOUNTS}

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # Por categoría auto-migratable, listar las transacciones sin match
        # contra el sistema (los que ya están matched no se duplican).
        for category in AUTO_MIGRATABLE_CATEGORIES:
            rows = cur.execute(
                """
                SELECT t.id, t.bank_account_code, t.transaction_date,
                       t.raw_description, t.amount
                FROM bank_transactions t
                WHERE t.category = ?
                  AND t.match_status = 'unmatched'
                ORDER BY t.transaction_date, t.id
                """,
                (category,),
            ).fetchall()

            n = len(rows)
            total = sum((Decimal(r["amount"]) for r in rows), Decimal("0"))
            out.append(f"\n## Categoría: `{category}` — {n} entries, total {_money(total)}\n")

            if n == 0:
                out.append("_Nada para migrar._\n")
                continue

            # Resumen por mes
            cur2 = conn.cursor()
            monthly = cur2.execute(
                """
                SELECT substr(transaction_date, 1, 7) as ym,
                       COUNT(*) as n,
                       SUM(amount) as total
                FROM bank_transactions
                WHERE category = ? AND match_status = 'unmatched'
                GROUP BY ym ORDER BY ym
                """,
                (category,),
            ).fetchall()
            out.append("**Distribución mensual:**\n")
            out.append("| Mes | N | Total |")
            out.append("|---|---:|---:|")
            for m in monthly:
                out.append(f"| {m['ym']} | {m['n']} | {_money(m['total'])} |")

            # SQL block
            out.append("\n**SQL propuesto:**\n")
            out.append("```sql")
            out.append("-- Categoría: " + category)
            for r in rows:
                account_id = bank_to_acc.get(r["bank_account_code"], "UNKNOWN")
                reference = f"BANK-{r['bank_account_code']}-{r['id']}"
                amount = Decimal(r["amount"])
                desc = _sql_escape(f"Auto: {r['raw_description']}")[:200]
                out.append(
                    f"INSERT INTO balance_entries "
                    f"(id, account_id, entry_date, amount, description, reference, created_at) "
                    f"VALUES (gen_random_uuid(), '{account_id}', '{r['transaction_date']}', "
                    f"{amount}, '{desc}', '{reference}', NOW());"
                )
            out.append("```\n")

        # 2. Transferencias internas confirmadas — propuesta de marcar
        out.append("\n## Transferencias internas confirmadas\n")
        pairs = cur.execute(
            """
            SELECT p.amount, p.date_gap_days,
                   tout.transaction_date as out_date,
                   tout.bank_account_code as out_acc,
                   tin.transaction_date as in_date,
                   tin.bank_account_code as in_acc
            FROM internal_transfer_pairs p
            JOIN bank_transactions tout ON tout.id = p.txn_out_id
            JOIN bank_transactions tin ON tin.id = p.txn_in_id
            ORDER BY tout.transaction_date
            """
        ).fetchall()
        out.append(f"**{len(pairs)} pares confirmados** entre cuentas propias.\n")
        out.append("> Cada par debe registrarse como UNA sola operación de "
                   "transferencia interna en el sistema (no como ingreso ni gasto). "
                   "Implementación: 2 entries con signos opuestos referenciando "
                   "el mismo `transfer_id`, o usar `counterpart_entry_id` de balance_entries.\n")
        if pairs:
            out.append("| Fecha | Out | In | Monto |")
            out.append("|---|---|---|---:|")
            for p in pairs:
                out.append(
                    f"| {p['out_date']} → {p['in_date']} | "
                    f"{p['out_acc']} | {p['in_acc']} | {_money(p['amount'])} |"
                )

        # 3. Categorías que requieren decisión manual
        out.append("\n## Categorías que requieren decisión manual\n")
        out.append("> Estas NO se migran automáticamente. Cada movimiento "
                   "requiere clasificación humana antes de generar el asiento.\n")

        manual_cats = ("transfer_external_via_nequi", "needs_manual_review",
                       "owner_drawing_candidate", "credit_card_payment",
                       "supplier_payment", "sale_qr", "cash_deposit")
        out.append("| Categoría | N movs | Total signed |")
        out.append("|---|---:|---:|")
        for cat in manual_cats:
            row = cur.execute(
                """
                SELECT COUNT(*) as n, SUM(amount) as total
                FROM bank_transactions
                WHERE category = ?
                """,
                (cat,),
            ).fetchone()
            if row["n"]:
                out.append(f"| `{cat}` | {row['n']} | {_money(row['total'])} |")

    return "\n".join(out) + "\n"


def write(*, db_path: str | None = None, output_dir: str = REPORTS_DIR) -> Path:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone(timedelta(hours=-5))).strftime("%Y-%m-%d")
    path = output / f"bank-migration-plan-{stamp}.md"
    path.write_text(build(db_path=db_path), encoding="utf-8")
    return path
