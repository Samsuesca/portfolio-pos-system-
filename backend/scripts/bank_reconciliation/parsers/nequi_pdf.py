"""Parser para extractos Nequi (PDF protegido con password).

Workflow:
    1. pdftotext -layout -upw <password> input.pdf - → texto
    2. regex sobre líneas para extraer transacciones
    3. parse header por keyword search

Estructura observada (verificada en marzo2026.pdf):
    Encabezado:
        CARMEN CONSUELO RIOS CARTAGENA
        Número de cuenta de ahorro: 3001234567
        Estado de cuenta para el período de: 2026/03/01 a 2026/03/31

    Resumen:
        Saldo anterior  $X.XX  | Saldo promedio  $Y.YY
        Total abonos    $X.XX  | Cuentas por cobrar  $Y.YY
        Total cargos    $X.XX  | Valor de intereses pagados $Y.YY
        Saldo actual    $X.XX  | Retefuente $Y.YY

    Movimientos (líneas con layout preservado):
              30/03/2026   De LUIS DAIRO AGUALIMPIA     $91,000.00    $364,789.88

Particularidades:
    - Valor siempre con prefijo $, negativos con $- (ej '$-60.00')
    - Cantidad de espacios variable — necesitamos regex flexibles
    - Headers de columnas se repiten cada página → filtrar
    - El password se pasa al pdftotext, NO se loguea
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


@dataclass
class NequiHeader:
    period_start: date
    period_end: date
    account_number: str
    holder_name: str
    opening_balance: Decimal
    closing_balance: Decimal
    total_credits: Decimal
    total_debits: Decimal
    interest_paid: Decimal


@dataclass
class NequiTransaction:
    transaction_date: date
    raw_description: str
    amount: Decimal
    running_balance: Decimal | None


@dataclass
class NequiStatement:
    header: NequiHeader
    transactions: list[NequiTransaction]


# Regex para línea de transacción. Layout preservado por pdftotext:
#       30/03/2026          De LUIS DAIRO AGUALIMPIA                      $91,000.00    $364,789.88
# Pueden venir con espacios variables.
_TXN_LINE_RE = re.compile(
    r"""
    ^\s*
    (?P<date>\d{2}/\d{2}/\d{4})
    \s+
    (?P<desc>.+?)
    \s+
    \$(?P<amount>-?[\d,]+\.\d{2})
    \s+
    \$(?P<balance>-?[\d,]+\.\d{2})
    \s*$
    """,
    re.VERBOSE,
)

_PERIOD_RE = re.compile(
    r"Estado de cuenta para el período de:\s*(\d{4}/\d{2}/\d{2})\s*a\s*(\d{4}/\d{2}/\d{2})"
)

_ACCOUNT_RE = re.compile(r"Número de cuenta de ahorro:\s*(\d+)")

# Patrones de resumen — todos en una línea con $monto
_SUMMARY_PATTERNS = {
    "opening_balance": re.compile(r"Saldo anterior\s+\$([\d,]+\.\d{2})"),
    "closing_balance": re.compile(r"Saldo actual\s+\$([\d,]+\.\d{2})"),
    "total_credits": re.compile(r"Total abonos\s+\$([\d,]+\.\d{2})"),
    "total_debits": re.compile(r"Total cargos\s+\$([\d,]+\.\d{2})"),
    "interest_paid": re.compile(r"Valor de intereses pagados\s+\$([\d,]+\.\d{2})"),
}


def _parse_decimal_str(s: str) -> Decimal:
    """'-15,000.00' → -15000.00; '91,000.00' → 91000.00."""
    return Decimal(s.replace(",", ""))


def _extract_text(pdf_path: Path, password: str) -> str:
    """Llama pdftotext -layout con password. Stdout es el texto."""
    result = subprocess.run(
        ["pdftotext", "-layout", "-upw", password, str(pdf_path), "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        # NO incluir el password en el mensaje de error
        raise RuntimeError(
            f"pdftotext falló para {pdf_path.name} (exit {result.returncode}). "
            f"Verificá password o si el archivo no está corrupto. stderr: {result.stderr[:200]}"
        )
    return result.stdout


def _parse_header(text: str) -> NequiHeader:
    """Extrae header desde el texto extraído del PDF."""
    period_m = _PERIOD_RE.search(text)
    if not period_m:
        raise ValueError("No se encontró el periodo del extracto Nequi")
    period_start = datetime.strptime(period_m.group(1), "%Y/%m/%d").date()
    period_end = datetime.strptime(period_m.group(2), "%Y/%m/%d").date()

    acc_m = _ACCOUNT_RE.search(text)
    account_number = acc_m.group(1) if acc_m else ""

    # Holder name: línea entre "Extracto de cuenta..." y "Número de cuenta"
    # Heurística: primera línea CAPS con palabras
    holder_name = ""
    for line in text.splitlines():
        s = line.strip()
        if s and s.isupper() and len(s.split()) >= 2 and not s.startswith("$"):
            holder_name = s
            break

    summary: dict[str, Decimal] = {}
    for key, pattern in _SUMMARY_PATTERNS.items():
        m = pattern.search(text)
        summary[key] = _parse_decimal_str(m.group(1)) if m else Decimal("0")

    return NequiHeader(
        period_start=period_start,
        period_end=period_end,
        account_number=account_number,
        holder_name=holder_name,
        opening_balance=summary["opening_balance"],
        closing_balance=summary["closing_balance"],
        total_credits=summary["total_credits"],
        total_debits=summary["total_debits"],
        interest_paid=summary["interest_paid"],
    )


def _parse_transactions(text: str) -> list[NequiTransaction]:
    """Extrae líneas de movimientos."""
    transactions: list[NequiTransaction] = []
    for line in text.splitlines():
        m = _TXN_LINE_RE.match(line)
        if not m:
            continue
        try:
            txn_date = datetime.strptime(m.group("date"), "%d/%m/%Y").date()
        except ValueError:
            continue
        # Skip lo que parezca header de columna repetido por página
        # (improbable que matchee el regex pero defensive)
        desc = m.group("desc").strip()
        if desc.lower() in ("descripción", "descripcion"):
            continue
        try:
            amount = _parse_decimal_str(m.group("amount"))
            balance = _parse_decimal_str(m.group("balance"))
        except Exception:
            continue
        transactions.append(NequiTransaction(
            transaction_date=txn_date,
            raw_description=desc,
            amount=amount,
            running_balance=balance,
        ))
    return transactions


def parse(pdf_path: str | Path, password: str) -> NequiStatement:
    """Parsea un PDF Nequi protegido. El password NO se loguea."""
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF no existe: {pdf_path}")

    text = _extract_text(pdf_path, password)
    header = _parse_header(text)
    transactions = _parse_transactions(text)
    return NequiStatement(header=header, transactions=transactions)
