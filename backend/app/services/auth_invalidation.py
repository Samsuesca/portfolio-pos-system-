"""
Token Invalidation — Single Source of Truth para invalidar JWTs vivos.

Se llama desde rutas que cambian credenciales (password change, email
change confirmado, ataques de toma de cuenta detectados, force-logout
administrativo). Bumpea ``User.token_version`` dentro de la transacción;
``get_current_user`` rechaza con 401 cualquier JWT con un valor previo.

Sin cache que invalidar — la validación es siempre contra el row de DB,
no hay TTL. La consistencia es inmediata tras commit.

Patrón espejo de ``PermissionInvalidator`` (que sirve para invalidar
el cache de permisos efectivos, no el JWT).
"""
from uuid import UUID

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class TokenInvalidator:
    """Bumpea ``User.token_version`` para invalidar JWTs activos.

    Uso típico desde una ruta que cambia credenciales::

        invalidator = TokenInvalidator(db)
        await invalidator.bump_user(user_id)
        await db.commit()

    No requiere flush post-commit (a diferencia de ``PermissionInvalidator``)
    porque no hay cache: la validación de tokens consulta el campo en DB
    directamente en cada request via ``get_current_user``.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def bump_user(self, user_id: UUID) -> None:
        """Incrementa ``User.token_version`` para el usuario indicado.

        Args:
            user_id: UUID del usuario cuyas sesiones se invalidan.

        Side effects:
            - ``UPDATE users SET token_version = token_version + 1 WHERE id = :user_id``
            - Cualquier JWT con ``token_version < nuevo`` será rechazado
              en el próximo request con HTTP 401.
        """
        await self.db.execute(
            update(User)
            .where(User.id == user_id)
            .values(token_version=User.token_version + 1)
        )
