"""Models - parent table: company + creator + name. Mapping references this for model-based mapping."""
from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator

from ..db import get_db
from .auth import get_current_user, UserOut

router = APIRouter(prefix="/company-models", tags=["company-models"])


class CompanyModelOut(BaseModel):
    id: str
    company_id: str
    name: str
    company_name: str | None = None
    created_by_user_id: str | None = None
    created_at: str | None = None
    created_by_name: str | None = None
    created_by_email: str | None = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _coerce_created_at(cls, v: Any) -> str | None:
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v) if v != "" else None


class CreateCompanyModelIn(BaseModel):
    name: str


def _list_company_models(conn: Any, company_id: str) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select m.id, m.company_id, m.name, c.name as company_name, m.created_by_user_id,
                   m.created_at, u.name as created_by_name, u.email as created_by_email
            from models m
            join companies c on c.id = m.company_id
            left join users u on u.id = m.created_by_user_id
            where m.company_id = ?
            order by (m.created_at is null), m.created_at desc, m.name
            """,
            (company_id,),
        )
        return [dict(zip(r.keys(), r)) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            """
            select m.id, m.company_id, m.name, c.name as company_name, m.created_by_user_id,
                   m.created_at, u.name as created_by_name, u.email as created_by_email
            from public.models m
            join public.companies c on c.id = m.company_id
            left join public.users u on u.id = m.created_by_user_id
            where m.company_id = %(company_id)s
            order by (m.created_at is null), m.created_at desc, m.name
            """,
            {"company_id": company_id},
        )
        return list(cur.fetchall())


def _company_exists(conn: Any, company_id: str) -> bool:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute("select 1 from companies where id = ? limit 1", (company_id,))
        return cur.fetchone() is not None
    with conn.cursor() as cur:
        cur.execute("select 1 from public.companies where id = %(id)s limit 1", {"id": company_id})
        return cur.fetchone() is not None


@router.get("", response_model=list[CompanyModelOut])
def list_company_models(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Annotated[Any, Depends(get_db)],
    company_id: Annotated[
        str | None,
        Query(description="List models for this company. Defaults to your company when omitted."),
    ] = None,
):
    """List mapping models (`models` table) for a company — same IDs stored on uploads."""
    cid = (company_id or "").strip() or user.company_id
    if not cid:
        raise HTTPException(status_code=400, detail="No company context")
    if not user.is_admin and cid != user.company_id:
        raise HTTPException(status_code=403, detail="Not allowed to view this company's models")
    if not _company_exists(db, cid):
        raise HTTPException(status_code=404, detail="Company not found")
    return _list_company_models(db, cid)


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
