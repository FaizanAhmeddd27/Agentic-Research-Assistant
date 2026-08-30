"""Streaming API — SSE endpoint that emits node-level events as the graph runs.

Uses LangGraph's stream() to emit events as each node completes.
The frontend connects via EventSource and receives JSON events.
"""

import json

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from langgraph.errors import GraphInterrupt

from app.auth.security import decode_token

router = APIRouter(prefix="/api/stream", tags=["stream"])


def _get_user_from_token(token: str | None) -> str:
    """Validate a token passed as a query param (EventSource can't send headers)."""
    if not token:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload["sub"]


def _serialize(obj):
    """Make objects JSON-safe for SSE."""
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(v) for v in obj]
    if isinstance(obj, (str, int, float, bool, type(None))):
        return obj
    return str(obj)


def _make_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(_serialize(data))}\n\n"


def _run_stream(query: str, user_id: str, thread_id: str):
    """Generator that yields SSE events from a graph.stream() run."""
    from app.main import get_graph

    graph = get_graph()

    initial_state = {
        "query": query,
        "sub_questions": [],
        "retrieved_sources": [],
        "critique_result": {},
        "draft_report": "",
        "final_report": "",
        "user_id": user_id,
        "thread_id": thread_id,
        "retry_count": 0,
        "memory_entries": [],
        "review_status": "pending",
        "review_decision": {},
    }

    config = {"configurable": {"thread_id": thread_id}}

    yield _make_event("thread", {"thread_id": thread_id, "status": "started", "query": query})
    yield _make_event("query", {"query": query})

    draft_report = ""
    final_report = ""
    writer_done = False

    try:
        for chunk in graph.stream(initial_state, config, stream_mode="updates"):
            for node_name, node_output in chunk.items():
                if node_name == "planner":
                    yield _make_event("node", {
                        "node": "planner",
                        "status": "done",
                        "sub_questions": node_output.get("sub_questions", []),
                    })
                elif node_name == "retriever":
                    sources = node_output.get("retrieved_sources", [])
                    yield _make_event("node", {
                        "node": "retriever",
                        "status": "done",
                        "source_count": len(sources),
                        "sources": _serialize(sources[:10]),
                    })
                elif node_name == "critique":
                    critique = node_output.get("critique_result", {})
                    yield _make_event("node", {
                        "node": "critique",
                        "status": "done",
                        "sufficient": critique.get("sufficient", False),
                        "reason": critique.get("reason", ""),
                    })
                elif node_name == "writer":
                    draft_report = node_output.get("draft_report", "")
                    writer_done = True
                    yield _make_event("node", {
                        "node": "writer",
                        "status": "done",
                        "draft_length": len(draft_report),
                        "draft_report": draft_report,
                    })
                elif node_name == "hitl_review":
                    yield _make_event("node", {
                        "node": "hitl_review",
                        "status": "awaiting_review",
                        "draft_report": draft_report,
                    })
                    yield _make_event("status", {
                        "status": "awaiting_review",
                        "thread_id": thread_id,
                        "draft_report": draft_report,
                    })
                    yield "event: done\ndata: {}\n\n"
                    return
                elif node_name == "process_review":
                    yield _make_event("node", {
                        "node": "process_review",
                        "status": "done",
                        "review_status": node_output.get("review_status", ""),
                    })
                elif node_name == "finalize":
                    final_report = node_output.get("final_report", "") or draft_report
                    yield _make_event("node", {
                        "node": "finalize",
                        "status": "done",
                        "final_report": final_report,
                        "memory_count": len(node_output.get("memory_entries", [])),
                    })

        # Stream loop exited normally
        if writer_done and draft_report and not final_report:
            yield _make_event("node", {
                "node": "hitl_review",
                "status": "awaiting_review",
                "draft_report": draft_report,
            })
            yield _make_event("status", {
                "status": "awaiting_review",
                "thread_id": thread_id,
                "draft_report": draft_report,
            })
            yield "event: done\ndata: {}\n\n"
            return

        yield _make_event("status", {
            "status": "completed",
            "thread_id": thread_id,
            "final_report": final_report or draft_report,
        })
        yield "event: done\ndata: {}\n\n"

    except GraphInterrupt:
        # LangGraph raises GraphInterrupt when interrupt() is executed inside hitl_review node.
        # This is expected behavior for Human-in-the-Loop review.
        if not draft_report:
            try:
                from app.db.checkpointer import get_checkpointer
                cp = get_checkpointer()
                states = list(cp.list(config))
                if states:
                    draft_report = states[0].checkpoint.get("channel_values", {}).get("draft_report", "")
            except Exception:
                pass

        yield _make_event("node", {
            "node": "hitl_review",
            "status": "awaiting_review",
            "draft_report": draft_report,
        })
        yield _make_event("status", {
            "status": "awaiting_review",
            "thread_id": thread_id,
            "draft_report": draft_report,
        })
        yield "event: done\ndata: {}\n\n"
        return

    except Exception as exc:
        yield _make_event("error", {"message": str(exc)})
        yield "event: done\ndata: {}\n\n"


@router.get("/{thread_id}")
def stream_run(
    thread_id: str,
    query: str,
    token: str | None = Query(default=None),
):
    """SSE stream for a new research run.

    Connect via: GET /api/stream/{thread_id}?query=...&token=...
    EventSource can't send headers, so auth token is passed as query param.
    """
    user_id = _get_user_from_token(token)
    return StreamingResponse(
        _run_stream(query, user_id, thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
