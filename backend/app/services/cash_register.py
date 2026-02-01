"""
Cash Register Service

Servicio para gestionar la Caja Menor y su liquidacion a Caja Mayor.

Flujo:
1. Ventas en efectivo van a Caja Menor (1101)
2. Al final del dia, vendedor liquida Caja Menor a Caja Mayor (1102)
3. Caja Mayor acumula el efectivo consolidado
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.accounting import (
    BalanceAccount,
    BalanceEntry,
    AccountType,
    CajaMenorConfig,
    Transaction,
    TransactionType,
    AccPaymentMethod,
)
from app.services.balance_integration import (
    BalanceIntegrationService,
    DEFAULT_ACCOUNTS
)


class CashRegisterService:
    """
    Servicio para gestionar operaciones de Caja Menor.

    Responsabilidades:
    - Obtener saldo actual de Caja Menor
    - Liquidar Caja Menor a Caja Mayor
    - Historial de liquidaciones
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.balance_service = BalanceIntegrationService(db)

    async def get_caja_menor_balance(self) -> dict:
        """
        Obtiene el saldo actual de Caja Menor.

        Returns:
            Dict con informacion de la cuenta:
            {
                "id": UUID,
                "name": str,
                "code": str,
                "balance": Decimal,
                "last_updated": datetime
            }
        """
        account = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_menor"]["code"]
        )

        if not account:
            # Crear cuentas si no existen
            await self.balance_service.get_or_create_global_accounts()
            account = await self.balance_service.get_global_account(
                DEFAULT_ACCOUNTS["caja_menor"]["code"]
            )

        if account:
            return {
                "id": str(account.id),
                "name": account.name,
                "code": account.code,
                "balance": account.balance,
                "last_updated": account.updated_at.isoformat() if account.updated_at else None
            }

        return {
            "id": None,
            "name": "Caja Menor",
            "code": "1101",
            "balance": Decimal("0"),
            "last_updated": None
        }

    async def get_caja_mayor_balance(self) -> dict:
        """
        Obtiene el saldo actual de Caja Mayor.

        Returns:
            Dict con informacion de la cuenta
        """
        account = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_mayor"]["code"]
        )

        if not account:
            await self.balance_service.get_or_create_global_accounts()
            account = await self.balance_service.get_global_account(
                DEFAULT_ACCOUNTS["caja_mayor"]["code"]
            )

        if account:
            return {
                "id": str(account.id),
                "name": account.name,
                "code": account.code,
                "balance": account.balance,
                "last_updated": account.updated_at.isoformat() if account.updated_at else None
            }

        return {
            "id": None,
            "name": "Caja Mayor",
            "code": "1102",
            "balance": Decimal("0"),
            "last_updated": None
        }

    async def liquidate_to_caja_mayor(
        self,
        amount: Decimal,
        notes: str | None = None,
        created_by: UUID | None = None
    ) -> dict:
        """
        Liquida (transfiere) un monto de Caja Menor a Caja Mayor.

        Args:
            amount: Monto a liquidar
            notes: Notas opcionales de la liquidacion
            created_by: ID del usuario que realiza la liquidacion

        Returns:
            Dict con resultado de la liquidacion:
            {
                "success": bool,
                "message": str,
                "caja_menor_balance": Decimal,
                "caja_mayor_balance": Decimal,
                "amount_liquidated": Decimal,
                "entry_from": dict,
                "entry_to": dict
            }

        Raises:
            ValueError: Si el monto es invalido o excede el saldo disponible
        """
        if amount <= 0:
            raise ValueError("El monto a liquidar debe ser mayor a 0")

        # Obtener cuenta Caja Menor
        caja_menor = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_menor"]["code"]
        )

        if not caja_menor:
            await self.balance_service.get_or_create_global_accounts()
            caja_menor = await self.balance_service.get_global_account(
                DEFAULT_ACCOUNTS["caja_menor"]["code"]
            )

        if not caja_menor:
            raise ValueError("No se encontro la cuenta Caja Menor")

        # Validar saldo suficiente
        if caja_menor.balance < amount:
            raise ValueError(
                f"Saldo insuficiente en Caja Menor. "
                f"Disponible: ${caja_menor.balance:,.2f}, "
                f"Solicitado: ${amount:,.2f}"
            )

        # Obtener cuenta Caja Mayor
        caja_mayor = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_mayor"]["code"]
        )

        if not caja_mayor:
            raise ValueError("No se encontro la cuenta Caja Mayor")

        # Realizar la transferencia
        description = notes or "Liquidacion de Caja Menor"
        timestamp = get_colombia_now_naive()

        # Descontar de Caja Menor
        caja_menor.balance -= amount
        entry_from = BalanceEntry(
            account_id=caja_menor.id,
            school_id=None,  # Liquidaciones son globales
            entry_date=get_colombia_date(),
            amount=-amount,
            balance_after=caja_menor.balance,
            description=f"Liquidacion a Caja Mayor: {description}",
            reference=f"LIQ-{timestamp.strftime('%Y%m%d%H%M%S')}",
            created_by=created_by
        )
        self.db.add(entry_from)

        # Agregar a Caja Mayor
        caja_mayor.balance += amount
        entry_to = BalanceEntry(
            account_id=caja_mayor.id,
            school_id=None,
            entry_date=get_colombia_date(),
            amount=amount,
            balance_after=caja_mayor.balance,
            description=f"Recibido de Caja Menor: {description}",
            reference=f"LIQ-{timestamp.strftime('%Y%m%d%H%M%S')}",
            created_by=created_by
        )
        self.db.add(entry_to)

        await self.db.flush()

        return {
            "success": True,
            "message": f"Liquidacion exitosa: ${amount:,.2f} transferidos a Caja Mayor",
            "caja_menor_balance": caja_menor.balance,
            "caja_mayor_balance": caja_mayor.balance,
            "amount_liquidated": amount,
            "entry_from": {
                "id": str(entry_from.id),
                "amount": entry_from.amount,
                "balance_after": entry_from.balance_after,
                "description": entry_from.description
            },
            "entry_to": {
                "id": str(entry_to.id),
                "amount": entry_to.amount,
                "balance_after": entry_to.balance_after,
                "description": entry_to.description
            }
        }

    async def get_liquidation_history(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 50
    ) -> list[dict]:
        """
        Obtiene historial de liquidaciones de Caja Menor a Caja Mayor.

        Args:
            start_date: Fecha inicial (opcional)
            end_date: Fecha final (opcional)
            limit: Limite de registros

        Returns:
            Lista de liquidaciones con detalles
        """
        # Obtener cuenta Caja Mayor (las liquidaciones se registran como ingresos ahi)
        caja_mayor = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_mayor"]["code"]
        )

        if not caja_mayor:
            return []

        # Buscar entries de liquidacion (las que tienen referencia LIQ-)
        query = select(BalanceEntry).where(
            BalanceEntry.account_id == caja_mayor.id,
            BalanceEntry.reference.like("LIQ-%"),
            BalanceEntry.amount > 0  # Solo ingresos (recibidos de Caja Menor)
        )

        if start_date:
            query = query.where(BalanceEntry.entry_date >= start_date)
        if end_date:
            query = query.where(BalanceEntry.entry_date <= end_date)

        query = query.order_by(BalanceEntry.created_at.desc()).limit(limit)

        result = await self.db.execute(query)
        entries = result.scalars().all()

        return [
            {
                "id": str(entry.id),
                "date": entry.entry_date.isoformat(),
                "amount": entry.amount,
                "balance_after": entry.balance_after,
                "description": entry.description,
                "reference": entry.reference,
                "created_at": entry.created_at.isoformat() if entry.created_at else None
            }
            for entry in entries
        ]

    async def get_today_summary(self) -> dict:
        """
        Obtiene resumen de operaciones del dia para Caja Menor.

        Returns:
            Dict con resumen:
            {
                "caja_menor_balance": Decimal,
                "caja_mayor_balance": Decimal,
                "today_liquidations": Decimal,
                "today_entries_count": int
            }
        """
        today = get_colombia_date()

        # Obtener saldos actuales
        caja_menor = await self.get_caja_menor_balance()
        caja_mayor = await self.get_caja_mayor_balance()

        # Obtener cuenta Caja Menor para queries
        caja_menor_account = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_menor"]["code"]
        )

        today_liquidations = Decimal("0")
        today_entries_count = 0

        if caja_menor_account:
            # Contar entries de hoy en Caja Menor
            count_result = await self.db.execute(
                select(func.count(BalanceEntry.id)).where(
                    BalanceEntry.account_id == caja_menor_account.id,
                    BalanceEntry.entry_date == today
                )
            )
            today_entries_count = count_result.scalar() or 0

            # Suma de liquidaciones de hoy (montos negativos que son liquidaciones)
            liq_result = await self.db.execute(
                select(func.sum(func.abs(BalanceEntry.amount))).where(
                    BalanceEntry.account_id == caja_menor_account.id,
                    BalanceEntry.entry_date == today,
                    BalanceEntry.reference.like("LIQ-%")
                )
            )
            today_liquidations = liq_result.scalar() or Decimal("0")

        return {
            "caja_menor_balance": caja_menor["balance"],
            "caja_mayor_balance": caja_mayor["balance"],
            "today_liquidations": today_liquidations,
            "today_entries_count": today_entries_count,
            "date": today.isoformat()
        }

    def _calculate_category_breakdown(self, entries: list[BalanceEntry]) -> dict:
        """
        Calcula el breakdown por categoría basado en el reference de cada entry.

        Patrones de reference:
        - VNT-* : Ventas (sales)
        - ENC-* : Encargos (orders)
        - ARR-* : Arreglos (alterations)
        - CHG-* : Cambios de venta (sale_changes)
        - XFER-*, LIQ-*, Transferencia* : Transferencias (transfers)
        - EXP-*, Pago gasto* : Gastos (expenses)
        - Otros : other
        """
        breakdown = {
            "sales": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "orders": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "alterations": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "sale_changes": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "transfers": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "expenses": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
            "other": {"income": Decimal("0"), "expense": Decimal("0"), "count": 0},
        }

        for entry in entries:
            ref = (entry.reference or "").upper()
            desc = (entry.description or "").lower()

            # Determinar categoría basado en reference y description
            if ref.startswith("VNT-") or "venta" in desc:
                category = "sales"
            elif ref.startswith("ENC-") or "encargo" in desc or "pedido" in desc or "abono" in desc:
                category = "orders"
            elif ref.startswith("ARR-") or "arreglo" in desc or "alteration" in desc:
                category = "alterations"
            elif ref.startswith("CHG-") or "cambio" in desc:
                category = "sale_changes"
            elif ref.startswith("XFER-") or ref.startswith("LIQ-") or "transferencia" in desc:
                category = "transfers"
            elif ref.startswith("EXP-") or "gasto" in desc or "pago proveedor" in desc:
                category = "expenses"
            else:
                category = "other"

            # Clasificar como income o expense
            if entry.amount > 0:
                breakdown[category]["income"] += entry.amount
            else:
                breakdown[category]["expense"] += abs(entry.amount)
            breakdown[category]["count"] += 1

        return breakdown

    async def get_daily_flow_by_account(self, target_date: date | None = None) -> dict:
        """
        Obtiene el flujo diario de cada cuenta de balance (Caja Menor, Caja Mayor, Nequi, Banco).

        Para cada cuenta calcula:
        - Saldo inicial del dia (balance antes del primer movimiento del dia)
        - Total de entradas (amount > 0)
        - Total de salidas (amount < 0)
        - Saldo final (balance actual de la cuenta o balance_after del ultimo movimiento del dia)
        - Cantidad de movimientos

        Args:
            target_date: Fecha a consultar (default: hoy)

        Returns:
            Dict con:
            {
                "date": "2026-01-20",
                "accounts": [
                    {
                        "account_id": "uuid",
                        "account_name": "Caja Menor",
                        "account_code": "1101",
                        "opening_balance": Decimal,
                        "total_income": Decimal,
                        "total_expenses": Decimal,
                        "closing_balance": Decimal,
                        "income_count": int,
                        "expense_count": int,
                        "net_flow": Decimal
                    },
                    ...
                ],
                "totals": {
                    "opening_balance": Decimal,
                    "total_income": Decimal,
                    "total_expenses": Decimal,
                    "closing_balance": Decimal,
                    "net_flow": Decimal
                }
            }
        """
        if target_date is None:
            target_date = get_colombia_date()

        # Obtener/crear cuentas globales
        accounts_map = await self.balance_service.get_or_create_global_accounts()

        accounts_flow = []
        totals = {
            "opening_balance": Decimal("0"),
            "total_income": Decimal("0"),
            "total_expenses": Decimal("0"),
            "closing_balance": Decimal("0"),
            "net_flow": Decimal("0")
        }

        # Procesar cada cuenta
        for account_key in ["caja_menor", "caja_mayor", "nequi", "banco"]:
            account_id = accounts_map.get(account_key)
            if not account_id:
                continue

            # Obtener la cuenta
            account_result = await self.db.execute(
                select(BalanceAccount).where(BalanceAccount.id == account_id)
            )
            account = account_result.scalar_one_or_none()
            if not account:
                continue

            # Obtener entradas del dia
            entries_result = await self.db.execute(
                select(BalanceEntry).where(
                    BalanceEntry.account_id == account_id,
                    BalanceEntry.entry_date == target_date
                ).order_by(BalanceEntry.created_at.asc())
            )
            entries = entries_result.scalars().all()

            # Calcular totales del dia
            total_income = Decimal("0")
            total_expenses = Decimal("0")
            income_count = 0
            expense_count = 0

            for entry in entries:
                if entry.amount > 0:
                    total_income += entry.amount
                    income_count += 1
                elif entry.amount < 0:
                    total_expenses += abs(entry.amount)
                    expense_count += 1

            # Calcular saldo inicial y final
            if entries:
                # El saldo inicial es el balance_after del primer movimiento menos su amount
                first_entry = entries[0]
                opening_balance = first_entry.balance_after - first_entry.amount

                # El saldo final es el balance_after del ultimo movimiento
                last_entry = entries[-1]
                closing_balance = last_entry.balance_after
            else:
                # Sin movimientos del dia: el saldo es el mismo al inicio y al final
                # Necesitamos buscar el ultimo movimiento antes de target_date
                prev_entry_result = await self.db.execute(
                    select(BalanceEntry).where(
                        BalanceEntry.account_id == account_id,
                        BalanceEntry.entry_date < target_date
                    ).order_by(BalanceEntry.created_at.desc()).limit(1)
                )
                prev_entry = prev_entry_result.scalar_one_or_none()

                if prev_entry:
                    opening_balance = prev_entry.balance_after
                    closing_balance = prev_entry.balance_after
                else:
                    # Si no hay entradas previas y es el dia de hoy, usamos balance actual
                    if target_date == get_colombia_date():
                        opening_balance = account.balance
                        closing_balance = account.balance
                    else:
                        opening_balance = Decimal("0")
                        closing_balance = Decimal("0")

            net_flow = total_income - total_expenses

            # Calcular breakdown por categoría basado en el reference de cada entry
            breakdown = self._calculate_category_breakdown(entries)

            account_flow = {
                "account_id": str(account.id),
                "account_name": account.name,
                "account_code": account.code or DEFAULT_ACCOUNTS[account_key]["code"],
                "opening_balance": opening_balance,
                "total_income": total_income,
                "total_expenses": total_expenses,
                "closing_balance": closing_balance,
                "income_count": income_count,
                "expense_count": expense_count,
                "net_flow": net_flow,
                "breakdown_by_category": breakdown
            }
            accounts_flow.append(account_flow)

            # Acumular totales
            totals["opening_balance"] += opening_balance
            totals["total_income"] += total_income
            totals["total_expenses"] += total_expenses
            totals["closing_balance"] += closing_balance
            totals["net_flow"] += net_flow

        return {
            "date": target_date.isoformat(),
            "accounts": accounts_flow,
            "totals": totals
        }

    # ============================================
    # Caja Menor Configuration & Auto-Close
    # ============================================

    async def get_caja_menor_config(self) -> CajaMenorConfig:
        """Get or create the singleton Caja Menor config row."""
        result = await self.db.execute(select(CajaMenorConfig).limit(1))
        config = result.scalar_one_or_none()
        if not config:
            config = CajaMenorConfig(base_amount=Decimal("400000"))
            self.db.add(config)
            await self.db.flush()
        return config

    async def update_caja_menor_config(
        self,
        base_amount: Decimal | None = None,
        auto_close_enabled: bool | None = None,
        auto_close_time: str | None = None,
        updated_by: UUID | None = None,
    ) -> CajaMenorConfig:
        """Update Caja Menor auto-close configuration."""
        config = await self.get_caja_menor_config()
        if base_amount is not None:
            config.base_amount = base_amount
        if auto_close_enabled is not None:
            config.auto_close_enabled = auto_close_enabled
        if auto_close_time is not None:
            config.auto_close_time = auto_close_time
        config.updated_by = updated_by
        await self.db.flush()
        return config

    async def auto_close_caja_menor(self, created_by: UUID | None = None) -> dict:
        """
        Close Caja Menor: transfer excess above base_amount to Caja Mayor.
        If balance <= base_amount, nothing is transferred.

        Returns:
            Dict with auto-close result details
        """
        config = await self.get_caja_menor_config()

        caja_menor = await self.balance_service.get_global_account(
            DEFAULT_ACCOUNTS["caja_menor"]["code"]
        )
        if not caja_menor:
            raise ValueError("No se encontro la cuenta Caja Menor")

        caja_mayor_info = await self.get_caja_mayor_balance()

        excess = caja_menor.balance - config.base_amount
        if excess <= 0:
            return {
                "success": True,
                "message": f"Caja Menor (${caja_menor.balance:,.0f}) no excede la base (${config.base_amount:,.0f}). Nada que transferir.",
                "excess_amount": Decimal("0"),
                "amount_transferred": Decimal("0"),
                "caja_menor_new_balance": caja_menor.balance,
                "caja_mayor_new_balance": caja_mayor_info["balance"],
                "base_amount": config.base_amount,
            }

        # Reuse existing liquidation logic
        result = await self.liquidate_to_caja_mayor(
            amount=excess,
            notes=f"Auto-cierre: excedente sobre base de ${config.base_amount:,.0f}",
            created_by=created_by,
        )

        # Update last auto-close timestamp
        config.last_auto_close_at = get_colombia_now_naive()
        await self.db.flush()

        return {
            "success": True,
            "message": f"Auto-cierre exitoso: ${excess:,.0f} transferidos a Caja Mayor",
            "excess_amount": excess,
            "amount_transferred": excess,
            "caja_menor_new_balance": result["caja_menor_balance"],
            "caja_mayor_new_balance": result["caja_mayor_balance"],
            "base_amount": config.base_amount,
        }

    # ============================================
    # Inter-Account Transfers
    # ============================================

    async def create_transfer(
        self,
        from_account_id: UUID,
        to_account_id: UUID,
        amount: Decimal,
        reason: str,
        reference: str | None = None,
        created_by: UUID | None = None,
    ) -> dict:
        """
        Create a transfer between any two balance accounts.

        Creates a Transaction record + dual BalanceEntry records for audit trail.
        """
        # Validate accounts exist and are different
        from_account = (
            await self.db.execute(
                select(BalanceAccount).where(BalanceAccount.id == from_account_id)
            )
        ).scalar_one_or_none()

        to_account = (
            await self.db.execute(
                select(BalanceAccount).where(BalanceAccount.id == to_account_id)
            )
        ).scalar_one_or_none()

        if not from_account:
            raise ValueError("Cuenta de origen no encontrada")
        if not to_account:
            raise ValueError("Cuenta de destino no encontrada")
        if from_account_id == to_account_id:
            raise ValueError("Las cuentas de origen y destino deben ser diferentes")

        # Validate sufficient balance
        if from_account.balance < amount:
            raise ValueError(
                f"Saldo insuficiente en {from_account.name}. "
                f"Disponible: ${from_account.balance:,.0f}, "
                f"Solicitado: ${amount:,.0f}"
            )

        timestamp = get_colombia_now_naive()
        ref_code = reference or f"XFER-{timestamp.strftime('%Y%m%d%H%M%S')}"

        # Create Transaction record
        transaction = Transaction(
            school_id=None,
            type=TransactionType.TRANSFER,
            amount=amount,
            payment_method=AccPaymentMethod.OTHER,
            description=reason,
            reference_code=ref_code,
            transaction_date=get_colombia_date(),
            balance_account_id=from_account_id,
            transfer_to_account_id=to_account_id,
            created_by=created_by,
        )
        self.db.add(transaction)
        await self.db.flush()

        # Use existing apply_transfer for dual-entry bookkeeping
        await self.balance_service.apply_transfer(
            transaction=transaction,
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            created_by=created_by,
        )

        # Refresh accounts to get updated balances
        await self.db.refresh(from_account)
        await self.db.refresh(to_account)

        return {
            "success": True,
            "message": f"Transferencia exitosa: ${amount:,.0f} de {from_account.name} a {to_account.name}",
            "transfer_id": str(transaction.id),
            "amount": amount,
            "from_account": {
                "id": str(from_account.id),
                "name": from_account.name,
                "code": from_account.code,
                "new_balance": from_account.balance,
            },
            "to_account": {
                "id": str(to_account.id),
                "name": to_account.name,
                "code": to_account.code,
                "new_balance": to_account.balance,
            },
            "reference": ref_code,
            "created_at": timestamp.isoformat(),
        }

    async def get_transfer_history(
        self,
        limit: int = 50,
        offset: int = 0,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> dict:
        """Get history of inter-account transfers with account details."""
        query = (
            select(Transaction)
            .where(
                Transaction.type == TransactionType.TRANSFER,
                Transaction.school_id.is_(None),
            )
            .options(
                selectinload(Transaction.balance_account),
                selectinload(Transaction.transfer_to_account),
                selectinload(Transaction.created_by_user),
            )
        )

        if start_date:
            query = query.where(Transaction.transaction_date >= start_date)
        if end_date:
            query = query.where(Transaction.transaction_date <= end_date)

        # Count total
        count_query = select(func.count()).select_from(
            select(Transaction.id)
            .where(
                Transaction.type == TransactionType.TRANSFER,
                Transaction.school_id.is_(None),
            )
            .subquery()
        )
        if start_date:
            count_query = select(func.count()).select_from(
                select(Transaction.id)
                .where(
                    Transaction.type == TransactionType.TRANSFER,
                    Transaction.school_id.is_(None),
                    Transaction.transaction_date >= start_date,
                )
                .subquery()
            )
        if end_date:
            count_query = select(func.count()).select_from(
                select(Transaction.id)
                .where(
                    Transaction.type == TransactionType.TRANSFER,
                    Transaction.school_id.is_(None),
                    Transaction.transaction_date <= end_date,
                )
                .subquery()
            )

        total = (await self.db.execute(count_query)).scalar() or 0

        query = query.order_by(Transaction.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(query)
        transfers = result.scalars().all()

        items = []
        for t in transfers:
            from_acct = t.balance_account
            to_acct = t.transfer_to_account
            user = t.created_by_user

            items.append({
                "id": str(t.id),
                "amount": t.amount,
                "from_account_name": from_acct.name if from_acct else "Desconocida",
                "from_account_code": from_acct.code if from_acct else None,
                "to_account_name": to_acct.name if to_acct else "Desconocida",
                "to_account_code": to_acct.code if to_acct else None,
                "description": t.description,
                "reference": t.reference_code,
                "created_by_name": user.full_name if user else None,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            })

        return {
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
        }
