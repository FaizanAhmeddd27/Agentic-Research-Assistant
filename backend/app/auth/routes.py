"""Authentication routes — signup, login, logout, me.

Custom email/password auth (no NextAuth, no OAuth). Passwords stored
bcrypt-hashed. Sessions are signed tokens returned to the client which
sends them as `Authorization: Bearer <token>`.
"""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.security import (
    hash_password,
    verify_password,
    create_token,
)
from app.auth.deps import get_current_user
from app.db.db import get_db_conn

router = APIRouter(prefix="/api/auth", tags=["auth"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupRequest(BaseModel):
    name: str = Field(default="", max_length=100)
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user: dict


def _validate_password(password: str) -> None:
    """Enforce VR-1: min 8 chars, at least one letter and one number."""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not re.search(r"[0-9]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")


def _public_user(row) -> dict:
    return {"id": row[0], "email": row[1], "name": row[2]}


@router.post("/signup", response_model=TokenResponse)
def signup(req: SignupRequest):
    _validate_password(req.password)

    email = req.email.lower().strip()
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    conn = get_db_conn()

    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        user_id = str(uuid.uuid4())
        password_hash = hash_password(req.password)
        name = req.name.strip() or email.split("@")[0]
        cur.execute(
            "INSERT INTO users (id, email, name, password_hash) VALUES (%s, %s, %s, %s)",
            (user_id, email, name, password_hash),
        )
    conn.commit()

    token = create_token(user_id)
    return TokenResponse(token=token, user={"id": user_id, "email": email, "name": name})


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    email = req.email.lower().strip()
    conn = get_db_conn()

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, password_hash FROM users WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()

    # Generic error per FR-1.2 (no hint about which field is wrong)
    if not row or not verify_password(req.password, row[3]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row[0])
    return TokenResponse(token=token, user=_public_user(row))


@router.post("/logout")
def logout(authorization: str | None = None, user_id: str = Depends(get_current_user)):
    # Token is stateless/HMAC-signed; client discards it. Kept for symmetry.
    return {"logged_out": True}


@router.get("/me")
def me(user_id: str = Depends(get_current_user)):
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, name, password_hash FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    return _public_user(row)
