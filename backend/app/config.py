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

    # Public "request access" form → email via SMTP (Office 365, Google Workspace, etc.).
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="", alias="SMTP_FROM")  # From address shown to recipients
    access_request_email_to: str = Field(
        default="",
        alias="ACCESS_REQUEST_EMAIL_TO",
        description="Comma-separated recipient addresses for access-request notifications.",
    )


settings = Settings()

