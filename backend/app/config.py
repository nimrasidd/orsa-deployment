from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Resolve `.env` relative to the backend package, not the process CWD.
    # This makes `uvicorn app.main:app ...` work consistently from any folder.
    _env_path = (Path(__file__).resolve().parents[1] / ".env")
    model_config = SettingsConfigDict(env_file=str(_env_path), env_file_encoding="utf-8", extra="ignore")

    # Postgres-only deployment: DATABASE_URL must be set (e.g. in backend/.env).
    database_url: str = Field(default="")
    cors_origins: str = "*"  # comma-separated, or "*"
    secret_key: str = Field(default="dev-secret-change-in-production", alias="SECRET_KEY")  # for JWT signing


settings = Settings()

