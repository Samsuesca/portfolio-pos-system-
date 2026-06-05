"""
Aplica el acta forense de encargos (GATE 0) a la base de datos.

Materializa las 25 decisiones firmadas en
``docs/v3/formalization/encargos-audit-2026-06-04.md`` creando filas en
``order_audit_overrides`` (y, para el grupo A, la caja real no registrada vía
``OrderAuditService``). NO toca ``orders.status`` público.

Idempotente: re-ejecutar no duplica (override por ``order_id`` UNIQUE; el grupo
A se materializa una sola vez). Verifica que ``orders.status`` no cambió.

Uso:
    venv/bin/python -m scripts.apply_encargos_audit            # dry-run (rollback)
    venv/bin/python -m scripts.apply_encargos_audit --commit   # persiste
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.order import Order, OrderStatus
from app.models.order_audit_override import OrderAuditOverride, OrderAuditDisposition
from app.models.user import User
from app.services.order_audit import OrderAuditService

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("encargos_audit")
for _noisy in ("sqlalchemy.engine", "sqlalchemy.engine.Engine", "sqlalchemy.pool"):
    _lg = logging.getLogger(_noisy)
    _lg.setLevel(logging.WARNING)
    _lg.propagate = False

D = OrderAuditDisposition
S = OrderStatus
FULL = "FULL"  # recognize_payment = saldo actual del encargo


@dataclass
class Decision:
    n: int
    code: str
    disposition: OrderAuditDisposition
    explanation: str
    real_status: OrderStatus | None = None
    real_balance: Decimal | None = None
    recognize: object | None = None  # FULL | Decimal | None
    notify_client: bool = False


# ── Acta firmada 2026-06-04 (25 casos) ───────────────────────────────────────
DECISIONS: list[Decision] = [
    # Grupo A — Pago retroactivo (+ entregado, sin notificar)
    Decision(1, "PINAL-001-ENC-2026-0058", D.PAYMENT_RETRO,
             "Santi Mazo: pago $10k no registrado; saldo calza. Entregado.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(5, "CARACAS-001-ENC-2026-0124", D.PAYMENT_RETRO,
             "Gustavo Aguirre: vendedora confirmó entrega y pago no registrados.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(6, "PINAL-001-ENC-2026-0048", D.PAYMENT_RETRO,
             "Danelys Verdugo: entregado, pago no registrado (owner aprobó A).",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(7, "PUMAREJO-001-ENC-2026-0036", D.PAYMENT_RETRO,
             "Laura Gallego: domicilio entregado por la vendedora, sí entró el dinero.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(11, "PINAL-001-ENC-2026-0040", D.PAYMENT_RETRO,
             "Wilmar Guevara: entregado, pago no registrado (owner aprobó A).",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(14, "PUMAREJO-001-ENC-2026-0025", D.PAYMENT_RETRO,
             "Orfa Cartagena: vendedora confirmó entrega y pago no registrados.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(15, "CARACAS-001-ENC-2026-0106", D.PAYMENT_RETRO,
             "Adriana Giraldo: llevó y pagó todo; faltó registrar pago y entrega.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(18, "CARACAS-001-ENC-2026-0094", D.PAYMENT_RETRO,
             "Luz Mary: confirmó entrega y pago; no se registró ninguno.",
             real_status=S.DELIVERED, recognize=FULL),
    Decision(3, "CARACAS-001-ENC-2026-0128", D.PAYMENT_RETRO,
             "Cristina Giraldo: jomber (prepago obligatorio) → pagó. NO es la del préstamo $19M.",
             real_status=S.DELIVERED, recognize=FULL),
    # Grupo A híbrido — caso 17 Jennifer: reconocer las 3 prendas entregadas, cancelar el jean
    Decision(17, "CARACAS-001-ENC-2026-0096", D.PAYMENT_RETRO,
             "Jennifer Ibarguen: pagó+recibió 3 prendas ($48k no registrado); jean $48k NO lo llevó "
             "→ saldo real $0 (jean cancelado).",
             real_status=S.DELIVERED, real_balance=Decimal("0"), recognize=Decimal("48000")),

    # Grupo E — Saldos fantasma por cambio (ya cobrados en la venta original)
    Decision(19, "CARACAS-001-ENC-2026-0093", D.PHANTOM_EXCHANGE,
             "Cambio de talla de VNT-2026-0673 (pagada $47k). Saldo $48k fantasma.",
             real_balance=Decimal("0")),
    Decision(22, "CARACAS-001-ENC-2026-0072", D.PHANTOM_EXCHANGE,
             "Cambio de talla de VNT-2026-0688 (pagada $88k). Saldo $45k fantasma (ya entregado).",
             real_balance=Decimal("0")),
    Decision(20, "CARACAS-001-ENC-2026-0091", D.PHANTOM_EXCHANGE,
             "Cambio Caracas→Felix Henao (FELIX-001-ENC-2026-0003 pagado+entregado). Saldo $42k fantasma.",
             real_balance=Decimal("0")),

    # Grupo D — Cancelado (cliente no llevó; sin ingreso)
    Decision(23, "PUMAREJO-001-ENC-2026-0015", D.CANCELLED,
             "Carolina Loaiza: no necesitó el encargo, no lo llevó. Cancelar, sin ingreso.",
             real_status=S.CANCELLED, real_balance=Decimal("0")),

    # Grupo C — Castigo centavos
    Decision(12, "PINAL-001-ENC-2026-0039", D.WRITE_OFF,
             "Luis Manuel Robledo: saldo $1k, castigar como pérdida operativa.",
             real_balance=Decimal("0")),
    Decision(21, "CARACAS-001-ENC-2026-0078", D.WRITE_OFF,
             "Karenny Castillo: saldo $1k, sin AR (no hay CxC). Limpiar.",
             real_balance=Decimal("0")),

    # Grupo B — CxC real / layaway (informativo; sin mover plata)
    Decision(2, "CARACAS-001-ENC-2026-0131", D.LEGIT_RECEIVABLE,
             "JUCUM $303k: CxC real (owner). Mantener cobrable; actualizar plan de pago."),
    Decision(13, "CARACAS-001-ENC-2026-0118", D.LEGIT_RECEIVABLE,
             "JUCUM $848k: CxC real (owner). Entregado a crédito; mantener cobrable."),
    Decision(4, "PUMAREJO-001-ENC-2026-0042", D.LEGIT_RECEIVABLE,
             "Camila Hernández $66k: CxC real (1 Chompa). El $346k de ENC-0038 se reembolsó (resuelto)."),
    Decision(8, "PINAL-001-ENC-2026-0057", D.LEGIT_RECEIVABLE,
             "Yuliza Tabares $58k: CxC (Tipo H). Limpiar pago espurio de $1 (BUG-ENC-02)."),
    Decision(9, "CARACAS-001-ENC-2026-0121", D.LEGIT_RECEIVABLE,
             "Dahiana Rodriguez $137k: CxC real (owner); domicilio por Angelo, pago no aclarado."),
    Decision(10, "PINAL-001-ENC-2026-0042", D.LEGIT_RECEIVABLE,
             "Alejandra Ferraro $42k: CxC real; abono parcial, 'dice que viene'."),
    Decision(16, "CARACAS-001-ENC-2026-0099", D.LEGIT_RECEIVABLE,
             "Dayana Mosquera $14k: CxC real; abono parcial, sin entregar."),
    Decision(24, "CONFAMA-001-ENC-2026-0018", D.LEGIT_RECEIVABLE,
             "Geraldine Ramirez $47k: layaway activo (par con 0007); pagó $150k, lleva 2/5."),
    Decision(25, "CONFAMA-001-ENC-2026-0007", D.LEGIT_RECEIVABLE,
             "Geraldine Ramirez $39k: layaway activo (par con 0018)."),
]


def _recognition_date(order: Order):
    """Fecha de reconocimiento = cuándo realmente ocurrió (periodo correcto)."""
    if order.delivered_at:
        return order.delivered_at.date()
    return order.order_date.date()


async def _get_auditor_id(db: AsyncSession):
    result = await db.execute(
        select(User.id).where(User.is_superuser.is_(True)).limit(1)
    )
    return result.scalar_one_or_none()


async def main(args: argparse.Namespace) -> int:
    mode = "COMMIT (persiste)" if args.commit else "DRY-RUN (rollback)"
    logger.info(f"\n{'='*70}\nAplicar acta de encargos — {mode}\n{'='*70}")

    assert len({d.code for d in DECISIONS}) == len(DECISIONS), "códigos duplicados"
    assert len(DECISIONS) == 25, f"se esperaban 25 decisiones, hay {len(DECISIONS)}"

    applied = skipped = errors = 0
    cash_recognized = Decimal("0")
    by_disp: dict[str, int] = {}

    async with AsyncSessionLocal() as db:
        auditor_id = await _get_auditor_id(db)
        service = OrderAuditService(db)

        # Snapshot de orders.status ANTES (para verificar que no cambió)
        codes = [d.code for d in DECISIONS]
        rows = (await db.execute(
            select(Order.code, Order.status).where(Order.code.in_(codes))
        )).all()
        status_before = {c: s for c, s in rows}

        for d in DECISIONS:
            order = (await db.execute(
                select(Order).where(Order.code == d.code)
            )).scalar_one_or_none()
            if order is None:
                logger.warning(f"  [!] {d.n:>2} {d.code}: NO EXISTE — saltado")
                errors += 1
                continue

            existing = await service.get_by_order(order.id)
            if existing:
                logger.info(f"  [=] {d.n:>2} {d.code}: ya tiene override ({existing.disposition.value}) — idempotente")
                skipped += 1
                continue

            recognize = None
            if d.recognize == FULL:
                recognize = order.balance
            elif isinstance(d.recognize, Decimal):
                recognize = d.recognize

            await service.apply_override(
                order,
                disposition=d.disposition,
                audit_explanation=d.explanation,
                real_status=d.real_status,
                real_balance=d.real_balance,
                recognize_payment=recognize,
                recognition_date=_recognition_date(order),
                notify_client=d.notify_client,
                auditor_user_id=auditor_id,
            )
            applied += 1
            by_disp[d.disposition.value] = by_disp.get(d.disposition.value, 0) + 1
            if recognize:
                cash_recognized += recognize
            tag = f"reconoce ${int(recognize):,}" if recognize else "—"
            logger.info(f"  [+] {d.n:>2} {d.code}: {d.disposition.value:<17} {tag}")

        # Verificación: orders.status NO cambió
        rows_after = (await db.execute(
            select(Order.code, Order.status).where(Order.code.in_(codes))
        )).all()
        status_after = {c: s for c, s in rows_after}
        changed = [c for c in status_before if status_before[c] != status_after.get(c)]

        logger.info(f"\n{'─'*70}")
        logger.info(f"Aplicados: {applied} · Idempotentes (ya estaban): {skipped} · Errores: {errors}")
        logger.info(f"Por disposición: {by_disp}")
        logger.info(f"Caja reconocida (grupo A): ${int(cash_recognized):,}")
        if changed:
            logger.error(f"  [X] orders.status CAMBIÓ en: {changed} — ABORTAR")
            await db.rollback()
            return 1
        logger.info("  [OK] orders.status público intacto en los 25 encargos")

        total_ov = (await db.execute(select(OrderAuditOverride))).scalars().all()
        logger.info(f"Total overrides en DB tras esta corrida: {len(total_ov)}")

        if args.commit:
            await db.commit()
            logger.info("\n=== COMMIT aplicado ===")
        else:
            await db.rollback()
            logger.info("\n=== DRY-RUN — rollback. Re-ejecuta con --commit para persistir ===")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--commit", action="store_true", help="Persiste los cambios.")
    sys.exit(asyncio.run(main(parser.parse_args())))
