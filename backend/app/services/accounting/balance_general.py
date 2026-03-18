"""
Balance General Service - Balance sheet reports
"""
from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    AccountType, BalanceAccount,
    AccountsReceivable, AccountsPayable
)
from app.schemas.accounting import (
    BalanceGeneralSummary, BalanceAccountsByType, BalanceGeneralDetailed,
    ReceivablesPayablesSummary, BalanceAccountListResponse
)
from app.services.accounting.balance_accounts import BalanceAccountService
from app.services.accounting.receivables import AccountsReceivableService
from app.services.accounting.payables import AccountsPayableService


class BalanceGeneralService:
    """High-level service for Balance General reports"""

    ACCOUNT_TYPE_LABELS = {
        AccountType.ASSET_CURRENT: "Activo Corriente",
        AccountType.ASSET_FIXED: "Activo Fijo",
        AccountType.ASSET_INTANGIBLE: "Activos Intangibles",
        AccountType.ASSET_OTHER: "Otros Activos",
        AccountType.LIABILITY_CURRENT: "Pasivo Corriente",
        AccountType.LIABILITY_LONG: "Pasivo a Largo Plazo",
        AccountType.LIABILITY_OTHER: "Otros Pasivos",
        AccountType.EQUITY_CAPITAL: "Capital",
        AccountType.EQUITY_RETAINED: "Utilidades Retenidas",
        AccountType.EQUITY_OTHER: "Otro Patrimonio",
    }

    def __init__(self, db: AsyncSession):
        self.db = db
        self.account_service = BalanceAccountService(db)
        self.receivable_service = AccountsReceivableService(db)
        self.payable_service = AccountsPayableService(db)

    async def get_balance_general_summary(
        self,
        school_id: UUID
    ) -> BalanceGeneralSummary:
        """Get balance general summary"""
        accounts = await self.account_service.get_all_active_accounts(school_id)

        # Calculate totals by category
        totals = {
            "current_assets": Decimal("0"),
            "fixed_assets": Decimal("0"),
            "intangible_assets": Decimal("0"),
            "other_assets": Decimal("0"),
            "current_liabilities": Decimal("0"),
            "long_liabilities": Decimal("0"),
            "other_liabilities": Decimal("0"),
            "equity": Decimal("0"),
        }

        for account in accounts:
            value = account.net_value
            if account.account_type == AccountType.ASSET_CURRENT:
                totals["current_assets"] += value
            elif account.account_type == AccountType.ASSET_FIXED:
                totals["fixed_assets"] += value
            elif account.account_type == AccountType.ASSET_INTANGIBLE:
                totals["intangible_assets"] += value
            elif account.account_type == AccountType.ASSET_OTHER:
                totals["other_assets"] += value
            elif account.account_type == AccountType.LIABILITY_CURRENT:
                totals["current_liabilities"] += value
            elif account.account_type == AccountType.LIABILITY_LONG:
                totals["long_liabilities"] += value
            elif account.account_type == AccountType.LIABILITY_OTHER:
                totals["other_liabilities"] += value
            else:  # Equity types
                totals["equity"] += value

        total_assets = totals["current_assets"] + totals["fixed_assets"] + totals["intangible_assets"] + totals["other_assets"]
        total_liabilities = totals["current_liabilities"] + totals["long_liabilities"] + totals["other_liabilities"]
        total_equity = totals["equity"]

        # Check if balanced (with small tolerance for rounding)
        is_balanced = abs(total_assets - (total_liabilities + total_equity)) < Decimal("0.01")

        return BalanceGeneralSummary(
            as_of_date=get_colombia_date(),
            total_current_assets=totals["current_assets"],
            total_fixed_assets=totals["fixed_assets"],
            total_intangible_assets=totals["intangible_assets"],
            total_other_assets=totals["other_assets"],
            total_assets=total_assets,
            total_current_liabilities=totals["current_liabilities"],
            total_long_liabilities=totals["long_liabilities"],
            total_other_liabilities=totals["other_liabilities"],
            total_liabilities=total_liabilities,
            total_equity=total_equity,
            is_balanced=is_balanced
        )

    async def get_balance_general_detailed(
        self,
        school_id: UUID
    ) -> BalanceGeneralDetailed:
        """Get detailed balance general with account breakdown"""
        accounts = await self.account_service.get_all_active_accounts(school_id)

        # Group accounts by type
        accounts_by_type: dict[AccountType, list[BalanceAccount]] = {}
        for account in accounts:
            if account.account_type not in accounts_by_type:
                accounts_by_type[account.account_type] = []
            accounts_by_type[account.account_type].append(account)

        def make_group(account_type: AccountType) -> BalanceAccountsByType:
            accts = accounts_by_type.get(account_type, [])
            return BalanceAccountsByType(
                account_type=account_type,
                account_type_label=self.ACCOUNT_TYPE_LABELS[account_type],
                accounts=[
                    BalanceAccountListResponse(
                        id=a.id,
                        account_type=a.account_type,
                        name=a.name,
                        code=a.code,
                        balance=a.balance,
                        net_value=a.net_value,
                        is_active=a.is_active
                    )
                    for a in accts
                ],
                total=sum(a.net_value for a in accts)
            )

        current_assets = make_group(AccountType.ASSET_CURRENT)
        fixed_assets = make_group(AccountType.ASSET_FIXED)
        intangible_assets = make_group(AccountType.ASSET_INTANGIBLE)
        other_assets = make_group(AccountType.ASSET_OTHER)

        current_liabilities = make_group(AccountType.LIABILITY_CURRENT)
        long_liabilities = make_group(AccountType.LIABILITY_LONG)
        other_liabilities = make_group(AccountType.LIABILITY_OTHER)

        equity = [
            make_group(AccountType.EQUITY_CAPITAL),
            make_group(AccountType.EQUITY_RETAINED),
            make_group(AccountType.EQUITY_OTHER),
        ]

        total_assets = current_assets.total + fixed_assets.total + intangible_assets.total + other_assets.total
        total_liabilities = current_liabilities.total + long_liabilities.total + other_liabilities.total
        total_equity = sum(e.total for e in equity)

        is_balanced = abs(total_assets - (total_liabilities + total_equity)) < Decimal("0.01")

        return BalanceGeneralDetailed(
            as_of_date=get_colombia_date(),
            current_assets=current_assets,
            fixed_assets=fixed_assets,
            intangible_assets=intangible_assets,
            other_assets=other_assets,
            current_liabilities=current_liabilities,
            long_liabilities=long_liabilities,
            other_liabilities=other_liabilities,
            equity=equity,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            total_equity=total_equity,
            is_balanced=is_balanced
        )

    async def get_receivables_payables_summary(
        self,
        school_id: UUID
    ) -> ReceivablesPayablesSummary:
        """Get summary of accounts receivable and payable"""
        # Update overdue statuses first
        await self.receivable_service.update_overdue_status(school_id)
        await self.payable_service.update_overdue_status(school_id)

        # Receivables summary
        receivables = await self.db.execute(
            select(
                func.count(AccountsReceivable.id).label('count'),
                func.coalesce(func.sum(AccountsReceivable.amount), 0).label('total'),
                func.coalesce(func.sum(AccountsReceivable.amount_paid), 0).label('paid'),
                func.coalesce(
                    func.sum(
                        case(
                            (AccountsReceivable.is_overdue == True, AccountsReceivable.amount - AccountsReceivable.amount_paid),
                            else_=0
                        )
                    ), 0
                ).label('overdue')
            ).where(
                AccountsReceivable.school_id == school_id
            )
        )
        r = receivables.one()

        # Payables summary
        payables = await self.db.execute(
            select(
                func.count(AccountsPayable.id).label('count'),
                func.coalesce(func.sum(AccountsPayable.amount), 0).label('total'),
                func.coalesce(func.sum(AccountsPayable.amount_paid), 0).label('paid'),
                func.coalesce(
                    func.sum(
                        case(
                            (AccountsPayable.is_overdue == True, AccountsPayable.amount - AccountsPayable.amount_paid),
                            else_=0
                        )
                    ), 0
                ).label('overdue')
            ).where(
                AccountsPayable.school_id == school_id
            )
        )
        p = payables.one()

        receivables_pending = Decimal(str(r.total)) - Decimal(str(r.paid))
        payables_pending = Decimal(str(p.total)) - Decimal(str(p.paid))

        return ReceivablesPayablesSummary(
            total_receivables=Decimal(str(r.total)),
            receivables_collected=Decimal(str(r.paid)),
            receivables_pending=receivables_pending,
            receivables_overdue=Decimal(str(r.overdue)),
            receivables_count=r.count,
            total_payables=Decimal(str(p.total)),
            payables_paid=Decimal(str(p.paid)),
            payables_pending=payables_pending,
            payables_overdue=Decimal(str(p.overdue)),
            payables_count=p.count,
            net_position=receivables_pending - payables_pending
        )
