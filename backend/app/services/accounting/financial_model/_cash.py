"""Saldo de caja disponible: fuente única.

El "saldo de caja" (suma de cuentas ``ASSET_CURRENT`` activas: efectivo +
banco + Nequi) se calculaba inline e idéntico en cinco servicios del modelo
financiero (``cfo_dashboard``, ``forecast``, ``trends``,
``executive_summary`` y ``_runway``). Cinco copias byte-idénticas son
frágiles: el día que una agregue o quite un filtro (p.ej. excluir una cuenta
puente), las demás divergen y el usuario ve una liquidez distinta según el
panel. Esta es la definición canónica — reusar, no recalcular.
"""
from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.accounting import AccountType, BalanceAccount

ZERO = Decimal("0")


async def current_cash_balance(db: AsyncSession) -> Decimal:
    """Saldo actual de activos corrientes (caja + banco + Nequi).

    Suma ``balance`` de las cuentas ``ASSET_CURRENT`` activas. Devuelve
    siempre ``Decimal`` (nunca ``None``: la suma vacía hace ``coalesce`` a 0).
    """
    stmt = select(func.coalesce(func.sum(BalanceAccount.balance), ZERO)).where(
        BalanceAccount.account_type == AccountType.ASSET_CURRENT,
        BalanceAccount.is_active == True,  # noqa: E712 (idioma SQLAlchemy)
    )
    result = await db.execute(stmt)
    return Decimal(str(result.scalar()))
