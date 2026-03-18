"""
Redis Client Configuration
Maneja conexiones a Redis para cache, rate limiting y verificación
"""
import redis.asyncio as redis
from typing import Optional
from app.core.config import settings

# Cliente Redis global
_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client"""
    global _redis_client

    if _redis_client is None:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            max_connections=10
        )

    return _redis_client


async def close_redis():
    """Close Redis connection"""
    global _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None


# Utilidades para códigos de verificación
async def set_verification_code(key: str, code: str, ttl: int = 600) -> None:
    """
    Guardar código de verificación en Redis

    Args:
        key: Identificador único (email o teléfono)
        code: Código de verificación
        ttl: Tiempo de vida en segundos (default: 10 minutos)
    """
    client = await get_redis()
    await client.setex(f"verify:{key}", ttl, code)


async def get_verification_code(key: str) -> Optional[str]:
    """
    Obtener código de verificación de Redis

    Args:
        key: Identificador único (email o teléfono)

    Returns:
        Código de verificación o None si expiró
    """
    client = await get_redis()
    return await client.get(f"verify:{key}")


async def delete_verification_code(key: str) -> None:
    """
    Eliminar código de verificación de Redis

    Args:
        key: Identificador único (email o teléfono)
    """
    client = await get_redis()
    await client.delete(f"verify:{key}")


async def set_verified_email(email: str, ttl: int = 3600) -> None:
    """
    Marcar email como verificado

    Args:
        email: Email verificado
        ttl: Tiempo de validez en segundos (default: 1 hora)
    """
    client = await get_redis()
    await client.setex(f"verified:{email}", ttl, "1")


async def is_email_verified(email: str) -> bool:
    """
    Verificar si email está marcado como verificado

    Args:
        email: Email a verificar

    Returns:
        True si está verificado y no ha expirado
    """
    client = await get_redis()
    result = await client.get(f"verified:{email}")
    return result == "1"


async def delete_verified_email(email: str) -> None:
    """
    Eliminar marca de verificación de email

    Args:
        email: Email a eliminar
    """
    client = await get_redis()
    await client.delete(f"verified:{email}")
