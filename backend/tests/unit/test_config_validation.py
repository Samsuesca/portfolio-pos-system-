"""
Tests for production configuration validation.

Ensures that dangerous defaults are caught when ENV=production,
and that safe defaults work in development/testing.
"""
import os
import pytest
from unittest.mock import patch


class TestProductionConfigValidation:
    """Tests that production environment rejects unsafe configurations."""

    def test_production_rejects_default_secret_key(self):
        """Production must reject the placeholder SECRET_KEY."""
        env = {
            "ENV": "production",
            "SECRET_KEY": "your-secret-key-change-in-production",
            "DEBUG": "false",
            "TESTING": "false",
        }
        with patch.dict(os.environ, env, clear=False):
            from pydantic_settings import BaseSettings
            from pydantic import model_validator

            # Re-import to test validation
            # We can't re-import Settings easily, so we test the validator logic directly
            from app.core.config import Settings
            with pytest.raises(ValueError, match="SECRET_KEY must be changed"):
                Settings(
                    ENV="production",
                    SECRET_KEY="your-secret-key-change-in-production",
                    DEBUG=False,
                    TESTING=False,
                )

    def test_production_rejects_debug_true(self):
        """Production must reject DEBUG=True."""
        with pytest.raises(ValueError, match="DEBUG must be False"):
            from app.core.config import Settings
            Settings(
                ENV="production",
                SECRET_KEY="a-real-secure-key-that-is-not-default",
                DEBUG=True,
                TESTING=False,
            )

    def test_production_rejects_testing_true(self):
        """Production must reject TESTING=True."""
        with pytest.raises(ValueError, match="TESTING must be False"):
            from app.core.config import Settings
            Settings(
                ENV="production",
                SECRET_KEY="a-real-secure-key-that-is-not-default",
                DEBUG=False,
                TESTING=True,
            )

    def test_production_accepts_valid_config(self):
        """Production accepts valid configuration."""
        from app.core.config import Settings
        s = Settings(
            ENV="production",
            SECRET_KEY="a-very-secure-production-key-2024",
            DEBUG=False,
            TESTING=False,
        )
        assert s.ENV == "production"
        assert s.SECRET_KEY == "a-very-secure-production-key-2024"
        assert s.DEBUG is False
        assert s.TESTING is False


class TestDevelopmentConfig:
    """Tests that development environment allows defaults."""

    def test_development_allows_default_secret_key(self):
        """Development environment should accept default SECRET_KEY."""
        from app.core.config import Settings
        s = Settings(
            ENV="development",
            SECRET_KEY="your-secret-key-change-in-production",
            DEBUG=True,
            TESTING=False,
        )
        assert s.SECRET_KEY == "your-secret-key-change-in-production"

    def test_development_allows_debug_true(self):
        """Development environment should accept DEBUG=True."""
        from app.core.config import Settings
        s = Settings(
            ENV="development",
            DEBUG=True,
        )
        assert s.DEBUG is True

    def test_testing_env_allows_testing_flag(self):
        """Testing environment should accept TESTING=True."""
        from app.core.config import Settings
        s = Settings(
            ENV="testing",
            TESTING=True,
        )
        assert s.TESTING is True


class TestConfigDefaults:
    """Tests that defaults are safe."""

    def test_debug_defaults_to_false(self):
        """DEBUG should default to False for safety."""
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert s.DEBUG is False

    def test_testing_defaults_to_false(self, monkeypatch):
        """TESTING should default to False."""
        monkeypatch.delenv("TESTING", raising=False)
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert s.TESTING is False

    def test_env_defaults_to_development(self, monkeypatch):
        """ENV should default to development, not production."""
        monkeypatch.delenv("ENV", raising=False)
        monkeypatch.delenv("TESTING", raising=False)
        from app.core.config import Settings
        s = Settings()
        assert s.ENV == "development"

    def test_cors_origins_include_production_domain(self):
        """CORS origins should include the production domain."""
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert "https://yourdomain.com" in s.BACKEND_CORS_ORIGINS

    def test_cors_origins_include_tauri(self):
        """CORS origins should include tauri://localhost for desktop app."""
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert "tauri://localhost" in s.BACKEND_CORS_ORIGINS

    def test_algorithm_is_hs256(self):
        """JWT algorithm should be HS256."""
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert s.ALGORITHM == "HS256"

    def test_token_expiry_is_reasonable(self):
        """Token expiry should be between 5 and 1440 minutes (1 day)."""
        from app.core.config import Settings
        s = Settings(ENV="development")
        assert 5 <= s.ACCESS_TOKEN_EXPIRE_MINUTES <= 1440
