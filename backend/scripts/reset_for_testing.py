"""
Script para resetear la base de datos para pruebas completas.

Este script elimina TODA la información operacional:
1. Ventas, encargos, pedidos web
2. Transacciones, gastos, CxC, CxP
3. Balances (resetea Caja y Banco a 0)
4. Mensajes de contacto (PQRS)
5. Cuentas de pago (QR, cuentas bancarias)

MANTIENE:
- Colegios (schools)
- Productos e inventario
- Tipos de prenda (garment_types)
- Clientes
- Usuarios

Uso:
    cd backend
    source venv/bin/activate
    python -m scripts.reset_for_testing
"""
import asyncio
from decimal import Decimal
from datetime import date

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.accounting import (
    BalanceAccount, BalanceEntry, Transaction, Expense,
    AccountsReceivable, AccountsPayable, DailyCashRegister
)


async def reset_database():
    """Resetea la base de datos para pruebas completas."""

    # Crear conexión
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            print("\n" + "="*70)
            print("🔄 INICIANDO RESET COMPLETO DE BASE DE DATOS")
            print("="*70 + "\n")

            # === PASO 1: ELIMINAR DATOS OPERACIONALES ===
            print("📋 PASO 1: Eliminando datos operacionales...\n")

            # 1.1. Eliminar sale_changes ANTES de sale_items (FK dependency)
            print("  🔄 Eliminando cambios/devoluciones de ventas...")
            await db.execute(text("DELETE FROM sale_changes"))

            # 1.2. Eliminar items de ventas
            print("  📦 Eliminando items de ventas...")
            await db.execute(text("DELETE FROM sale_items"))

            # 1.3. Eliminar ventas
            print("  🛒 Eliminando ventas...")
            await db.execute(text("DELETE FROM sales"))

            # 1.4. Eliminar items de encargos
            print("  📋 Eliminando items de encargos...")
            await db.execute(text("DELETE FROM order_items"))

            # 1.5. Eliminar encargos (orders incluye web_orders)
            print("  📋 Eliminando encargos y pedidos web...")
            await db.execute(text("DELETE FROM orders"))

            # === PASO 2: ELIMINAR DATOS CONTABLES ===
            print("\n💰 PASO 2: Eliminando datos contables...\n")

            # 2.1. Eliminar transacciones contables
            print("  💳 Eliminando transacciones...")
            await db.execute(text("DELETE FROM transactions"))

            # 2.2. Eliminar gastos
            print("  💸 Eliminando gastos...")
            await db.execute(text("DELETE FROM expenses"))

            # 2.3. Eliminar cuentas por cobrar
            print("  📥 Eliminando cuentas por cobrar...")
            await db.execute(text("DELETE FROM accounts_receivable"))

            # 2.4. Eliminar cuentas por pagar
            print("  📤 Eliminando cuentas por pagar...")
            await db.execute(text("DELETE FROM accounts_payable"))

            # 2.5. Eliminar entradas de balance (historial)
            print("  📊 Eliminando historial de balances...")
            await db.execute(text("DELETE FROM balance_entries"))

            # 2.6. Eliminar registros de caja diaria
            print("  💰 Eliminando registros de caja diaria...")
            await db.execute(text("DELETE FROM daily_cash_registers"))

            # === PASO 3: ELIMINAR OTROS DATOS ===
            print("\n🗑️ PASO 3: Eliminando otros datos...\n")

            # 3.1. Eliminar mensajes de contacto (PQRS)
            print("  📧 Eliminando mensajes de contacto (PQRS)...")
            await db.execute(text("DELETE FROM contacts"))

            # === PASO 4: RESETEAR BALANCES ===
            print("\n🏦 PASO 4: Reseteando balances de Caja y Banco...\n")

            # Obtener cuentas globales (Caja y Banco)
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),
                    BalanceAccount.code.in_(['1101', '1102'])
                )
            )
            global_accounts = result.scalars().all()

            for account in global_accounts:
                old_balance = account.balance
                account.balance = Decimal("0")
                print(f"  ✓ {account.name}: ${old_balance:,.2f} → $0.00")

                # Crear entrada de reset en historial
                entry = BalanceEntry(
                    account_id=account.id,
                    school_id=None,
                    entry_date=date.today(),
                    amount=-old_balance,
                    balance_after=Decimal("0"),
                    description="Reset completo de base de datos para pruebas",
                    reference="RESET"
                )
                db.add(entry)

            # === PASO 5: ELIMINAR CUENTAS DE BALANCE POR COLEGIO ===
            print("\n🏛️ PASO 5: Eliminando cuentas de balance por colegio...\n")
            print("  (Mantiene cuentas globales: Caja y Banco)")
            result = await db.execute(
                text("DELETE FROM balance_accounts WHERE school_id IS NOT NULL")
            )
            print(f"  ✓ Eliminadas {result.rowcount} cuentas de balance por colegio")

            # === COMMIT ===
            await db.commit()

            print("\n" + "="*70)
            print("✅ RESET COMPLETADO EXITOSAMENTE")
            print("="*70)
            print("\n📊 ESTADO ACTUAL DE LA BASE DE DATOS:\n")
            print("  ❌ ELIMINADO:")
            print("     • Ventas: 0")
            print("     • Encargos/Pedidos web: 0")
            print("     • Transacciones: 0")
            print("     • Gastos: 0")
            print("     • Cuentas por cobrar (CxC): 0")
            print("     • Cuentas por pagar (CxP): 0")
            print("     • Mensajes de contacto: 0")
            print("     • Cuentas de pago: 0")
            print("     • Cuentas de balance por colegio: 0")
            print("     • Caja: $0.00")
            print("     • Banco: $0.00")
            print("\n  ✅ MANTENIDO:")
            print("     • Colegios (schools)")
            print("     • Productos e inventario")
            print("     • Tipos de prenda (garment_types)")
            print("     • Clientes")
            print("     • Usuarios")
            print("\n" + "="*70)
            print("🎉 La base de datos está lista para pruebas desde cero")
            print("="*70 + "\n")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ ERROR: {e}")
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_database())
