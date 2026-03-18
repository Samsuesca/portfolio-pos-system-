"""
Attendance Service - Attendance logging and absence management
"""
from uuid import UUID
from decimal import Decimal
from datetime import date, time, datetime, timedelta
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.utils.timezone import get_colombia_date, get_colombia_now_naive
from app.models.workforce import (
    AttendanceRecord, AttendanceStatus,
    AbsenceRecord, AbsenceType,
)
from app.models.payroll import Employee
from app.schemas.workforce import (
    AttendanceCreate, AttendanceUpdate,
    AbsenceCreate, AbsenceUpdate,
    DailyAttendanceSummary,
)
from app.services.workforce.shifts import shift_service


class AttendanceService:
    """Service for attendance and absence operations"""

    # ============================================
    # Attendance CRUD
    # ============================================

    async def get_attendance_records(
        self,
        db: AsyncSession,
        *,
        record_date: date | None = None,
        employee_id: UUID | None = None,
        status: AttendanceStatus | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[AttendanceRecord]:
        """Get attendance records with filters"""
        stmt = select(AttendanceRecord).options(
            selectinload(AttendanceRecord.employee)
        )

        if record_date is not None:
            stmt = stmt.where(AttendanceRecord.record_date == record_date)
        if employee_id is not None:
            stmt = stmt.where(AttendanceRecord.employee_id == employee_id)
        if status is not None:
            stmt = stmt.where(AttendanceRecord.status == status)
        if date_from is not None:
            stmt = stmt.where(AttendanceRecord.record_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(AttendanceRecord.record_date <= date_to)

        stmt = stmt.order_by(AttendanceRecord.record_date.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_attendance_record(
        self,
        db: AsyncSession,
        record_id: UUID,
    ) -> AttendanceRecord | None:
        """Get a single attendance record"""
        stmt = (
            select(AttendanceRecord)
            .options(selectinload(AttendanceRecord.employee))
            .where(AttendanceRecord.id == record_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def log_attendance(
        self,
        db: AsyncSession,
        data: AttendanceCreate,
        *,
        recorded_by: UUID | None = None,
    ) -> AttendanceRecord:
        """Log attendance for an employee on a date"""
        # Check for existing record
        existing = await self._get_by_employee_date(db, data.employee_id, data.record_date)
        if existing:
            raise ValueError(
                f"Ya existe un registro de asistencia para este empleado en {data.record_date}"
            )

        # Get scheduled times from employee schedule
        schedule = await shift_service.get_schedule_for_employee_date(
            db, data.employee_id, data.record_date
        )
        scheduled_start = schedule.start_time if schedule else None
        scheduled_end = schedule.end_time if schedule else None

        # Calculate lateness
        minutes_late = 0
        minutes_early = 0
        if data.check_in_time and scheduled_start:
            minutes_late = self._calculate_minutes_late(data.check_in_time, scheduled_start)
        if data.check_out_time and scheduled_end:
            minutes_early = self._calculate_early_departure(data.check_out_time, scheduled_end)

        record = AttendanceRecord(
            employee_id=data.employee_id,
            record_date=data.record_date,
            status=data.status,
            check_in_time=data.check_in_time,
            check_out_time=data.check_out_time,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            minutes_late=minutes_late,
            minutes_early_departure=minutes_early,
            notes=data.notes,
            recorded_by=recorded_by,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

        # Telegram alert for late/absent
        if minutes_late > 0 or data.status in ("absent", "late"):
            try:
                from app.services.telegram import fire_and_forget_routed_alert
                from app.services.telegram_messages import TelegramMessageBuilder
                from app.models.payroll import Employee
                from sqlalchemy import select as sa_select

                emp_result = await db.execute(
                    sa_select(Employee).where(Employee.id == data.employee_id)
                )
                employee = emp_result.scalar_one_or_none()
                emp_name = employee.full_name if employee else str(data.employee_id)

                status_label = "late" if minutes_late > 0 else data.status
                msg = TelegramMessageBuilder.attendance_alert(
                    employee_name=emp_name,
                    status=status_label,
                    minutes_late=minutes_late if minutes_late > 0 else None,
                )
                fire_and_forget_routed_alert("attendance_alert", msg)
            except Exception:
                pass

        # Re-fetch with relationships loaded
        return await self.get_attendance_record(db, record.id)

    async def update_attendance(
        self,
        db: AsyncSession,
        record_id: UUID,
        data: AttendanceUpdate,
    ) -> AttendanceRecord:
        """Update an attendance record"""
        record = await self.get_attendance_record(db, record_id)
        if not record:
            raise ValueError("Registro de asistencia no encontrado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(record, field, value)

        # Recalculate lateness if times changed
        if record.check_in_time and record.scheduled_start:
            record.minutes_late = self._calculate_minutes_late(
                record.check_in_time, record.scheduled_start
            )
        if record.check_out_time and record.scheduled_end:
            record.minutes_early_departure = self._calculate_early_departure(
                record.check_out_time, record.scheduled_end
            )

        await db.commit()
        await db.refresh(record)
        return record

    async def get_daily_summary(
        self,
        db: AsyncSession,
        target_date: date | None = None,
    ) -> DailyAttendanceSummary:
        """Get attendance summary for a specific date"""
        if target_date is None:
            target_date = get_colombia_date()

        # Count active employees
        total_stmt = select(func.count()).select_from(Employee).where(Employee.is_active == True)
        total_result = await db.execute(total_stmt)
        total_employees = total_result.scalar() or 0

        # Count by status
        records = await self.get_attendance_records(db, record_date=target_date)
        present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT.value)
        absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT.value)
        late = sum(1 for r in records if r.status == AttendanceStatus.LATE.value)
        excused = sum(1 for r in records if r.status == AttendanceStatus.EXCUSED.value)
        logged = present + absent + late + excused

        return DailyAttendanceSummary(
            date=target_date,
            total_employees=total_employees,
            present=present,
            absent=absent,
            late=late,
            excused=excused,
            not_logged=total_employees - logged,
        )

    # ============================================
    # Absence CRUD
    # ============================================

    async def get_absences(
        self,
        db: AsyncSession,
        *,
        employee_id: UUID | None = None,
        absence_type: AbsenceType | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        is_deductible: bool | None = None,
    ) -> list[AbsenceRecord]:
        """Get absence records with filters"""
        stmt = select(AbsenceRecord).options(
            selectinload(AbsenceRecord.employee)
        )

        if employee_id is not None:
            stmt = stmt.where(AbsenceRecord.employee_id == employee_id)
        if absence_type is not None:
            stmt = stmt.where(AbsenceRecord.absence_type == absence_type)
        if date_from is not None:
            stmt = stmt.where(AbsenceRecord.absence_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(AbsenceRecord.absence_date <= date_to)
        if is_deductible is not None:
            stmt = stmt.where(AbsenceRecord.is_deductible == is_deductible)

        stmt = stmt.order_by(AbsenceRecord.absence_date.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_absence(
        self,
        db: AsyncSession,
        absence_id: UUID,
    ) -> AbsenceRecord | None:
        """Get a single absence record"""
        stmt = (
            select(AbsenceRecord)
            .options(selectinload(AbsenceRecord.employee))
            .where(AbsenceRecord.id == absence_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_absence(
        self,
        db: AsyncSession,
        data: AbsenceCreate,
        *,
        created_by: UUID | None = None,
    ) -> AbsenceRecord:
        """Record an absence"""
        absence = AbsenceRecord(
            **data.model_dump(),
            created_by=created_by,
        )
        db.add(absence)
        await db.commit()
        await db.refresh(absence)
        # Re-fetch with relationships loaded
        return await self.get_absence(db, absence.id)

    async def update_absence(
        self,
        db: AsyncSession,
        absence_id: UUID,
        data: AbsenceUpdate,
    ) -> AbsenceRecord:
        """Update an absence record"""
        absence = await self.get_absence(db, absence_id)
        if not absence:
            raise ValueError("Registro de falta no encontrado")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(absence, field, value)

        await db.commit()
        await db.refresh(absence)
        return absence

    async def approve_absence(
        self,
        db: AsyncSession,
        absence_id: UUID,
        *,
        approved_by: UUID,
    ) -> AbsenceRecord:
        """Approve/justify an absence"""
        absence = await self.get_absence(db, absence_id)
        if not absence:
            raise ValueError("Registro de falta no encontrado")

        absence.approved_by = approved_by
        absence.approved_at = get_colombia_now_naive()
        await db.commit()
        await db.refresh(absence)
        return absence

    async def get_deductible_absences(
        self,
        db: AsyncSession,
        *,
        period_start: date,
        period_end: date,
        employee_id: UUID | None = None,
    ) -> list[AbsenceRecord]:
        """Get deductible absences for a payroll period"""
        return await self.get_absences(
            db,
            employee_id=employee_id,
            date_from=period_start,
            date_to=period_end,
            is_deductible=True,
        )

    # ============================================
    # Metrics
    # ============================================

    async def get_attendance_rate(
        self,
        db: AsyncSession,
        employee_id: UUID,
        period_start: date,
        period_end: date,
    ) -> Decimal:
        """Calculate attendance rate for an employee in a period (% of days present)"""
        records = await self.get_attendance_records(
            db, employee_id=employee_id, date_from=period_start, date_to=period_end
        )
        if not records:
            return Decimal("0")

        present_count = sum(
            1 for r in records
            if r.status in (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)
        )
        return Decimal(str(round(present_count / len(records) * 100, 2)))

    async def get_punctuality_rate(
        self,
        db: AsyncSession,
        employee_id: UUID,
        period_start: date,
        period_end: date,
    ) -> Decimal:
        """Calculate punctuality rate (% of present days that were on-time)"""
        records = await self.get_attendance_records(
            db, employee_id=employee_id, date_from=period_start, date_to=period_end
        )
        present_records = [
            r for r in records
            if r.status in (AttendanceStatus.PRESENT.value, AttendanceStatus.LATE.value)
        ]
        if not present_records:
            return Decimal("0")

        on_time = sum(1 for r in present_records if r.status == AttendanceStatus.PRESENT.value)
        return Decimal(str(round(on_time / len(present_records) * 100, 2)))

    # ============================================
    # Helpers
    # ============================================

    async def _get_by_employee_date(
        self,
        db: AsyncSession,
        employee_id: UUID,
        record_date: date,
    ) -> AttendanceRecord | None:
        """Get attendance record for a specific employee and date"""
        stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.employee_id == employee_id,
                AttendanceRecord.record_date == record_date,
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def _calculate_minutes_late(check_in: time, scheduled_start: time) -> int:
        """Calculate minutes late (0 if on time or early)"""
        today = get_colombia_date()
        check_in_dt = datetime.combine(today, check_in)
        scheduled_dt = datetime.combine(today, scheduled_start)
        diff = (check_in_dt - scheduled_dt).total_seconds() / 60
        return max(0, int(diff))

    @staticmethod
    def _calculate_early_departure(check_out: time, scheduled_end: time) -> int:
        """Calculate minutes of early departure (0 if stayed or left late)"""
        today = get_colombia_date()
        check_out_dt = datetime.combine(today, check_out)
        scheduled_dt = datetime.combine(today, scheduled_end)
        diff = (scheduled_dt - check_out_dt).total_seconds() / 60
        return max(0, int(diff))


# Singleton
attendance_service = AttendanceService()
