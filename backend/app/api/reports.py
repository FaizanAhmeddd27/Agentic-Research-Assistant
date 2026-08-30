"""Reports API — get and export finalized reports.

Reports are saved to the `reports` table by the finalize node or retrieved from the checkpointer.
Supports Authorization Header as well as ?token= query parameter for direct browser downloads.
"""

import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import PlainTextResponse

from app.auth.security import decode_token
from app.db.db import get_db_conn
from app.db.checkpointer import get_checkpointer

router = APIRouter(prefix="/api/reports", tags=["reports"])


def get_user_from_header_or_query(
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
) -> str:
    """Validate user from Authorization header or ?token= query parameter."""
    raw_token = None
    if authorization:
        scheme, _, raw_token = authorization.partition(" ")
        if scheme.lower() != "bearer":
            raw_token = None
    if not raw_token and token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    payload = decode_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload["sub"]


def _get_report_data(thread_id: str, user_id: str) -> dict:
    """Retrieve markdown report from the reports table or fallback to the checkpointer."""
    # 1. Try reports table
    try:
        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, content_markdown, status, version, created_at "
                "FROM reports WHERE thread_id = %s AND user_id = %s "
                "ORDER BY version DESC LIMIT 1",
                (thread_id, user_id),
            )
            row = cur.fetchone()
            if row and row[1]:
                return {
                    "id": row[0],
                    "thread_id": thread_id,
                    "content_markdown": row[1],
                    "status": row[2],
                    "version": row[3],
                    "created_at": row[4].isoformat() if row[4] else None,
                }
    except Exception:
        pass

    # 2. Fallback to checkpointer
    try:
        cp = get_checkpointer()
        config = {"configurable": {"thread_id": thread_id}}
        states = list(cp.list(config))
        if states:
            values = states[0].checkpoint.get("channel_values", {})
            owner = values.get("user_id")
            if owner and owner != user_id:
                raise HTTPException(status_code=403, detail="Forbidden")
            report = values.get("final_report") or values.get("draft_report")
            if report:
                return {
                    "id": str(uuid.uuid4()),
                    "thread_id": thread_id,
                    "content_markdown": report,
                    "status": "final" if values.get("final_report") else "draft",
                    "version": 1,
                    "created_at": None,
                }
    except HTTPException:
        raise
    except Exception:
        pass

    raise HTTPException(status_code=404, detail="Report not found")


@router.get("/{thread_id}")
def get_report(thread_id: str, user_id: str = Depends(get_user_from_header_or_query)):
    return _get_report_data(thread_id, user_id)


@router.get("/{thread_id}/export")
def export_report(thread_id: str, user_id: str = Depends(get_user_from_header_or_query)):
    report_data = _get_report_data(thread_id, user_id)
    content = report_data["content_markdown"]

    return PlainTextResponse(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="report-{thread_id}.md"'
        },
    )
