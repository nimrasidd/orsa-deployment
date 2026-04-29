from __future__ import annotations

from collections.abc import Generator
import logging
import sqlite3
from typing import Any

import psycopg
from psycopg.rows import dict_row

from .config import settings
from .debug_log import emit


logger = logging.getLogger("app.db")


def _redact_db_url(url: str) -> str:
    """
    Redact password in URLs like postgresql://user:pass@host:5432/db
    Best-effort: never raise from logging helpers.
    """
    try:
        if "://" not in url:
            return "<invalid-url>"
        scheme, rest = url.split("://", 1)
        if "@" not in rest:
            return f"{scheme}://<redacted>"
        creds, hostpart = rest.split("@", 1)
        if ":" in creds:
            user = creds.split(":", 1)[0]
            return f"{scheme}://{user}:***@{hostpart}"
        return f"{scheme}://***@{hostpart}"
    except Exception:
        return "<redacted>"


def get_db() -> Generator[Any, None, None]:
    """
    FastAPI dependency that yields a short-lived DB connection.

    Supports:
    - Postgres via `psycopg` when DATABASE_URL is a Postgres URL
    - SQLite when DATABASE_URL starts with `sqlite:///`
    """
    if not settings.database_url.strip():
        raise RuntimeError("DATABASE_URL is required")

    if settings.database_url.startswith("sqlite:///"):
        prefix = "sqlite:///"
        raw = settings.database_url[len(prefix) :]
        # Keep behavior consistent with the `/debug` endpoint: resolve relative paths
        # under the backend folder so running uvicorn from any CWD works.
        from pathlib import Path

        backend_dir = Path(__file__).resolve().parents[1]
        path = (backend_dir / raw.replace("./", "")).resolve() if not raw.startswith("/") else Path(raw)
        conn = sqlite3.connect(str(path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("pragma foreign_keys=on")
        except Exception:
            pass
        try:
            yield conn
        finally:
            conn.close()
        return

    # #region agent log
    emit(
        "app/db.py:get_db",
        "Attempting Postgres connect",
        data={"database_url": _redact_db_url(settings.database_url)},
        hypothesis_id="A",
        run_id="pre-fix",
    )
    # #endregion
    logger.debug("Connecting to DB: %s", _redact_db_url(settings.database_url))
    try:
        conn = psycopg.connect(
            settings.database_url,
            row_factory=dict_row,  # type: ignore[arg-type]
            connect_timeout=10,
            prepare_threshold=None,  # Required for Supabase transaction-mode pooler
        )
        # psycopg3 defaults to autocommit=False. Our API code often relies on context managers
        # (e.g. `with conn.transaction():`) without calling conn.commit() explicitly.
        # When the request ends, the connection is closed and the uncommitted transaction rolls back.
        # Autocommit=True ensures writes persist unless a transaction block explicitly rolls them back.
        conn.autocommit = True
    except Exception as e:
        # #region agent log
        emit(
            "app/db.py:get_db",
            "Postgres connect failed",
            data={"error_type": type(e).__name__, "error": str(e)[:300]},
            hypothesis_id="A",
            run_id="pre-fix",
        )
        # #endregion
        raise

    try:
        yield conn
    finally:
        conn.close()


def check_db_connection() -> None:
    """One-shot connectivity check for startup diagnostics."""
    if not settings.database_url.strip():
        raise RuntimeError("DATABASE_URL is required")
    url = settings.database_url
    logger.info("DB check starting: %s", _redact_db_url(url))
    emit(
        "app/db.py:check_db_connection",
        "DB check starting",
        data={"database_url": _redact_db_url(url)},
        hypothesis_id="A",
        run_id="pre-fix",
    )
    try:
        if url.startswith("sqlite:///"):
            prefix = "sqlite:///"
            raw = url[len(prefix) :]
            from pathlib import Path

            backend_dir = Path(__file__).resolve().parents[1]
            path = (backend_dir / raw.replace("./", "")).resolve() if not raw.startswith("/") else Path(raw)
            conn = sqlite3.connect(str(path))
            try:
                row = conn.execute("select 1 as ok").fetchone()
                if not row:
                    raise RuntimeError("DB check failed: empty response")
            finally:
                conn.close()
        else:
            conn = psycopg.connect(
                url,
                row_factory=dict_row,  # type: ignore[arg-type]
                connect_timeout=10,
                prepare_threshold=None,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute("select 1 as ok")
                    row = cur.fetchone()
                    if not row:
                        raise RuntimeError("DB check failed: empty response")
            finally:
                conn.close()
    except Exception as e:
        emit(
            "app/db.py:check_db_connection",
            "DB check connect failed",
            data={"error_type": type(e).__name__, "error": str(e)[:300]},
            hypothesis_id="A",
            run_id="pre-fix",
        )
        raise
    logger.info("DB check OK")
    emit(
        "app/db.py:check_db_connection",
        "DB check OK",
        hypothesis_id="A",
        run_id="pre-fix",
    )

