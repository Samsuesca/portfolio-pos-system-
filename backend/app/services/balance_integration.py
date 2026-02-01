"""
Balance Integration Service

Integra transacciones con cuentas del balance general.
Cuando se crea una transacción, automáticamente actualiza
la cuenta correspondiente según el método de pago.

ARQUITECTURA GLOBAL:
- Las cuentas son GLOBALES (school_id = NULL)
- El dinero de todas las ventas va a las cuentas globales
- Las transacciones mantienen school_id para reportes por colegio

CUENTAS DE ACTIVO LIQUIDO:
- 1101 Caja Menor: Efectivo operativo (INGRESOS en efectivo: ventas, pagos)
- 1102 Caja Mayor: Efectivo consolidado (GASTOS en efectivo salen de aquí)
- 1103 Nequi: Cuenta Nequi
- 1104 Banco: Transferencias bancarias y tarjetas

FLUJO DE EFECTIVO:
- Ingresos (ventas, pagos de encargos/arreglos) en CASH -> Caja Menor (+)
- Gastos del negocio en CASH -> Caja Mayor (-)
- Liquidaciones: Caja Menor -> Caja Mayor (traslado diario)
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    Transaction,
    TransactionType,
    AccPaymentMethod,
    BalanceAccount,
    BalanceEntry,
    AccountType
)


# Códigos estándar de contabilidad para cuentas default GLOBALES
DEFAULT_ACCOUNTS = {
    "caja_menor": {
        "name": "Caja Menor",
        "code": "1101",
        "description": "Efectivo operativo (se liquida diario a Caja Mayor)",
        "account_type": AccountType.ASSET_CURRENT
    },
    "caja_mayor": {
        "name": "Caja Mayor",
        "code": "1102",
        "description": "Efectivo consolidado (liquidaciones de Caja Menor)",
        "account_type": AccountType.ASSET_CURRENT
    },
    "nequi": {
        "name": "Nequi",
        "code": "1103",
        "description": "Cuenta Nequi",
        "account_type": AccountType.ASSET_CURRENT
    },
    "banco": {
        "name": "Banco",
        "code": "1104",
        "description": "Cuentas bancarias (transferencias + tarjetas)",
        "account_type": AccountType.ASSET_CURRENT
    }
}

# Mapeo de payment_method a tipo de cuenta para INGRESOS (ventas, pagos de encargos/arreglos)
# El efectivo de ingresos va a Caja Menor (efectivo operativo)
INCOME_ACCOUNT_MAP = {
    AccPaymentMethod.CASH: "caja_menor",    # Efectivo -> Caja Menor (operativo)
    AccPaymentMethod.NEQUI: "nequi",        # Nequi -> Cuenta Nequi
    AccPaymentMethod.TRANSFER: "banco",     # Transferencia -> Banco
    AccPaymentMethod.CARD: "banco",         # Tarjeta -> Banco
    AccPaymentMethod.CREDIT: None,          # Crédito -> No afecta cuentas (genera CxC)
    AccPaymentMethod.OTHER: None            # Otro -> No afecta cuentas
}

# Mapeo de payment_method a tipo de cuenta para GASTOS (expenses del negocio)
# El efectivo de gastos sale de Caja Mayor (efectivo consolidado)
EXPENSE_ACCOUNT_MAP = {
    AccPaymentMethod.CASH: "caja_mayor",    # Efectivo -> Caja Mayor (consolidado)
    AccPaymentMethod.NEQUI: "nequi",        # Nequi -> Cuenta Nequi
    AccPaymentMethod.TRANSFER: "banco",     # Transferencia -> Banco
    AccPaymentMethod.CARD: "banco",         # Tarjeta -> Banco
    AccPaymentMethod.CREDIT: None,          # Crédito -> No afecta cuentas (genera CxP)
    AccPaymentMethod.OTHER: None            # Otro -> No afecta cuentas
}

# Mapeo legacy para compatibilidad (usa mapeo de ingresos por defecto)
PAYMENT_METHOD_TO_ACCOUNT = INCOME_ACCOUNT_MAP

# Alias para compatibilidad con código legacy
LEGACY_ACCOUNT_ALIASES = {
    "caja": "caja_menor",  # "caja" ahora apunta a "caja_menor"
}


class BalanceIntegrationService:
    """
    Servicio para integrar transacciones con cuentas del balance.

    IMPORTANTE: Las cuentas son GLOBALES (school_id = NULL).
    Esto significa que todas las ventas de todos los colegios van a las mismas
    cuentas globales del negocio.

    Cuentas disponibles:
    - Caja Menor (1101): Efectivo operativo, se liquida diario
    - Caja Mayor (1102): Efectivo consolidado
    - Nequi (1103): Cuenta Nequi
    - Banco (1104): Transferencias y tarjetas

    Responsabilidades:
    - Crear cuentas globales si no existen
    - Mapear payment_method a la cuenta correspondiente
    - Actualizar saldos de cuentas al crear transacciones
    - Crear entradas de auditoría (BalanceEntry)
    - Liquidar Caja Menor a Caja Mayor
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_global_accounts(
        self,
        created_by: UUID | None = None
    ) -> dict[str, UUID]:
        """
        Obtiene o crea las cuentas globales (Caja, Banco).

        Estas cuentas tienen school_id = NULL (son del negocio, no de un colegio).

        Args:
            created_by: ID del usuario que crea las cuentas

        Returns:
            Dict con {tipo: uuid} para cada cuenta creada/existente
            Ej: {"caja": UUID(...), "banco": UUID(...)}
        """
        accounts_map = {}

        for account_key, account_config in DEFAULT_ACCOUNTS.items():
            # Buscar cuenta global existente (school_id IS NULL)
            result = await self.db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),  # Global account
                    BalanceAccount.code == account_config["code"],
                    BalanceAccount.is_active == True
                ).limit(1)
            )
            account = result.scalar_one_or_none()

            if not account:
                # Crear cuenta global si no existe
                account = BalanceAccount(
                    school_id=None,  # Global account
                    account_type=account_config["account_type"],
                    name=account_config["name"],
                    code=account_config["code"],
                    description=account_config["description"],
                    balance=Decimal("0"),
                    created_by=created_by,
                    is_active=True
                )
                self.db.add(account)
                await self.db.flush()

            accounts_map[account_key] = account.id

        return accounts_map

    async def get_global_account(self, code: str) -> BalanceAccount | None:
        """
        Obtiene una cuenta global por su código.

        Args:
            code: Código de la cuenta (ej: "1101" para Caja)

        Returns:
            BalanceAccount o None si no existe
        """
        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.code == code,
                BalanceAccount.school_id.is_(None),  # Global account
                BalanceAccount.is_active == True
            ).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_account_for_payment_method(
        self,
        payment_method: AccPaymentMethod
    ) -> UUID | None:
        """
        Obtiene el ID de la cuenta global para un método de pago.

        Args:
            payment_method: Método de pago (CASH, TRANSFER, etc.)

        Returns:
            UUID de la cuenta de balance, o None si no aplica (ej: CREDIT)
        """
        account_key = PAYMENT_METHOD_TO_ACCOUNT.get(payment_method)

        if account_key is None:
            return None

        account_code = DEFAULT_ACCOUNTS[account_key]["code"]
        account = await self.get_global_account(account_code)

        if account:
            return account.id

        # Si no existe, crear cuentas globales
        accounts_map = await self.get_or_create_global_accounts()
        return accounts_map.get(account_key)

    async def apply_transaction_to_balance(
        self,
        transaction: Transaction,
        created_by: UUID | None = None
    ) -> BalanceEntry | None:
        """
        Aplica el efecto de una transacción a la cuenta de balance global.

        - INCOME con CASH -> +amount a Caja Global
        - INCOME con TRANSFER -> +amount a Banco Global
        - EXPENSE con CASH -> -amount de Caja Global
        - EXPENSE con TRANSFER -> -amount de Banco Global
        - CREDIT -> No afecta cuentas (retorna None)

        Args:
            transaction: La transacción a aplicar
            created_by: ID del usuario

        Returns:
            BalanceEntry creado, o None si no aplica
        """
        # CREDIT no afecta cuentas de balance
        if transaction.payment_method == AccPaymentMethod.CREDIT:
            return None

        # Obtener cuenta global destino
        account_id = await self.get_account_for_payment_method(
            transaction.payment_method
        )

        if not account_id:
            return None

        # Obtener cuenta
        result = await self.db.execute(
            select(BalanceAccount).where(BalanceAccount.id == account_id)
        )
        account = result.scalar_one_or_none()

        if not account:
            return None

        # Calcular delta según tipo de transacción
        # INCOME = +amount (dinero entra)
        # EXPENSE = -amount (dinero sale)
        if transaction.type == TransactionType.INCOME:
            delta = transaction.amount
        elif transaction.type == TransactionType.EXPENSE:
            delta = -transaction.amount
        else:
            # TRANSFER: se maneja diferente (requiere cuenta origen y destino)
            return None

        # Actualizar balance de la cuenta
        new_balance = account.balance + delta
        account.balance = new_balance

        # Actualizar balance_account_id en la transacción
        transaction.balance_account_id = account_id

        # Crear BalanceEntry para auditoría
        # school_id en entry puede ser NULL (global) o el school_id de la transacción
        entry = BalanceEntry(
            account_id=account_id,
            school_id=transaction.school_id,  # Puede ser NULL o UUID (para reportes)
            entry_date=transaction.transaction_date,
            amount=delta,
            balance_after=new_balance,
            description=f"Auto: {transaction.description}",
            reference=transaction.reference_code,
            created_by=created_by
        )
        self.db.add(entry)

        await self.db.flush()

        return entry

    async def apply_transfer(
        self,
        transaction: Transaction,
        from_account_id: UUID,
        to_account_id: UUID,
        created_by: UUID | None = None
    ) -> tuple[BalanceEntry, BalanceEntry]:
        """
        Aplica una transferencia entre cuentas.

        Args:
            transaction: Transacción de tipo TRANSFER
            from_account_id: Cuenta origen
            to_account_id: Cuenta destino
            created_by: ID del usuario

        Returns:
            Tupla con (entry_from, entry_to)
        """
        # Obtener cuenta origen
        result = await self.db.execute(
            select(BalanceAccount).where(BalanceAccount.id == from_account_id)
        )
        from_account = result.scalar_one_or_none()

        # Obtener cuenta destino
        result = await self.db.execute(
            select(BalanceAccount).where(BalanceAccount.id == to_account_id)
        )
        to_account = result.scalar_one_or_none()

        if not from_account or not to_account:
            raise ValueError("Cuentas de transferencia no encontradas")

        amount = transaction.amount

        # Descontar de cuenta origen
        from_account.balance -= amount
        entry_from = BalanceEntry(
            account_id=from_account_id,
            school_id=None,  # Transferencias son globales
            entry_date=transaction.transaction_date,
            amount=-amount,
            balance_after=from_account.balance,
            description=f"Transferencia a {to_account.name}: {transaction.description}",
            reference=transaction.reference_code,
            created_by=created_by
        )
        self.db.add(entry_from)

        # Agregar a cuenta destino
        to_account.balance += amount
        entry_to = BalanceEntry(
            account_id=to_account_id,
            school_id=None,  # Transferencias son globales
            entry_date=transaction.transaction_date,
            amount=amount,
            balance_after=to_account.balance,
            description=f"Transferencia desde {from_account.name}: {transaction.description}",
            reference=transaction.reference_code,
            created_by=created_by
        )
        self.db.add(entry_to)

        # Actualizar transaction
        transaction.balance_account_id = from_account_id
        transaction.transfer_to_account_id = to_account_id

        await self.db.flush()

        return entry_from, entry_to

    async def get_global_cash_balances(self) -> dict:
        """
        Obtiene los saldos actuales globales de todas las cuentas líquidas.

        Returns:
            Dict con información de saldos:
            {
                "caja_menor": {"id": UUID, "name": str, "balance": Decimal, "code": str},
                "caja_mayor": {"id": UUID, "name": str, "balance": Decimal, "code": str},
                "nequi": {"id": UUID, "name": str, "balance": Decimal, "code": str},
                "banco": {"id": UUID, "name": str, "balance": Decimal, "code": str},
                "total_liquid": Decimal,
                "total_cash": Decimal  # caja_menor + caja_mayor
            }
        """
        # Obtener/crear cuentas globales
        accounts_map = await self.get_or_create_global_accounts()

        result = {
            "caja_menor": None,
            "caja_mayor": None,
            "nequi": None,
            "banco": None,
            "total_liquid": Decimal("0"),
            "total_cash": Decimal("0")
        }

        for account_key in ["caja_menor", "caja_mayor", "nequi", "banco"]:
            account_id = accounts_map.get(account_key)
            if account_id:
                account_result = await self.db.execute(
                    select(BalanceAccount).where(BalanceAccount.id == account_id)
                )
                account = account_result.scalar_one_or_none()
                if account:
                    result[account_key] = {
                        "id": str(account.id),
                        "name": account.name,
                        "code": account.code,
                        "balance": account.balance,
                        "last_updated": account.updated_at.isoformat() if account.updated_at else None
                    }
                    result["total_liquid"] += account.balance
                    # Sumar efectivo (caja_menor + caja_mayor)
                    if account_key in ["caja_menor", "caja_mayor"]:
                        result["total_cash"] += account.balance

        return result

    # Legacy method for backwards compatibility
    async def get_cash_balances(self, school_id: UUID | None = None) -> dict:
        """
        Obtiene los saldos de Caja y Banco.

        NOTA: school_id se ignora - siempre retorna saldos globales.
        Este método existe por compatibilidad con código existente.

        Args:
            school_id: Ignorado (compatibilidad)

        Returns:
            Dict con saldos globales
        """
        return await self.get_global_cash_balances()

    async def initialize_global_accounts(
        self,
        caja_menor_initial_balance: Decimal = Decimal("0"),
        caja_mayor_initial_balance: Decimal = Decimal("0"),
        nequi_initial_balance: Decimal = Decimal("0"),
        banco_initial_balance: Decimal = Decimal("0"),
        created_by: UUID | None = None
    ) -> dict[str, UUID]:
        """
        Inicializa las cuentas globales con saldos iniciales.
        Útil para configuración inicial del sistema.

        Args:
            caja_menor_initial_balance: Saldo inicial de Caja Menor
            caja_mayor_initial_balance: Saldo inicial de Caja Mayor
            nequi_initial_balance: Saldo inicial de Nequi
            banco_initial_balance: Saldo inicial de Banco
            created_by: ID del usuario

        Returns:
            Dict con {tipo: uuid}
        """
        accounts_map = {}

        initial_balances = {
            "caja_menor": caja_menor_initial_balance,
            "caja_mayor": caja_mayor_initial_balance,
            "nequi": nequi_initial_balance,
            "banco": banco_initial_balance
        }

        for account_key, account_config in DEFAULT_ACCOUNTS.items():
            initial_balance = initial_balances.get(account_key, Decimal("0"))

            # Buscar cuenta global existente
            result = await self.db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.school_id.is_(None),  # Global
                    BalanceAccount.code == account_config["code"]
                ).limit(1)
            )
            account = result.scalar_one_or_none()

            if account:
                # Actualizar balance si ya existe
                account.balance = initial_balance
            else:
                # Crear nueva cuenta global
                account = BalanceAccount(
                    school_id=None,  # Global
                    account_type=account_config["account_type"],
                    name=account_config["name"],
                    code=account_config["code"],
                    description=account_config["description"],
                    balance=initial_balance,
                    created_by=created_by,
                    is_active=True
                )
                self.db.add(account)

            await self.db.flush()
            accounts_map[account_key] = account.id

            # Crear BalanceEntry inicial si hay balance
            if initial_balance != Decimal("0"):
                entry = BalanceEntry(
                    account_id=account.id,
                    school_id=None,  # Global entry
                    entry_date=get_colombia_date(),
                    amount=initial_balance,
                    balance_after=initial_balance,
                    description="Saldo inicial",
                    created_by=created_by
                )
                self.db.add(entry)

        await self.db.flush()

        return accounts_map

    # Legacy method - redirects to global
    async def get_or_create_default_accounts(
        self,
        school_id: UUID | None = None,
        created_by: UUID | None = None
    ) -> dict[str, UUID]:
        """
        Legacy method - redirects to get_or_create_global_accounts.

        NOTA: school_id se ignora - siempre usa cuentas globales.
        """
        return await self.get_or_create_global_accounts(created_by)

    # Legacy method - redirects to global
    async def initialize_default_accounts_for_school(
        self,
        school_id: UUID | None = None,
        caja_initial_balance: Decimal = Decimal("0"),
        banco_initial_balance: Decimal = Decimal("0"),
        created_by: UUID | None = None
    ) -> dict[str, UUID]:
        """
        Legacy method - redirects to initialize_global_accounts.

        NOTA: school_id se ignora - siempre usa cuentas globales.
        caja_initial_balance se aplica a caja_menor por compatibilidad.
        """
        return await self.initialize_global_accounts(
            caja_menor_initial_balance=caja_initial_balance,
            banco_initial_balance=banco_initial_balance,
            created_by=created_by
        )

    async def record_expense_payment(
        self,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        description: str,
        created_by: UUID | None = None,
        allow_negative: bool = False
    ) -> BalanceEntry | None:
        """
        Registra el pago de un gasto (reduce Caja Mayor o Banco).

        IMPORTANTE: Los gastos en efectivo salen de Caja Mayor (no Caja Menor).
        Caja Menor es solo para ingresos operativos (ventas).

        Args:
            amount: Monto del pago
            payment_method: Método de pago (CASH -> Caja Mayor, TRANSFER/CARD -> Banco)
            description: Descripción del pago
            created_by: ID del usuario
            allow_negative: Si es True, permite balance negativo (default False)

        Returns:
            BalanceEntry creado, o None si no aplica (ej: CREDIT)

        Raises:
            ValueError: Si no hay fondos suficientes y allow_negative es False
        """
        # CREDIT no afecta cuentas
        if payment_method == AccPaymentMethod.CREDIT:
            return None

        # Obtener cuenta según método de pago usando mapeo de GASTOS
        # CASH -> Caja Mayor (no Caja Menor)
        account_key = EXPENSE_ACCOUNT_MAP.get(payment_method)
        if account_key is None:
            return None

        account_code = DEFAULT_ACCOUNTS[account_key]["code"]
        account = await self.get_global_account(account_code)

        if not account:
            # Si no existe, crear cuentas globales y obtener la correcta
            accounts_map = await self.get_or_create_global_accounts()
            account_id = accounts_map.get(account_key)
            if not account_id:
                return None
            result = await self.db.execute(
                select(BalanceAccount).where(BalanceAccount.id == account_id)
            )
            account = result.scalar_one_or_none()

        if not account:
            return None

        account_id = account.id

        # Validar fondos suficientes
        new_balance = account.balance - amount
        if new_balance < 0 and not allow_negative:
            raise ValueError(
                f"Fondos insuficientes en {account.name}. "
                f"Disponible: ${account.balance:,.2f}, Requerido: ${amount:,.2f}"
            )

        # Restar del balance (gasto = dinero sale)
        account.balance = new_balance

        # Crear BalanceEntry para auditoría
        entry = BalanceEntry(
            account_id=account_id,
            school_id=None,  # Pagos de gastos son globales
            entry_date=get_colombia_date(),
            amount=-amount,
            balance_after=new_balance,
            description=description,
            created_by=created_by
        )
        self.db.add(entry)

        await self.db.flush()

        return entry

    async def record_income(
        self,
        amount: Decimal,
        payment_method: AccPaymentMethod,
        description: str,
        school_id: UUID | None = None,
        created_by: UUID | None = None
    ) -> BalanceEntry | None:
        """
        Registra un ingreso (aumenta Caja Menor o Banco).

        IMPORTANTE: Los ingresos en efectivo van a Caja Menor (efectivo operativo).
        Esto incluye ventas, pagos de encargos y pagos de arreglos.

        Args:
            amount: Monto del ingreso
            payment_method: Método de pago (CASH -> Caja Menor, TRANSFER/CARD -> Banco)
            description: Descripción del ingreso
            school_id: ID del colegio (para reportes, la cuenta es global)
            created_by: ID del usuario

        Returns:
            BalanceEntry creado, o None si no aplica (ej: CREDIT)
        """
        # CREDIT no afecta cuentas
        if payment_method == AccPaymentMethod.CREDIT:
            return None

        # Obtener cuenta según método de pago
        account_id = await self.get_account_for_payment_method(payment_method)

        if not account_id:
            return None

        # Obtener cuenta
        result = await self.db.execute(
            select(BalanceAccount).where(BalanceAccount.id == account_id)
        )
        account = result.scalar_one_or_none()

        if not account:
            return None

        # Sumar al balance (ingreso = dinero entra)
        new_balance = account.balance + amount
        account.balance = new_balance

        # Crear BalanceEntry para auditoría
        entry = BalanceEntry(
            account_id=account_id,
            school_id=school_id,  # Para reportes por colegio
            entry_date=get_colombia_date(),
            amount=amount,
            balance_after=new_balance,
            description=description,
            created_by=created_by
        )
        self.db.add(entry)

        await self.db.flush()

        return entry

    async def get_account_balance(self, account_key: str) -> Decimal | None:
        """
        Obtiene el balance de una cuenta por su clave.

        Args:
            account_key: Clave de la cuenta (caja_menor, caja_mayor, nequi, banco)

        Returns:
            Balance actual o None si no existe
        """
        # Resolver alias
        account_key = LEGACY_ACCOUNT_ALIASES.get(account_key, account_key)

        account_info = DEFAULT_ACCOUNTS.get(account_key)
        if not account_info:
            return None

        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.code == account_info["code"],
                BalanceAccount.school_id.is_(None)
            ).limit(1)
        )
        account = result.scalar_one_or_none()

        return account.balance if account else None

    async def record_expense_payment_from_account(
        self,
        amount: Decimal,
        account_key: str,
        description: str,
        created_by: UUID | None = None,
        allow_negative: bool = False
    ) -> BalanceEntry | None:
        """
        Registra el pago de un gasto desde una cuenta específica.

        A diferencia de record_expense_payment que usa el mapeo de payment_method,
        este método permite especificar directamente la cuenta (ej: caja_mayor).

        Args:
            amount: Monto del pago
            account_key: Clave de la cuenta (caja_menor, caja_mayor, nequi, banco)
            description: Descripción del pago
            created_by: ID del usuario
            allow_negative: Si es True, permite balance negativo (default False)

        Returns:
            BalanceEntry creado, o None si la cuenta no existe

        Raises:
            ValueError: Si no hay fondos suficientes y allow_negative es False
        """
        # Resolver alias
        account_key = LEGACY_ACCOUNT_ALIASES.get(account_key, account_key)

        account_info = DEFAULT_ACCOUNTS.get(account_key)
        if not account_info:
            return None

        # Obtener cuenta por código
        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.code == account_info["code"],
                BalanceAccount.school_id.is_(None)
            ).limit(1)
        )
        account = result.scalar_one_or_none()

        if not account:
            return None

        # Validar fondos suficientes
        new_balance = account.balance - amount
        if new_balance < 0 and not allow_negative:
            raise ValueError(
                f"Fondos insuficientes en {account.name}. "
                f"Disponible: ${account.balance:,.2f}, Requerido: ${amount:,.2f}"
            )

        # Restar del balance (gasto = dinero sale)
        account.balance = new_balance

        # Crear BalanceEntry para auditoría
        entry = BalanceEntry(
            account_id=account.id,
            school_id=None,
            entry_date=get_colombia_date(),
            amount=-amount,
            balance_after=new_balance,
            description=description,
            created_by=created_by
        )
        self.db.add(entry)

        await self.db.flush()

        return entry
