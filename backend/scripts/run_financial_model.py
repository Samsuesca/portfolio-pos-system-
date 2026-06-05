"""
Ejecuta los servicios financieros del backend UCR contra la DB dev (uniformes_db)
y produce un reporte JSON consolidado del estado del modelo financiero ACTUAL.

Bypass auth: instancia los servicios directamente sin pasar por FastAPI dependencies.
"""
import asyncio
import json
import sys
from datetime import date
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, "/var/www/uniformes-system-v2/backend")
# Cuando se ejecute en el container del backend la ruta es distinta:
import os
if os.path.exists("/app"):
    sys.path.insert(0, "/app")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.services.patrimony import PatrimonyService
from app.services.financial_statements import FinancialStatementsService


def _decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError(f"Type not serializable: {type(obj)}")


async def main():
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://uniformes_user:dev_password@uniformes-postgres:5432/uniformes_db"
    )
    engine = create_async_engine(db_url, echo=False)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with AsyncSessionLocal() as db:
        report = {}

        # 1. Patrimony summary
        try:
            pat_service = PatrimonyService(db)
            patrimony = await pat_service.get_global_patrimony_summary()
            report["patrimony"] = patrimony
        except Exception as e:
            report["patrimony_error"] = f"{type(e).__name__}: {e}"

        # 2. Income Statement (P&L) for current year
        try:
            fs_service = FinancialStatementsService(db)
            income = await fs_service.get_income_statement(
                start_date=date(2026, 1, 1),
                end_date=date.today(),
            )
            report["income_statement_2026_ytd"] = income
        except Exception as e:
            report["income_statement_error"] = f"{type(e).__name__}: {e}"

        # 3. Balance Sheet
        try:
            balance = await fs_service.get_balance_sheet()
            report["balance_sheet"] = balance
        except Exception as e:
            report["balance_sheet_error"] = f"{type(e).__name__}: {e}"

        print(json.dumps(report, default=_decimal_default, indent=2, ensure_ascii=False))

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
