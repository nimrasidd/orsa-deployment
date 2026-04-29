from __future__ import annotations

import logging
from typing import Any, cast

from fastapi import FastAPI

# Ensure app logs are visible in server logs
logging.basicConfig(level=logging.INFO)
logging.getLogger("app").setLevel(logging.INFO)
logging.getLogger("app.db").setLevel(logging.INFO)
logging.getLogger("app.auth").setLevel(logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .debug_log import emit

# Import for exception handler - must handle HTTPException so our custom 500 details are returned
from fastapi import HTTPException
from fastapi import Depends
from .db import check_db_connection, get_db
from .routers import auth, companies, countries, mappings, models, regions, reports, reports_list, uploads
from .routers import settings as settings_router
from .schemas import HealthOut

app = FastAPI(title="ORSA API - Own Risk And Solvency Assessment")


@app.on_event("startup")
def _startup_db_check() -> None:
    # Don’t crash the server on boot; log clearly so deployment issues are obvious.
    try:
        check_db_connection()
    except Exception:
        logging.getLogger("app.db").exception("DB check failed on startup")
        emit(
            "app/main.py:_startup_db_check",
            "DB check failed on startup",
            hypothesis_id="A",
            run_id="pre-fix",
        )


@app.exception_handler(HTTPException)
def handle_http_exception(request, exc: HTTPException):
    """Ensure HTTPException (including our 500 with detail) returns proper JSON."""
    detail = exc.detail
    if isinstance(detail, (list, dict)):
        return JSONResponse(status_code=exc.status_code, content={"detail": detail})
    return JSONResponse(status_code=exc.status_code, content={"detail": str(detail)})


@app.exception_handler(Exception)
def handle_unhandled(request, exc: Exception):
    """Return JSON for DB/connection errors; avoid ECONNRESET from unhandled exceptions."""
    name = type(exc).__name__
    msg = str(exc).lower()
    # Log full traceback for 500s so we can debug
    logging.exception("Unhandled exception: %s %s", request.method, request.url.path)
    # DB / connection / network errors -> 503 with message
    if (
        "psycopg" in name
        or "operationalerror" in name
        or "connection" in msg
        or "connect" in msg
        or "econnrefused" in msg
        or "econnreset" in msg
        or "timeout" in msg
    ):
        emit(
            "app/main.py:handle_unhandled",
            "Returning 503 due to DB/connectivity error",
            data={
                "path": request.url.path,
                "error_type": name,
                "error": str(exc)[:300],
            },
            hypothesis_id="A",
            run_id="pre-fix",
        )
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database unavailable. Run migration on Supabase, check DATABASE_URL, or try /debug.",
                "error": str(exc)[:300],
            },
        )
    # Other errors -> 500 with message (avoids ECONNRESET from bare exception)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)[:300], "type": name},
    )


def _parse_cors_origins(raw: str) -> list[str]:
    raw = raw.strip()
    if raw == "*" or raw == "":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


origins = _parse_cors_origins(settings.cors_origins)
allow_credentials = origins != ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if origins == ["*"] else origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok")


@app.get("/")
def root():
    """Root redirect/info."""
    return {"message": "ORSA API - Own Risk And Solvency Assessment", "docs": "/docs", "health": "/health"}


@app.get("/debug")
def debug_db():
    """Diagnose DB connection and table counts. Never returns 500 - errors go in response."""
    import sqlite3
    from pathlib import Path

    url = settings.database_url
    info: dict[str, Any] = {
        "database": "sqlite" if url.startswith("sqlite:///") else "postgres",
        "mapping_count": None,
        "uploads_count": None,
        "report_nodes_count": None,
        "report_region_applicability_count": None,
        "error": None,
    }
    try:
        if url.startswith("sqlite:///"):
            prefix = "sqlite:///"
            raw = url[len(prefix):]
            backend = Path(__file__).resolve().parents[1]
            path = (backend / raw.replace("./", "")).resolve() if not raw.startswith("/") else Path(raw)
            conn = sqlite3.connect(str(path))
            conn.row_factory = sqlite3.Row
            for tbl, col in [("mapping", "mapping_count"), ("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                try:
                    r = conn.execute(f"select count(*) as n from {tbl}").fetchone()
                    info[col] = r["n"] if r else 0
                except Exception:
                    info[col] = None
            conn.close()
        else:
            import psycopg
            from psycopg import sql
            from psycopg.rows import dict_row

            conn = psycopg.connect(
                url,
                row_factory=cast(Any, dict_row),
                prepare_threshold=None,
            )
            try:
                with conn.cursor() as cur:
                    for tbl, col in [("mapping", "mapping_count"), ("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                        try:
                            cur.execute(
                                sql.SQL("select count(*) as n from public.{}").format(sql.Identifier(tbl))
                            )
                            row = cur.fetchone()
                            info[col] = int(cast(dict[str, Any], row)["n"]) if row is not None else 0
                        except Exception:
                            info[col] = None
            finally:
                conn.close()
    except Exception as e:
        info["error"] = str(e)
    return info


@app.get("/debug/app")
def debug_app_db(db=Depends(get_db)):
    """Table counts from the DB connection the app actually uses (includes SQLite fallback)."""
    import sqlite3

    info: dict[str, Any] = {"database": "sqlite" if isinstance(db, sqlite3.Connection) else "postgres"}
    try:
        if isinstance(db, sqlite3.Connection):
            for tbl, col in [("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                try:
                    r = db.execute(f"select count(*) as n from {tbl}").fetchone()
                    info[col] = int(r["n"]) if r is not None else 0
                except Exception:
                    info[col] = None
        else:
            from psycopg import sql

            with db.cursor() as cur:
                try:
                    cur.execute("select current_database() as db, current_user as user")
                    row = cur.fetchone()
                    if isinstance(row, dict):
                        info["current_database"] = row.get("db")
                        info["current_user"] = row.get("user")
                    elif row is not None:
                        info["current_database"] = row[0]
                        info["current_user"] = row[1]
                except Exception:
                    pass
                for tbl, col in [("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                    try:
                        cur.execute(
                            sql.SQL("select count(*) as n from public.{}").format(sql.Identifier(tbl))
                        )
                        row = cur.fetchone()
                        info[col] = int(cast(dict[str, Any], row)["n"]) if row is not None else 0
                    except Exception:
                        info[col] = None
    except Exception as e:
        info["error"] = str(e)
    return info


app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(reports.router)
app.include_router(reports_list.router)
app.include_router(mappings.router)
app.include_router(regions.router)
app.include_router(countries.router)
app.include_router(companies.router)
app.include_router(settings_router.router)
app.include_router(models.router)

