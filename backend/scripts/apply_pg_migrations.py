from __future__ import annotations

from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = ROOT / "supabase" / "migrations"


def _split_sql(sql: str) -> list[str]:
    """
    Very small SQL splitter for our migration files.
    Assumptions:
    - No function bodies containing semicolons in $$...$$ blocks
    - Statements end with ';'
    """
    out: list[str] = []
    buff: list[str] = []
    for line in sql.splitlines():
        s = line.strip()
        if s.startswith("--") or s == "":
            continue
        buff.append(line)
        if s.endswith(";"):
            out.append("\n".join(buff).strip().rstrip(";"))
            buff = []
    if buff:
        out.append("\n".join(buff).strip())
    return [stmt for stmt in out if stmt]


def apply_file(conn: psycopg.Connection, path: Path) -> None:
    sql = path.read_text(encoding="utf-8")
    stmts = _split_sql(sql)
    if not stmts:
        return
    with conn.cursor() as cur:
        for stmt in stmts:
            cur.execute(stmt)
    conn.commit()


def main() -> int:
    import os

    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        print("ERROR: DATABASE_URL env var is required.")
        return 2

    files = [
        "20260216_init.sql",
        "001_region_country_model.sql",
        "002_add_gcc_region_countries.sql",
        "003_seed_all_master_data.sql",
        "004_companies_country_id.sql",
        "006_add_users.sql",
        "008_fix_users_schema.sql",
        "012_users_is_admin.sql",
        "013_users_admin_no_company.sql",
    ]

    missing = [f for f in files if not (MIGRATIONS_DIR / f).exists()]
    if missing:
        print("ERROR: missing migration files:", missing)
        return 3

    conn = psycopg.connect(db_url, connect_timeout=10, prepare_threshold=None)
    try:
        for f in files:
            p = MIGRATIONS_DIR / f
            print(f"Applying {p.name} ...")
            apply_file(conn, p)
        print("Done.")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

