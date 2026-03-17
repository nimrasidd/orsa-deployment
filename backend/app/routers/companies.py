from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from ..db import get_db
from ..schemas import CompanyOut

router = APIRouter(prefix="/companies", tags=["companies"])


def _list_companies(conn: Any, region_id: str | None = None) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        if region_id:
            cur = conn.execute(
                "select id, name, region_id, country_id from companies where region_id = ? order by name",
                (region_id,),
            )
        else:
            cur = conn.execute("select id, name, region_id, country_id from companies order by name")
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        if region_id:
            cur.execute(
                "select id, name, region_id, country_id from public.companies where region_id = %(region_id)s order by name",
                {"region_id": region_id},
            )
        else:
            cur.execute("select id, name, region_id, country_id from public.companies order by name")
        return list(cur.fetchall())


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Annotated[Any, Depends(get_db)],
    region_id: Annotated[str | None, Query()] = None,
):
    """List companies, optionally filtered by region."""
    rid = region_id
    return _list_companies(db, rid)
