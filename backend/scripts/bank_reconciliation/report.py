"""Generación de reportes markdown desde el SQLite staging.

Dos outputs:
    1. diagnostic — saldos, totales, transferencias internas, gaps.
       Para entender qué pasó.
    2. proposed_fixes — lista accionable de asientos faltantes + categorías
       sin tracking en el sistema (intereses, 4x1000).
       Para implementar después en otra sesión.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from pathlib import Path

from .config import KNOWN_ACCOUNTS, REPORTS_DIR
from .storage import get_connection


def _now_str() -> str:
    tz_colombia = timezone(timedelta(hours=-5))
    return datetime.now(tz_colombia).replace(microsecond=0).isoformat()


def _money(value) -> str:
    if value is None:
        return "—"
    d = Decimal(value)
    return f"${d:,.2f}"


# ---------------------------------------------------------------------------
# Diagnostic report
# ---------------------------------------------------------------------------

def build_diagnostic(db_path: str | None = None) -> str:
    """Reporte de diagnóstico completo (lo que pasó)."""
    kwargs = {"db_path": db_path} if db_path else {}
    out: list[str] = []
    out.append("# Diagnóstico de Conciliación Bancaria")
    out.append(f"\nGenerado: {_now_str()} (Colombia)\n")

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # --- Imports ---
        out.append("## Archivos importados\n")
        out.append("| Banco | Periodo | Origen | Movs | Apertura | Cierre | Abonos | Cargos |")
        out.append("|---|---|---|---:|---:|---:|---:|---:|")
        imports = cur.execute(
            """
            SELECT i.bank_account_code, ba.bank,
                   i.period_start, i.period_end, i.source_format,
                   i.transaction_count,
                   i.opening_balance, i.closing_balance,
                   i.total_credits, i.total_debits
            FROM statement_imports i
            JOIN bank_accounts ba ON ba.code = i.bank_account_code
            ORDER BY ba.bank, i.period_start
            """
        ).fetchall()
        for imp in imports:
            out.append(
                f"| {imp['bank']} | {imp['period_start']} → {imp['period_end']} "
                f"| {imp['source_format']} | {imp['transaction_count']} "
                f"| {_money(imp['opening_balance'])} | {_money(imp['closing_balance'])} "
                f"| {_money(imp['total_credits'])} | {_money(imp['total_debits'])} |"
            )

        # --- Resumen por cuenta ---
        out.append("\n## Resumen por cuenta\n")
        out.append("| Banco | Movs totales | Conciliados internos | Conciliados sistema | Sin conciliar |")
        out.append("|---|---:|---:|---:|---:|")
        for acc in KNOWN_ACCOUNTS:
            row = cur.execute(
                """
                SELECT
                    SUM(CASE WHEN 1=1 THEN 1 ELSE 0 END) as total,
                    SUM(CASE WHEN match_status='internal_pair' THEN 1 ELSE 0 END) as internal,
                    SUM(CASE WHEN match_status='balance_entry' THEN 1 ELSE 0 END) as system,
                    SUM(CASE WHEN match_status='unmatched' THEN 1 ELSE 0 END) as gap
                FROM bank_transactions
                WHERE bank_account_code = ?
                """,
                (acc.code,),
            ).fetchone()
            out.append(
                f"| {acc.bank} ({acc.account_number}) | {row['total'] or 0} "
                f"| {row['internal'] or 0} | {row['system'] or 0} | {row['gap'] or 0} |"
            )

        # --- Categorías ---
        out.append("\n## Distribución por categoría (auto)\n")
        out.append("| Categoría | N movs | Total abonos | Total cargos |")
        out.append("|---|---:|---:|---:|")
        rows = cur.execute(
            """
            SELECT category,
                   COUNT(*) as n,
                   SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as credits,
                   SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as debits
            FROM bank_transactions
            GROUP BY category
            ORDER BY n DESC
            """
        ).fetchall()
        for r in rows:
            out.append(
                f"| `{r['category']}` | {r['n']} "
                f"| {_money(r['credits'])} | {_money(r['debits'])} |"
            )

        # --- Transferencias internas detectadas ---
        out.append("\n## Transferencias internas detectadas\n")
        pairs = cur.execute(
            """
            SELECT p.amount, p.date_gap_days,
                   tout.transaction_date as out_date, tout.raw_description as out_desc,
                   ba_out.bank as out_bank,
                   tin.transaction_date as in_date, tin.raw_description as in_desc,
                   ba_in.bank as in_bank
            FROM internal_transfer_pairs p
            JOIN bank_transactions tout ON tout.id = p.txn_out_id
            JOIN bank_transactions tin ON tin.id = p.txn_in_id
            JOIN bank_accounts ba_out ON ba_out.code = tout.bank_account_code
            JOIN bank_accounts ba_in ON ba_in.code = tin.bank_account_code
            ORDER BY tout.transaction_date
            """
        ).fetchall()
        if not pairs:
            out.append("_Ninguna detectada._\n")
        else:
            out.append(f"**Total pares:** {len(pairs)}\n")
            out.append("| Fecha out | Banco out | Descripción out | Monto | Fecha in | Banco in | Δ días |")
            out.append("|---|---|---|---:|---|---|---:|")
            for p in pairs:
                out.append(
                    f"| {p['out_date']} | {p['out_bank']} | {p['out_desc'][:35]} "
                    f"| {_money(p['amount'])} | {p['in_date']} | {p['in_bank']} | {p['date_gap_days']} |"
                )

        # --- Matches con sistema ---
        out.append("\n## Conciliación contra balance_entries del sistema\n")
        match_summary = cur.execute(
            """
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN confidence >= 0.9 THEN 1 ELSE 0 END) as exact,
                SUM(CASE WHEN confidence >= 0.7 AND confidence < 0.9 THEN 1 ELSE 0 END) as high,
                SUM(CASE WHEN confidence < 0.7 THEN 1 ELSE 0 END) as fuzzy
            FROM balance_entry_matches
            """
        ).fetchone()
        out.append(
            f"- Total matches: **{match_summary['total'] or 0}** "
            f"(exactos {match_summary['exact'] or 0}, "
            f"alta {match_summary['high'] or 0}, "
            f"fuzzy {match_summary['fuzzy'] or 0})\n"
        )

        # --- Top gaps por monto ---
        out.append("\n## Top 30 movimientos SIN match (gaps)\n")
        out.append("> Transacciones del banco que NO tienen contraparte en el sistema. "
                   "Son candidatas a ser asientos faltantes en la app, gastos personales, "
                   "o ingresos no registrados.\n")
        out.append("| Fecha | Banco | Categoría | Descripción | Monto |")
        out.append("|---|---|---|---|---:|")
        gaps = cur.execute(
            """
            SELECT t.transaction_date, ba.bank, t.category, t.raw_description, t.amount
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.code = t.bank_account_code
            WHERE t.match_status = 'unmatched'
              AND t.category != 'internal_transfer'
            ORDER BY ABS(t.amount) DESC
            LIMIT 30
            """
        ).fetchall()
        for g in gaps:
            out.append(
                f"| {g['transaction_date']} | {g['bank']} | `{g['category']}` "
                f"| {g['raw_description'][:50]} | {_money(g['amount'])} |"
            )

        # --- Comparación saldos sistema vs banco ---
        out.append("\n## Comparación saldos: sistema vs banco real\n")
        out.append("> Saldo del sistema = `balance_accounts.balance` en prod_snapshot al "
                   "momento del refresh. Saldo banco = cierre del último extracto cargado.\n")
        out.append("| Cuenta | Sistema (DB) | Banco (último cierre) | Diferencia | Periodo banco |")
        out.append("|---|---:|---:|---:|---|")
        # Necesitamos consultar prod_snapshot para system balance
        from .matchers.balance_entry import _query_psql
        try:
            for acc in KNOWN_ACCOUNTS:
                sys_balance_raw = _query_psql(
                    f"SELECT balance::text FROM balance_accounts "
                    f"WHERE id = '{acc.system_balance_account_id}'"
                ).strip()
                sys_balance = Decimal(sys_balance_raw) if sys_balance_raw else Decimal("0")

                last_close = cur.execute(
                    """
                    SELECT closing_balance, period_end
                    FROM statement_imports
                    WHERE bank_account_code = ?
                    ORDER BY period_end DESC LIMIT 1
                    """,
                    (acc.code,),
                ).fetchone()
                if last_close:
                    bank_balance = Decimal(last_close["closing_balance"])
                    period_end = last_close["period_end"]
                else:
                    bank_balance = Decimal("0")
                    period_end = "—"
                diff = sys_balance - bank_balance
                out.append(
                    f"| {acc.bank} | {_money(sys_balance)} | {_money(bank_balance)} "
                    f"| {_money(diff)} | {period_end} |"
                )
        except Exception as e:
            out.append(f"_Error consultando prod_snapshot: {e}_\n")

        # --- Categorías sin tracking en sistema ---
        out.append("\n## Categorías sin tracking sistemático\n")
        out.append("> Tipos de movimientos que el banco genera regularmente pero el sistema "
                   "no rastrea como categoría dedicada. Insight: confirma la observación del "
                   "owner que **no hubo control de intereses ni 4x1000**.\n")
        for cat in ("bank_fee", "financial_income"):
            agg = cur.execute(
                """
                SELECT COUNT(*) as n,
                       SUM(amount) as total
                FROM bank_transactions
                WHERE category = ?
                """,
                (cat,),
            ).fetchone()
            n = agg["n"] or 0
            total = Decimal(agg["total"] or 0)
            out.append(f"- **`{cat}`**: {n} movimientos, total {_money(total)}")

    return "\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# Proposed fixes report
# ---------------------------------------------------------------------------

def build_proposed_fixes(db_path: str | None = None) -> str:
    """Reporte accionable: qué cambios hay que aplicar al sistema."""
    kwargs = {"db_path": db_path} if db_path else {}
    out: list[str] = []
    out.append("# Fixes Propuestos para Conciliación Bancaria")
    out.append(f"\nGenerado: {_now_str()} (Colombia)\n")
    out.append("> Lista accionable derivada del diagnóstico. Cada item es una **propuesta** "
               "que requiere review y aprobación antes de aplicar.\n")

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # 1. Asientos faltantes (gaps) — sugeridos como entries nuevas
        out.append("## 1. Asientos faltantes en el sistema\n")
        out.append("Movimientos del banco sin contraparte en `balance_entries`. "
                   "Propuesta: crear entry retroactivo en la cuenta del sistema.\n")

        gaps_by_account = cur.execute(
            """
            SELECT ba.bank, ba.code,
                   SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as missing_credits,
                   SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as missing_debits,
                   COUNT(*) as n
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.code = t.bank_account_code
            WHERE t.match_status = 'unmatched'
              AND t.category != 'internal_transfer'
            GROUP BY ba.bank, ba.code
            """
        ).fetchall()
        for r in gaps_by_account:
            out.append(f"- **{r['bank']}**: {r['n']} movs no registrados. "
                       f"Abonos faltantes {_money(r['missing_credits'])}, "
                       f"cargos faltantes {_money(r['missing_debits'])}.")

        # 2. Categorías a crear en el sistema
        out.append("\n## 2. Crear categorías en el sistema\n")
        out.append("Categorías que el sistema no rastrea como tales:\n")
        out.append("- **`bank_fee`** (4x1000, gravámenes, cuotas manejo) — actualmente "
                   "estos cargos quedan sin clasificación. Crear como `ExpenseCategory.BANK_FEES`.")
        out.append("- **`financial_income`** (intereses ganados de cuentas de ahorro) — "
                   "actualmente no se reconoce ingreso financiero. Crear como cuenta `INCOME.FINANCIAL`.")

        # 3. Transferencias internas a marcar
        n_internal = cur.execute(
            "SELECT COUNT(*) FROM internal_transfer_pairs"
        ).fetchone()[0]
        out.append(f"\n## 3. Marcar transferencias internas ({n_internal} pares)\n")
        out.append("Pares BC↔Nequi detectados automáticamente. En el sistema, cada par debe ser "
                   "**1 sola operación** que mueve plata entre dos `balance_accounts` propias "
                   "(no debe contar como ingreso ni gasto). Ver detalle completo en diagnóstico.\n")

        # 4. Diferencia de saldos
        out.append("## 4. Reconciliar diferencias de saldo cuenta-banco\n")
        out.append("Ver tabla 'Comparación saldos' del diagnóstico. La diferencia "
                   "representa el monto histórico que el sistema no rastreó. Posibles causas:\n")
        out.append("- Movimientos antes del periodo cargado (fixes pendientes)")
        out.append("- Errores de captura por vendedoras (no registraron ventas)")
        out.append("- Gastos personales pagados con cuenta del negocio")
        out.append("- Bug del sistema (`set_balance` no genera entry compensatoria)\n")

        # 5. Owner drawing candidates
        n_owner = cur.execute(
            "SELECT COUNT(*) FROM bank_transactions WHERE category = 'owner_drawing_candidate'"
        ).fetchone()[0]
        out.append(f"## 5. Revisar `owner_drawing_candidate` ({n_owner} movs)\n")
        out.append("Movimientos con keywords típicos de gasto personal (YANBAL, TEMU, etc.). "
                   "Decisión por movimiento:\n")
        out.append("- **(a) Gasto personal**: crear entry como `owner_drawing` (reduce patrimonio del propietario).")
        out.append("- **(b) Gasto operativo**: crear entry como `expense` con categoría adecuada.")
        out.append("- **(c) Reembolsable**: marcar como CxC contra el propietario.\n")
        out.append("**Lista completa**:\n")
        rows = cur.execute(
            """
            SELECT transaction_date, raw_description, amount
            FROM bank_transactions
            WHERE category = 'owner_drawing_candidate'
            ORDER BY ABS(amount) DESC
            """
        ).fetchall()
        out.append("| Fecha | Descripción | Monto |")
        out.append("|---|---|---:|")
        for r in rows:
            out.append(f"| {r['transaction_date']} | {r['raw_description'][:50]} | {_money(r['amount'])} |")

    return "\n".join(out) + "\n"


def build_detail_csv(db_path: str | None = None) -> str:
    """CSV con TODOS los movimientos: 1 fila por transacción.

    Columnas: id, bank, period_import, transaction_date, raw_description,
    amount, running_balance, category, rule_match, match_status,
    matched_entry_id, match_confidence, internal_pair_with
    """
    kwargs = {"db_path": db_path} if db_path else {}
    import io
    import csv

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "id", "bank", "import_period", "transaction_date", "raw_description",
        "amount", "running_balance", "category", "rule_match",
        "match_status", "matched_entry_id", "match_confidence",
        "internal_pair_with_id",
    ])

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()
        rows = cur.execute(
            """
            SELECT
                t.id, ba.bank, i.period_start || ' a ' || i.period_end as period,
                t.transaction_date, t.raw_description, t.amount, t.running_balance,
                t.category, t.category_rule, t.match_status,
                bem.balance_entry_id, bem.confidence,
                CASE
                    WHEN t.id = itp1.txn_out_id THEN itp1.txn_in_id
                    WHEN t.id = itp2.txn_in_id THEN itp2.txn_out_id
                    ELSE NULL
                END as pair_with
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.code = t.bank_account_code
            JOIN statement_imports i ON i.id = t.import_id
            LEFT JOIN balance_entry_matches bem ON bem.bank_transaction_id = t.id
            LEFT JOIN internal_transfer_pairs itp1 ON itp1.txn_out_id = t.id
            LEFT JOIN internal_transfer_pairs itp2 ON itp2.txn_in_id = t.id
            ORDER BY t.transaction_date, t.id
            """
        ).fetchall()
        for r in rows:
            w.writerow([
                r["id"], r["bank"], r["period"], r["transaction_date"],
                r["raw_description"], r["amount"], r["running_balance"],
                r["category"], r["category_rule"], r["match_status"],
                r["balance_entry_id"], r["confidence"], r["pair_with"],
            ])

    return buf.getvalue()


def build_track_summary(db_path: str | None = None) -> str:
    """Resumen exhaustivo por banco + mes + categoría + match status."""
    kwargs = {"db_path": db_path} if db_path else {}
    out: list[str] = []
    out.append("# Track Exacto de Movimientos Bancarios")
    out.append(f"\nGenerado: {_now_str()} (Colombia)")
    out.append("\n> Trazabilidad granular: cada movimiento clasificado por categoría "
               "y por status de conciliación contra `balance_entries` del sistema. "
               "Detalle completo en `bank-transactions-detail-<date>.csv`.\n")

    with get_connection(**kwargs) as conn:
        cur = conn.cursor()

        # Tabla maestra: banco × mes × match_status
        out.append("## Cobertura por banco y mes\n")
        out.append("| Banco | Mes | Total | Conciliado sistema | Pair interno | Sin match |")
        out.append("|---|---|---:|---:|---:|---:|")
        rows = cur.execute(
            """
            SELECT ba.bank, substr(t.transaction_date, 1, 7) as ym,
                   COUNT(*) as total,
                   SUM(CASE WHEN t.match_status = 'balance_entry' THEN 1 ELSE 0 END) as matched,
                   SUM(CASE WHEN t.match_status = 'internal_pair' THEN 1 ELSE 0 END) as internal,
                   SUM(CASE WHEN t.match_status = 'unmatched' THEN 1 ELSE 0 END) as gap
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.code = t.bank_account_code
            GROUP BY ba.bank, ym
            ORDER BY ba.bank, ym
            """
        ).fetchall()
        for r in rows:
            pct = (r["matched"] + r["internal"]) * 100 / r["total"] if r["total"] else 0
            out.append(
                f"| {r['bank']} | {r['ym']} | {r['total']} | "
                f"{r['matched']} ({pct:.0f}%) | {r['internal']} | {r['gap']} |"
            )

        # Categoría × match_status
        out.append("\n## Categorías × Estado de conciliación\n")
        out.append("| Categoría | Match sistema | Pair interno | Sin match | Total | Σ signed |")
        out.append("|---|---:|---:|---:|---:|---:|")
        cats = cur.execute(
            """
            SELECT category,
                   SUM(CASE WHEN match_status = 'balance_entry' THEN 1 ELSE 0 END) as matched,
                   SUM(CASE WHEN match_status = 'internal_pair' THEN 1 ELSE 0 END) as internal,
                   SUM(CASE WHEN match_status = 'unmatched' THEN 1 ELSE 0 END) as gap,
                   COUNT(*) as total,
                   SUM(amount) as total_signed
            FROM bank_transactions
            GROUP BY category
            ORDER BY total DESC
            """
        ).fetchall()
        for c in cats:
            out.append(
                f"| `{c['category']}` | {c['matched']} | {c['internal']} | "
                f"{c['gap']} | {c['total']} | {_money(c['total_signed'])} |"
            )

        # Movimientos needs_manual_review por monto (top 50)
        out.append("\n## Top 50 movimientos `needs_manual_review`\n")
        out.append("> Sin categorizar automáticamente y sin match en el sistema. "
                   "Estos son los que requieren ojo humano para clasificar.\n")
        out.append("| Fecha | Banco | Descripción | Monto |")
        out.append("|---|---|---|---:|")
        revs = cur.execute(
            """
            SELECT t.transaction_date, ba.bank, t.raw_description, t.amount
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.code = t.bank_account_code
            WHERE t.category = 'needs_manual_review'
            ORDER BY ABS(t.amount) DESC
            LIMIT 50
            """
        ).fetchall()
        for r in revs:
            out.append(
                f"| {r['transaction_date']} | {r['bank']} "
                f"| {r['raw_description'][:55]} | {_money(r['amount'])} |"
            )

        # Recurrencia de contrapartes ("Para X", "De X") agrupado para auto-detectar
        # proveedores/clientes recurrentes
        out.append("\n## Contrapartes recurrentes (candidatos a proveedores/clientes)\n")
        out.append("> Nombres que aparecen ≥3 veces en transacciones sin conciliar. "
                   "Indica relación de negocio recurrente — vale la pena catalogarlos.\n")
        out.append("| Contraparte (raw) | N apariciones | Total signed | Cuentas |")
        out.append("|---|---:|---:|---|")
        # Heurística: extraer "Para [X]" o "De [X]" de la descripción
        recurrent = cur.execute(
            """
            WITH counterparts AS (
                SELECT
                    CASE
                        WHEN raw_description LIKE 'Para %' THEN substr(raw_description, 6)
                        WHEN raw_description LIKE 'De %' THEN substr(raw_description, 4)
                        ELSE NULL
                    END as cp,
                    amount, bank_account_code
                FROM bank_transactions
                WHERE category IN ('needs_manual_review', 'transfer_external_via_nequi')
                  AND match_status = 'unmatched'
            )
            SELECT cp, COUNT(*) as n, SUM(amount) as total,
                   GROUP_CONCAT(DISTINCT bank_account_code) as accounts
            FROM counterparts
            WHERE cp IS NOT NULL AND length(cp) > 4
            GROUP BY cp
            HAVING n >= 2
            ORDER BY ABS(total) DESC
            LIMIT 30
            """
        ).fetchall()
        for r in recurrent:
            out.append(
                f"| {r['cp'][:40]} | {r['n']} | {_money(r['total'])} | {r['accounts']} |"
            )

    return "\n".join(out) + "\n"


def write_reports(
    *,
    db_path: str | None = None,
    output_dir: str = REPORTS_DIR,
    suffix: str = "",
) -> dict[str, Path]:
    """Genera todos los reportes. Devuelve dict {tipo: path}."""
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    stamp = datetime.now(timezone(timedelta(hours=-5))).strftime("%Y-%m-%d")
    s = f"-{suffix}" if suffix else ""

    paths: dict[str, Path] = {}

    paths["diagnostic"] = output / f"bank-reconciliation-{stamp}{s}.md"
    paths["diagnostic"].write_text(build_diagnostic(db_path=db_path), encoding="utf-8")

    paths["fixes"] = output / f"bank-fixes-proposed-{stamp}{s}.md"
    paths["fixes"].write_text(build_proposed_fixes(db_path=db_path), encoding="utf-8")

    paths["track"] = output / f"bank-track-summary-{stamp}{s}.md"
    paths["track"].write_text(build_track_summary(db_path=db_path), encoding="utf-8")

    paths["detail_csv"] = output / f"bank-transactions-detail-{stamp}{s}.csv"
    paths["detail_csv"].write_text(build_detail_csv(db_path=db_path), encoding="utf-8")

    return paths
