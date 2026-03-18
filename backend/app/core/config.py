from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import List, Optional
import os
import json
from pathlib import Path


def _load_version_from_file() -> str:
    """Load version from version.json in project root."""
    try:
        # Navigate from backend/app/core/config.py to project root
        project_root = Path(__file__).parent.parent.parent.parent
        version_file = project_root / "version.json"
        if version_file.exists():
            with open(version_file, "r") as f:
                data = json.load(f)
                return data.get("apps", {}).get("backend", data.get("system", "2.5.0"))
    except Exception:
        pass
    return "2.5.0"  # Fallback version


class Settings(BaseSettings):
    # Project
    PROJECT_NAME: str = "Uniformes System API"
    VERSION: str = _load_version_from_file()
    API_V1_STR: str = "/api/v1"

    # Environment
    ENV: str = "development"
    DEBUG: bool = False
    TESTING: bool = False  # Set to True during pytest runs to disable rate limiting

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://uniformes_user:dev_password@localhost:5432/uniformes_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Server
    BACKEND_HOST: str = "0.0.0.0"  # Listen on all interfaces
    BACKEND_PORT: int = 8000

    # CORS - Lista restringida de origenes permitidos
    BACKEND_CORS_ORIGINS: List[str] = [
        # Desktop app (Tauri)
        "tauri://localhost",
        # Desarrollo local
        "http://localhost:3001",   # Web portal dev
        "http://localhost:3002",   # Admin portal dev
        "http://localhost:5171",   # Vite dev server (Tauri frontend)
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        # Produccion
        "https://yourdomain.com",
        "https://www.yourdomain.com",
        "https://api.yourdomain.com",
        "https://admin.yourdomain.com",
    ]

    # Email (Resend)
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "Uniformes <noreply@resend.dev>"
    FRONTEND_URL: str = "http://localhost:3001"  # Web portal (clients)
    ADMIN_PORTAL_URL: str = "http://localhost:3002"  # Admin portal (internal users)

    # Wompi Payment Gateway
    WOMPI_ENABLED: bool = False
    WOMPI_ENVIRONMENT: str = "sandbox"  # "sandbox" or "production"
    WOMPI_PUBLIC_KEY: Optional[str] = None
    WOMPI_PRIVATE_KEY: Optional[str] = None
    WOMPI_EVENTS_KEY: Optional[str] = None
    WOMPI_INTEGRITY_KEY: Optional[str] = None
    WOMPI_REDIRECT_URL: str = "http://localhost:3001/pago/resultado"

    @property
    def wompi_base_url(self) -> str:
        if self.WOMPI_ENVIRONMENT == "production":
            return "https://production.wompi.co/v1"
        return "https://sandbox.wompi.co/v1"

    # Telegram Monitoring Alerts
    TELEGRAM_BOT_TOKEN: Optional[str] = None
    TELEGRAM_CHAT_ID: Optional[str] = None
    DISK_ALERT_THRESHOLD_PCT: float = 80.0
    HEALTH_SAMPLE_INTERVAL: int = 60  # seconds

    # WhatsApp Business API (Meta Cloud API)
    WHATSAPP_ENABLED: bool = False
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None

    # Uploads directory (auto-detected based on environment)
    UPLOADS_DIR: str = ""

    @property
    def uploads_path(self) -> str:
        """Get the uploads directory path based on environment."""
        if self.UPLOADS_DIR:
            return self.UPLOADS_DIR
        if self.ENV == "production":
            return "/var/www/uniformes-system-v2/uploads"
        # Development: use local backend/uploads directory
        import os
        return os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

    @model_validator(mode='after')
    def validate_production_settings(self) -> 'Settings':
        """Prevent dangerous defaults in production."""
        if self.ENV == "production":
            if self.SECRET_KEY == "your-secret-key-change-in-production":
                raise ValueError("SECRET_KEY must be changed in production")
            if self.DEBUG:
                raise ValueError("DEBUG must be False in production")
            if self.TESTING:
                raise ValueError("TESTING must be False in production")
        return self

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
