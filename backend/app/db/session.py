"""
Database session configuration
"""
import logging
from collections.abc import Awaitable, Callable

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# Clave en session.info donde se acumulan las notificaciones diferidas (WS2).
_AFTER_COMMIT_KEY = "after_commit_callbacks"


def defer_after_commit(session: AsyncSession, make_coro: Callable[[], Awaitable]) -> None:
    """Encola una acción IRREVERSIBLE (email/WhatsApp/Telegram al cliente) para
    dispararse SOLO si la transacción del request commitea.

    ``make_coro`` es un callable SIN argumentos que retorna la corrutina a
    ejecutar (la corrutina se crea al disparar, no antes, para no dejar
    corrutinas sin await si la transacción revierte). Las notificaciones se
    drenan en ``get_db`` justo después del commit, con la sesión aún viva.

    Razón (WS2): hoy las notificaciones se mandan DENTRO de la transacción; si
    luego hace rollback, el cliente recibe "tu pedido está listo" de un estado
    que no se guardó. Diferirlas garantiza: notificación al cliente ⟺ estado
    committeado.
    """
    session.info.setdefault(_AFTER_COMMIT_KEY, []).append(make_coro)

# Create async engine
# Connection pooling optimizado para VPS de 1-2GB RAM
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    pool_pre_ping=True,          # Verificar conexión antes de usar
    pool_size=5,                 # Reducido de 10 a 5 (ahorra RAM)
    max_overflow=10,             # Reducido de 20 a 10
    pool_recycle=3600,           # Reciclar conexiones cada hora
    pool_timeout=30,             # Timeout de 30s para obtener conexión
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """
    Dependency for getting async database sessions

    Usage in FastAPI:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            # La transacción no commiteó: descartar notificaciones encoladas
            # (WS2) para no avisar al cliente de un estado que no se guardó.
            session.info.pop(_AFTER_COMMIT_KEY, None)
            raise
        else:
            # Commit exitoso: disparar notificaciones diferidas con la sesión
            # aún viva (best-effort: un fallo de notificación no rompe el request).
            for make_coro in session.info.pop(_AFTER_COMMIT_KEY, []):
                try:
                    await make_coro()
                except Exception as e:
                    logger.error(f"Notificación after-commit falló (best-effort): {e}")
        finally:
            await session.close()
