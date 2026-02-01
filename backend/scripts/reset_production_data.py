"""
Script para limpiar datos de prueba en producción.

ADVERTENCIA: Este script elimina TODOS los datos de:
- Ventas (sales, sale_items, sale_changes)
- Encargos (orders, order_items)
- Clientes (clients)
- Transacciones relacionadas
- Pone stock de productos en 0

Ejecutar:
    cd backend
    source venv/bin/activate
    python -m scripts.reset_production_data
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.db.session import AsyncSessionLocal


async def reset_production_data():
    """Reset all test data from production"""

    print("\n" + "="*60)
    print("⚠️  ADVERTENCIA: Este script eliminará TODOS los datos de prueba")
    print("="*60)
    print("\nDatos a eliminar:")
    print("  - Todas las ventas (sales, sale_items, sale_changes)")
    print("  - Todos los encargos (orders, order_items)")
    print("  - Todos los clientes (clients)")
    print("  - Todas las transacciones (transactions)")
    print("  - Todas las cuentas por cobrar/pagar")
    print("  - Stock de productos → 0")
    print("  - Entradas de balance (balance_entries)")
    print("\n" + "="*60)

    confirm = input("\n¿Estás seguro? Escribe 'SI ELIMINAR' para confirmar: ")

    if confirm != "SI ELIMINAR":
        print("\n❌ Operación cancelada.")
        return

    async with AsyncSessionLocal() as db:
        try:
            print("\n🔄 Iniciando limpieza de datos...")

            # 1. Delete sale_changes first (depends on sale_items)
            result = await db.execute(text("DELETE FROM sale_changes"))
            print(f"  ✓ sale_changes eliminados: {result.rowcount}")

            # 2. Delete sale_items
            result = await db.execute(text("DELETE FROM sale_items"))
            print(f"  ✓ sale_items eliminados: {result.rowcount}")

            # 3. Delete sales
            result = await db.execute(text("DELETE FROM sales"))
            print(f"  ✓ sales eliminadas: {result.rowcount}")

            # 4. Delete order_items first
            result = await db.execute(text("DELETE FROM order_items"))
            print(f"  ✓ order_items eliminados: {result.rowcount}")

            # 5. Delete orders
            result = await db.execute(text("DELETE FROM orders"))
            print(f"  ✓ orders eliminados: {result.rowcount}")

            # 6. Delete transactions
            result = await db.execute(text("DELETE FROM transactions"))
            print(f"  ✓ transactions eliminadas: {result.rowcount}")

            # 7. Delete balance_entries
            result = await db.execute(text("DELETE FROM balance_entries"))
            print(f"  ✓ balance_entries eliminados: {result.rowcount}")

            # 8. Reset balance_accounts to 0
            result = await db.execute(text("UPDATE balance_accounts SET balance = 0"))
            print(f"  ✓ balance_accounts reseteados: {result.rowcount}")

            # 9. Delete accounts_receivable
            result = await db.execute(text("DELETE FROM accounts_receivable"))
            print(f"  ✓ accounts_receivable eliminados: {result.rowcount}")

            # 10. Delete accounts_payable
            result = await db.execute(text("DELETE FROM accounts_payable"))
            print(f"  ✓ accounts_payable eliminados: {result.rowcount}")

            # 11. Delete expenses
            result = await db.execute(text("DELETE FROM expenses"))
            print(f"  ✓ expenses eliminados: {result.rowcount}")

            # 12. Delete clients
            result = await db.execute(text("DELETE FROM clients"))
            print(f"  ✓ clients eliminados: {result.rowcount}")

            # 13. Reset all inventory to 0
            result = await db.execute(text("UPDATE inventory SET quantity = 0"))
            print(f"  ✓ inventory reseteado a 0: {result.rowcount} registros")

            # 14. Reset global_inventory to 0 (if exists)
            try:
                result = await db.execute(text("UPDATE global_inventory SET quantity = 0"))
                print(f"  ✓ global_inventory reseteado a 0: {result.rowcount} registros")
            except Exception:
                print("  - global_inventory no existe o está vacío")

            await db.commit()

            print("\n" + "="*60)
            print("✅ LIMPIEZA COMPLETADA EXITOSAMENTE")
            print("="*60)
            print("\nEl sistema está listo para datos reales.")
            print("Recuerda:")
            print("  1. Agregar stock a los productos")
            print("  2. Crear clientes reales")
            print("  3. Las cuentas Caja y Banco están en $0")

        except Exception as e:
            await db.rollback()
            print(f"\n❌ Error: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(reset_production_data())
