"""
Payroll Service - Business logic for payroll management
"""
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.payroll import (
    Employee,
    PayrollRun,
    PayrollItem,
    PayrollStatus,
    PaymentFrequency,
)
from app.models.accounting import Expense, ExpenseCategory
from app.models.fixed_expense import (
    FixedExpense,
    FixedExpenseType,
    ExpenseFrequency as FixedExpenseFrequency,
    RecurrenceFrequency,
)
from app.schemas.payroll import PayrollRunCreate, PayrollRunUpdate, PayrollItemUpdate
from app.services.employee_service import employee_service
from app.services.workforce.attendance import attendance_service

# Constants for payroll fixed expenses
PAYROLL_FIXED_EXPENSE_VENDOR = "Empleados - Nómina Consolidada"

# Mapping of PaymentFrequency to FixedExpense names
PAYROLL_FREQUENCY_NAMES = {
    PaymentFrequency.DAILY: "Nómina Diaria",
    PaymentFrequency.WEEKLY: "Nómina Semanal",
    PaymentFrequency.BIWEEKLY: "Nómina Quincenal",
    PaymentFrequency.MONTHLY: "Nómina Mensual",
}


class PayrollService:
    """Service for payroll operations"""

    # ============================================
    # Payroll Run CRUD
    # ============================================

    async def get_payroll_runs(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        status: PayrollStatus | None = None,
    ) -> list[PayrollRun]:
        """Get all payroll runs with optional status filter"""
        stmt = select(PayrollRun)

        if status is not None:
            stmt = stmt.where(PayrollRun.status == status)

        stmt = stmt.order_by(PayrollRun.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_payroll_run(
        self,
        db: AsyncSession,
        payroll_id: UUID,
    ) -> PayrollRun | None:
        """Get a single payroll run with items"""
        stmt = (
            select(PayrollRun)
            .options(
                selectinload(PayrollRun.items).selectinload(PayrollItem.employee)
            )
            .where(PayrollRun.id == payroll_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_payroll_run(
        self,
        db: AsyncSession,
        data: PayrollRunCreate,
        *,
        created_by: UUID | None = None,
    ) -> PayrollRun:
        """Create a new payroll run with items for all active employees"""
        # Validate dates
        if data.period_end < data.period_start:
            raise ValueError("La fecha de fin debe ser mayor o igual a la fecha de inicio")

        # Get employees (specific list or all active)
        if data.employee_ids:
            employees = []
            for emp_id in data.employee_ids:
                emp = await employee_service.get_employee(db, emp_id)
                if emp and emp.is_active:
                    employees.append(emp)
        else:
            employees = await employee_service.get_employees(db, is_active=True)

        if not employees:
            raise ValueError("No hay empleados activos para incluir en la nómina")

        # Create payroll run
        payroll_run = PayrollRun(
            period_start=data.period_start,
            period_end=data.period_end,
            payment_date=data.payment_date,
            notes=data.notes,
            status=PayrollStatus.DRAFT,
            created_by=created_by,
            employee_count=len(employees),
        )
        db.add(payroll_run)
        await db.flush()  # Get the ID

        # Calculate period days
        period_days = (data.period_end - data.period_start).days + 1

        # Create items for each employee
        total_base = Decimal("0")
        total_bonuses = Decimal("0")
        total_deductions = Decimal("0")
        total_net = Decimal("0")

        for employee in employees:
            # Calculate employee totals
            totals = await employee_service.calculate_employee_totals(
                db, employee.id, data.period_end
            )

            # Calculate base salary based on payment frequency
            worked_days: int | None = None
            daily_rate: Decimal | None = None
            calculated_base: Decimal

            # Normalize payment_frequency to string for comparison
            freq_str = (
                employee.payment_frequency.value
                if hasattr(employee.payment_frequency, 'value')
                else str(employee.payment_frequency)
            )

            if freq_str == PaymentFrequency.DAILY.value:
                # For daily-paid employees: salary_daily × worked_days
                worked_days = await self._get_worked_days(
                    db, employee.id, data.period_start, data.period_end
                )
                daily_rate = employee.base_salary
                calculated_base = daily_rate * Decimal(str(worked_days))
            elif freq_str == PaymentFrequency.WEEKLY.value:
                # Prorate if period is not exactly 7 days
                weeks = Decimal(str(period_days)) / Decimal("7")
                calculated_base = employee.base_salary * weeks
            elif freq_str == PaymentFrequency.BIWEEKLY.value:
                # Prorate based on 14-day periods
                biweeks = Decimal(str(period_days)) / Decimal("14")
                calculated_base = employee.base_salary * biweeks
            else:
                # Monthly: prorate if period < 30 days
                if period_days < 28:
                    # Prorate based on typical month
                    month_factor = Decimal(str(period_days)) / Decimal("30")
                    calculated_base = totals["base_salary"] * month_factor
                else:
                    calculated_base = totals["base_salary"]

            # Add absence deductions from workforce management
            absence_deductions = await attendance_service.get_deductible_absences(
                db,
                period_start=data.period_start,
                period_end=data.period_end,
                employee_id=employee.id,
            )
            deduction_breakdown = list(totals["deduction_breakdown"])
            extra_deductions = Decimal("0")
            for absence in absence_deductions:
                if absence.deduction_amount > 0:
                    absence_label = {
                        "absence_unjustified": "Falta injustificada",
                        "tardiness": "Retardo",
                        "early_departure": "Salida temprana",
                    }.get(absence.absence_type.value if hasattr(absence.absence_type, 'value') else str(absence.absence_type), "Falta")
                    deduction_breakdown.append({
                        "name": f"{absence_label} ({absence.absence_date})",
                        "amount": float(absence.deduction_amount),
                    })
                    extra_deductions += absence.deduction_amount

            total_deductions_amount = totals["total_deductions"] + extra_deductions
            net = calculated_base + totals["total_bonuses"] - total_deductions_amount

            item = PayrollItem(
                payroll_run_id=payroll_run.id,
                employee_id=employee.id,
                base_salary=calculated_base,
                total_bonuses=totals["total_bonuses"],
                total_deductions=total_deductions_amount,
                net_amount=net,
                bonus_breakdown=totals["bonus_breakdown"],
                deduction_breakdown=deduction_breakdown,
                worked_days=worked_days,
                daily_rate=daily_rate,
            )
            db.add(item)

            total_base += calculated_base
            total_bonuses += totals["total_bonuses"]
            total_deductions += total_deductions_amount
            total_net += net

        # Update payroll run totals
        payroll_run.total_base_salary = total_base
        payroll_run.total_bonuses = total_bonuses
        payroll_run.total_deductions = total_deductions
        payroll_run.total_net = total_net

        await db.commit()
        await db.refresh(payroll_run)
        return payroll_run

    async def update_payroll_run(
        self,
        db: AsyncSession,
        payroll_id: UUID,
        data: PayrollRunUpdate,
    ) -> PayrollRun:
        """Update a payroll run (only if in draft status)"""
        payroll = await self.get_payroll_run(db, payroll_id)
        if not payroll:
            raise ValueError("Liquidación de nómina no encontrada")

        if payroll.status != PayrollStatus.DRAFT:
            raise ValueError("Solo se pueden editar liquidaciones en estado borrador")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(payroll, field, value)

        await db.commit()
        await db.refresh(payroll)
        return payroll

    async def approve_payroll_run(
        self,
        db: AsyncSession,
        payroll_id: UUID,
        *,
        approved_by: UUID | None = None,
    ) -> PayrollRun:
        """Approve a payroll run and create expense"""
        payroll = await self.get_payroll_run(db, payroll_id)
        if not payroll:
            raise ValueError("Liquidación de nómina no encontrada")

        if payroll.status != PayrollStatus.DRAFT:
            raise ValueError("Solo se pueden aprobar liquidaciones en estado borrador")

        # Build employee details for notes
        employee_details = []
        for item in payroll.items:
            emp_name = item.employee.full_name if item.employee else "Empleado"
            employee_details.append(f"- {emp_name}: ${item.net_amount:,.0f}")
        notes_text = "\n".join(employee_details)

        # Create expense for payroll with employee breakdown in notes
        expense = Expense(
            category=ExpenseCategory.PAYROLL,
            description=f"Nómina {payroll.period_start.strftime('%d/%m/%Y')} - {payroll.period_end.strftime('%d/%m/%Y')}",
            amount=payroll.total_net,
            expense_date=payroll.payment_date or get_colombia_date(),
            vendor=PAYROLL_FIXED_EXPENSE_VENDOR,
            notes=f"Detalle por empleado:\n{notes_text}",
            is_paid=False,
            created_by=approved_by,
        )
        db.add(expense)
        await db.flush()

        # Update or create FixedExpenses per payment frequency
        # Need to reload items with employees to get payment frequencies
        items_with_employees = payroll.items
        employee_ids = [item.employee_id for item in items_with_employees]
        employees_list = []
        for emp_id in employee_ids:
            emp = await employee_service.get_employee(db, emp_id)
            if emp:
                employees_list.append(emp)
        await self._update_payroll_fixed_expenses(db, payroll, items_with_employees, employees_list, approved_by)

        # Update payroll status
        payroll.status = PayrollStatus.APPROVED
        payroll.expense_id = expense.id
        payroll.approved_by = approved_by
        payroll.approved_at = get_colombia_now_naive()

        await db.commit()
        await db.refresh(payroll)
        return payroll

    async def _update_payroll_fixed_expenses(
        self,
        db: AsyncSession,
        payroll: PayrollRun,
        items: list[PayrollItem],
        employees: list[Employee],
        updated_by: UUID | None = None,
    ) -> None:
        """
        Update or create FixedExpenses per payment frequency.

        Creates separate FixedExpense records for each payment frequency
        present in the payroll (e.g., "Nómina Semanal", "Nómina Mensual").
        """
        from collections import defaultdict

        # Group totals by payment frequency (normalize to string key)
        totals_by_frequency: dict[str, Decimal] = defaultdict(Decimal)
        employee_map = {emp.id: emp for emp in employees}

        for item in items:
            emp = employee_map.get(item.employee_id)
            if emp:
                # Handle both enum and string values
                freq_key = emp.payment_frequency.value if hasattr(emp.payment_frequency, 'value') else str(emp.payment_frequency)
                totals_by_frequency[freq_key] += item.net_amount

        # Update/create FixedExpense for each frequency
        for freq_str, total in totals_by_frequency.items():
            # Convert string back to enum for the upsert method
            try:
                frequency = PaymentFrequency(freq_str)
            except ValueError:
                frequency = PaymentFrequency.MONTHLY  # Default fallback
            await self._upsert_fixed_expense_for_frequency(
                db, frequency, total, payroll.period_start, updated_by
            )

    async def _upsert_fixed_expense_for_frequency(
        self,
        db: AsyncSession,
        frequency: PaymentFrequency,
        amount: Decimal,
        effective_date: date,
        updated_by: UUID | None = None,
    ) -> FixedExpense:
        """Create or update the FixedExpense for a specific payment frequency."""
        # Map PaymentFrequency to ExpenseFrequency (for legacy frequency field)
        # Note: ExpenseFrequency doesn't have DAILY, so we use WEEKLY for daily
        freq_to_expense_freq = {
            PaymentFrequency.DAILY: FixedExpenseFrequency.WEEKLY,  # Closest match
            PaymentFrequency.WEEKLY: FixedExpenseFrequency.WEEKLY,
            PaymentFrequency.BIWEEKLY: FixedExpenseFrequency.BIWEEKLY,
            PaymentFrequency.MONTHLY: FixedExpenseFrequency.MONTHLY,
        }

        name = PAYROLL_FREQUENCY_NAMES.get(frequency, "Nómina")
        expense_freq = freq_to_expense_freq.get(frequency, FixedExpenseFrequency.MONTHLY)

        # Look for existing fixed expense with this name
        stmt = select(FixedExpense).where(
            FixedExpense.name == name,
            FixedExpense.category == ExpenseCategory.PAYROLL,
            FixedExpense.is_active == True,
        )
        result = await db.execute(stmt)
        fixed_expense = result.scalar_one_or_none()

        if fixed_expense:
            # Update existing
            fixed_expense.amount = amount
            fixed_expense.updated_at = get_colombia_now_naive()
        else:
            # Create new
            fixed_expense = FixedExpense(
                name=name,
                description=f"Gasto fijo de nómina para empleados con pago {frequency.value}. Se actualiza al aprobar liquidaciones.",
                category=ExpenseCategory.PAYROLL,
                expense_type=FixedExpenseType.EXACT,
                amount=amount,
                frequency=expense_freq,
                day_of_month=30 if frequency == PaymentFrequency.MONTHLY else None,
                auto_generate=False,  # Payroll module creates expenses, not auto-generation
                vendor=PAYROLL_FIXED_EXPENSE_VENDOR,
                is_active=True,
                created_by=updated_by,
            )
            db.add(fixed_expense)

        await db.flush()
        return fixed_expense

    async def get_payroll_fixed_expenses(
        self,
        db: AsyncSession,
    ) -> list[FixedExpense]:
        """Get all payroll fixed expenses (one per frequency)."""
        payroll_names = list(PAYROLL_FREQUENCY_NAMES.values())
        stmt = select(FixedExpense).where(
            FixedExpense.name.in_(payroll_names),
            FixedExpense.category == ExpenseCategory.PAYROLL,
            FixedExpense.is_active == True,
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def mark_payroll_paid(
        self,
        db: AsyncSession,
        payroll_id: UUID,
    ) -> PayrollRun:
        """Mark entire payroll as paid"""
        payroll = await self.get_payroll_run(db, payroll_id)
        if not payroll:
            raise ValueError("Liquidación de nómina no encontrada")

        if payroll.status != PayrollStatus.APPROVED:
            raise ValueError("Solo se pueden pagar liquidaciones aprobadas")

        # Mark all items as paid
        for item in payroll.items:
            if not item.is_paid:
                item.is_paid = True
                item.paid_at = get_colombia_now_naive()

        payroll.status = PayrollStatus.PAID
        payroll.paid_at = get_colombia_now_naive()

        # Also mark the associated Expense as paid
        if payroll.expense_id:
            expense_stmt = select(Expense).where(Expense.id == payroll.expense_id)
            expense_result = await db.execute(expense_stmt)
            expense = expense_result.scalar_one_or_none()
            if expense:
                expense.is_paid = True
                expense.paid_at = get_colombia_now_naive()

        await db.commit()
        await db.refresh(payroll)
        return payroll

    async def cancel_payroll_run(
        self,
        db: AsyncSession,
        payroll_id: UUID,
    ) -> PayrollRun:
        """Cancel a payroll run"""
        payroll = await self.get_payroll_run(db, payroll_id)
        if not payroll:
            raise ValueError("Liquidación de nómina no encontrada")

        if payroll.status == PayrollStatus.PAID:
            raise ValueError("No se pueden cancelar liquidaciones ya pagadas")

        payroll.status = PayrollStatus.CANCELLED

        # Deactivate the associated expense if it exists and hasn't been paid
        if payroll.expense_id:
            stmt = select(Expense).where(Expense.id == payroll.expense_id)
            result = await db.execute(stmt)
            expense = result.scalar_one_or_none()
            if expense and not expense.is_paid:
                # Mark expense as inactive and add cancellation note
                expense.is_active = False
                existing_notes = expense.notes or ""
                expense.notes = f"{existing_notes}\n[CANCELADO - Liquidación cancelada]".strip()

        await db.commit()
        await db.refresh(payroll)
        return payroll

    # ============================================
    # Payroll Item Operations
    # ============================================

    async def get_payroll_item(
        self,
        db: AsyncSession,
        item_id: UUID,
    ) -> PayrollItem | None:
        """Get a single payroll item"""
        stmt = (
            select(PayrollItem)
            .options(selectinload(PayrollItem.employee))
            .where(PayrollItem.id == item_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_payroll_item(
        self,
        db: AsyncSession,
        item_id: UUID,
        data: PayrollItemUpdate,
    ) -> PayrollItem:
        """Update a payroll item (only if payroll is in draft)"""
        item = await self.get_payroll_item(db, item_id)
        if not item:
            raise ValueError("Item de nómina no encontrado")

        # Check payroll status
        payroll = await self.get_payroll_run(db, item.payroll_run_id)
        if payroll.status != PayrollStatus.DRAFT:
            raise ValueError("Solo se pueden editar items de liquidaciones en borrador")

        update_data = data.model_dump(exclude_unset=True)

        # Recalculate totals if breakdowns changed
        if "bonus_breakdown" in update_data:
            bonus_list = update_data["bonus_breakdown"] or []
            item.bonus_breakdown = [{"name": b.name, "amount": float(b.amount)} for b in bonus_list]
            item.total_bonuses = sum(Decimal(str(b.amount)) for b in bonus_list)

        if "deduction_breakdown" in update_data:
            ded_list = update_data["deduction_breakdown"] or []
            item.deduction_breakdown = [{"name": d.name, "amount": float(d.amount)} for d in ded_list]
            item.total_deductions = sum(Decimal(str(d.amount)) for d in ded_list)

        if "base_salary" in update_data:
            item.base_salary = update_data["base_salary"]

        # Recalculate net
        item.net_amount = item.base_salary + item.total_bonuses - item.total_deductions

        # Recalculate payroll totals
        await self._recalculate_payroll_totals(db, payroll)

        await db.commit()
        await db.refresh(item)
        return item

    async def pay_payroll_item(
        self,
        db: AsyncSession,
        item_id: UUID,
        payment_method: str,
        payment_reference: str | None = None,
    ) -> PayrollItem:
        """Pay a single payroll item"""
        item = await self.get_payroll_item(db, item_id)
        if not item:
            raise ValueError("Item de nómina no encontrado")

        # Check payroll status
        payroll = await self.get_payroll_run(db, item.payroll_run_id)
        if payroll.status not in [PayrollStatus.APPROVED, PayrollStatus.PAID]:
            raise ValueError("Solo se pueden pagar items de liquidaciones aprobadas")

        if item.is_paid:
            raise ValueError("Este item ya fue pagado")

        item.is_paid = True
        item.paid_at = get_colombia_now_naive()
        item.payment_method = payment_method
        item.payment_reference = payment_reference

        # Check if all items are paid
        all_paid = all(i.is_paid for i in payroll.items)
        if all_paid:
            payroll.status = PayrollStatus.PAID
            payroll.paid_at = get_colombia_now_naive()

        await db.commit()
        await db.refresh(item)
        return item

    # ============================================
    # Helper Methods
    # ============================================

    async def _get_worked_days(
        self,
        db: AsyncSession,
        employee_id: UUID,
        period_start: date,
        period_end: date,
    ) -> int:
        """
        Calculate worked days based on attendance records.

        Returns the count of days with status 'present' or 'late'.
        If no attendance records exist, estimates based on working days
        in the period (assumes 6 working days per week: Mon-Sat).
        """
        # Get attendance records for the period
        records = await attendance_service.get_attendance_records(
            db,
            employee_id=employee_id,
            date_from=period_start,
            date_to=period_end,
        )

        if records:
            # Count days with 'present' or 'late' status (they worked)
            worked = sum(
                1 for r in records
                if (r.status.value if hasattr(r.status, 'value') else str(r.status)) in ('present', 'late')
            )
            return worked
        else:
            # No attendance records: estimate working days (Mon-Sat = 6/7)
            total_days = (period_end - period_start).days + 1
            # Estimate: assume 6 working days per week
            estimated = int(total_days * 6 / 7)
            return max(estimated, 1)  # At least 1 day

    async def _recalculate_payroll_totals(
        self,
        db: AsyncSession,
        payroll: PayrollRun,
    ) -> None:
        """Recalculate payroll run totals from items"""
        total_base = Decimal("0")
        total_bonuses = Decimal("0")
        total_deductions = Decimal("0")
        total_net = Decimal("0")

        for item in payroll.items:
            total_base += item.base_salary
            total_bonuses += item.total_bonuses
            total_deductions += item.total_deductions
            total_net += item.net_amount

        payroll.total_base_salary = total_base
        payroll.total_bonuses = total_bonuses
        payroll.total_deductions = total_deductions
        payroll.total_net = total_net

    def _get_monthly_multiplier(self, frequency: PaymentFrequency) -> Decimal:
        """Get multiplier to convert salary to monthly equivalent"""
        if frequency == PaymentFrequency.DAILY:
            return Decimal("21.67")  # ~260 working days / 12 months
        elif frequency == PaymentFrequency.WEEKLY:
            return Decimal("4.33")  # 52 weeks / 12 months
        elif frequency == PaymentFrequency.BIWEEKLY:
            return Decimal("2.17")  # 26 biweekly periods / 12 months
        else:  # MONTHLY
            return Decimal("1")

    async def get_payroll_summary(
        self,
        db: AsyncSession,
    ) -> dict:
        """Get summary of payroll data"""
        # Count active employees
        employees = await employee_service.get_employees(db, is_active=True)

        # Calculate monthly payroll estimate (converting based on payment frequency)
        total_monthly = Decimal("0")
        for emp in employees:
            totals = await employee_service.calculate_employee_totals(db, emp.id)
            # Convert to monthly equivalent based on payment frequency
            multiplier = self._get_monthly_multiplier(emp.payment_frequency)
            total_monthly += totals["net_amount"] * multiplier

        # Count pending payroll runs
        pending_stmt = select(PayrollRun).where(
            PayrollRun.status.in_([PayrollStatus.DRAFT, PayrollStatus.APPROVED])
        )
        pending_result = await db.execute(pending_stmt)
        pending_runs = list(pending_result.scalars().all())

        # Get last paid payroll date
        last_paid_stmt = (
            select(PayrollRun)
            .where(PayrollRun.status == PayrollStatus.PAID)
            .order_by(PayrollRun.paid_at.desc())
            .limit(1)
        )
        last_paid_result = await db.execute(last_paid_stmt)
        last_paid = last_paid_result.scalar_one_or_none()

        # Check if payroll fixed expenses exist and their total is synced
        fixed_expenses = await self.get_payroll_fixed_expenses(db)
        fixed_expense_info = None
        if fixed_expenses:
            # Sum all payroll fixed expenses and check if synced with estimated monthly
            total_fixed = sum(fe.amount for fe in fixed_expenses)
            most_recent = max(fixed_expenses, key=lambda fe: fe.updated_at or fe.created_at)
            fixed_expense_info = {
                "id": str(most_recent.id),
                "amount": total_fixed,
                "is_synced": abs(total_fixed - total_monthly) < Decimal("1000"),  # ~synced if within 1k
                "updated_at": most_recent.updated_at.isoformat() if most_recent.updated_at else None,
            }

        return {
            "active_employees": len(employees),
            "total_monthly_payroll": total_monthly,
            "pending_payroll_runs": len(pending_runs),
            "last_payroll_date": last_paid.period_end if last_paid else None,
            "fixed_expense_integration": fixed_expense_info,
        }


# Create singleton instance
payroll_service = PayrollService()
