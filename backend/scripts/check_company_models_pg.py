from __future__ import annotations

import os

import psycopg


def main() -> int:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        print("ERROR: DATABASE_URL env var is required.")
        return 2

    conn = psycopg.connect(db_url, connect_timeout=10, prepare_threshold=None)
    try:
        with conn.cursor() as cur:
            cur.execute("select count(*) from public.models")
            print("public.models total =", cur.fetchone()[0])
            cur.execute("select count(*) from public.company_model")
            print("public.company_model total =", cur.fetchone()[0])
            cur.execute("select id::text, name from public.models order by name limit 10")
            print("sample models =", cur.fetchall())
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

