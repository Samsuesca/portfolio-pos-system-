"""
Script para crear cuentas default (Caja, Banco) para todos los colegios existentes.

Ejecutar después de aplicar la migración de balance integration:
    cd backend
    source venv/bin/activate
    python -m scripts.create_default_accounts
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from decimal import Decimal

from app.db.session import AsyncSessionLocal
from app.models.school import School
from app.models.accounting import BalanceAccount, AccountType


async def create_default_accounts_for_all_schools():
    """Create Caja and Banco accounts for all active schools"""

    async with AsyncSessionLocal() as db:
        try:
            # Get all active schools
            result = await db.execute(
                select(School).where(School.is_active == True)
            )
            schools = result.scalars().all()

            if not schools:
                print("No schools found in database")
                return

            print(f"Found {len(schools)} active schools")

            created_count = 0
            updated_count = 0

            for school in schools:
                print(f"\nProcessing: {school.name} ({school.code})")

                accounts_created = []

                # Check/create Caja account
                caja_result = await db.execute(
                    select(BalanceAccount).where(
                        BalanceAccount.school_id == school.id,
                        BalanceAccount.code == "1101"
                    )
                )
                caja = caja_result.scalar_one_or_none()

                if not caja:
                    caja = BalanceAccount(
                        school_id=school.id,
                        account_type=AccountType.ASSET_CURRENT,
                        name="Caja",
                        code="1101",
                        description="Efectivo en caja",
                        balance=Decimal("0"),
                        is_active=True
                    )
                    db.add(caja)
                    await db.flush()
                    accounts_created.append("Caja")
                    print(f"  + Created Caja account (ID: {caja.id})")
                else:
                    print(f"  - Caja already exists (ID: {caja.id})")

                # Check/create Banco account
                banco_result = await db.execute(
                    select(BalanceAccount).where(
                        BalanceAccount.school_id == school.id,
                        BalanceAccount.code == "1102"
                    )
                )
                banco = banco_result.scalar_one_or_none()

                if not banco:
                    banco = BalanceAccount(
                        school_id=school.id,
                        account_type=AccountType.ASSET_CURRENT,
                        name="Banco",
                        code="1102",
                        description="Cuentas bancarias",
                        balance=Decimal("0"),
                        is_active=True
                    )
                    db.add(banco)
                    await db.flush()
                    accounts_created.append("Banco")
                    print(f"  + Created Banco account (ID: {banco.id})")
                else:
                    print(f"  - Banco already exists (ID: {banco.id})")

                # Update school settings with account mapping
                settings = school.settings or {}
                settings["payment_account_mapping"] = {
                    "caja": str(caja.id),
                    "banco": str(banco.id)
                }
                settings["default_cash_account_id"] = str(caja.id)
                settings["default_bank_account_id"] = str(banco.id)
                school.settings = settings

                if accounts_created:
                    created_count += len(accounts_created)
                    print(f"  => Created: {', '.join(accounts_created)}")
                else:
                    updated_count += 1
                    print(f"  => Settings updated (no new accounts)")

            await db.commit()

            print(f"\n{'='*50}")
            print(f"Summary:")
            print(f"  - Schools processed: {len(schools)}")
            print(f"  - New accounts created: {created_count}")
            print(f"  - Schools with existing accounts: {updated_count}")
            print(f"{'='*50}")
            print("\nDone! Default accounts are ready.")

        except Exception as e:
            await db.rollback()
            print(f"\nError: {e}")
            raise


if __name__ == "__main__":
    print("Creating default balance accounts for all schools...")
    print("="*50)
    asyncio.run(create_default_accounts_for_all_schools())
