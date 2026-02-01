"""
Script para migrar a contabilidad global.

Este script:
1. Crea las cuentas globales Caja y Banco (school_id = NULL)
2. Suma los balances de todas las cuentas por colegio a las cuentas globales
3. Desactiva las cuentas por colegio antiguas

Ejecutar:
    cd backend
    source venv/bin/activate
    python -m scripts.migrate_to_global_accounting
"""
import asyncio
import sys
from pathlib import Path
from decimal import Decimal

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.accounting import BalanceAccount, AccountType


async def migrate_to_global_accounting():
    """Migrate from per-school accounts to global accounts"""

    print("\n" + "="*60)
    print("MIGRACIÓN A CONTABILIDAD GLOBAL")
    print("="*60)
    print("\nEste script:")
    print("  1. Crea cuentas globales Caja y Banco (school_id = NULL)")
    print("  2. Suma balances de cuentas por colegio a las globales")
    print("  3. Desactiva cuentas por colegio antiguas")
    print("\n" + "="*60)

    confirm = input("\n¿Continuar? (s/n): ")
    if confirm.lower() != "s":
        print("\n❌ Operación cancelada.")
        return

    async with AsyncSessionLocal() as db:
        try:
            print("\n🔄 Iniciando migración...")

            # 1. Check for existing global accounts
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code.in_(["1101", "1102"])
                )
            )
            existing_global = result.scalars().all()

            if existing_global:
                print(f"  ⚠️ Ya existen {len(existing_global)} cuentas globales")
                for acc in existing_global:
                    print(f"     - {acc.name} (code={acc.code}): ${acc.balance}")

            # 2. Get all school-specific Caja accounts (code=1101)
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.isnot(None),
                    BalanceAccount.code == "1101",
                    BalanceAccount.is_active == True
                )
            )
            school_cajas = result.scalars().all()

            total_caja = Decimal("0")
            for caja in school_cajas:
                total_caja += caja.balance
                print(f"  📦 Caja {caja.school_id}: ${caja.balance}")

            # 3. Get all school-specific Banco accounts (code=1102)
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.isnot(None),
                    BalanceAccount.code == "1102",
                    BalanceAccount.is_active == True
                )
            )
            school_bancos = result.scalars().all()

            total_banco = Decimal("0")
            for banco in school_bancos:
                total_banco += banco.balance
                print(f"  🏦 Banco {banco.school_id}: ${banco.balance}")

            print(f"\n  📊 Total Caja a migrar: ${total_caja}")
            print(f"  📊 Total Banco a migrar: ${total_banco}")

            # 4. Create or update global Caja
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code == "1101"
                )
            )
            global_caja = result.scalar_one_or_none()

            if global_caja:
                global_caja.balance += total_caja
                print(f"\n  ✓ Actualizada Caja Global: ${global_caja.balance}")
            else:
                global_caja = BalanceAccount(
                    school_id=None,
                    account_type=AccountType.ASSET_CURRENT,
                    name="Caja General",
                    code="1101",
                    description="Efectivo en caja (global del negocio)",
                    balance=total_caja,
                    is_active=True
                )
                db.add(global_caja)
                print(f"\n  ✓ Creada Caja Global: ${total_caja}")

            # 5. Create or update global Banco
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code == "1102"
                )
            )
            global_banco = result.scalar_one_or_none()

            if global_banco:
                global_banco.balance += total_banco
                print(f"  ✓ Actualizado Banco Global: ${global_banco.balance}")
            else:
                global_banco = BalanceAccount(
                    school_id=None,
                    account_type=AccountType.ASSET_CURRENT,
                    name="Banco General",
                    code="1102",
                    description="Cuentas bancarias (global del negocio)",
                    balance=total_banco,
                    is_active=True
                )
                db.add(global_banco)
                print(f"  ✓ Creado Banco Global: ${total_banco}")

            # 6. Deactivate school-specific accounts
            deactivated = 0
            for acc in school_cajas + school_bancos:
                acc.is_active = False
                acc.name = f"[MIGRADO] {acc.name}"
                deactivated += 1

            print(f"\n  ✓ Cuentas por colegio desactivadas: {deactivated}")

            await db.commit()

            print("\n" + "="*60)
            print("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE")
            print("="*60)
            print("\nResumen:")
            print(f"  - Caja Global: ${global_caja.balance}")
            print(f"  - Banco Global: ${global_banco.balance}")
            print(f"  - Total Líquido: ${global_caja.balance + global_banco.balance}")
            print(f"  - Cuentas migradas: {deactivated}")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error: {e}")
            raise


async def create_global_accounts_only():
    """Only create global accounts without migrating existing data"""

    print("\n" + "="*60)
    print("CREAR CUENTAS GLOBALES")
    print("="*60)

    async with AsyncSessionLocal() as db:
        try:
            # Create global Caja
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code == "1101"
                )
            )
            if not result.scalar_one_or_none():
                caja = BalanceAccount(
                    school_id=None,
                    account_type=AccountType.ASSET_CURRENT,
                    name="Caja General",
                    code="1101",
                    description="Efectivo en caja (global del negocio)",
                    balance=Decimal("0"),
                    is_active=True
                )
                db.add(caja)
                print("  ✓ Caja Global creada")
            else:
                print("  - Caja Global ya existe")

            # Create global Banco
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code == "1102"
                )
            )
            if not result.scalar_one_or_none():
                banco = BalanceAccount(
                    school_id=None,
                    account_type=AccountType.ASSET_CURRENT,
                    name="Banco General",
                    code="1102",
                    description="Cuentas bancarias (global del negocio)",
                    balance=Decimal("0"),
                    is_active=True
                )
                db.add(banco)
                print("  ✓ Banco Global creado")
            else:
                print("  - Banco Global ya existe")

            await db.commit()
            print("\n✅ Cuentas globales listas")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error: {e}")
            raise


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--create-only":
        asyncio.run(create_global_accounts_only())
    else:
        asyncio.run(migrate_to_global_accounting())
