"""Authentication: login, JWT, company-based users."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel

from ..config import settings
from ..db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


def _verify_password(plain: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


class LoginIn(BaseModel):
    email: str
    password: str


class RegisterIn(BaseModel):
    email: str
    password: str
    name: str
    company_id: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    company_id: str
    company_name: str | None


class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def _create_token(sub: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def _get_user_by_email(conn: Any, email: str) -> dict | None:
    import sqlite3

    email_lower = email.strip().lower()
    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name
            from users u
            left join companies c on c.id = u.company_id
            where lower(u.email) = ?
            """,
            (email_lower,),
        )
        row = cur.fetchone()
        return dict(row) if row else None

    with conn.cursor() as cur:
        cur.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name
            from public.users u
            left join public.companies c on c.id = u.company_id
            where lower(u.email) = %(email)s
            """,
            {"email": email_lower},
        )
        return cur.fetchone()


def _verify_user(conn: Any, email: str, password: str) -> dict | None:
    import sqlite3

    email_lower = email.strip().lower()
    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            "select id, email, password_hash, name, company_id from users where lower(email) = ?",
            (email_lower,),
        )
        row = cur.fetchone()
        if not row:
            return None
        r = dict(row)
    else:
        with conn.cursor() as cur:
            cur.execute(
                "select id, email, password_hash, name, company_id from public.users where lower(email) = %(email)s",
                {"email": email_lower},
            )
            r = cur.fetchone()
        if not r:
            return None

    if not _verify_password(password, r["password_hash"]):
        return None
    return r


@router.post("/register", response_model=UserOut)
def register(db: Annotated[Any, Depends(get_db)], body: RegisterIn):
    """Register a new user with email, password, name, and company."""
    import sqlite3
    from uuid import uuid4
    from datetime import datetime, timezone

    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not body.company_id:
        raise HTTPException(status_code=400, detail="Company is required")

    password_hash = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()

    if isinstance(db, sqlite3.Connection):
        cur = db.execute("select id from companies where id = ?", (body.company_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Company not found")
        cur = db.execute("select id from users where lower(email) = ?", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")
        db.execute(
            "insert into users (id, email, password_hash, name, company_id, created_at) values (?, ?, ?, ?, ?, ?)",
            (user_id, email, password_hash, body.name.strip(), body.company_id, now),
        )
        db.commit()
    else:
        with db.transaction():
            with db.cursor() as cur:
                cur.execute("select id from public.companies where id = %(cid)s", {"cid": body.company_id})
                if not cur.fetchone():
                    raise HTTPException(status_code=400, detail="Company not found")
                cur.execute("select id from public.users where lower(email) = %(email)s", {"email": email})
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail="Email already registered")
                cur.execute(
                    "insert into public.users (id, email, password_hash, name, company_id, created_at) values (%(id)s, %(email)s, %(password_hash)s, %(name)s, %(company_id)s, %(created_at)s)",
                    {
                        "id": user_id,
                        "email": email,
                        "password_hash": password_hash,
                        "name": body.name.strip(),
                        "company_id": body.company_id,
                        "created_at": now,
                    },
                )

    full = _get_user_by_email(db, body.email)
    if not full:
        raise HTTPException(status_code=500, detail="User created but not found")
    return UserOut(
        id=str(full["id"]),
        email=full["email"],
        name=full["name"],
        company_id=str(full["company_id"]),
        company_name=full.get("company_name"),
    )


@router.post("/login", response_model=LoginOut)
def login(db: Annotated[Any, Depends(get_db)], body: LoginIn):
    """Login with email and password. Returns JWT and user info."""
    user = _verify_user(db, body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Get company name
    full = _get_user_by_email(db, body.email)
    company_name = full.get("company_name") if full else None

    token = _create_token(str(user["id"]))
    return LoginOut(
        access_token=token,
        user=UserOut(
            id=str(user["id"]),
            email=user["email"],
            name=user["name"],
            company_id=str(user["company_id"]),
            company_name=company_name,
        ),
    )


def _decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def get_current_user(
    db: Annotated[Any, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> UserOut:
    """Dependency: require valid JWT and return current user."""
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_token(creds.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = _get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return UserOut(
        id=str(user["id"]),
        email=user["email"],
        name=user["name"],
        company_id=str(user["company_id"]),
        company_name=user.get("company_name"),
    )


def get_current_user_optional(
    db: Annotated[Any, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> UserOut | None:
    """Dependency: return current user if authenticated, else None."""
    if not creds or not creds.credentials:
        return None
    user_id = _decode_token(creds.credentials)
    if not user_id:
        return None
    user = _get_user_by_id(db, user_id)
    if not user:
        return None
    return UserOut(
        id=str(user["id"]),
        email=user["email"],
        name=user["name"],
        company_id=str(user["company_id"]),
        company_name=user.get("company_name"),
    )


def _get_user_by_id(conn: Any, user_id: str) -> dict | None:
    import sqlite3

    if isinstance(conn, sqlite3.Connection):
        cur = conn.execute(
            """
            select u.id, u.email, u.name, u.company_id, c.name as company_name
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
            select u.id, u.email, u.name, u.company_id, c.name as company_name
            from public.users u
            left join public.companies c on c.id = u.company_id
            where u.id = %(id)s
            """,
            {"id": user_id},
        )
        return cur.fetchone()


@router.get("/me", response_model=UserOut)
def me(user: Annotated[UserOut, Depends(get_current_user)]):
    """Return current authenticated user."""
    return user
