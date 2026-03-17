"""Run Supabase migrations against the configured DATABASE_URL."""
from __future__ import annotations

import sys
from pathlib import Path

# Add backend to path
backend = Path(__file__).resolve().parent
sys.path.insert(0, str(backend))

from app.config import settings
import psycopg

def main() -> None:
    if settings.database_url.startswith("sqlite:///"):
        print("Migration script is for PostgreSQL only. SQLite uses in-app init.")
        sys.exit(1)

    migrations_dir = Path(__file__).resolve().parents[1] / "supabase" / "migrations"
    migrations = ["000_full_schema.sql", "001_region_country_model.sql"]

    with psycopg.connect(settings.database_url) as conn:
        for name in migrations:
            path = migrations_dir / name
            if not path.exists():
                print(f"Skip {name} (not found)")
                continue
            sql = path.read_text(encoding="utf-8")
            # Strip comments and split on semicolon; execute each non-empty statement
            statements = []
            for s in sql.split(";"):
                s = s.strip()
                # Skip comment-only lines at start of statement
                lines = [line for line in s.split("\n") if not line.strip().startswith("--")]
                stmt = "\n".join(lines).strip()
                if stmt:
                    statements.append(stmt)
            print(f"Running {name}...")
            with conn.cursor() as cur:
                for stmt in statements:
                    cur.execute(stmt + ";")
            conn.commit()
            print(f"  OK")

    print("Migrations complete.")

if __name__ == "__main__":
    main()
