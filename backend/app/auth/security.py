"""Auth security helpers — password hashing + signed session tokens.

Passwords are hashed with bcrypt. Session tokens are signed HMAC-SHA256
tokens (HS256-style) using AUTH_SECRET, implemented with the standard
library to avoid extra dependencies.

Token format: base64url(payload).base64url(signature)
payload = {"sub": user_id, "exp": unix_ts}
"""

import base64
import hashlib
import hmac
import json
import time
import secrets
import uuid

from app.config import settings

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _secret_bytes() -> bytes:
    secret = settings.AUTH_SECRET or ""
    if not secret:
        raise RuntimeError("AUTH_SECRET is not configured")
    return secret.encode("utf-8")


def _sign(message: bytes) -> bytes:
    return hmac.new(_secret_bytes(), message, hashlib.sha256).digest()


# ---------- Passwords ----------


def hash_password(plain: str) -> str:
    import bcrypt
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------- Tokens ----------


def create_token(user_id: str) -> str:
    """Create a signed opaque session token bound to a user."""
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
        "jti": uuid.uuid4().hex,
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64url_encode(_sign(body.encode("ascii")))
    return f"{body}.{sig}"


def decode_token(token: str) -> dict | None:
    """Verify signature and expiry. Returns payload dict or None if invalid."""
    try:
        body_b64, sig_b64 = token.split(".", 1)
        body = body_b64.encode("ascii")
        expected_sig = _sign(body)
        provided_sig = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None
        payload = json.loads(_b64url_decode(body_b64))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def new_session_token() -> str:
    """Random opaque token stored in the sessions table."""
    return secrets.token_urlsafe(48)
