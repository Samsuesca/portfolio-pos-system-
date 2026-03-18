"""
Audit Service - Records sensitive operations for security and compliance.

Usage:
    from app.services.audit import audit_service

    # In a route handler:
    await audit_service.log(
        db=db,
        actor_id=current_user.id,
        action=AuditAction.SALE_CANCEL,
        resource_type="sale",
        resource_id=str(sale.id),
        description=f"Cancelled sale {sale.sale_number}",
        data_before={"status": "completed", "total": str(sale.total)},
        data_after={"status": "cancelled"},
        request=request,
    )
"""
import uuid
from datetime import date
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.models.audit_log import AuditLog, AuditAction
from app.utils.timezone import get_colombia_now_naive, get_colombia_datetime_range_naive


class AuditService:
    """Service for recording and querying audit logs."""

    async def log(
        self,
        db: AsyncSession,
        actor_id: Optional[uuid.UUID],
        action: str | AuditAction,
        resource_type: str,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        school_id: Optional[uuid.UUID] = None,
        data_before: Optional[dict] = None,
        data_after: Optional[dict] = None,
        request: Optional[Request] = None,
    ) -> AuditLog:
        """Record an audit log entry."""
        action_value = action.value if isinstance(action, AuditAction) else action

        ip_address = None
        user_agent = None
        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent", "")[:500]

        entry = AuditLog(
            actor_id=actor_id,
            action=action_value,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            school_id=school_id,
            data_before=data_before,
            data_after=data_after,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(entry)
        await db.flush()
        return entry

    async def get_logs(
        self,
        db: AsyncSession,
        action: Optional[str] = None,
        actor_id: Optional[uuid.UUID] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        school_id: Optional[uuid.UUID] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """Query audit logs with filters. Returns (logs, total_count)."""
        conditions = []

        if action:
            conditions.append(AuditLog.action == action)
        if actor_id:
            conditions.append(AuditLog.actor_id == actor_id)
        if resource_type:
            conditions.append(AuditLog.resource_type == resource_type)
        if resource_id:
            conditions.append(AuditLog.resource_id == resource_id)
        if school_id:
            conditions.append(AuditLog.school_id == school_id)
        if date_from:
            start, _ = get_colombia_datetime_range_naive(date_from)
            conditions.append(AuditLog.created_at >= start)
        if date_to:
            _, end = get_colombia_datetime_range_naive(date_to)
            conditions.append(AuditLog.created_at <= end)

        where_clause = and_(*conditions) if conditions else True

        # Count
        count_stmt = select(func.count(AuditLog.id)).where(where_clause)
        total = (await db.execute(count_stmt)).scalar() or 0

        # Query
        stmt = (
            select(AuditLog)
            .where(where_clause)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(stmt)
        logs = list(result.scalars().all())

        return logs, total

    async def get_resource_history(
        self,
        db: AsyncSession,
        resource_type: str,
        resource_id: str,
    ) -> list[AuditLog]:
        """Get all audit entries for a specific resource."""
        stmt = (
            select(AuditLog)
            .where(
                AuditLog.resource_type == resource_type,
                AuditLog.resource_id == resource_id,
            )
            .order_by(AuditLog.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_actor_activity(
        self,
        db: AsyncSession,
        actor_id: uuid.UUID,
        limit: int = 100,
    ) -> list[AuditLog]:
        """Get recent activity by a specific user."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.actor_id == actor_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())


# Singleton instance
audit_service = AuditService()
