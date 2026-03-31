from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..db import get_db
from ..schemas import CompanyOut
from .auth import UserOut, get_current_user, get_current_user_optional, require_admin

router = APIRouter(prefix="/companies", tags=["companies"])


class CreateCompanyIn(BaseModel):
    name: str
    region_id: str
    country_id: str | None = None


def _get_company_by_id(conn: Any, company_id: str) -> dict | None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select id, name, region_id, country_id from companies where id = ?",
            (company_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    with conn.cursor() as cur:
        cur.execute(
            "select id, name, region_id, country_id from public.companies where id = %(id)s",
            {"id": company_id},
        )
        row = cur.fetchone()
        return dict(row) if row else None


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


def _ensure_region_exists(conn: Any, region_id: str) -> None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute("select id from regions where id = ?", (region_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Region not found")
        return
    with conn.cursor() as cur:
        cur.execute("select id from public.regions where id = %(id)s", {"id": region_id})
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Region not found")


def _ensure_country_in_region(conn: Any, country_id: str, region_id: str) -> None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select id from countries where id = ? and region_id = ?",
            (country_id, region_id),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Country not found for this region")
        return
    with conn.cursor() as cur:
        cur.execute(
            "select id from public.countries where id = %(cid)s and region_id = %(rid)s",
            {"cid": country_id, "rid": region_id},
        )
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Country not found for this region")


@router.get("", response_model=list[CompanyOut])
def list_companies(
    db: Annotated[Any, Depends(get_db)],
    user: Annotated[UserOut | None, Depends(get_current_user_optional)],
    region_id: Annotated[str | None, Query()] = None,
):
    """
    List companies, optionally filtered by region.
    Unauthenticated (e.g. registration): all companies in region.
    Authenticated non-admin: only their company.
    Admin: all companies.
    """
    rid = region_id
    if user and not user.is_admin:
        row = _get_company_by_id(db, user.company_id)
        return [CompanyOut(**dict(row))] if row else []
    return _list_companies(db, rid)


@router.post("", response_model=CompanyOut)
def create_company(
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
    body: CreateCompanyIn,
):
    """Register a new company (admin only)."""
    import sqlite3
    from uuid import uuid4

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Company name is required")
    _ensure_region_exists(db, body.region_id)
    if body.country_id:
        _ensure_country_in_region(db, body.country_id, body.region_id)

    company_id = f"co-{uuid4().hex[:12]}"

    if isinstance(db, sqlite3.Connection):
        try:
            db.execute(
                "insert into companies (id, name, region_id, country_id) values (?, ?, ?, ?)",
                (company_id, name, body.region_id, body.country_id),
            )
            db.commit()
        except Exception as e:
            db.rollback()
            if "unique" in str(e).lower():
                raise HTTPException(status_code=400, detail="A company with this name already exists in this region") from e
            raise HTTPException(status_code=400, detail=f"Could not create company: {e}") from e
        cur = db.execute(
            "select id, name, region_id, country_id from companies where id = ?",
            (company_id,),
        )
        row = cur.fetchone()
        return CompanyOut(**dict(row))
    with db.transaction():
        with db.cursor() as cur:
            try:
                cur.execute(
                    """
                    insert into public.companies (id, name, region_id, country_id)
                    values (%(id)s, %(name)s, %(region_id)s, %(country_id)s)
                    """,
                    {
                        "id": company_id,
                        "name": name,
                        "region_id": body.region_id,
                        "country_id": body.country_id,
                    },
                )
            except Exception as e:
                msg = str(e).lower()
                if "unique" in msg or "duplicate" in msg:
                    raise HTTPException(status_code=400, detail="A company with this name already exists in this region") from e
                raise HTTPException(status_code=400, detail=f"Could not create company: {e}") from e
    with db.cursor() as cur:
        cur.execute(
            "select id, name, region_id, country_id from public.companies where id = %(id)s",
            {"id": company_id},
        )
        row = cur.fetchone()
        return CompanyOut(**dict(row))
