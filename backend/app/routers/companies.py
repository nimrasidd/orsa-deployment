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
            """
            select c.id, c.name, c.region_id, c.country_id,
                   r.name as region_name, co.name as country_name
            from companies c
            left join regions r on r.id = c.region_id
            left join countries co on co.id = c.country_id
            where c.id = ?
            """,
            (company_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    with conn.cursor() as cur:
        cur.execute(
            """
            select c.id::text as id, c.name, c.region_id::text as region_id,
                   c.country_id::text as country_id,
                   r.name as region_name, co.name as country_name
            from public.companies c
            left join public.regions r on r.id = c.region_id
            left join public.countries co on co.id = c.country_id
            where c.id = %(id)s::uuid
            """,
            {"id": company_id},
        )
        row = cur.fetchone()
        return dict(row) if row else None


def _list_companies(conn: Any, region_id: str | None = None) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        if region_id:
            cur = conn.execute(
                """
                select c.id, c.name, c.region_id, c.country_id,
                       r.name as region_name, co.name as country_name
                from companies c
                left join regions r on r.id = c.region_id
                left join countries co on co.id = c.country_id
                where c.region_id = ?
                order by c.name
                """,
                (region_id,),
            )
        else:
            cur = conn.execute(
                """
                select c.id, c.name, c.region_id, c.country_id,
                       r.name as region_name, co.name as country_name
                from companies c
                left join regions r on r.id = c.region_id
                left join countries co on co.id = c.country_id
                order by c.name
                """
            )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        if region_id:
            cur.execute(
                """
                select c.id::text as id, c.name, c.region_id::text as region_id,
                       c.country_id::text as country_id,
                       r.name as region_name, co.name as country_name
                from public.companies c
                left join public.regions r on r.id = c.region_id
                left join public.countries co on co.id = c.country_id
                where c.region_id = %(region_id)s::uuid
                order by c.name
                """,
                {"region_id": region_id},
            )
        else:
            cur.execute(
                """
                select c.id::text as id, c.name, c.region_id::text as region_id,
                       c.country_id::text as country_id,
                       r.name as region_name, co.name as country_name
                from public.companies c
                left join public.regions r on r.id = c.region_id
                left join public.countries co on co.id = c.country_id
                order by c.name
                """
            )
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
        if not user.company_id:
            return []
        row = _get_company_by_id(db, user.company_id)
        return [CompanyOut(**dict(row))] if row else []
    return [CompanyOut(**r) for r in _list_companies(db, rid)]


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

    # SQLite uses string IDs like "co-xxxx"; Postgres uses UUID primary keys.
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
            """
            select c.id, c.name, c.region_id, c.country_id,
                   r.name as region_name, co.name as country_name
            from companies c
            left join regions r on r.id = c.region_id
            left join countries co on co.id = c.country_id
            where c.id = ?
            """,
            (company_id,),
        )
        row = cur.fetchone()
        return CompanyOut(**dict(row))

    # Postgres path
    company_uuid = str(uuid4())
    try:
        with db.cursor() as cur:
            cur.execute(
                """
                insert into public.companies (id, name, region_id, country_id)
                values (%(id)s::uuid, %(name)s, %(region_id)s::uuid, %(country_id)s::uuid)
                """,
                {
                    "id": company_uuid,
                    "name": name,
                    "region_id": body.region_id,
                    "country_id": body.country_id,
                },
            )
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        msg = str(e).lower()
        if "unique" in msg or "duplicate" in msg:
            raise HTTPException(status_code=400, detail="A company with this name already exists in this region") from e
        raise HTTPException(status_code=400, detail=f"Could not create company: {e}") from e

    row = _get_company_by_id(db, company_uuid)
    if not row:
        raise HTTPException(status_code=500, detail="Company created but not found")
    return CompanyOut(**dict(row))


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
):
    """Delete a company (admin only). Fails if any users are assigned to it."""
    import sqlite3

    if isinstance(db, sqlite3.Connection):
        cur = db.execute("select count(*) as n from users where company_id = ?", (company_id,))
        n = int(dict(cur.fetchone())["n"])  # type: ignore[index]
        if n > 0:
            raise HTTPException(status_code=400, detail="Cannot delete: users are still assigned to this company")
        cur = db.execute("delete from companies where id = ?", (company_id,))
        db.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Company not found")
        return {"ok": True}

    # For psycopg3, be explicit about commit/rollback to ensure the delete persists.
    try:
        with db.cursor() as cur:
            cur.execute(
                "select count(*) as n from public.users where company_id = %(cid)s::uuid",
                {"cid": company_id},
            )
            row = cur.fetchone()
            n = int(row["n"]) if row and "n" in row else 0
            if n > 0:
                raise HTTPException(status_code=400, detail="Cannot delete: users are still assigned to this company")

            cur.execute(
                "delete from public.companies where id = %(cid)s::uuid",
                {"cid": company_id},
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Company not found")
        db.commit()
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Could not delete company: {e}") from e
    return {"ok": True}
