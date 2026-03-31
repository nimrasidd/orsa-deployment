"""Authenticated directory: users list, create user, map user to company."""
from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..db import get_db
from .auth import RegisterIn, UserOut, require_admin, register_user_account

router = APIRouter(prefix="/settings", tags=["settings"])


class UserListOut(BaseModel):
    id: str
    email: str
    name: str
    company_id: str
    company_name: str | None = None
    created_at: str | None = None


class UpdateUserCompanyIn(BaseModel):
    company_id: str


def _list_users(conn: Any) -> list[dict]:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name, u.created_at
            from users u
            left join companies c on c.id = u.company_id
            order by lower(u.email)
            """
        )
        return [dict(r) for r in cur.fetchall()]

    with conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name, u.created_at
            from public.users u
            left join public.companies c on c.id = u.company_id
            order by lower(u.email)
            """
        )
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def _get_user_row(conn: Any, user_id: str) -> dict | None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name, u.created_at
            from users u
            left join companies c on c.id = u.company_id
            where u.id = ?
            """,
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None
    with conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name, u.created_at
            from public.users u
            left join public.companies c on c.id = u.company_id
            where u.id = %(id)s
            """,
            {"id": user_id},
        )
        row = cur.fetchone()
        return dict(row) if row else None


@router.get("/users", response_model=list[UserListOut])
def list_users(
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
):
    rows = _list_users(db)
    return [
        UserListOut(
            id=str(r["id"]),
            email=r["email"],
            name=r["name"],
            company_id=str(r["company_id"]),
            company_name=r.get("company_name"),
            created_at=str(r["created_at"]) if r.get("created_at") is not None else None,
        )
        for r in rows
    ]


@router.post("/users", response_model=UserOut)
def create_user(
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
    body: RegisterIn,
):
    """Create a user and assign to a company (same rules as public register)."""
    return register_user_account(db, body)


@router.patch("/users/{user_id}", response_model=UserListOut)
def update_user_company(
    user_id: str,
    db: Annotated[Any, Depends(get_db)],
    _: Annotated[UserOut, Depends(require_admin)],
    body: UpdateUserCompanyIn,
):
    """Map an existing user to a different company."""
    import sqlite3

    if not body.company_id:
        raise HTTPException(status_code=400, detail="company_id is required")

    row = _get_user_row(db, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    if isinstance(db, sqlite3.Connection):
        cur = db.execute("select id from companies where id = ?", (body.company_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Company not found")
        db.execute("update users set company_id = ? where id = ?", (body.company_id, user_id))
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select id from public.companies where id = %(cid)s", {"cid": body.company_id})
                if not cur.fetchone():
                    raise HTTPException(status_code=400, detail="Company not found")
                cur.execute(
                    "update public.users set company_id = %(cid)s where id = %(uid)s",
                    {"cid": body.company_id, "uid": user_id},
                )

    updated = _get_user_row(db, user_id)
    if not updated:
        raise HTTPException(status_code=500, detail="User update failed")
    return UserListOut(
        id=str(updated["id"]),
        email=updated["email"],
        name=updated["name"],
        company_id=str(updated["company_id"]),
        company_name=updated.get("company_name"),
        created_at=str(updated["created_at"]) if updated.get("created_at") is not None else None,
    )
