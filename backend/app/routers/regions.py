from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from ..db import get_db
from ..schemas import CountryOut, RegionOut

router = APIRouter(prefix="/regions", tags=["regions"])


def _list_regions(conn: Any) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute("select id, name from regions order by name")
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            "select id, name from public.regions order by name"
        )
        return list(cur.fetchall())


def _list_countries_by_region(conn: Any, region_id: str) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select id, region_id, name from countries where region_id = ? order by name",
            (region_id,),
        )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            "select id, region_id, name from public.countries where region_id = %(region_id)s order by name",
            {"region_id": region_id},
        )
        return list(cur.fetchall())


@router.get("", response_model=list[RegionOut])
def list_regions(db: Annotated[Any, Depends(get_db)]):
    """List all regions."""
    return _list_regions(db)


@router.get("/{region_id}/countries", response_model=list[CountryOut])
def list_countries(region_id: str, db: Annotated[Any, Depends(get_db)]):
    """List countries in a region."""
    rows = _list_countries_by_region(db, region_id)
    return rows
