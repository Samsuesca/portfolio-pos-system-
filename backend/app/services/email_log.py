"""
Email Log Service

Service for creating and querying email logs.
Provides audit trail and statistics for all email operations.
"""
import logging
from uuid import UUID
from datetime import date, timedelta
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_log import EmailLog, EmailType, EmailStatus
from app.models.client import Client
from app.models.user import User
from app.utils.timezone import get_colombia_date, get_colombia_datetime_range_naive
from app.schemas.email_log import (
    EmailLogWithDetails,
    EmailLogFilter,
    EmailLogListResponse,
    EmailStatsResponse,
    EmailTypeSummary,
    EmailDaySummary,
)

logger = logging.getLogger(__name__)

# Human-readable labels for email types
EMAIL_TYPE_LABELS = {
    EmailType.VERIFICATION: "Codigo de Verificacion",
    EmailType.WELCOME: "Bienvenida",
    EmailType.PASSWORD_RESET: "Recuperar Contrasena",
    EmailType.ORDER_CONFIRMATION: "Confirmacion de Encargo",
    EmailType.SALE_CONFIRMATION: "Confirmacion de Venta",
    EmailType.ACTIVATION: "Activacion de Cuenta",
    EmailType.ORDER_READY: "Pedido Listo",
    EmailType.WELCOME_ACTIVATION: "Bienvenida + Activacion",
    EmailType.EMAIL_CHANGE: "Cambio de Email",
    EmailType.DRAWER_ACCESS: "Codigo de Cajon",
}


class EmailLogService:
    """Service for email log operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_log(
        self,
        email_type: EmailType,
        recipient_email: str,
        subject: str,
        status: EmailStatus,
        recipient_name: str | None = None,
        error_message: str | None = None,
        reference_code: str | None = None,
        client_id: UUID | None = None,
        order_id: UUID | None = None,
        sale_id: UUID | None = None,
        user_id: UUID | None = None,
        triggered_by: UUID | None = None,
    ) -> EmailLog:
        """
        Create an email log entry.

        This should be called after every email send attempt.
        """
        log = EmailLog(
            email_type=email_type,
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            subject=subject,
            status=status,
            error_message=error_message,
            reference_code=reference_code,
            client_id=client_id,
            order_id=order_id,
            sale_id=sale_id,
            user_id=user_id,
            triggered_by=triggered_by,
        )

        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)

        return log

    async def get_logs(
        self,
        filters: EmailLogFilter | None = None
    ) -> EmailLogListResponse:
        """
        Get email logs with optional filters.
        """
        filters = filters or EmailLogFilter()

        # Build conditions
        conditions = []

        if filters.start_date:
            start_of_day, _ = get_colombia_datetime_range_naive(filters.start_date)
            conditions.append(EmailLog.sent_at >= start_of_day)
        if filters.end_date:
            _, end_of_day = get_colombia_datetime_range_naive(filters.end_date)
            conditions.append(EmailLog.sent_at <= end_of_day)
        if filters.email_type:
            conditions.append(EmailLog.email_type == filters.email_type)
        if filters.status:
            conditions.append(EmailLog.status == filters.status)
        if filters.recipient_email:
            conditions.append(EmailLog.recipient_email.ilike(f"%{filters.recipient_email}%"))
        if filters.client_id:
            conditions.append(EmailLog.client_id == filters.client_id)

        # Count total
        count_query = select(func.count(EmailLog.id))
        if conditions:
            count_query = count_query.where(and_(*conditions))
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        # Get logs with joins
        query = (
            select(EmailLog, Client, User)
            .outerjoin(Client, EmailLog.client_id == Client.id)
            .outerjoin(User, EmailLog.triggered_by == User.id)
        )

        if conditions:
            query = query.where(and_(*conditions))

        query = (
            query
            .order_by(EmailLog.sent_at.desc())
            .offset(filters.skip)
            .limit(filters.limit)
        )

        result = await self.db.execute(query)

        items = []
        for log, client, triggered_user in result.all():
            items.append(
                EmailLogWithDetails(
                    id=log.id,
                    email_type=log.email_type,
                    recipient_email=log.recipient_email,
                    recipient_name=log.recipient_name,
                    subject=log.subject,
                    status=log.status,
                    error_message=log.error_message,
                    reference_code=log.reference_code,
                    client_id=log.client_id,
                    order_id=log.order_id,
                    sale_id=log.sale_id,
                    user_id=log.user_id,
                    triggered_by=log.triggered_by,
                    sent_at=log.sent_at,
                    client_name=client.name if client else None,
                    triggered_by_name=triggered_user.full_name or triggered_user.username if triggered_user else None,
                    email_type_label=EMAIL_TYPE_LABELS.get(log.email_type, log.email_type.value),
                )
            )

        return EmailLogListResponse(
            items=items,
            total=total,
            skip=filters.skip,
            limit=filters.limit,
        )

    async def get_statistics(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> EmailStatsResponse:
        """
        Get email statistics for a period.

        Defaults to last 30 days if no dates provided.
        """
        if not end_date:
            end_date = get_colombia_date()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Base condition for date range using datetime ranges for precision
        start_dt, _ = get_colombia_datetime_range_naive(start_date)
        _, end_dt = get_colombia_datetime_range_naive(end_date)
        date_condition = and_(
            EmailLog.sent_at >= start_dt,
            EmailLog.sent_at <= end_dt
        )

        # Overall totals
        totals_query = select(
            func.count(EmailLog.id).label('total'),
            func.sum(case((EmailLog.status == EmailStatus.SUCCESS, 1), else_=0)).label('success'),
            func.sum(case((EmailLog.status == EmailStatus.FAILED, 1), else_=0)).label('failed'),
            func.sum(case((EmailLog.status == EmailStatus.DEV_SKIPPED, 1), else_=0)).label('dev_skipped'),
        ).where(date_condition)

        totals_result = await self.db.execute(totals_query)
        totals = totals_result.one()

        total_sent = totals.total or 0
        total_success = int(totals.success or 0)
        total_failed = int(totals.failed or 0)
        total_dev_skipped = int(totals.dev_skipped or 0)

        # By type
        by_type_query = (
            select(
                EmailLog.email_type,
                func.count(EmailLog.id).label('total'),
                func.sum(case((EmailLog.status == EmailStatus.SUCCESS, 1), else_=0)).label('success'),
                func.sum(case((EmailLog.status == EmailStatus.FAILED, 1), else_=0)).label('failed'),
            )
            .where(date_condition)
            .group_by(EmailLog.email_type)
            .order_by(func.count(EmailLog.id).desc())
        )

        by_type_result = await self.db.execute(by_type_query)
        by_type = [
            EmailTypeSummary(
                email_type=row.email_type,
                email_type_label=EMAIL_TYPE_LABELS.get(row.email_type, row.email_type.value),
                total=row.total,
                success=int(row.success or 0),
                failed=int(row.failed or 0),
                success_rate=int(row.success or 0) / row.total if row.total > 0 else 0.0,
            )
            for row in by_type_result.all()
        ]

        # By day
        by_day_query = (
            select(
                func.date(EmailLog.sent_at).label('day'),
                func.count(EmailLog.id).label('total'),
                func.sum(case((EmailLog.status == EmailStatus.SUCCESS, 1), else_=0)).label('success'),
                func.sum(case((EmailLog.status == EmailStatus.FAILED, 1), else_=0)).label('failed'),
            )
            .where(date_condition)
            .group_by(func.date(EmailLog.sent_at))
            .order_by(func.date(EmailLog.sent_at).desc())
        )

        by_day_result = await self.db.execute(by_day_query)
        by_day = [
            EmailDaySummary(
                date=row.day,
                total=row.total,
                success=int(row.success or 0),
                failed=int(row.failed or 0),
                success_rate=int(row.success or 0) / row.total if row.total > 0 else 0.0,
            )
            for row in by_day_result.all()
        ]

        # Calculate averages
        days_count = (end_date - start_date).days + 1
        avg_per_day = total_sent / days_count if days_count > 0 else 0.0

        return EmailStatsResponse(
            period_start=start_date,
            period_end=end_date,
            total_sent=total_sent,
            total_success=total_success,
            total_failed=total_failed,
            total_dev_skipped=total_dev_skipped,
            overall_success_rate=total_success / total_sent if total_sent > 0 else 0.0,
            by_type=by_type,
            by_day=by_day,
            avg_per_day=avg_per_day,
        )

    async def get_recent_failures(
        self,
        limit: int = 10
    ) -> list[EmailLogWithDetails]:
        """Get recent failed emails for quick debugging."""
        query = (
            select(EmailLog, Client, User)
            .outerjoin(Client, EmailLog.client_id == Client.id)
            .outerjoin(User, EmailLog.triggered_by == User.id)
            .where(EmailLog.status == EmailStatus.FAILED)
            .order_by(EmailLog.sent_at.desc())
            .limit(limit)
        )

        result = await self.db.execute(query)

        return [
            EmailLogWithDetails(
                id=log.id,
                email_type=log.email_type,
                recipient_email=log.recipient_email,
                recipient_name=log.recipient_name,
                subject=log.subject,
                status=log.status,
                error_message=log.error_message,
                reference_code=log.reference_code,
                client_id=log.client_id,
                order_id=log.order_id,
                sale_id=log.sale_id,
                user_id=log.user_id,
                triggered_by=log.triggered_by,
                sent_at=log.sent_at,
                client_name=client.name if client else None,
                triggered_by_name=user.full_name or user.username if user else None,
                email_type_label=EMAIL_TYPE_LABELS.get(log.email_type, log.email_type.value),
            )
            for log, client, user in result.all()
        ]
