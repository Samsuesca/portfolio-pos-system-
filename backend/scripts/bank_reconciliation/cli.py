"""CLI orquestador. Self-contained, sin clicks ni argparse fancy.

Uso:
    python -m backend.scripts.bank_reconciliation.cli init
    python -m backend.scripts.bank_reconciliation.cli load --password <pwd>
    python -m backend.scripts.bank_reconciliation.cli match
    python -m backend.scripts.bank_reconciliation.cli report
    python -m backend.scripts.bank_reconciliation.cli all --password <pwd>
    python -m backend.scripts.bank_reconciliation.cli stats

El password se acepta también via env var: BANK_PDF_PASSWORD
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from . import loader, post_process, storage
from .config import EXTRACTS_DIR
from .matchers import balance_entry as match_balance
from .matchers import internal_transfer as match_internal
from .migration_plan import write as write_migration_plan
from .report import write_reports


def cmd_init(args) -> int:
    storage.init_db(drop_first=args.reset)
    print(f"DB inicializada en {storage.DB_PATH} (reset={args.reset})")
    return 0


def cmd_load(args) -> int:
    password = args.password or os.environ.get("BANK_PDF_PASSWORD")
    extracts_root = Path(EXTRACTS_DIR)
    if not extracts_root.exists():
        print(f"ERROR: no existe {extracts_root}", file=sys.stderr)
        return 2

    total_inserted = 0
    total_skipped = 0

    # Bancolombia: XLSX (en zip o directo) o PDF
    bc_dir = extracts_root / "Bancolombia"
    if bc_dir.exists():
        # Buscar todos los .xlsx, incluyendo dentro de zips
        for xlsx in sorted(bc_dir.rglob("*.xlsx")):
            try:
                res = loader.load_bancolombia_xlsx(xlsx)
                print(f"[BC]    {xlsx.name}: +{res.transactions_inserted} "
                      f"(dup {res.transactions_skipped_duplicate}) "
                      f"period {res.period_start}→{res.period_end}")
                total_inserted += res.transactions_inserted
                total_skipped += res.transactions_skipped_duplicate
            except Exception as e:
                print(f"[BC]    {xlsx.name}: ERROR {type(e).__name__}: {e}", file=sys.stderr)

        # Auto-extraer zips de Bancolombia
        import zipfile
        import tempfile
        for zip_path in sorted(bc_dir.glob("*.zip")):
            with tempfile.TemporaryDirectory() as td:
                try:
                    with zipfile.ZipFile(zip_path) as zf:
                        zf.extractall(td)
                    for xlsx in Path(td).rglob("*.xlsx"):
                        # source_file_override: guardamos el path del zip
                        # como identidad lógica, no el path temporal.
                        # account_code explícito: el path en /tmp no tiene "Bancolombia".
                        logical_path = f"{zip_path}::{xlsx.name}"
                        res = loader.load_bancolombia_xlsx(
                            xlsx,
                            account_code="BC_AHORROS_7338",
                            source_file_override=logical_path,
                        )
                        print(f"[BC-ZIP] {zip_path.name} → {xlsx.name}: "
                              f"+{res.transactions_inserted} "
                              f"(dup {res.transactions_skipped_duplicate}) "
                              f"period {res.period_start}→{res.period_end}")
                        total_inserted += res.transactions_inserted
                        total_skipped += res.transactions_skipped_duplicate
                except Exception as e:
                    print(f"[BC-ZIP] {zip_path.name}: ERROR {type(e).__name__}: {e}",
                          file=sys.stderr)

    # Nequi: PDFs con password
    nequi_dir = extracts_root / "Nequi"
    if nequi_dir.exists():
        if not password:
            print("WARNING: no password (--password o env BANK_PDF_PASSWORD), "
                  "skipping Nequi PDFs.", file=sys.stderr)
        else:
            for pdf in sorted(nequi_dir.glob("*.pdf")):
                try:
                    res = loader.load_nequi_pdf(pdf, password)
                    print(f"[Nequi] {pdf.name}: +{res.transactions_inserted} "
                          f"(dup {res.transactions_skipped_duplicate}) "
                          f"period {res.period_start}→{res.period_end}")
                    total_inserted += res.transactions_inserted
                    total_skipped += res.transactions_skipped_duplicate
                except Exception as e:
                    print(f"[Nequi] {pdf.name}: ERROR {type(e).__name__}: {e}",
                          file=sys.stderr)

    print(f"\nTOTAL: {total_inserted} insertadas, {total_skipped} duplicadas (idempotente)")
    return 0


def cmd_match(args) -> int:
    print("\n=== Matching transferencias internas BC↔Nequi ===")
    internal_stats = match_internal.run()
    print(f"  Candidatos:  {internal_stats.candidates_examined}")
    print(f"  Pares OK:    {internal_stats.pairs_matched}")
    print(f"  Ambiguos:    {internal_stats.ambiguous}")
    print(f"  Sin par:     {internal_stats.unmatched}")

    print("\n=== Matching contra balance_entries del sistema (prod_snapshot) ===")
    sys_stats = match_balance.run(min_score=args.min_score)
    print(f"  Candidatos:    {sys_stats.candidates_examined}")
    print(f"  Match alto:    {sys_stats.matched_high}")
    print(f"  Match fuzzy:   {sys_stats.matched_low}")
    print(f"  Gap (sin):     {sys_stats.unmatched_gap}")

    print("\n=== Post-procesamiento ===")
    pp_stats = post_process.run()
    print(f"  Internal sin par → transfer_external_via_nequi:  {pp_stats.internal_no_pair}")
    print(f"  Unknown unmatched → needs_manual_review:          {pp_stats.needs_review}")
    return 0


def cmd_report(args) -> int:
    paths = write_reports(suffix=args.suffix)
    for kind, p in paths.items():
        print(f"  {kind:<12}: {p}")

    mp = write_migration_plan()
    print(f"  {'migration':<12}: {mp}")
    return 0


def cmd_stats(args) -> int:
    s = storage.stats()
    print("=== Stats SQLite ===")
    for k, v in s.items():
        print(f"  {k:>20}: {v}")
    return 0


def cmd_all(args) -> int:
    print("=== STEP 1/4: init ===")
    storage.init_db(drop_first=True)

    print("\n=== STEP 2/4: load ===")
    rc = cmd_load(args)
    if rc != 0:
        return rc

    print("\n=== STEP 3/4: match ===")
    cmd_match(args)

    print("\n=== STEP 4/4: report ===")
    cmd_report(args)

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="bank_reconciliation")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init", help="Crear/resetear SQLite local")
    p_init.add_argument("--reset", action="store_true",
                        help="Borrar DB antes de crear")
    p_init.set_defaults(func=cmd_init)

    p_load = sub.add_parser("load", help="Cargar todos los extractos de documentos/Finanzas/Extractos")
    p_load.add_argument("--password", help="Password PDFs Nequi (o env BANK_PDF_PASSWORD)")
    p_load.set_defaults(func=cmd_load)

    p_match = sub.add_parser("match", help="Correr matching internal + sistema")
    p_match.add_argument("--min-score", type=float, default=0.5,
                         help="Score mínimo para match contra balance_entries")
    p_match.set_defaults(func=cmd_match)

    p_report = sub.add_parser("report", help="Generar reportes markdown")
    p_report.add_argument("--suffix", default="",
                          help="Sufijo opcional para nombres de archivo")
    p_report.set_defaults(func=cmd_report)

    p_stats = sub.add_parser("stats", help="Mostrar stats del SQLite")
    p_stats.set_defaults(func=cmd_stats)

    p_all = sub.add_parser("all", help="init + load + match + report en orden")
    p_all.add_argument("--password", help="Password PDFs Nequi")
    p_all.add_argument("--min-score", type=float, default=0.5)
    p_all.add_argument("--suffix", default="")
    p_all.set_defaults(func=cmd_all)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
