"""
Patrimony Service

Calcula el patrimonio del negocio:
- Activos = Caja + Banco + Inventario + Activos Fijos + Cuentas por Cobrar
- Pasivos = Cuentas por Pagar + Deudas
- Patrimonio = Activos - Pasivos

El inventario se valora como: cantidad × costo
Si no hay costo definido, se usa: precio × 0.80 (margen del 80%)
"""
from uuid import UUID
from decimal import Decimal
from datetime import date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    BalanceAccount,
    BalanceEntry,
    AccountType,
    AccountsReceivable,
    AccountsPayable
)
from app.models.product import Product, Inventory, GlobalProduct, GlobalInventory
from app.services.balance_integration import BalanceIntegrationService


# Margen de costo por defecto (80% del precio de venta)
DEFAULT_COST_MARGIN = Decimal("0.80")


class PatrimonyService:
    """
    Servicio para calcular y gestionar el patrimonio del negocio.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_inventory_valuation(self, school_id: UUID) -> dict:
        """
        Calcula el valor total del inventario.

        Usa el costo del producto si está definido, sino precio × 0.80

        Returns:
            {
                "total_units": int,
                "total_value": Decimal,
                "products_with_cost": int,
                "products_estimated": int,
                "breakdown": [
                    {
                        "product_code": str,
                        "product_name": str,
                        "quantity": int,
                        "cost": Decimal,
                        "is_estimated": bool,
                        "total_value": Decimal
                    }
                ]
            }
        """
        # Query products with inventory
        result = await self.db.execute(
            select(Product, Inventory)
            .join(Inventory, Product.id == Inventory.product_id)
            .where(
                Product.school_id == school_id,
                Product.is_active == True,
                Inventory.quantity > 0
            )
        )
        rows = result.all()

        total_units = 0
        total_value = Decimal("0")
        products_with_cost = 0
        products_estimated = 0
        breakdown = []

        for product, inventory in rows:
            quantity = inventory.quantity

            # Usar costo real o estimado (80% del precio)
            if product.cost is not None:
                cost = Decimal(str(product.cost))
                is_estimated = False
                products_with_cost += 1
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                is_estimated = True
                products_estimated += 1

            item_value = cost * quantity
            total_units += quantity
            total_value += item_value

            breakdown.append({
                "product_id": str(product.id),
                "product_code": product.code,
                "product_name": product.name or f"{product.code} - {product.size}",
                "quantity": quantity,
                "unit_cost": float(cost),
                "is_estimated": is_estimated,
                "total_value": float(item_value)
            })

        # Also calculate global products inventory (if any)
        global_result = await self.db.execute(
            select(GlobalProduct, GlobalInventory)
            .join(GlobalInventory, GlobalProduct.id == GlobalInventory.product_id)
            .where(
                GlobalProduct.is_active == True,
                GlobalInventory.quantity > 0
            )
        )
        global_rows = global_result.all()

        for product, inventory in global_rows:
            quantity = inventory.quantity

            if product.cost is not None:
                cost = Decimal(str(product.cost))
                is_estimated = False
                products_with_cost += 1
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                is_estimated = True
                products_estimated += 1

            item_value = cost * quantity
            total_units += quantity
            total_value += item_value

            breakdown.append({
                "product_id": str(product.id),
                "product_code": product.code,
                "product_name": product.name or f"[Global] {product.code}",
                "quantity": quantity,
                "unit_cost": float(cost),
                "is_estimated": is_estimated,
                "total_value": float(item_value),
                "is_global": True
            })

        return {
            "total_units": total_units,
            "total_value": float(total_value),
            "products_with_cost": products_with_cost,
            "products_estimated": products_estimated,
            "cost_margin_used": float(DEFAULT_COST_MARGIN),
            "breakdown": sorted(breakdown, key=lambda x: x["total_value"], reverse=True)
        }

    async def get_cash_and_bank(self, school_id: UUID) -> dict:
        """
        Obtiene saldos de Caja y Banco.

        Returns:
            {
                "caja": {"id": UUID, "name": str, "balance": Decimal},
                "banco": {"id": UUID, "name": str, "balance": Decimal},
                "total_liquid": Decimal
            }
        """
        balance_service = BalanceIntegrationService(self.db)
        return await balance_service.get_cash_balances(school_id)

    async def get_accounts_receivable_total(self, school_id: UUID) -> dict:
        """
        Obtiene total de cuentas por cobrar (dinero que nos deben).

        Returns:
            {
                "total": Decimal,
                "count": int,
                "overdue_total": Decimal,
                "overdue_count": int
            }
        """
        # Total pendiente
        result = await self.db.execute(
            select(
                func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid),
                func.count(AccountsReceivable.id)
            )
            .where(
                AccountsReceivable.school_id == school_id,
                AccountsReceivable.is_paid == False
            )
        )
        total, count = result.one()

        # Vencidas
        result_overdue = await self.db.execute(
            select(
                func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid),
                func.count(AccountsReceivable.id)
            )
            .where(
                AccountsReceivable.school_id == school_id,
                AccountsReceivable.is_paid == False,
                AccountsReceivable.due_date < get_colombia_date()
            )
        )
        overdue_total, overdue_count = result_overdue.one()

        return {
            "total": float(total or 0),
            "count": count or 0,
            "overdue_total": float(overdue_total or 0),
            "overdue_count": overdue_count or 0
        }

    async def get_accounts_payable_total(self, school_id: UUID) -> dict:
        """
        Obtiene total de cuentas por pagar (dinero que debemos a proveedores).

        Returns:
            {
                "total": Decimal,
                "count": int,
                "overdue_total": Decimal,
                "overdue_count": int
            }
        """
        result = await self.db.execute(
            select(
                func.sum(AccountsPayable.amount - AccountsPayable.amount_paid),
                func.count(AccountsPayable.id)
            )
            .where(
                AccountsPayable.school_id == school_id,
                AccountsPayable.is_paid == False
            )
        )
        total, count = result.one()

        # Vencidas
        result_overdue = await self.db.execute(
            select(
                func.sum(AccountsPayable.amount - AccountsPayable.amount_paid),
                func.count(AccountsPayable.id)
            )
            .where(
                AccountsPayable.school_id == school_id,
                AccountsPayable.is_paid == False,
                AccountsPayable.due_date < get_colombia_date()
            )
        )
        overdue_total, overdue_count = result_overdue.one()

        return {
            "total": float(total or 0),
            "count": count or 0,
            "overdue_total": float(overdue_total or 0),
            "overdue_count": overdue_count or 0
        }

    async def get_fixed_assets(self, school_id: UUID) -> dict:
        """
        Obtiene total de activos fijos (maquinaria, equipos, muebles).

        Returns:
            {
                "total_value": Decimal,
                "count": int,
                "breakdown": [
                    {"name": str, "value": Decimal, "depreciation": Decimal}
                ]
            }
        """
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.account_type == AccountType.ASSET_FIXED,
                BalanceAccount.is_active == True
            )
        )
        accounts = result.scalars().all()

        total_value = Decimal("0")
        breakdown = []

        for account in accounts:
            net_value = account.net_value
            total_value += net_value
            breakdown.append({
                "id": str(account.id),
                "name": account.name,
                "original_value": float(account.original_value or account.balance),
                "depreciation": float(account.accumulated_depreciation or 0),
                "net_value": float(net_value)
            })

        return {
            "total_value": float(total_value),
            "count": len(accounts),
            "breakdown": breakdown
        }

    async def get_intangible_assets(self, school_id: UUID) -> dict:
        """
        Obtiene total de activos intangibles (software, licencias, patentes, marcas).

        Returns:
            {
                "total_value": Decimal,
                "count": int,
                "breakdown": [
                    {"name": str, "value": Decimal, "amortization": Decimal}
                ]
            }
        """
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.account_type == AccountType.ASSET_INTANGIBLE,
                BalanceAccount.is_active == True
            )
        )
        accounts = result.scalars().all()

        total_value = Decimal("0")
        breakdown = []

        for account in accounts:
            net_value = account.net_value
            total_value += net_value
            breakdown.append({
                "id": str(account.id),
                "name": account.name,
                "original_value": float(account.original_value or account.balance),
                "amortization": float(account.accumulated_depreciation or 0),
                "net_value": float(net_value)
            })

        return {
            "total_value": float(total_value),
            "count": len(accounts),
            "breakdown": breakdown
        }

    async def get_debts(self, school_id: UUID) -> dict:
        """
        Obtiene total de deudas (préstamos, créditos, etc.).

        Returns:
            {
                "short_term": Decimal,  # < 1 año
                "long_term": Decimal,   # > 1 año
                "total": Decimal,
                "breakdown": [...]
            }
        """
        # Pasivos corrientes (corto plazo)
        result_current = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.account_type == AccountType.LIABILITY_CURRENT,
                BalanceAccount.is_active == True
            )
        )
        current_liabilities = result_current.scalars().all()

        # Pasivos largo plazo
        result_long = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.account_type == AccountType.LIABILITY_LONG,
                BalanceAccount.is_active == True
            )
        )
        long_liabilities = result_long.scalars().all()

        short_term = sum(acc.balance for acc in current_liabilities)
        long_term = sum(acc.balance for acc in long_liabilities)

        breakdown = []
        for acc in current_liabilities + long_liabilities:
            breakdown.append({
                "id": str(acc.id),
                "name": acc.name,
                "creditor": acc.creditor,
                "balance": float(acc.balance),
                "interest_rate": float(acc.interest_rate) if acc.interest_rate else None,
                "due_date": acc.due_date.isoformat() if acc.due_date else None,
                "is_long_term": acc.account_type == AccountType.LIABILITY_LONG
            })

        return {
            "short_term": float(short_term),
            "long_term": float(long_term),
            "total": float(short_term + long_term),
            "breakdown": breakdown
        }

    async def get_patrimony_summary(self, school_id: UUID) -> dict:
        """
        Calcula el resumen completo del patrimonio.

        PATRIMONIO = ACTIVOS - PASIVOS

        ACTIVOS:
        - Caja + Banco (líquido)
        - Inventario (valorado)
        - Cuentas por Cobrar
        - Activos Fijos

        PASIVOS:
        - Cuentas por Pagar (proveedores)
        - Deudas (préstamos, créditos)

        Returns:
            {
                "assets": {
                    "cash_and_bank": {...},
                    "inventory": {...},
                    "accounts_receivable": {...},
                    "fixed_assets": {...},
                    "total": Decimal
                },
                "liabilities": {
                    "accounts_payable": {...},
                    "debts": {...},
                    "total": Decimal
                },
                "patrimony": Decimal,
                "summary": {
                    "total_assets": Decimal,
                    "total_liabilities": Decimal,
                    "net_patrimony": Decimal
                }
            }
        """
        # Obtener todos los componentes
        cash_and_bank = await self.get_cash_and_bank(school_id)
        inventory = await self.get_inventory_valuation(school_id)
        accounts_receivable = await self.get_accounts_receivable_total(school_id)
        fixed_assets = await self.get_fixed_assets(school_id)
        intangible_assets = await self.get_intangible_assets(school_id)
        accounts_payable = await self.get_accounts_payable_total(school_id)
        debts = await self.get_debts(school_id)

        # Calcular totales
        total_liquid = Decimal(str(cash_and_bank.get("total_liquid", 0)))
        total_inventory = Decimal(str(inventory["total_value"]))
        total_receivables = Decimal(str(accounts_receivable["total"]))
        total_fixed = Decimal(str(fixed_assets["total_value"]))
        total_intangible = Decimal(str(intangible_assets["total_value"]))

        total_assets = total_liquid + total_inventory + total_receivables + total_fixed + total_intangible

        total_payables = Decimal(str(accounts_payable["total"]))
        total_debts = Decimal(str(debts["total"]))

        total_liabilities = total_payables + total_debts

        net_patrimony = total_assets - total_liabilities

        # Calculate Caja (Caja Menor + Caja Mayor) and Banco (Nequi + Banco)
        caja_menor_balance = Decimal(str(cash_and_bank.get("caja_menor", {}).get("balance", 0) if cash_and_bank.get("caja_menor") else 0))
        caja_mayor_balance = Decimal(str(cash_and_bank.get("caja_mayor", {}).get("balance", 0) if cash_and_bank.get("caja_mayor") else 0))
        nequi_balance = Decimal(str(cash_and_bank.get("nequi", {}).get("balance", 0) if cash_and_bank.get("nequi") else 0))
        banco_balance = Decimal(str(cash_and_bank.get("banco", {}).get("balance", 0) if cash_and_bank.get("banco") else 0))

        total_caja = caja_menor_balance + caja_mayor_balance  # Efectivo total
        total_banco = nequi_balance + banco_balance  # Digital total

        return {
            "assets": {
                "cash_and_bank": {
                    "caja": float(total_caja),  # Caja Menor + Caja Mayor
                    "banco": float(total_banco),  # Nequi + Banco
                    "total": float(total_liquid),
                    # Detailed breakdown
                    "caja_menor": float(caja_menor_balance),
                    "caja_mayor": float(caja_mayor_balance),
                    "nequi": float(nequi_balance),
                    "banco_cuenta": float(banco_balance)
                },
                "inventory": {
                    "total_units": inventory["total_units"],
                    "total_value": inventory["total_value"],
                    "products_estimated": inventory["products_estimated"],
                    "cost_margin_used": inventory["cost_margin_used"]
                },
                "accounts_receivable": accounts_receivable,
                "fixed_assets": fixed_assets,
                "intangible_assets": intangible_assets,
                "total": float(total_assets)
            },
            "liabilities": {
                "accounts_payable": accounts_payable,
                "debts": debts,
                "total": float(total_liabilities)
            },
            "summary": {
                "total_assets": float(total_assets),
                "total_liabilities": float(total_liabilities),
                "net_patrimony": float(net_patrimony),
                "is_positive": net_patrimony >= 0
            },
            "generated_at": get_colombia_date().isoformat()
        }

    async def set_initial_balance(
        self,
        school_id: UUID,
        account_code: str,  # "1101" for Caja, "1102" for Banco
        initial_balance: Decimal,
        created_by: UUID | None = None
    ) -> BalanceAccount:
        """
        Establece el saldo inicial de una cuenta (Caja o Banco).

        Crea un BalanceEntry con la descripción "Saldo inicial".
        """
        # Buscar cuenta por código
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.school_id == school_id,
                BalanceAccount.code == account_code,
                BalanceAccount.is_active == True
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise ValueError(f"Cuenta con código {account_code} no encontrada")

        # Calcular diferencia con el saldo actual
        difference = initial_balance - account.balance

        if difference == 0:
            return account  # No hay cambio

        # Actualizar balance
        account.balance = initial_balance

        # Crear entrada de ajuste
        entry = BalanceEntry(
            account_id=account.id,
            school_id=school_id,
            entry_date=get_colombia_date(),
            amount=difference,
            balance_after=initial_balance,
            description="Ajuste de saldo inicial",
            reference="INICIAL",
            created_by=created_by
        )
        self.db.add(entry)

        await self.db.flush()
        await self.db.refresh(account)

        return account

    async def create_debt(
        self,
        school_id: UUID,
        name: str,
        amount: Decimal,
        creditor: str,
        is_long_term: bool = False,
        interest_rate: Decimal | None = None,
        due_date: date | None = None,
        description: str | None = None,
        created_by: UUID | None = None
    ) -> BalanceAccount:
        """
        Crea una nueva deuda en el sistema.
        """
        account_type = AccountType.LIABILITY_LONG if is_long_term else AccountType.LIABILITY_CURRENT

        debt = BalanceAccount(
            school_id=school_id,
            account_type=account_type,
            name=name,
            description=description,
            balance=amount,
            creditor=creditor,
            interest_rate=interest_rate,
            due_date=due_date,
            created_by=created_by,
            is_active=True
        )
        self.db.add(debt)
        await self.db.flush()
        await self.db.refresh(debt)

        return debt

    async def create_fixed_asset(
        self,
        school_id: UUID,
        name: str,
        value: Decimal,
        description: str | None = None,
        useful_life_years: int | None = None,
        created_by: UUID | None = None
    ) -> BalanceAccount:
        """
        Crea un nuevo activo fijo (maquinaria, equipo, etc.).
        """
        asset = BalanceAccount(
            school_id=school_id,
            account_type=AccountType.ASSET_FIXED,
            name=name,
            description=description,
            balance=value,
            original_value=value,
            accumulated_depreciation=Decimal("0"),
            useful_life_years=useful_life_years,
            created_by=created_by,
            is_active=True
        )
        self.db.add(asset)
        await self.db.flush()
        await self.db.refresh(asset)

        return asset

    # ============================================
    # Global Patrimony Methods (No school_id filter)
    # ============================================

    async def get_global_inventory_valuation(self) -> dict:
        """
        Calcula el valor total del inventario de TODOS los colegios.

        Returns breakdown by school for internal reporting.
        """
        total_units = 0
        total_value = Decimal("0")
        products_with_cost = 0
        products_estimated = 0
        by_school = {}

        # School products (ALL schools)
        result = await self.db.execute(
            select(Product, Inventory)
            .join(Inventory, Product.id == Inventory.product_id)
            .where(
                Product.is_active == True,
                Inventory.quantity > 0
            )
        )
        rows = result.all()

        for product, inventory in rows:
            quantity = inventory.quantity
            school_id = str(product.school_id)

            if product.cost is not None:
                cost = Decimal(str(product.cost))
                is_estimated = False
                products_with_cost += quantity
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                is_estimated = True
                products_estimated += quantity

            item_value = cost * quantity
            total_units += quantity
            total_value += item_value

            # Group by school
            if school_id not in by_school:
                by_school[school_id] = {
                    "units": 0,
                    "value": Decimal("0"),
                    "with_cost": 0,
                    "estimated": 0
                }
            by_school[school_id]["units"] += quantity
            by_school[school_id]["value"] += item_value
            if is_estimated:
                by_school[school_id]["estimated"] += quantity
            else:
                by_school[school_id]["with_cost"] += quantity

        # Global products
        global_result = await self.db.execute(
            select(GlobalProduct, GlobalInventory)
            .join(GlobalInventory, GlobalProduct.id == GlobalInventory.product_id)
            .where(
                GlobalProduct.is_active == True,
                GlobalInventory.quantity > 0
            )
        )
        global_rows = global_result.all()

        global_value = Decimal("0")
        global_units = 0

        for product, inventory in global_rows:
            quantity = inventory.quantity

            if product.cost is not None:
                cost = Decimal(str(product.cost))
                products_with_cost += quantity
            else:
                cost = Decimal(str(product.price)) * DEFAULT_COST_MARGIN
                products_estimated += quantity

            item_value = cost * quantity
            total_units += quantity
            total_value += item_value
            global_units += quantity
            global_value += item_value

        # Convert by_school values to float
        by_school_float = {
            k: {
                "units": v["units"],
                "value": float(v["value"]),
                "with_cost": v["with_cost"],
                "estimated": v["estimated"]
            }
            for k, v in by_school.items()
        }

        return {
            "total_units": total_units,
            "total_value": float(total_value),
            "products_with_cost": products_with_cost,
            "products_estimated": products_estimated,
            "cost_margin_used": float(DEFAULT_COST_MARGIN),
            "by_school": by_school_float,
            "global_products": {
                "units": global_units,
                "value": float(global_value)
            }
        }

    async def get_global_cash_and_bank(self) -> dict:
        """
        Obtiene saldos globales de Caja y Banco (todas las cuentas).
        """
        # Cash account codes: 1101=Caja Menor, 1102=Caja Mayor, 1103=Nequi, 1104=Banco
        CASH_ACCOUNT_CODES = ["1101", "1102", "1103", "1104"]

        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.ASSET_CURRENT,
                BalanceAccount.code.in_(CASH_ACCOUNT_CODES),
                BalanceAccount.is_active == True
            )
            .order_by(BalanceAccount.code)
        )
        accounts = result.scalars().all()

        caja_menor = Decimal("0")
        caja_mayor = Decimal("0")
        nequi = Decimal("0")
        banco = Decimal("0")

        for acc in accounts:
            if acc.code == "1101":
                caja_menor = acc.balance
            elif acc.code == "1102":
                caja_mayor = acc.balance
            elif acc.code == "1103":
                nequi = acc.balance
            elif acc.code == "1104":
                banco = acc.balance

        total_caja = caja_menor + caja_mayor
        total_banco = nequi + banco
        total_liquid = total_caja + total_banco

        return {
            "caja": float(total_caja),
            "banco": float(total_banco),
            "total_liquid": float(total_liquid),
            "caja_menor": float(caja_menor),
            "caja_mayor": float(caja_mayor),
            "nequi": float(nequi),
            "banco_cuenta": float(banco)
        }

    async def get_global_accounts_receivable(self) -> dict:
        """
        Obtiene total global de cuentas por cobrar (todas).
        """
        result = await self.db.execute(
            select(
                func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid),
                func.count(AccountsReceivable.id)
            )
            .where(AccountsReceivable.is_paid == False)
        )
        total, count = result.one()

        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def get_global_accounts_payable(self) -> dict:
        """
        Obtiene total global de cuentas por pagar (todas).
        """
        result = await self.db.execute(
            select(
                func.sum(AccountsPayable.amount - AccountsPayable.amount_paid),
                func.count(AccountsPayable.id)
            )
            .where(AccountsPayable.is_paid == False)
        )
        total, count = result.one()

        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def get_global_fixed_assets(self) -> dict:
        """
        Obtiene total global de activos fijos.
        """
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.ASSET_FIXED,
                BalanceAccount.is_active == True
            )
        )
        accounts = result.scalars().all()

        total_value = sum(acc.net_value for acc in accounts)
        breakdown = [
            {
                "id": str(acc.id),
                "name": acc.name,
                "net_value": float(acc.net_value)
            }
            for acc in accounts
        ]

        return {
            "total_value": float(total_value),
            "count": len(accounts),
            "breakdown": breakdown
        }

    async def get_global_intangible_assets(self) -> dict:
        """
        Obtiene total global de activos intangibles.
        """
        result = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.ASSET_INTANGIBLE,
                BalanceAccount.is_active == True
            )
        )
        accounts = result.scalars().all()

        total_value = sum(acc.net_value for acc in accounts)
        breakdown = [
            {
                "id": str(acc.id),
                "name": acc.name,
                "net_value": float(acc.net_value)
            }
            for acc in accounts
        ]

        return {
            "total_value": float(total_value),
            "count": len(accounts),
            "breakdown": breakdown
        }

    async def get_global_debts(self) -> dict:
        """
        Obtiene total global de deudas.
        """
        # Current liabilities
        result_current = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.LIABILITY_CURRENT,
                BalanceAccount.is_active == True
            )
        )
        current_liabilities = result_current.scalars().all()

        # Long-term liabilities
        result_long = await self.db.execute(
            select(BalanceAccount)
            .where(
                BalanceAccount.account_type == AccountType.LIABILITY_LONG,
                BalanceAccount.is_active == True
            )
        )
        long_liabilities = result_long.scalars().all()

        short_term = sum(acc.balance for acc in current_liabilities)
        long_term = sum(acc.balance for acc in long_liabilities)

        breakdown = [
            {
                "id": str(acc.id),
                "name": acc.name,
                "balance": float(acc.balance),
                "is_long_term": acc.account_type == AccountType.LIABILITY_LONG
            }
            for acc in current_liabilities + long_liabilities
        ]

        return {
            "short_term": float(short_term),
            "long_term": float(long_term),
            "total": float(short_term + long_term),
            "breakdown": breakdown
        }

    async def get_global_pending_expenses(self) -> dict:
        """
        Obtiene total de gastos pendientes de pago.
        """
        from app.models.accounting import Expense

        result = await self.db.execute(
            select(
                func.sum(Expense.amount - Expense.amount_paid),
                func.count(Expense.id)
            )
            .where(
                Expense.is_active == True,
                Expense.is_paid == False
            )
        )
        total, count = result.one()

        return {
            "total": float(total or 0),
            "count": count or 0
        }

    async def get_global_patrimony_summary(self) -> dict:
        """
        Calcula el resumen GLOBAL del patrimonio (todos los colegios).

        PATRIMONIO = ACTIVOS - PASIVOS

        Esta es la vista consolidada del negocio completo.
        """
        # Get all components globally
        cash_and_bank = await self.get_global_cash_and_bank()
        inventory = await self.get_global_inventory_valuation()
        accounts_receivable = await self.get_global_accounts_receivable()
        fixed_assets = await self.get_global_fixed_assets()
        intangible_assets = await self.get_global_intangible_assets()
        accounts_payable = await self.get_global_accounts_payable()
        pending_expenses = await self.get_global_pending_expenses()
        debts = await self.get_global_debts()

        # Calculate totals
        total_liquid = Decimal(str(cash_and_bank["total_liquid"]))
        total_inventory = Decimal(str(inventory["total_value"]))
        total_receivables = Decimal(str(accounts_receivable["total"]))
        total_fixed = Decimal(str(fixed_assets["total_value"]))
        total_intangible = Decimal(str(intangible_assets["total_value"]))

        total_assets = total_liquid + total_inventory + total_receivables + total_fixed + total_intangible

        total_payables = Decimal(str(accounts_payable["total"]))
        total_pending = Decimal(str(pending_expenses["total"]))
        total_debts = Decimal(str(debts["total"]))

        total_liabilities = total_payables + total_pending + total_debts

        net_patrimony = total_assets - total_liabilities

        # Calculate current assets (for compatibility with Balance Sheet)
        current_assets = total_liquid + total_inventory + total_receivables

        return {
            "assets": {
                "cash_and_bank": cash_and_bank,
                "inventory": {
                    "total_units": inventory["total_units"],
                    "total_value": inventory["total_value"],
                    "products_with_cost": inventory["products_with_cost"],
                    "products_estimated": inventory["products_estimated"],
                    "cost_margin_used": inventory["cost_margin_used"],
                    "by_school": inventory["by_school"]
                },
                "accounts_receivable": accounts_receivable,
                "fixed_assets": fixed_assets,
                "intangible_assets": intangible_assets,
                "current_assets": float(current_assets),
                "total": float(total_assets)
            },
            "liabilities": {
                "accounts_payable": accounts_payable,
                "pending_expenses": pending_expenses,
                "debts": debts,
                "total": float(total_liabilities)
            },
            "summary": {
                "total_assets": float(total_assets),
                "total_liabilities": float(total_liabilities),
                "net_patrimony": float(net_patrimony),
                "is_positive": net_patrimony >= 0
            },
            "generated_at": get_colombia_date().isoformat()
        }
