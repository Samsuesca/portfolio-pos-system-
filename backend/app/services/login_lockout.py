"""
Login lockout — mitigacion de fuerza bruta por cuenta.

Cuenta los intentos fallidos de login por combinacion ``(username, IP)`` en
Redis y bloquea temporalmente esa combinacion tras superar el umbral. Es una
capa adicional sobre el rate limit por IP de slowapi: protege una cuenta
concreta de fuerza bruta desde una misma IP sin permitir que un atacante en
otra IP bloquee a un usuario legitimo.

Diseño fail-open: cualquier error de Redis se traga y la operacion se vuelve
un no-op (se loguea un warning). La seguridad nunca debe depender de que Redis
este vivo — preferimos que el login siga disponible a bloquearlo por una caida
de infraestructura.
"""
import logging

from app.core.redis_client import get_redis

logger = logging.getLogger("auth.lockout")

MAX_FAILED_ATTEMPTS = 10
LOCKOUT_WINDOW_SECONDS = 15 * 60

# INCR + EXPIRE en una sola operacion atomica (Lua corre indivisible en Redis).
# El EXPIRE solo se setea cuando la key no tiene TTL (< 0), de modo que la
# ventana queda fija desde el primer fallo. Ademas auto-sana: si un fallo de
# red dejo una key sin TTL, el siguiente intento se lo restaura (evita keys
# zombi que se acumularian para siempre).
_INCR_WITH_TTL_LUA = """
local attempts = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return attempts
"""


def _key(username: str, ip: str) -> str:
    return f"login_fail:{username.strip().lower()}:{ip}"


async def get_lockout_remaining(username: str, ip: str) -> int | None:
    """Segundos restantes de bloqueo, o ``None`` si la combinacion no esta bloqueada.

    Fail-open: ante cualquier error de Redis retorna ``None`` (no bloquea).
    """
    key = _key(username, ip)
    try:
        client = await get_redis()
        attempts = await client.get(key)
        if attempts is None or int(attempts) < MAX_FAILED_ATTEMPTS:
            return None
        ttl = await client.ttl(key)
        return ttl if ttl and ttl > 0 else None
    except Exception as exc:  # noqa: BLE001 — fail-open intencional
        logger.warning("Lockout check omitido (error de Redis): %s", type(exc).__name__)
        return None


async def register_failed_attempt(username: str, ip: str) -> None:
    """Incrementa el contador de fallos y fija el TTL de la ventana (atomico).

    La ventana es fija desde el primer fallo: el TTL solo se asigna cuando la
    key aun no lo tiene, asi el bloqueo expira 15 minutos despues del primer
    intento fallido y luego el contador se reinicia solo. El INCR+EXPIRE corre
    como un unico script Lua para que un corte de red no pueda dejar la key sin
    TTL (lo que generaria contadores zombi).

    Fail-open: ante error de Redis no hace nada.
    """
    key = _key(username, ip)
    try:
        client = await get_redis()
        await client.eval(_INCR_WITH_TTL_LUA, 1, key, LOCKOUT_WINDOW_SECONDS)
    except Exception as exc:  # noqa: BLE001 — fail-open intencional
        logger.warning("Lockout registro omitido (error de Redis): %s", type(exc).__name__)


async def clear_failed_attempts(username: str, ip: str) -> None:
    """Limpia el contador tras un login exitoso. Fail-open."""
    key = _key(username, ip)
    try:
        client = await get_redis()
        await client.delete(key)
    except Exception as exc:  # noqa: BLE001 — fail-open intencional
        logger.warning("Lockout limpieza omitida (error de Redis): %s", type(exc).__name__)
