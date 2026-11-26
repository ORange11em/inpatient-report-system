from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="",
        env_file=None,
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str = ""
    database_ssl_required: bool = False
    db_ssl_ca_file: str | None = None
    session_ttl_minutes: int = 480

    @model_validator(mode="after")
    def validate_runtime_settings(self):
        if self.session_ttl_minutes < 5 or self.session_ttl_minutes > 1440:
            raise ValueError("SESSION_TTL_MINUTES must be between 5 and 1440")
        if self.app_env.lower() == "production" and not self.database_ssl_required:
            raise ValueError("DATABASE_SSL_REQUIRED must be true in production")
        if self.db_ssl_ca_file and not Path(self.db_ssl_ca_file).is_file():
            raise ValueError("DB_SSL_CA_FILE must point to a readable CA file")
        return self

    @property
    def secure_cookies(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def docs_enabled(self) -> bool:
        return self.app_env.lower() != "production"

    def async_database_url(self) -> str:
        value = self.database_url.strip()
        if not value:
            raise RuntimeError("DATABASE_URL is not configured")
        if value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+asyncpg://", 1)
        if not value.startswith("postgresql+asyncpg://"):
            raise RuntimeError("DATABASE_URL must use PostgreSQL with asyncpg")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
