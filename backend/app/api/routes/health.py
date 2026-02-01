from fastapi import APIRouter
from app.utils.timezone import get_colombia_now_naive

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": get_colombia_now_naive().isoformat(),
        "version": "2.0.0",
        "service": "Uniformes System API"
    }
