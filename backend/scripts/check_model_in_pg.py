from __future__ import annotations

import os

import psycopg


def main() -> int:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        print("ERROR: DATABASE_URL env var is required.")
        return 2

    model_id = os.environ.get("MODEL_ID", "").strip()
    model_name = os.environ.get("MODEL_NAME", "").strip()

    conn = psycopg.connect(db_url, connect_timeout=10, prepare_threshold=None)
    try:
        with conn.cursor() as cur:
            cur.execute("select count(*) from public.application_models")
            total = cur.fetchone()[0]
            print("application_models_total=", total)

            if model_id:
                cur.execute(
                    "select id::text, country_id::text, name from public.application_models where id = %(id)s::uuid",
                    {"id": model_id},
                )
                row = cur.fetchone()
                print("model_row=", row)

            if model_name:
                cur.execute(
                    "select count(*) from public.application_models where name = %(name)s",
                    {"name": model_name},
                )
                print("name_match_count=", cur.fetchone()[0])
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

