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
            cur.execute("select id::text from public.countries order by name limit 1")
            row = cur.fetchone()
            if not row:
                print("ERROR: no countries found")
                return 3
            country_id = row[0]

        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    "insert into public.application_models (country_id, name) values (%(cid)s::uuid, %(name)s) returning id::text",
                    {"cid": country_id, "name": "Test Model (TX)"},
                )
                new_id = cur.fetchone()[0]
                print("inserted_id=", new_id)

        with conn.cursor() as cur:
            cur.execute("select count(*) from public.application_models where id = %(id)s::uuid", {"id": new_id})
            print("row_exists_count=", cur.fetchone()[0])
    finally:
        conn.close()

    # Verify from a brand new connection too
    conn2 = psycopg.connect(db_url, connect_timeout=10, prepare_threshold=None)
    try:
        with conn2.cursor() as cur:
            cur.execute("select count(*) from public.application_models where id = %(id)s::uuid", {"id": new_id})
            print("row_exists_count_new_conn=", cur.fetchone()[0])
    finally:
        conn2.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

