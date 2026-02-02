from fastapi import APIRouter
from app.utils.timezone import get_colombia_now_naive
from app.core.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": get_colombia_now_naive().isoformat(),
        "version": settings.VERSION,
        "service": settings.PROJECT_NAME,
        "environment": settings.ENV
    }
