"""Aplicador idempotente de correcciones contables aprobadas — sprint estabilización Q2.

Reemplaza el script aspiracional que el ROADMAP pedía. Hoy cubre 2 fases
auto-aplicables que ya tienen decisión owner; las que aún requieren input
quedan documentadas en deploy-checklist.md §4.5 y se ejecutan manualmente
cuando el owner las decida.

Fases aplicadas:

  Fase 1 — Bank migration plan (bank_fee + financial_income)
      Parsea `docs/v3/formalization/estabilizacion_contable/bank-migration-plan-*.md`
      (generado por `scripts.bank_reconciliation.migration_plan`) y aplica los
      INSERTs propuestos a `balance_entries` con `balance_after` calculado
      cronológicamente. Idempotente vía campo `reference` (BANK-...).
      Equivalente al `scripts.bank_reconciliation.apply_migration` pero sin
      requerir el SQLite intermedio.

  Fase 2 — AP Cristina Rios $19M (vigente)
      Confirmado por owner 2026-05-24: deuda original $39M, $20M pagado feb,
      $19M residual VIGENTE (no es equity correctivo, es AP viva). Crea vendor
      "Cristina Rios" si no existe y un AccountsPayable con due_date abierta.

Fases NO aplicadas (bloqueadas — owner debe decidir):
  - 20 owner_drawings YANBAL/ESIKA/TEMU: clasificación 1-a-1
  - Nequi $20M → $10 (5-ene-2026): pendiente clarificación con Consuelo
  - Equity correctivo $21.6M: bloqueado por audit Q2 Bancolombia $7.7M divergencia
  - Reclasificación masiva mercado/ocio personal vs negocio: ~60 tx 1-a-1

Uso:
    cd backend
    venv/bin/python -m scripts.apply_stabilization_data_corrections           # dry-run
    venv/bin/python -m scripts.apply_stabilization_data_corrections --commit  # persiste
    venv/bin/python -m scripts.apply_stabilization_data_corrections --commit \\
        --plan-path docs/v3/formalization/estabilizacion_contable/bank-migration-plan-2026-05-17.md
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import re
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.accounting import AccountsPayable, BalanceAccount, BalanceEntry
from app.models.vendor import Vendor, VendorType
from app.utils.timezone import get_colombia_now_naive


def _normalize_vendor_name(name: str) -> str:
    """Normalización para campo unique normalized_name (lower + collapse spaces)."""
    return re.sub(r"\s+", " ", name.strip().lower())

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
logger = logging.getLogger("stabilization")

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PLAN = (
    REPO_ROOT / "docs" / "v3" / "formalization" / "estabilizacion_contable"
    / "bank-migration-plan-2026-05-17.md"
)

# Decisión owner 2026-05-24
CRISTINA_TOTAL_DEBT = Decimal("39000000")
CRISTINA_PAID = Decimal("20000000")
CRISTINA_VIGENTE = CRISTINA_TOTAL_DEBT - CRISTINA_PAID  # $19M
CRISTINA_INVOICE_DATE = "2026-02-01"  # mes del pago parcial registrado

# Regex del INSERT generado por migration_plan.py — formato fijo
INSERT_RE = re.compile(
    r"INSERT INTO balance_entries .* VALUES \(gen_random_uuid\(\), "
    r"'(?P<account_id>[0-9a-f-]+)', '(?P<entry_date>[0-9-]+)', "
    r"(?P<amount>-?[0-9.]+), '(?P<description>(?:[^']|'')*)', "
    r"'(?P<reference>BANK-[^']+)', NOW\(\)\);"
)


@dataclass
class BankEntry:
    account_id: str
    entry_date: str
    amount: Decimal
    description: str
    reference: str


@dataclass
class PhaseStats:
    inserted: int = 0
    skipped_existing: int = 0
    errors: list[str] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


# ---------------------------------------------------------------------------
# Fase 1 — Bank migration plan
# ---------------------------------------------------------------------------

def parse_migration_plan(path: Path) -> list[BankEntry]:
    """Extrae todos los INSERT del markdown del plan."""
    if not path.exists():
        raise FileNotFoundError(f"Plan no encontrado: {path}")
    content = path.read_text(encoding="utf-8")
    entries: list[BankEntry] = []
    for m in INSERT_RE.finditer(content):
        entries.append(BankEntry(
            account_id=m.group("account_id"),
            entry_date=m.group("entry_date"),
            amount=Decimal(m.group("amount")),
            description=m.group("description").replace("''", "'"),
            reference=m.group("reference"),
        ))
    return entries


async def apply_bank_migration(
    db: AsyncSession, entries: list[BankEntry],
) -> PhaseStats:
    """Aplica entries a balance_entries con balance_after calculado y idempotencia."""
    stats = PhaseStats()

    # Agrupar por account_id, ordenar cronológicamente
    by_account: dict[str, list[BankEntry]] = {}
    for e in entries:
        by_account.setdefault(e.account_id, []).append(e)

    for account_id, account_entries in by_account.items():
        # Saldo actual de la cuenta como punto de partida
        acc_stmt = select(BalanceAccount).where(BalanceAccount.id == account_id)
        account = (await db.execute(acc_stmt)).scalar_one_or_none()
        if account is None:
            stats.errors.append(f"account_id {account_id} no existe")
            continue
        running_balance = Decimal(account.balance)

        # Referencias ya aplicadas (idempotencia)
        existing_stmt = select(BalanceEntry.reference).where(
            BalanceEntry.account_id == account_id,
            BalanceEntry.reference.like("BANK-%"),
        )
        existing_refs = {r for r, in (await db.execute(existing_stmt)).all()}

        # Ordenar por fecha + reference (estable)
        account_entries.sort(key=lambda x: (x.entry_date, x.reference))

        now = get_colombia_now_naive()
        for entry in account_entries:
            if entry.reference in existing_refs:
                stats.skipped_existing += 1
                continue
            running_balance += entry.amount
            db.add(BalanceEntry(
                account_id=account_id,
                school_id=None,
                entry_date=date.fromisoformat(entry.entry_date),
                amount=entry.amount,
                balance_after=running_balance,
                description=f"Auto: {entry.description.removeprefix('Auto: ')}"[:500],
                reference=entry.reference,
                created_at=now,
            ))
            stats.inserted += 1

        # Update del saldo final solo si cambió
        if running_balance != Decimal(account.balance):
            account.balance = running_balance
            await db.flush()
            logger.info(
                "  Cuenta %s: %s → %s (Δ %s)",
                account.name, Decimal(account.balance) - sum(
                    e.amount for e in account_entries
                    if e.reference not in existing_refs
                ), running_balance,
                sum(e.amount for e in account_entries if e.reference not in existing_refs),
            )

    return stats


# ---------------------------------------------------------------------------
# Fase 2 — AP Cristina Rios $19M vigente
# ---------------------------------------------------------------------------

async def ensure_cristina_ap(db: AsyncSession) -> PhaseStats:
    """Crea vendor + AP de Cristina $19M vigente si no existe. Idempotente por description."""
    stats = PhaseStats()
    vendor_name = "Cristina Rios"
    ap_description = f"Refinanciamiento Cristina Rios — residual {CRISTINA_VIGENTE} (orig {CRISTINA_TOTAL_DEBT}, pagado {CRISTINA_PAID} feb-2026)"

    # 1. Vendor — buscar por name (case-insensitive)
    v_stmt = select(Vendor).where(Vendor.name.ilike(vendor_name))
    vendor = (await db.execute(v_stmt)).scalar_one_or_none()
    if vendor is None:
        vendor = Vendor(
            name=vendor_name,
            normalized_name=_normalize_vendor_name(vendor_name),
            type=VendorType.PERSON,
            notes="Préstamo personal — decisión owner 2026-05-24, "
                  "deuda $39M, pago parcial $20M feb-2026, residual $19M vigente",
            is_active=True,
        )
        db.add(vendor)
        await db.flush()
        logger.info("  + vendor creado: %s (id=%s)", vendor.name, vendor.id)
    else:
        logger.info("  = vendor ya existe: %s (id=%s)", vendor.name, vendor.id)

    # 2. AP — buscar por (vendor_id, description) para idempotencia
    ap_stmt = select(AccountsPayable).where(
        AccountsPayable.vendor_id == vendor.id,
        AccountsPayable.description.ilike("%Refinanciamiento Cristina%"),
    )
    existing_ap = (await db.execute(ap_stmt)).scalar_one_or_none()
    if existing_ap is not None:
        if existing_ap.amount != CRISTINA_VIGENTE:
            existing_ap.amount = CRISTINA_VIGENTE
            existing_ap.is_paid = False
            existing_ap.description = ap_description
            existing_ap.updated_at = get_colombia_now_naive()
            logger.info(
                "  ~ AP Cristina actualizada: amount → %s", CRISTINA_VIGENTE,
            )
            stats.inserted += 1
        else:
            logger.info("  = AP Cristina ya está al valor objetivo (skip)")
            stats.skipped_existing += 1
        return stats

    db.add(AccountsPayable(
        school_id=None,
        vendor_id=vendor.id,
        amount=CRISTINA_VIGENTE,
        amount_paid=Decimal("0"),
        description=ap_description,
        category="financial_debt",
        invoice_date=date.fromisoformat(CRISTINA_INVOICE_DATE),
        due_date=None,
        is_paid=False,
        is_overdue=False,
        notes="Sin contrato formal — decisión owner 2026-05-24 confirma vigencia. "
              "Catalogar como 'financial_debt' en P&L.",
    ))
    stats.inserted += 1
    logger.info("  + AP Cristina creada: %s @ %s", vendor.name, CRISTINA_VIGENTE)
    return stats


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

async def main(args: argparse.Namespace) -> int:
    mode = "COMMIT (persiste)" if args.commit else "DRY-RUN (rollback)"
    logger.info("=== apply_stabilization_data_corrections — %s ===", mode)

    plan_path = Path(args.plan_path)
    entries = parse_migration_plan(plan_path)
    logger.info("Plan parseado: %s → %d INSERTs", plan_path.name, len(entries))

    async with AsyncSessionLocal() as db:
        logger.info("\n[1/2] Bank migration plan (bank_fee + financial_income)")
        bank_stats = await apply_bank_migration(db, entries)
        logger.info(
            "  → inserted: %d | skipped (ya existían): %d | errors: %d",
            bank_stats.inserted, bank_stats.skipped_existing, len(bank_stats.errors),
        )
        for err in bank_stats.errors:
            logger.warning("    ERROR: %s", err)

        logger.info("\n[2/2] AP Cristina Rios $19M vigente")
        cristina_stats = await ensure_cristina_ap(db)
        logger.info(
            "  → inserted/updated: %d | skipped: %d",
            cristina_stats.inserted, cristina_stats.skipped_existing,
        )

        if args.commit:
            await db.commit()
            logger.info("\n=== COMMIT — cambios persistidos ===")
        else:
            await db.rollback()
            logger.info("\n=== DRY-RUN — rollback, re-ejecuta con --commit ===")

    logger.info("\nFases NO aplicadas (decisión owner pendiente — ver deploy-checklist.md §4.5):")
    logger.info("  - 20 owner_drawings YANBAL/ESIKA/TEMU (clasificación 1-a-1)")
    logger.info("  - Nequi $20M → $10 5-ene-2026 (clarificar con Consuelo)")
    logger.info("  - Equity correctivo $21.6M (bloqueado por audit Q2)")
    logger.info("  - Reclasificación masiva personal/negocio (~60 tx 1-a-1)")

    total_errors = len(bank_stats.errors)
    return 0 if total_errors == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--plan-path", default=str(DEFAULT_PLAN),
        help="Path al bank-migration-plan markdown.",
    )
    parser.add_argument("--commit", action="store_true", help="Persiste cambios.")
    parsed = parser.parse_args()
    sys.exit(asyncio.run(main(parsed)))
