"""
Telegram Digest & Proactive Reminders

Background tasks that run on a schedule (Colombia timezone):
- 9:00am  → pending expenses, overdue receivables, orders ready
- 6:00pm  → close cash reminder
- 8:00pm  → daily digest
- Sun 8pm → weekly summary
"""
import asyncio
import logging
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.accounting import (
    AccountsReceivable,
    BalanceAccount,
    DailyCashRegister,
    Expense,
    Transaction,
    TransactionType,
)
from app.models.order import Order, OrderStatus
from app.models.product import Inventory
from app.models.sale import Sale
from app.models.telegram_subscription import TelegramAlertType
from app.services.telegram import route_alert
from app.services.telegram_messages import TelegramMessageBuilder
from app.utils.timezone import get_colombia_date, get_colombia_now

logger = logging.getLogger(__name__)

# Track which tasks already ran today to avoid duplicates
_ran_today: dict[str, str] = {}  # task_key -> date_str


def _already_ran(task_key: str, date_str: str) -> bool:
    if _ran_today.get(task_key) == date_str:
        return True
    _ran_today[task_key] = date_str
    return False


async def _morning_reminders() -> None:
    """9am reminders: pending expenses, overdue receivables, orders ready."""
    try:
        async with AsyncSessionLocal() as db:
            today = get_colombia_date()

            # Pending expenses
            result = await db.execute(
                select(
                    func.count(Expense.id),
                    func.coalesce(func.sum(Expense.amount), 0),
                ).where(
                    Expense.is_paid == False,
                    Expense.due_date <= today,
                )
            )
            row = result.one()
            pending_count, pending_total = int(row[0]), Decimal(str(row[1]))
            if pending_count > 0:
                msg = TelegramMessageBuilder.reminder_pending_expenses(
                    pending_count, pending_total
                )
                await route_alert(TelegramAlertType.reminder_pending_expenses.value, msg)

            # Overdue receivables
            result = await db.execute(
                select(
                    func.count(AccountsReceivable.id),
                    func.coalesce(func.sum(AccountsReceivable.amount - AccountsReceivable.amount_paid), 0),
                ).where(
                    AccountsReceivable.is_paid == False,
                    AccountsReceivable.due_date.isnot(None),
                    AccountsReceivable.due_date < today,
                )
            )
            row = result.one()
            overdue_count, overdue_total = int(row[0]), Decimal(str(row[1]))
            if overdue_count > 0:
                msg = TelegramMessageBuilder.reminder_overdue_receivables(
                    overdue_count, overdue_total
                )
                await route_alert(TelegramAlertType.reminder_overdue_receivables.value, msg)

            # Orders ready for delivery
            result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.status == OrderStatus.READY
                )
            )
            ready_count = result.scalar() or 0
            if ready_count > 0:
                msg = TelegramMessageBuilder.reminder_orders_ready(ready_count)
                await route_alert(TelegramAlertType.reminder_orders_ready.value, msg)

    except Exception as e:
        logger.error("Morning reminders failed: %s", e)


async def _close_cash_reminder() -> None:
    """6pm reminder: check if cash register was closed today."""
    try:
        async with AsyncSessionLocal() as db:
            today = get_colombia_date()

            result = await db.execute(
                select(func.count(DailyCashRegister.id)).where(
                    DailyCashRegister.register_date == today
                )
            )
            count = result.scalar() or 0
            if count == 0:
                msg = TelegramMessageBuilder.reminder_close_cash()
                await route_alert(TelegramAlertType.reminder_close_cash.value, msg)

    except Exception as e:
        logger.error("Close cash reminder failed: %s", e)


async def _daily_digest() -> None:
    """8pm daily digest: sales, orders, balances, stock."""
    try:
        async with AsyncSessionLocal() as db:
            today = get_colombia_date()
            date_str = today.strftime("%d/%m/%Y")

            # Sales today
            result = await db.execute(
                select(
                    func.count(Sale.id),
                    func.coalesce(func.sum(Sale.total), 0),
                ).where(
                    func.date(Sale.sale_date) == today,
                    Sale.is_historical == False,
                )
            )
            row = result.one()
            total_sales, sales_revenue = int(row[0]), Decimal(str(row[1]))

            # Orders today
            result = await db.execute(
                select(func.count(Order.id)).where(
                    func.date(Order.created_at) == today
                )
            )
            total_orders = result.scalar() or 0

            # Pending orders (all time)
            result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.status.in_([OrderStatus.PENDING, OrderStatus.IN_PRODUCTION])
                )
            )
            pending_orders = result.scalar() or 0

            # Cash and bank balances (sum caja_menor + caja_mayor for cash)
            cash_balance = Decimal("0")
            bank_balance = Decimal("0")
            result = await db.execute(
                select(BalanceAccount).where(
                    BalanceAccount.code.in_(["caja_menor", "caja_mayor", "banco"])
                )
            )
            for acc in result.scalars().all():
                if acc.code in ("caja_menor", "caja_mayor"):
                    cash_balance += acc.balance or Decimal("0")
                elif acc.code == "banco":
                    bank_balance = acc.balance or Decimal("0")

            # Expenses today
            result = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    func.date(Transaction.transaction_date) == today,
                    Transaction.type == TransactionType.EXPENSE,
                )
            )
            expenses_total = Decimal(str(result.scalar() or 0))

            # Low stock products
            result = await db.execute(
                select(func.count(Inventory.id)).where(
                    Inventory.quantity <= Inventory.min_stock_alert
                )
            )
            low_stock_count = result.scalar() or 0

            msg = TelegramMessageBuilder.daily_digest(
                date_str=date_str,
                total_sales=total_sales,
                sales_revenue=sales_revenue,
                total_orders=total_orders,
                pending_orders=pending_orders,
                cash_balance=cash_balance,
                bank_balance=bank_balance,
                low_stock_count=low_stock_count,
                expenses_total=expenses_total,
            )
            await route_alert(TelegramAlertType.daily_digest.value, msg)

    except Exception as e:
        logger.error("Daily digest failed: %s", e)


async def _weekly_summary() -> None:
    """Sunday 8pm weekly summary."""
    try:
        async with AsyncSessionLocal() as db:
            today = get_colombia_date()
            week_start = today - timedelta(days=6)
            week_str = f"{week_start.strftime('%d/%m')} - {today.strftime('%d/%m/%Y')}"

            # Sales this week
            result = await db.execute(
                select(
                    func.count(Sale.id),
                    func.coalesce(func.sum(Sale.total), 0),
                ).where(
                    func.date(Sale.sale_date) >= week_start,
                    func.date(Sale.sale_date) <= today,
                    Sale.is_historical == False,
                )
            )
            row = result.one()
            total_sales, sales_revenue = int(row[0]), Decimal(str(row[1]))

            # Orders this week
            result = await db.execute(
                select(func.count(Order.id)).where(
                    func.date(Order.created_at) >= week_start,
                    func.date(Order.created_at) <= today,
                )
            )
            total_orders = result.scalar() or 0

            # Expenses this week
            result = await db.execute(
                select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    func.date(Transaction.transaction_date) >= week_start,
                    func.date(Transaction.transaction_date) <= today,
                    Transaction.type == TransactionType.EXPENSE,
                )
            )
            expenses_total = Decimal(str(result.scalar() or 0))

            net_result = sales_revenue - expenses_total

            msg = TelegramMessageBuilder.weekly_summary(
                week_str=week_str,
                total_sales=total_sales,
                sales_revenue=sales_revenue,
                total_orders=total_orders,
                expenses_total=expenses_total,
                net_result=net_result,
            )
            await route_alert(TelegramAlertType.reminder_weekly_summary.value, msg)

    except Exception as e:
        logger.error("Weekly summary failed: %s", e)


async def telegram_digest_loop() -> None:
    """Main background loop. Checks Colombia time every 60s and triggers tasks."""
    logger.info("Telegram digest loop started")

    while True:
        await asyncio.sleep(60)

        try:
            now = get_colombia_now()
            hour = now.hour
            minute = now.minute
            date_str = now.strftime("%Y-%m-%d")
            weekday = now.weekday()  # 0=Monday, 6=Sunday

            # 9:00am reminders (run once per day, within first 2 minutes of the hour)
            if hour == 9 and minute < 2 and not _already_ran("morning", date_str):
                await _morning_reminders()

            # 6:00pm close cash reminder
            if hour == 18 and minute < 2 and not _already_ran("close_cash", date_str):
                await _close_cash_reminder()

            # 8:00pm daily digest
            if hour == 20 and minute < 2 and not _already_ran("daily_digest", date_str):
                await _daily_digest()

            # Sunday 8:00pm weekly summary
            if weekday == 6 and hour == 20 and minute < 2 and not _already_ran("weekly", date_str):
                await _weekly_summary()

        except Exception as e:
            logger.error("Digest loop iteration failed: %s", e)
