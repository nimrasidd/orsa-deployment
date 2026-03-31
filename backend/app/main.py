from __future__ import annotations

import logging

from fastapi import FastAPI

# Ensure upload/excel errors are visible in server logs
logging.getLogger("app").setLevel(logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings

# Import for exception handler - must handle HTTPException so our custom 500 details are returned
from fastapi import HTTPException
from fastapi import Depends
from .db import get_db
from .routers import auth, companies, company_models, countries, mappings, models, regions, reports, reports_list, uploads
from .routers import settings as settings_router
from .schemas import HealthOut

app = FastAPI(title="ORSA API - Own Risk And Solvency Assessment")


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
    info = {
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
            from psycopg.rows import dict_row
            conn = psycopg.connect(url, row_factory=dict_row, prepare_threshold=None)
            try:
                with conn.cursor() as cur:
                    for tbl, col in [("mapping", "mapping_count"), ("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                        try:
                            cur.execute(f"select count(*) as n from public.{tbl}")
                            info[col] = cur.fetchone()["n"]
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
    info = {"database": "sqlite" if isinstance(db, sqlite3.Connection) else "postgres"}
    try:
        if isinstance(db, sqlite3.Connection):
            for tbl, col in [("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                try:
                    r = db.execute(f"select count(*) as n from {tbl}").fetchone()
                    info[col] = r["n"] if r else 0
                except Exception:
                    info[col] = None
        else:
            with db.cursor() as cur:
                for tbl, col in [("uploads", "uploads_count"), ("report_nodes", "report_nodes_count"), ("report_region_applicability", "report_region_applicability_count")]:
                    try:
                        cur.execute(f"select count(*) as n from public.{tbl}")
                        info[col] = cur.fetchone()["n"]
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
app.include_router(company_models.router)
app.include_router(models.router)

