from app.schemas.base import ErrorResponse

_CATALOG: dict[int, dict] = {
    400: {"model": ErrorResponse, "description": "Datos invalidos"},
    401: {"model": ErrorResponse, "description": "No autenticado"},
    403: {"model": ErrorResponse, "description": "Permisos insuficientes"},
    404: {"model": ErrorResponse, "description": "Recurso no encontrado"},
    409: {"model": ErrorResponse, "description": "Conflicto con el estado actual"},
    422: {"model": ErrorResponse, "description": "Error de validacion"},
}

AUTHENTICATED = {401: _CATALOG[401], 403: _CATALOG[403]}


def responses(*codes: int) -> dict[int, dict]:
    result = dict(AUTHENTICATED)
    for code in codes:
        if code in _CATALOG:
            result[code] = _CATALOG[code]
    return result
