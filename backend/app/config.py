from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Resolve `.env` relative to the backend package, not the process CWD.
    # This makes `uvicorn app.main:app ...` work consistently from any folder.
    _env_path = (Path(__file__).resolve().parents[1] / ".env")
    model_config = SettingsConfigDict(env_file=str(_env_path), env_file_encoding="utf-8", extra="ignore")

    # Default satisfies the type checker; DATABASE_URL / `.env` still overrides at runtime.
    database_url: str = Field(default="sqlite:///./osra.db")
    cors_origins: str = "*"  # comma-separated, or "*"
    secret_key: str = "dev-secret-change-in-production"  # for JWT signing


settings = Settings()

