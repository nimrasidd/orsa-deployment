from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from ..db import get_db
from ..schemas import ApplicationModelOut

router = APIRouter(prefix="/countries", tags=["countries"])


def _list_models_by_country(conn: Any, country_id: str) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select id, country_id, name from application_models where country_id = ? order by name",
            (country_id,),
        )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            "select id, country_id, name from public.application_models where country_id = %(country_id)s order by name",
            {"country_id": country_id},
        )
        return list(cur.fetchall())


@router.get("/{country_id}/models", response_model=list[ApplicationModelOut])
def list_models(country_id: str, db: Annotated[Any, Depends(get_db)]):
    """List application models in a country."""
    return _list_models_by_country(db, country_id)
