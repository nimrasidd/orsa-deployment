"""Models - parent table: company + creator + name. Mapping references this for model-based mapping."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_db
from .auth import get_current_user, UserOut

router = APIRouter(prefix="/company-models", tags=["company-models"])


class CompanyModelOut(BaseModel):
    id: str
    company_id: str
    name: str
    company_name: str | None = None
    created_by_user_id: str | None = None


class CreateCompanyModelIn(BaseModel):
    name: str


def _list_company_models(conn: Any, company_id: str) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select m.id, m.company_id, m.name, c.name as company_name, m.created_by_user_id
            from models m
            join companies c on c.id = m.company_id
            where m.company_id = ?
            order by m.name
            """,
            (company_id,),
        )
        return [dict(zip(r.keys(), r)) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            """
            select m.id, m.company_id, m.name, c.name as company_name, m.created_by_user_id
            from public.models m
            join public.companies c on c.id = m.company_id
            where m.company_id = %(company_id)s
            order by m.name
            """,
            {"company_id": company_id},
        )
        return list(cur.fetchall())


@router.get("", response_model=list[CompanyModelOut])
def list_company_models(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Annotated[Any, Depends(get_db)],
):
    """List company models for the logged-in user's company."""
    return _list_company_models(db, user.company_id)


@router.post("", response_model=CompanyModelOut)
def create_company_model(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Annotated[Any, Depends(get_db)],
    body: CreateCompanyModelIn,
):
    """Create a company model (name only, scoped to user's company)."""
    import sqlite3
    from uuid import uuid4

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name is required")

    company_id = user.company_id

    created_by = user.id

    if isinstance(db, sqlite3.Connection):
        cur = db.execute(
            "select id from models where company_id = :cid and name = :name",
            {"cid": company_id, "name": name},
        )
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Model with this name already exists for your company")
        model_id = str(uuid4())
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "insert into models (id, company_id, created_by_user_id, name, created_at) values (:id, :company_id, :created_by, :name, :created_at)",
            {"id": model_id, "company_id": company_id, "created_by": created_by, "name": name, "created_at": now},
        )
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute(
                    "select id from public.models where company_id = %(cid)s and name = %(name)s",
                    {"cid": company_id, "name": name},
                )
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Model with this name already exists for your company")
                model_id = str(uuid4())
                cur.execute(
                    "insert into public.models (id, company_id, created_by_user_id, name) values (%(id)s, %(company_id)s, %(created_by)s, %(name)s)",
                    {"id": model_id, "company_id": company_id, "created_by": created_by, "name": name},
                )

    models = _list_company_models(db, company_id)
    for m in models:
        if str(m["id"]) == str(model_id):
            return CompanyModelOut(**m)
    raise HTTPException(status_code=500, detail="Model created but not found")
