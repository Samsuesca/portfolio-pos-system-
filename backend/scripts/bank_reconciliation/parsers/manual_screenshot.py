"""Parser para transcripción manual de screenshots (Bancolombia abr-may, etc.).

Cuando Bancolombia no genera extracto mensual (solo trimestral), el owner
transcribe los movimientos visibles en la app/web del banco a un CSV.

Formato esperado del CSV (encabezado obligatorio):
    date,description,amount,running_balance
    2026-04-01,IMPTO GOBIERNO 4X1000,-1234.56,9000000.00
    2026-04-02,PAGO QR JUAN PEREZ,150000.00,9150000.00

Reglas:
    - `date` ISO YYYY-MM-DD
    - `description` libre (la categorización se hace al cargar)
    - `amount` signed: positivo abono, negativo cargo. Sin símbolo $.
    - `running_balance` opcional pero recomendado para validar consistencia

El parser deriva el periodo del archivo: min(date) → max(date).
opening_balance y closing_balance se infieren del primer/último running_balance
si están; en caso contrario quedan en 0 y se reportan como gap a llenar manualmente.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path


@dataclass
class ManualHeader:
    period_start: date
    period_end: date
    account_number: str
    holder_name: str
    opening_balance: Decimal
    closing_balance: Decimal
    total_credits: Decimal
    total_debits: Decimal


@dataclass
class ManualTransaction:
    transaction_date: date
    raw_description: str
    amount: Decimal
    running_balance: Decimal | None


@dataclass
class ManualStatement:
    header: ManualHeader
    transactions: list[ManualTransaction]


def parse(
    csv_path: str | Path,
    *,
    account_number: str = "",
    holder_name: str = "",
) -> ManualStatement:
    csv_path = Path(csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV no existe: {csv_path}")

    transactions: list[ManualTransaction] = []
    with csv_path.open("r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        required = {"date", "description", "amount"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(
                f"CSV {csv_path.name} le faltan columnas: {missing}. "
                f"Encabezado requerido: date,description,amount[,running_balance]"
            )
        for i, row in enumerate(reader, start=2):
            try:
                txn_date = date.fromisoformat(row["date"].strip())
                amount = Decimal(row["amount"].strip())
                rb_raw = row.get("running_balance", "").strip()
                running_balance = Decimal(rb_raw) if rb_raw else None
            except Exception as e:
                raise ValueError(
                    f"CSV {csv_path.name}:{i} fila inválida: {e}"
                ) from e
            transactions.append(ManualTransaction(
                transaction_date=txn_date,
                raw_description=row["description"].strip(),
                amount=amount,
                running_balance=running_balance,
            ))

    if not transactions:
        raise ValueError(f"CSV {csv_path.name} no tiene filas de datos")

    # Header inferido
    dates = [t.transaction_date for t in transactions]
    period_start = min(dates)
    period_end = max(dates)
    abonos = sum((t.amount for t in transactions if t.amount > 0), Decimal("0"))
    cargos = sum((-t.amount for t in transactions if t.amount < 0), Decimal("0"))

    opening = next(
        (t.running_balance - t.amount for t in transactions
         if t.running_balance is not None),
        Decimal("0"),
    )
    closing = transactions[-1].running_balance if transactions[-1].running_balance else opening + abonos - cargos

    header = ManualHeader(
        period_start=period_start,
        period_end=period_end,
        account_number=account_number,
        holder_name=holder_name,
        opening_balance=opening,
        closing_balance=closing,
        total_credits=abonos,
        total_debits=cargos,
    )

    return ManualStatement(header=header, transactions=transactions)
