"""List and create application models (for mappings and Model Comparison)."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_db
from .auth import UserOut, require_admin

router = APIRouter(prefix="/models", tags=["models"])


class CreateModelIn(BaseModel):
    country_id: str
    name: str


def _list_all_models(conn: Any) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select m.id, m.country_id, m.name, c.name as country_name, r.name as region_name
            from application_models m
            join countries c on c.id = m.country_id
            join regions r on r.id = c.region_id
            order by r.name, c.name, m.name
            """
        )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            """
            select m.id, m.country_id, m.name, c.name as country_name, r.name as region_name
            from public.application_models m
            join public.countries c on c.id = m.country_id
            join public.regions r on r.id = c.region_id
            order by r.name, c.name, m.name
            """
        )
        return list(cur.fetchall())


@router.get("")
def list_all_models(db: Annotated[Any, Depends(get_db)]):
    """List all application models with country and region info."""
    return _list_all_models(db)


@router.post("")
def create_model(
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
    body: CreateModelIn,
):
    """Create a new application model for a country (admin only)."""
    country_id = body.country_id
    name = body.name
    import sqlite3
    from uuid import uuid4

    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name is required")

    if isinstance(db, sqlite3.Connection):
        cur = db.execute(
            "select id from countries where id = :cid",
            {"cid": country_id},
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Country not found")
        cur = db.execute(
            "select id from application_models where country_id = :cid and name = :name",
            {"cid": country_id, "name": name},
        )
        if cur.fetchone():
            raise HTTPException(status_code=404, detail="Model with this name already exists for this country")
        model_id = str(uuid4())
        db.execute(
            "insert into application_models (id, country_id, name) values (:id, :country_id, :name)",
            {"id": model_id, "country_id": country_id, "name": name},
        )
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select id from public.countries where id = %(cid)s", {"cid": country_id})
                if not cur.fetchone():
                    raise HTTPException(status_code=404, detail="Country not found")
                cur.execute(
                    "select id from public.application_models where country_id = %(cid)s and name = %(name)s",
                    {"cid": country_id, "name": name},
                )
                if cur.fetchone():
                    raise HTTPException(status_code=404, detail="Model with this name already exists for this country")
                cur.execute(
                    "insert into public.application_models (country_id, name) values (%(country_id)s, %(name)s) returning id",
                    {"country_id": country_id, "name": name},
                )
                model_id = cur.fetchone()["id"]

    models = _list_all_models(db)
    for m in models:
        if str(m["id"]) == str(model_id):
            return m
    raise HTTPException(status_code=500, detail="Model created but not found")
