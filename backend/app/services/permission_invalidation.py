"""
Permission Invalidation — Single Source of Truth.

Toda mutacion que afecta los permisos efectivos de un usuario debe pasar
por aqui. Garantiza:
  1. permissions_version del/los user(s) bumpea dentro de la transaccion.
  2. permission_cache invalida DESPUES del commit (evita race entre
     invalidate y commit con repoblacion de cache pre-commit).
  3. Punto unico para extender a Redis pub/sub en el futuro
     (multi-worker cache coherency).
"""
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserSchoolRole
from app.services.permission_cache import invalidate as cache_invalidate


class PermissionInvalidator:
    """Coordina bump de permissions_version + invalidacion de cache.

    Uso tipico desde una ruta:
        invalidator = PermissionInvalidator(db)
        await invalidator.bump_user(user_id, school_id)
        await audit_service.log(...)
        await db.commit()
        invalidator.flush_cache_after_commit()

    El flush DEBE llamarse despues del commit. Si la request muere entre
    commit y flush, el TTL del cache (60s) absorbe la inconsistencia.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self._post_commit_users: list[tuple[UUID, UUID | None]] = []

    async def bump_user(self, user_id: UUID, school_id: UUID | None = None) -> None:
        """Bumpea permissions_version de un usuario.

        Args:
            user_id: UUID del usuario afectado.
            school_id: school_id opcional para invalidacion granular del
                cache (si None, invalida todas las entries del usuario).
        """
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(permissions_version=User.permissions_version + 1)
        )
        self._post_commit_users.append((user_id, school_id))

    async def bump_users_by_custom_role(self, custom_role_id: UUID) -> int:
        """Bumpea permissions_version de TODOS los usuarios asignados a un custom_role.

        Returns:
            Numero de usuarios afectados.
        """
        result = await self.db.execute(
            select(UserSchoolRole.user_id, UserSchoolRole.school_id)
            .where(UserSchoolRole.custom_role_id == custom_role_id)
        )
        pairs = list(result.all())
        if not pairs:
            return 0

        user_ids = list({uid for uid, _ in pairs})
        await self.db.execute(
            update(User)
            .where(User.id.in_(user_ids))
            .values(permissions_version=User.permissions_version + 1)
        )
        for user_id, school_id in pairs:
            self._post_commit_users.append((user_id, school_id))
        return len(user_ids)

    def flush_cache_after_commit(self) -> None:
        """Invalida cache de permisos para los usuarios marcados.

        DEBE llamarse despues del db.commit() exitoso. Idempotente:
        llamadas subsecuentes son no-op hasta que se vuelva a marcar
        otro usuario via bump_user/bump_users_by_custom_role.
        """
        for user_id, school_id in self._post_commit_users:
            cache_invalidate(user_id=user_id, school_id=school_id)
        self._post_commit_users.clear()
