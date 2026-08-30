"""FastAPI dependencies for authentication.

The frontend receives a signed session token after login/signup and sends
it as `Authorization: Bearer <token>`. This dependency validates it and
injects the authenticated user into request handlers.
"""

from fastapi import Depends, Header, HTTPException, status

from app.auth.security import decode_token


def get_current_user(authorization: str | None = Header(default=None)) -> str:
    """Return the authenticated user_id or raise 401."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload["sub"]
