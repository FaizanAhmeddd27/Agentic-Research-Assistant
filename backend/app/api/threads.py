"""Threads API — list and get threads for the authenticated user.

Thread data lives in the LangGraph checkpointer (channel_values).
This module queries the checkpointer to list/get threads scoped to user_id.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import get_current_user
from app.db.db import get_db_conn

router = APIRouter(prefix="/api/threads", tags=["threads"])


@router.get("/")
def list_threads(user_id: str = Depends(get_current_user)):
    """Return all threads owned by the current user, newest first."""
    from app.db.checkpointer import get_checkpointer

    cp = get_checkpointer()
    threads = []
    seen = set()

    for config_tuple in cp.list(None):
        values = config_tuple.checkpoint.get("channel_values", {})
        owner = values.get("user_id")
        if owner != user_id:
            continue
        tid = config_tuple.config.get("configurable", {}).get("thread_id")
        if not tid or tid in seen:
            continue
        seen.add(tid)

        query = values.get("query", "")
        review_status = values.get("review_status", "pending")
        has_draft = bool(values.get("draft_report"))
        has_final = bool(values.get("final_report"))

        if review_status in ("approved", "edited"):
            status = "completed"
        elif has_draft or has_final:
            status = "awaiting_review"
        else:
            status = "in_progress"

        ts_value = config_tuple.checkpoint.get("ts")
        ts = None
        if isinstance(ts_value, str):
            try:
                ts = datetime.fromisoformat(ts_value.replace("Z", "+00:00"))
            except ValueError:
                ts = None

        threads.append({
            "thread_id": tid,
            "query": query,
            "status": status,
            "_sort_ts": ts,
        })

    threads.sort(key=lambda t: (t["_sort_ts"] is not None, t["_sort_ts"] or datetime.min), reverse=True)
    return {
        "threads": [
            {key: value for key, value in thread.items() if key != "_sort_ts"}
            for thread in threads
        ],
        "count": len(threads),
    }


@router.get("/{thread_id}")
def get_thread(thread_id: str, user_id: str = Depends(get_current_user)):
    """Return full state for a single thread owned by the current user."""
    from app.db.checkpointer import get_checkpointer

    cp = get_checkpointer()
    config = {"configurable": {"thread_id": thread_id}}
    states = list(cp.list(config))
    if not states:
        raise HTTPException(status_code=404, detail="Thread not found")

    latest = states[0]
    values = latest.checkpoint.get("channel_values", {})
    owner = values.get("user_id")
    if owner and owner != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    return {
        "thread_id": thread_id,
        "values": values,
    }
