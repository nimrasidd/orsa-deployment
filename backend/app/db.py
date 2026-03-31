from __future__ import annotations

from collections.abc import Generator
from pathlib import Path
from typing import Any
import sqlite3

import psycopg
from psycopg.rows import dict_row

from .config import settings


_sqlite_initialized = False


def _ensure_models_migration(conn: sqlite3.Connection) -> None:
    """Migrate company_models -> models for existing SQLite DBs."""
    cur = conn.execute("select name from sqlite_master where type='table' and name='company_models'")
    if not cur.fetchone():
        return  # no company_models, nothing to migrate
    # Create models if not exists
    conn.execute(
        """
        create table if not exists models (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          created_by_user_id text references users(id) on delete set null,
          name text not null,
          created_at text not null default (datetime('now')),
          unique(company_id, name)
        )
        """
    )
    # Migrate company_models -> models
    conn.execute(
        "insert or ignore into models (id, company_id, created_by_user_id, name, created_at) "
        "select id, company_id, null, name, datetime('now') from company_models"
    )
    # mapping.company_model_id -> mapping.model_id (models.id = company_models.id)
    try:
        conn.execute("alter table mapping add column model_id_new text references models(id)")
        conn.execute("update mapping set model_id_new = company_model_id where company_model_id is not null")
        conn.execute("alter table mapping drop column company_model_id")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("alter table mapping drop column model_id")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("alter table mapping rename column model_id_new to model_id")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("drop table company_models")
    except sqlite3.OperationalError:
        pass


def _ensure_users_columns(conn: sqlite3.Connection) -> None:
    """Ensure users table has full schema for login/register (id, email, password_hash, name, company_id, created_at)."""
    cur = conn.execute("select name from sqlite_master where type='table' and name='users'")
    if not cur.fetchone():
        return  # table doesn't exist yet (will be created by _init_sqlite)
    for col, typ in [
        ("id", "text"),
        ("email", "text"),
        ("password_hash", "text"),
        ("company_id", "text"),
        ("created_at", "text"),
        ("is_admin", "integer default 0"),
    ]:
        try:
            conn.execute(f"alter table users add column {col} {typ}")
        except sqlite3.OperationalError:
            pass  # column already exists
    try:
        conn.execute("create unique index if not exists idx_users_email_unique on users(email)")
    except sqlite3.OperationalError:
        pass


def _ensure_sqlite_uploads_columns(conn: sqlite3.Connection) -> None:
    """Add new columns to uploads if missing (for existing SQLite DBs)."""
    for col, typ in [
        ("mapping_config_id", "text"),
        ("region_id", "text"),
        ("country_id", "text"),
        ("model_id", "text"),
        ("company_id", "text"),
        ("report_year", "integer"),
        ("report_month", "integer"),
    ]:
        try:
            conn.execute(f"alter table uploads add column {col} {typ}")
        except sqlite3.OperationalError:
            pass  # column already exists

    # Seed regions/countries/models/companies if empty
    cur = conn.execute("select count(*) from regions")
    if cur.fetchone()[0] == 0:
        conn.executemany(
            "insert or ignore into regions (id, name) values (?, ?)",
            [
                ("r-APAC", "APAC"),
                ("r-EMEA", "EMEA"),
                ("r-Americas", "Americas"),
                ("r-GCC", "GCC"),
            ],
        )
        conn.executemany(
            "insert or ignore into countries (id, region_id, name) values (?, ?, ?)",
            [
                ("c-PK", "r-APAC", "Pakistan"),
                ("c-IN", "r-APAC", "India"),
                ("c-UK", "r-EMEA", "UK"),
                ("c-SA", "r-GCC", "Saudi Arabia"),
                ("c-AE", "r-GCC", "United Arab Emirates"),
                ("c-QA", "r-GCC", "Qatar"),
                ("c-KW", "r-GCC", "Kuwait"),
                ("c-BH", "r-GCC", "Bahrain"),
                ("c-OM", "r-GCC", "Oman"),
            ],
        )
        conn.executemany(
            "insert or ignore into application_models (id, country_id, name) values (?, ?, ?)",
            [
                ("m-SCR-PK", "c-PK", "SCR"),
                ("m-OSRA-PK", "c-PK", "OSRA"),
                ("m-SCR-IN", "c-IN", "SCR"),
            ],
        )
        conn.executemany(
            "insert or ignore into companies (id, name, region_id, country_id) values (?, ?, ?, ?)",
            [
                ("co-SIR", "SIR Consultants", "r-APAC", "c-PK"),
                ("co-Demo", "Demo Company", "r-APAC", "c-PK"),
            ],
        )
        # Seed default user: admin@sir.com / password123 (pre-computed bcrypt hash)
        from datetime import datetime, timezone
        admin_hash = "$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa"
        conn.execute(
            "insert or ignore into users (id, email, password_hash, name, company_id, created_at) values (?, ?, ?, ?, ?, ?)",
            ("u-admin", "admin@sir.com", admin_hash, "Admin User", "co-SIR", datetime.now(timezone.utc).isoformat()),
        )

    # Ensure admin user exists and has correct hash (idempotent)
    admin_hash = "$2b$12$qwBrFToCIo7RYw/zwhvXoOPhw9YFra.WU5AAqGtk3MiEwuTIidGaa"
    from datetime import datetime, timezone
    conn.execute(
        "insert or ignore into users (id, email, password_hash, name, company_id, created_at) "
        "select 'u-admin', 'admin@sir.com', ?, 'Admin User', id, ? from companies where id = 'co-SIR' limit 1",
        (admin_hash, datetime.now(timezone.utc).isoformat()),
    )
    # If co-SIR doesn't exist, try first company
    cur = conn.execute("select count(*) from users where lower(email) = 'admin@sir.com'")
    if cur.fetchone()[0] == 0:
        conn.execute(
            "insert or ignore into users (id, email, password_hash, name, company_id, created_at) "
            "select 'u-admin', 'admin@sir.com', ?, 'Admin User', id, ? from companies limit 1",
            (admin_hash, datetime.now(timezone.utc).isoformat()),
        )
    conn.execute(
        "update users set password_hash = ? where lower(email) = 'admin@sir.com'",
        (admin_hash,),
    )
    try:
        conn.execute("update users set is_admin = 1 where lower(email) = 'admin@sir.com'")
    except sqlite3.OperationalError:
        pass

    # Add country_id to companies if missing (for existing SQLite DBs)
    try:
        conn.execute("alter table companies add column country_id text references countries(id)")
    except sqlite3.OperationalError:
        pass  # column already exists
    # Backfill country_id for companies that have region but no country
    conn.execute(
        """
        update companies set country_id = (
          select id from countries where countries.region_id = companies.region_id limit 1
        ) where country_id is null
        """
    )

    # Add GCC region and countries if not present (idempotent)
    cur = conn.execute("select id from regions where name = 'GCC'")
    if cur.fetchone() is None:
        conn.execute("insert or ignore into regions (id, name) values ('r-GCC', 'GCC')")
        for cid, name in [
            ("c-SA", "Saudi Arabia"),
            ("c-AE", "United Arab Emirates"),
            ("c-QA", "Qatar"),
            ("c-KW", "Kuwait"),
            ("c-BH", "Bahrain"),
            ("c-OM", "Oman"),
        ]:
            conn.execute(
                "insert or ignore into countries (id, region_id, name) values (?, 'r-GCC', ?)",
                (cid, name),
            )
    conn.commit()


def _init_sqlite(conn: sqlite3.Connection) -> None:
    """
    Minimal local-dev schema so the app can run without Supabase/Postgres.
    Mirrors supabase migrations with SQLite-friendly types.
    """
    conn.execute("PRAGMA foreign_keys = ON;")

    # Region-Country-Model master tables (must exist before uploads references them)
    conn.execute(
        "create table if not exists regions (id text primary key, name text not null unique)"
    )
    conn.execute(
        """
        create table if not exists countries (
          id text primary key,
          region_id text not null references regions(id),
          name text not null,
          unique(region_id, name)
        )
        """
    )
    conn.execute(
        """
        create table if not exists application_models (
          id text primary key,
          country_id text not null references countries(id),
          name text not null,
          unique(country_id, name)
        )
        """
    )
    conn.execute(
        """
        create table if not exists companies (
          id text primary key,
          name text not null,
          region_id text not null references regions(id),
          country_id text references countries(id),
          unique(name, region_id)
        )
        """
    )

    conn.execute(
        """
        create table if not exists users (
          id text primary key,
          email text not null unique,
          password_hash text not null,
          name text not null,
          company_id text not null references companies(id),
          created_at text not null,
          is_admin integer not null default 0
        )
        """
    )

    conn.execute(
        """
        create table if not exists models (
          id text primary key,
          company_id text not null references companies(id) on delete cascade,
          created_by_user_id text references users(id) on delete set null,
          name text not null,
          created_at text not null default (datetime('now')),
          unique(company_id, name)
        )
        """
    )

    conn.execute(
        """
        create table if not exists uploads (
          id text primary key,
          report_key text not null,
          version_no integer not null,
          original_filename text not null,
          uploaded_at text not null,
          notes text,
          mapping_config_id text,
          region_id text,
          country_id text,
          model_id text,
          company_id text,
          report_year integer,
          report_month integer,
          constraint uploads_report_key_version_unique unique (report_key, version_no)
        )
        """
    )
    _ensure_sqlite_uploads_columns(conn)

    conn.execute(
        """
        create table if not exists report_region_applicability (
          id text primary key,
          upload_id text not null references uploads(id) on delete cascade,
          region_id text not null references regions(id),
          unique(upload_id, region_id)
        )
        """
    )
    conn.execute(
        """
        create table if not exists report_nodes (
          id text primary key,
          upload_id text not null references uploads(id) on delete cascade,
          code text not null,
          level integer not null,
          parent_code text,
          description text,
          value numeric,
          sheet_name text not null,
          cell_ref text not null,
          created_at text not null
        )
        """
    )
    conn.execute("create index if not exists idx_report_nodes_upload_id on report_nodes(upload_id)")
    conn.execute("create index if not exists idx_report_nodes_upload_code on report_nodes(upload_id, code)")
    conn.execute(
        "create index if not exists idx_report_nodes_upload_parent_code on report_nodes(upload_id, parent_code)"
    )
    conn.execute(
        """
        create table if not exists mapping (
          id text primary key,
          config_id text not null,
          model_id text references models(id),
          name text not null,
          version integer not null default 1,
          is_active integer not null default 0,
          uploaded_at text not null,
          notes text,
          code text not null,
          description text,
          sheet_name text not null,
          cell_ref text not null,
          level integer not null,
          parent_code text
        )
        """
    )
    conn.execute("create index if not exists idx_mapping_config_id on mapping(config_id)")
    conn.execute("create index if not exists idx_mapping_model_id on mapping(model_id)")
    _ensure_users_columns(conn)
    _ensure_models_migration(conn)
    conn.commit()


def _sqlite_path_from_url(database_url: str) -> Path:
    # Supported forms:
    # - sqlite:///./osra.db
    # - sqlite:////absolute/path/to/osra.db
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError("Unsupported sqlite url format")
    raw = database_url[len(prefix) :]
    # If raw starts with "/", it's already absolute-like (on Windows could be "C:/...").
    if raw.startswith("/") or (len(raw) >= 3 and raw[1:3] == ":/"):
        return Path(raw)
    # Relative path -> resolve relative to backend folder
    backend_dir = Path(__file__).resolve().parents[1]
    return (backend_dir / raw).resolve()


def _get_sqlite_conn(db_path: Path | None = None) -> sqlite3.Connection:
    """Get SQLite connection (used directly or as fallback)."""
    global _sqlite_initialized
    if db_path is None:
        backend_dir = Path(__file__).resolve().parents[1]
        db_path = (backend_dir / "osra.db").resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row  # type: ignore[attr-defined]
    if not _sqlite_initialized:
        _init_sqlite(conn)
        _sqlite_initialized = True
    return conn


def get_db() -> Generator[Any, None, None]:
    """
    FastAPI dependency that yields a short-lived DB connection.

    Uses SQLite if DATABASE_URL is sqlite:///. Otherwise tries Postgres;
    if Postgres fails (timeout, DNS, firewall), falls back to SQLite automatically.
    """
    global _sqlite_initialized

    if settings.database_url.startswith("sqlite:///"):
        conn = _get_sqlite_conn(_sqlite_path_from_url(settings.database_url))
        try:
            yield conn
        finally:
            conn.close()
        return

    # Try Postgres first; fall back to SQLite on connection failure only
    conn = None
    try:
        conn = psycopg.connect(
            settings.database_url,
            row_factory=dict_row,  # type: ignore[arg-type]
            connect_timeout=5,
            prepare_threshold=None,  # Required for Supabase transaction-mode pooler
        )
    except Exception as e:
        import logging

        logging.warning(
            "Postgres connection failed (%s), falling back to SQLite (backend/osra.db)",
            str(e)[:80],
        )
        conn = _get_sqlite_conn()

    try:
        yield conn
    finally:
        conn.close()

