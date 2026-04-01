"""Mapping models (global) + company_model M2M: any company can use any model."""
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
    name: str
    company_id: str | None = None
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
    company_id: str | None = None


def _row_to_out(row: dict) -> CompanyModelOut:
    return CompanyModelOut(
        id=str(row["id"]),
        name=row["name"],
        company_id=None,
        company_name=None,
        created_by_user_id=str(row["created_by_user_id"]) if row.get("created_by_user_id") else None,
        created_at=str(row["created_at"]) if row.get("created_at") is not None else None,
        created_by_name=row.get("created_by_name"),
        created_by_email=row.get("created_by_email"),
    )


def _list_models_for_company(conn: Any, company_id: str) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select m.id, m.name, m.created_by_user_id, m.created_at,
                   u.name as created_by_name, u.email as created_by_email
            from models m
            inner join company_model cm on cm.model_id = m.id and cm.company_id = ?
            left join users u on u.id = m.created_by_user_id
            order by (m.created_at is null), m.created_at desc, m.name
            """,
            (company_id,),
        )
        return [dict(zip(r.keys(), r)) for r in cur.fetchall()]
    with conn.cursor() as cur:
        cur.execute(
            """
            select m.id, m.name, m.created_by_user_id, m.created_at,
                   u.name as created_by_name, u.email as created_by_email
            from public.models m
            inner join public.company_model cm on cm.model_id = m.id and cm.company_id = %(cid)s::uuid
            left join public.users u on u.id = m.created_by_user_id
            order by (m.created_at is null), m.created_at desc, m.name
            """,
            {"cid": company_id},
        )
        return list(cur.fetchall())


def _list_all_models(conn: Any) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select m.id, m.name, m.created_by_user_id, m.created_at,
                   u.name as created_by_name, u.email as created_by_email
            from models m
            left join users u on u.id = m.created_by_user_id
            order by m.name, (m.created_at is null), m.created_at desc
            """
        )
        return [dict(zip(r.keys(), r)) for r in cur.fetchall()]
    with conn.cursor() as cur:
        cur.execute(
            """
            select m.id, m.name, m.created_by_user_id, m.created_at,
                   u.name as created_by_name, u.email as created_by_email
            from public.models m
            left join public.users u on u.id = m.created_by_user_id
            order by m.name, (m.created_at is null), m.created_at desc
            """
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


def _link_model_to_all_companies(conn: Any, model_id: str) -> None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        conn.execute(
            """
            insert or ignore into company_model (company_id, model_id)
            select id, ? from companies
            """,
            (model_id,),
        )
        return
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.company_model (company_id, model_id)
                select id, %(mid)s from public.companies
                on conflict do nothing
                """,
                {"mid": model_id},
            )


@router.get("", response_model=list[CompanyModelOut])
def list_company_models(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Annotated[Any, Depends(get_db)],
    company_id: Annotated[
        str | None,
        Query(description="When set, list models linked to this company. Admins may omit to list all models."),
    ] = None,
):
    q = (company_id or "").strip()
    if user.is_admin and not q:
        return [_row_to_out(dict(r)) for r in _list_all_models(db)]
    if user.is_admin:
        cid = q
    else:
        cid = user.company_id or ""
        if not cid:
            raise HTTPException(status_code=403, detail="No company assigned to this account")
        if q and q != cid:
            raise HTTPException(status_code=403, detail="Not allowed to view this company's models")
    if not cid:
        raise HTTPException(status_code=400, detail="company_id is required")
    if not _company_exists(db, cid):
        raise HTTPException(status_code=404, detail="Company not found")
    return [_row_to_out(dict(r)) for r in _list_models_for_company(db, cid)]


@router.post("", response_model=CompanyModelOut)
def create_company_model(
    user: Annotated[UserOut, Depends(get_current_user)],
    db: Annotated[Any, Depends(get_db)],
    body: CreateCompanyModelIn,
):
    import sqlite3
    from datetime import datetime, timezone
    from uuid import uuid4

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Model name is required")

    if not user.is_admin:
        cid = user.company_id or ""
        if not cid:
            raise HTTPException(status_code=403, detail="No company assigned to this account")
        q = (body.company_id or "").strip()
        if q and q != cid:
            raise HTTPException(status_code=403, detail="Cannot create models for another company")

    created_by = user.id

    model_id = str(uuid4())
    if isinstance(db, sqlite3.Connection):
        now = datetime.now(timezone.utc).isoformat()
        db.execute(
            "insert into models (id, created_by_user_id, name, created_at) values (:id, :created_by, :name, :created_at)",
            {"id": model_id, "created_by": created_by, "name": name, "created_at": now},
        )
        _link_model_to_all_companies(db, model_id)
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute(
                    """
                    insert into public.models (id, created_by_user_id, name)
                    values (%(id)s, %(created_by)s, %(name)s)
                    """,
                    {"id": model_id, "created_by": created_by, "name": name},
                )
        _link_model_to_all_companies(db, model_id)

    if isinstance(db, sqlite3.Connection):
        cur = db.execute(
            """
            select m.id, m.name, m.created_by_user_id, m.created_at,
                   u.name as created_by_name, u.email as created_by_email
            from models m
            left join users u on u.id = m.created_by_user_id
            where m.id = ?
            """,
            (model_id,),
        )
        row = cur.fetchone()
        r = dict(zip(row.keys(), row)) if row else None
    else:
        with db.cursor() as cur:
            cur.execute(
                """
                select m.id, m.name, m.created_by_user_id, m.created_at,
                       u.name as created_by_name, u.email as created_by_email
                from public.models m
                left join public.users u on u.id = m.created_by_user_id
                where m.id = %(id)s
                """,
                {"id": model_id},
            )
            r = cur.fetchone()
    if not r:
        raise HTTPException(status_code=500, detail="Model created but not found")
    return _row_to_out(dict(r))
