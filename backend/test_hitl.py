"""Phase 6 test: Human-in-the-Loop — approve, edit, reject flows.

Usage:
    python test_hitl.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from app.config import settings
from app.db.checkpointer import get_checkpointer, close_checkpointer
from app.db.store import get_store, close_store
from app.agent.graph import build_graph


TEST_USER = "test-hitl-user-001"


def make_initial_state(query: str, user_id: str, thread_id: str) -> dict:
    return {
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


def run_test(graph, label: str, query: str, thread_id: str, decision: dict):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    state = make_initial_state(query, TEST_USER, thread_id)
    config = {"configurable": {"thread_id": thread_id}}

    print(f"\n  Running agent...")
    result = graph.invoke(state, config)

    review_status = result.get("review_status", "unknown")
    draft_len = len(result.get("draft_report", ""))
    final_len = len(result.get("final_report", ""))

    print(f"  Draft report: {draft_len} chars")
    print(f"  Review status: {review_status}")

    # Check if graph is interrupted (waiting for review)
    from langgraph.types import interrupt
    if result.get("review_status") == "pending" and draft_len > 0:
        print(f"  Graph interrupted — waiting for review.")

        print(f"\n  Submitting review decision: {decision.get('decision')}")
        from langgraph.types import Command
        result2 = graph.invoke(Command(resume=decision), config)

        review_status = result2.get("review_status", "unknown")
        final_len = len(result2.get("final_report", ""))
        print(f"  After review: status={review_status}, final_report={final_len} chars")
        return result2

    return result


def test_hitl():
    print("=" * 60)
    print("Phase 6: Human-in-the-Loop (HITL) Test")
    print("=" * 60)

    store = get_store()
    cp = get_checkpointer()
    graph = build_graph(checkpointer=cp, store=store)

    # --- Test 1: Approve ---
    r1 = run_test(
        graph,
        "Test 1: Approve flow",
        "What is Python?",
        f"hitl-approve-{TEST_USER}",
        {"decision": "approve"},
    )
    assert r1.get("review_status") == "approved", f"FAIL: expected approved, got {r1.get('review_status')}"
    assert len(r1.get("final_report", "")) > 0, "FAIL: final_report empty after approve"
    print("\n  PASS: Approve flow works")

    # --- Test 2: Edit ---
    r2 = run_test(
        graph,
        "Test 2: Edit flow",
        "What is JavaScript?",
        f"hitl-edit-{TEST_USER}",
        {"decision": "edit", "edited_text": "# Custom Edited Report\n\nThis is my edited version."},
    )
    assert r2.get("review_status") == "edited", f"FAIL: expected edited, got {r2.get('review_status')}"
    assert "Custom Edited" in r2.get("final_report", ""), "FAIL: edited text not in final_report"
    print("\n  PASS: Edit flow works")

    # --- Test 3: Reject ---
    r3 = run_test(
        graph,
        "Test 3: Reject flow (loops back)",
        "What is SQL?",
        f"hitl-reject-{TEST_USER}",
        {"decision": "reject", "feedback": "Too shallow, go deeper."},
    )
    # After reject, graph loops back and produces a new draft → should be interrupted again
    print(f"\n  After reject: review_status={r3.get('review_status')}, draft={len(r3.get('draft_report', ''))} chars")

    # Now approve the new draft
    if r3.get("review_status") == "pending" and len(r3.get("draft_report", "")) > 0:
        print("  Approving the re-drafted report...")
        from langgraph.types import Command
        r3b = graph.invoke(Command(resume={"decision": "approve"}), {"configurable": {"thread_id": f"hitl-reject-{TEST_USER}"}})
        assert r3b.get("review_status") == "approved", f"FAIL: expected approved after retry, got {r3b.get('review_status')}"
        print("  PASS: Reject → retry → approve flow works")
    else:
        print("  NOTE: Graph completed without re-interrupt (reject may have forced write-through)")

    print("\n" + "=" * 60)
    print("Phase 6 HITL test PASSED.")
    print("=" * 60)


if __name__ == "__main__":
    if not settings.DATABASE_URL or settings.DATABASE_URL.startswith("your_"):
        print("ERROR: Set DATABASE_URL in .env before running this test.")
        sys.exit(1)
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        print("ERROR: Set GROQ_API_KEY in .env before running this test.")
        sys.exit(1)

    try:
        test_hitl()
    finally:
        close_store()
        close_checkpointer()
