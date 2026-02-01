"""
Expense Adjustment Service

Handles expense rollbacks, corrections, and reversals.
Maintains accounting integrity by creating compensatory balance entries.

IMPORTANT: When adjusting paid expenses:
1. Refund to original account (positive balance entry)
2. If account changes, deduct from new account (negative balance entry)
3. Update expense payment state
4. Record adjustment for audit trail
"""
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date
from app.models.accounting import (
    Expense,
    ExpenseAdjustment,
    AdjustmentReason,
    BalanceAccount,
    BalanceEntry,
    AccPaymentMethod,
)


class ExpenseAdjustmentService:
    """
    Service for managing expense adjustments and rollbacks.

    Handles:
    - Amount corrections (change payment amount)
    - Account corrections (move payment between accounts)
    - Complete reversals (undo entire payment)
    - Partial refunds

    All operations maintain double-entry accounting integrity.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_expense_by_id(
        self,
        expense_id: UUID,
        include_adjustments: bool = False
    ) -> Expense | None:
        """
        Get an expense by ID with optional adjustment history.

        Args:
            expense_id: The expense UUID
            include_adjustments: Whether to eagerly load adjustments

        Returns:
            Expense or None if not found
        """
        query = select(Expense).where(
            Expense.id == expense_id,
            Expense.is_active == True
        )

        if include_adjustments:
            query = query.options(selectinload(Expense.adjustments))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_account_by_id(self, account_id: UUID) -> BalanceAccount | None:
        """Get a balance account by ID."""
        result = await self.db.execute(
            select(BalanceAccount).where(
                BalanceAccount.id == account_id,
                BalanceAccount.is_active == True
            )
        )
        return result.scalar_one_or_none()

    async def adjust_expense(
        self,
        expense_id: UUID,
        new_amount: Decimal | None = None,
        new_payment_account_id: UUID | None = None,
        new_payment_method: str | None = None,
        reason: AdjustmentReason = AdjustmentReason.AMOUNT_CORRECTION,
        description: str | None = None,
        adjusted_by: UUID | None = None
    ) -> ExpenseAdjustment:
        """
        Adjust a paid expense's amount and/or payment account.

        This method handles:
        1. Amount corrections: Refund difference to original account
        2. Account corrections: Move payment from old to new account
        3. Both: Combine above operations

        Args:
            expense_id: The expense to adjust
            new_amount: New expense amount (if changing)
            new_payment_account_id: New payment account (if moving)
            new_payment_method: New payment method string (if changing)
            reason: Reason for adjustment
            description: Description of the adjustment
            adjusted_by: User making the adjustment

        Returns:
            ExpenseAdjustment record

        Raises:
            ValueError: If expense not found, not paid, or invalid parameters
        """
        # Get expense
        expense = await self.get_expense_by_id(expense_id)
        if not expense:
            raise ValueError(f"Gasto no encontrado: {expense_id}")

        if not expense.is_paid and expense.amount_paid == Decimal("0"):
            raise ValueError("No se puede ajustar un gasto que no ha sido pagado")

        # Validate at least one change is being made
        amount_changing = new_amount is not None and new_amount != expense.amount
        account_changing = (
            new_payment_account_id is not None and
            new_payment_account_id != expense.payment_account_id
        )

        if not amount_changing and not account_changing:
            raise ValueError("Debe especificar un nuevo monto o una nueva cuenta de pago")

        # Determine adjustment reason if not specified correctly
        if amount_changing and account_changing:
            reason = AdjustmentReason.BOTH_CORRECTION
        elif account_changing and reason == AdjustmentReason.AMOUNT_CORRECTION:
            reason = AdjustmentReason.ACCOUNT_CORRECTION

        # Store previous values
        previous_amount = expense.amount
        previous_amount_paid = expense.amount_paid
        previous_payment_method = expense.payment_method
        previous_payment_account_id = expense.payment_account_id

        # Calculate adjustments
        if new_amount is None:
            new_amount = expense.amount

        # The key insight: if expense amount changes, we adjust amount_paid proportionally
        # If only account changes, amount_paid stays the same
        if amount_changing:
            # If reducing expense amount, check if amount_paid exceeds new amount
            if new_amount < expense.amount_paid:
                # Partial refund needed
                refund_amount = expense.amount_paid - new_amount
                new_amount_paid = new_amount
            else:
                # Amount increased or stayed same, amount_paid unchanged
                refund_amount = Decimal("0")
                new_amount_paid = expense.amount_paid
        else:
            refund_amount = Decimal("0")
            new_amount_paid = expense.amount_paid

        # Handle account change
        refund_entry = None
        new_payment_entry = None

        if account_changing and expense.payment_account_id:
            # Get old and new accounts
            old_account = await self.get_account_by_id(expense.payment_account_id)
            new_account = await self.get_account_by_id(new_payment_account_id) if new_payment_account_id else None

            if old_account:
                # Refund to old account (add back the payment)
                old_account.balance += expense.amount_paid
                refund_entry = BalanceEntry(
                    account_id=old_account.id,
                    school_id=None,
                    entry_date=get_colombia_date(),
                    amount=expense.amount_paid,
                    balance_after=old_account.balance,
                    description=f"Ajuste gasto: devolución de {expense.description}",
                    reference=f"ADJ-{expense_id}",
                    created_by=adjusted_by
                )
                self.db.add(refund_entry)

            if new_account:
                # Deduct from new account
                new_balance = new_account.balance - new_amount_paid
                if new_balance < Decimal("0"):
                    raise ValueError(
                        f"Fondos insuficientes en {new_account.name}. "
                        f"Disponible: ${new_account.balance:,.2f}, Requerido: ${new_amount_paid:,.2f}"
                    )
                new_account.balance = new_balance
                new_payment_entry = BalanceEntry(
                    account_id=new_account.id,
                    school_id=None,
                    entry_date=get_colombia_date(),
                    amount=-new_amount_paid,
                    balance_after=new_balance,
                    description=f"Ajuste gasto: pago de {expense.description}",
                    reference=f"ADJ-{expense_id}",
                    created_by=adjusted_by
                )
                self.db.add(new_payment_entry)

        elif amount_changing and refund_amount > Decimal("0") and expense.payment_account_id:
            # Only amount changing with refund needed
            old_account = await self.get_account_by_id(expense.payment_account_id)
            if old_account:
                old_account.balance += refund_amount
                refund_entry = BalanceEntry(
                    account_id=old_account.id,
                    school_id=None,
                    entry_date=get_colombia_date(),
                    amount=refund_amount,
                    balance_after=old_account.balance,
                    description=f"Ajuste gasto: reembolso parcial de {expense.description}",
                    reference=f"ADJ-{expense_id}",
                    created_by=adjusted_by
                )
                self.db.add(refund_entry)

        await self.db.flush()

        # Calculate delta (positive = money returned to accounts)
        if account_changing:
            adjustment_delta = expense.amount_paid - new_amount_paid
        else:
            adjustment_delta = refund_amount

        # Update expense
        expense.amount = new_amount
        expense.amount_paid = new_amount_paid
        if account_changing:
            expense.payment_account_id = new_payment_account_id
            if new_payment_method:
                expense.payment_method = new_payment_method

        # Update is_paid status
        expense.is_paid = expense.amount_paid >= expense.amount

        # Create adjustment record
        adjustment = ExpenseAdjustment(
            expense_id=expense_id,
            reason=reason,
            description=description or f"Ajuste de gasto: {reason.value}",
            previous_amount=previous_amount,
            previous_amount_paid=previous_amount_paid,
            previous_payment_method=previous_payment_method,
            previous_payment_account_id=previous_payment_account_id,
            new_amount=new_amount,
            new_amount_paid=new_amount_paid,
            new_payment_method=expense.payment_method,
            new_payment_account_id=expense.payment_account_id,
            adjustment_delta=adjustment_delta,
            refund_entry_id=refund_entry.id if refund_entry else None,
            new_payment_entry_id=new_payment_entry.id if new_payment_entry else None,
            adjusted_by=adjusted_by
        )
        self.db.add(adjustment)

        await self.db.flush()
        await self.db.refresh(adjustment)

        return adjustment

    async def revert_expense_payment(
        self,
        expense_id: UUID,
        description: str | None = None,
        adjusted_by: UUID | None = None
    ) -> ExpenseAdjustment:
        """
        Completely revert an expense payment (full rollback).

        This returns the paid amount to the original account and
        marks the expense as unpaid.

        Args:
            expense_id: The expense to revert
            description: Description of the reversal
            adjusted_by: User making the reversal

        Returns:
            ExpenseAdjustment record

        Raises:
            ValueError: If expense not found or not paid
        """
        # Get expense
        expense = await self.get_expense_by_id(expense_id)
        if not expense:
            raise ValueError(f"Gasto no encontrado: {expense_id}")

        if expense.amount_paid == Decimal("0"):
            raise ValueError("No se puede revertir un gasto que no ha sido pagado")

        # Store previous values
        previous_amount = expense.amount
        previous_amount_paid = expense.amount_paid
        previous_payment_method = expense.payment_method
        previous_payment_account_id = expense.payment_account_id

        refund_entry = None

        # Refund to original account
        if expense.payment_account_id:
            account = await self.get_account_by_id(expense.payment_account_id)
            if account:
                # Add back the full payment
                account.balance += expense.amount_paid
                refund_entry = BalanceEntry(
                    account_id=account.id,
                    school_id=None,
                    entry_date=get_colombia_date(),
                    amount=expense.amount_paid,
                    balance_after=account.balance,
                    description=f"Reversión de gasto: {expense.description}",
                    reference=f"REV-{expense_id}",
                    created_by=adjusted_by
                )
                self.db.add(refund_entry)

        await self.db.flush()

        # Create adjustment record
        adjustment = ExpenseAdjustment(
            expense_id=expense_id,
            reason=AdjustmentReason.ERROR_REVERSAL,
            description=description or f"Reversión completa de pago de gasto",
            previous_amount=previous_amount,
            previous_amount_paid=previous_amount_paid,
            previous_payment_method=previous_payment_method,
            previous_payment_account_id=previous_payment_account_id,
            new_amount=expense.amount,  # Amount stays the same
            new_amount_paid=Decimal("0"),  # Payment reverted
            new_payment_method=None,
            new_payment_account_id=None,
            adjustment_delta=previous_amount_paid,  # Full refund
            refund_entry_id=refund_entry.id if refund_entry else None,
            new_payment_entry_id=None,
            adjusted_by=adjusted_by
        )
        self.db.add(adjustment)

        # Update expense
        expense.amount_paid = Decimal("0")
        expense.is_paid = False
        expense.payment_method = None
        expense.payment_account_id = None
        expense.paid_at = None

        await self.db.flush()
        await self.db.refresh(adjustment)

        return adjustment

    async def get_adjustment_history(
        self,
        expense_id: UUID
    ) -> list[ExpenseAdjustment]:
        """
        Get the adjustment history for an expense.

        Args:
            expense_id: The expense UUID

        Returns:
            List of adjustments ordered by date descending
        """
        result = await self.db.execute(
            select(ExpenseAdjustment)
            .where(ExpenseAdjustment.expense_id == expense_id)
            .order_by(ExpenseAdjustment.adjusted_at.desc())
        )
        return list(result.scalars().all())

    async def get_adjustments_by_date_range(
        self,
        start_date: date,
        end_date: date,
        reason: AdjustmentReason | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[list[ExpenseAdjustment], int]:
        """
        Get adjustments within a date range.

        Args:
            start_date: Start date (inclusive)
            end_date: End date (inclusive)
            reason: Filter by reason (optional)
            limit: Maximum records to return
            offset: Records to skip

        Returns:
            Tuple of (adjustments, total_count)
        """
        from sqlalchemy import func

        # Build base query
        query = select(ExpenseAdjustment).where(
            ExpenseAdjustment.adjusted_at >= datetime.combine(start_date, datetime.min.time()),
            ExpenseAdjustment.adjusted_at <= datetime.combine(end_date, datetime.max.time())
        )

        if reason:
            query = query.where(ExpenseAdjustment.reason == reason)

        # Count total
        count_query = select(func.count(ExpenseAdjustment.id)).where(
            ExpenseAdjustment.adjusted_at >= datetime.combine(start_date, datetime.min.time()),
            ExpenseAdjustment.adjusted_at <= datetime.combine(end_date, datetime.max.time())
        )
        if reason:
            count_query = count_query.where(ExpenseAdjustment.reason == reason)

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0

        # Get paginated results
        query = query.order_by(ExpenseAdjustment.adjusted_at.desc()).limit(limit).offset(offset)
        result = await self.db.execute(query)
        adjustments = list(result.scalars().all())

        return adjustments, total

    async def partial_refund(
        self,
        expense_id: UUID,
        refund_amount: Decimal,
        description: str | None = None,
        adjusted_by: UUID | None = None
    ) -> ExpenseAdjustment:
        """
        Issue a partial refund on an expense payment.

        This reduces the amount_paid and returns the difference to the account.

        Args:
            expense_id: The expense to refund
            refund_amount: Amount to refund (must be <= amount_paid)
            description: Description of the refund
            adjusted_by: User making the refund

        Returns:
            ExpenseAdjustment record

        Raises:
            ValueError: If expense not found, not paid, or refund exceeds payment
        """
        # Get expense
        expense = await self.get_expense_by_id(expense_id)
        if not expense:
            raise ValueError(f"Gasto no encontrado: {expense_id}")

        if expense.amount_paid == Decimal("0"):
            raise ValueError("No se puede reembolsar un gasto que no ha sido pagado")

        if refund_amount <= Decimal("0"):
            raise ValueError("El monto de reembolso debe ser positivo")

        if refund_amount > expense.amount_paid:
            raise ValueError(
                f"El monto de reembolso (${refund_amount:,.2f}) excede "
                f"el monto pagado (${expense.amount_paid:,.2f})"
            )

        # Store previous values
        previous_amount = expense.amount
        previous_amount_paid = expense.amount_paid
        previous_payment_method = expense.payment_method
        previous_payment_account_id = expense.payment_account_id

        refund_entry = None

        # Refund to original account
        if expense.payment_account_id:
            account = await self.get_account_by_id(expense.payment_account_id)
            if account:
                account.balance += refund_amount
                refund_entry = BalanceEntry(
                    account_id=account.id,
                    school_id=None,
                    entry_date=get_colombia_date(),
                    amount=refund_amount,
                    balance_after=account.balance,
                    description=f"Reembolso parcial de gasto: {expense.description}",
                    reference=f"REF-{expense_id}",
                    created_by=adjusted_by
                )
                self.db.add(refund_entry)

        await self.db.flush()

        # Calculate new amount_paid
        new_amount_paid = expense.amount_paid - refund_amount

        # Create adjustment record
        adjustment = ExpenseAdjustment(
            expense_id=expense_id,
            reason=AdjustmentReason.PARTIAL_REFUND,
            description=description or f"Reembolso parcial de ${refund_amount:,.2f}",
            previous_amount=previous_amount,
            previous_amount_paid=previous_amount_paid,
            previous_payment_method=previous_payment_method,
            previous_payment_account_id=previous_payment_account_id,
            new_amount=expense.amount,  # Amount stays the same
            new_amount_paid=new_amount_paid,
            new_payment_method=expense.payment_method,
            new_payment_account_id=expense.payment_account_id,
            adjustment_delta=refund_amount,
            refund_entry_id=refund_entry.id if refund_entry else None,
            new_payment_entry_id=None,
            adjusted_by=adjusted_by
        )
        self.db.add(adjustment)

        # Update expense
        expense.amount_paid = new_amount_paid
        expense.is_paid = expense.amount_paid >= expense.amount

        await self.db.flush()
        await self.db.refresh(adjustment)

        return adjustment
