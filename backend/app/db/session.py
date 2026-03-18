"""
Database session configuration
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

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
            raise
        finally:
            await session.close()
