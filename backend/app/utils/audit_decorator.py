"""
Audit decorator for route handlers.

Usage:
    from app.utils.audit_decorator import audit_action
    from app.models.audit_log import AuditAction

    @router.delete("/{expense_id}")
    @audit_action(AuditAction.EXPENSE_DELETE, resource_type="expense")
    async def delete_expense(
        expense_id: UUID,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user),
        request: Request = None,
    ):
        ...
        # The decorator automatically logs the action after successful execution
"""
import functools
import uuid
from typing import Optional, Callable

from app.models.audit_log import AuditAction
from app.services.audit import audit_service


def audit_action(
    action: AuditAction,
    resource_type: str,
    resource_id_param: str = None,
    description_fn: Optional[Callable] = None,
):
    """
    Decorator that automatically logs an audit entry after a route handler executes.

    Args:
        action: The AuditAction enum value
        resource_type: String identifying the resource type (e.g., "sale", "expense")
        resource_id_param: Name of the path parameter containing the resource ID
        description_fn: Optional callable(result) -> str for custom description
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)

            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            request = kwargs.get("request")

            if db and current_user:
                actor_id = getattr(current_user, "id", None)
                resource_id = None

                if resource_id_param and resource_id_param in kwargs:
                    resource_id = str(kwargs[resource_id_param])

                desc = None
                if description_fn:
                    try:
                        desc = description_fn(result)
                    except Exception:
                        desc = None

                try:
                    await audit_service.log(
                        db=db,
                        actor_id=actor_id,
                        action=action,
                        resource_type=resource_type,
                        resource_id=resource_id,
                        description=desc,
                        request=request,
                    )
                except Exception:
                    # Audit logging should never break the main operation
                    pass

            return result
        return wrapper
    return decorator
