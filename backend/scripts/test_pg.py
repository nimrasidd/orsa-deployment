from __future__ import annotations

from pathlib import Path
import sys

import psycopg

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402


def main() -> int:
    url = settings.database_url
    print(f"Settings.database_url = {url}")

    if url.startswith("sqlite:///"):
        print("ERROR: Settings is still configured for SQLite, not Postgres.")
        return 2

    try:
        conn = psycopg.connect(url, connect_timeout=5, prepare_threshold=None)
    except Exception as e:
        print(f"ERROR: Postgres connection failed: {type(e).__name__}: {e}")
        return 1

    try:
        with conn.cursor() as cur:
            cur.execute("select current_database(), current_user")
            row = cur.fetchone()
            print(f"Connected OK: db={row[0]} user={row[1]}")
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

