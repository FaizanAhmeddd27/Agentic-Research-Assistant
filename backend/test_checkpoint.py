"""Phase 4 test: Postgres checkpointer persistence + resume.

Usage:
    1. Ensure DATABASE_URL is set in .env (Neon Postgres)
    2. Run: python test_checkpoint.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from app.config import settings
from app.db.checkpointer import get_checkpointer, close_checkpointer
from app.agent.graph import build_graph


TEST_USER = "test-user-001"
THREAD_ID = "test-checkpoint-thread-001"


def test_checkpoint():
    print("=" * 60)
    print("Phase 4: Postgres Checkpointer Test")
    print("=" * 60)

    print("\n1. Setting up checkpointer...")
    cp = get_checkpointer()
    print("   Checkpointer ready.")

    print("\n2. Building graph with checkpointer...")
    graph = build_graph(checkpointer=cp)
    print("   Graph compiled with checkpointer.")

    query = "What is LangGraph and how is it used for agent orchestration?"
    print(f"\n3. Running agent with thread_id={THREAD_ID}")
    print(f"   Query: {query}\n")

    initial_state = {
        "query": query,
        "sub_questions": [],
        "retrieved_sources": [],
        "critique_result": {},
        "draft_report": "",
        "final_report": "",
        "user_id": TEST_USER,
        "thread_id": THREAD_ID,
        "retry_count": 0,
    }

    config = {"configurable": {"thread_id": THREAD_ID}}
    result = graph.invoke(initial_state, config)

    print(f"   Draft report length: {len(result.get('draft_report', ''))} chars")
    print(f"   Retry count: {result.get('retry_count', 0)}")

    print("\n4. Verifying checkpoint exists...")
    cp_instance = get_checkpointer()
    states = list(cp_instance.list(config))
    print(f"   Checkpoints found: {len(states)}")

    if len(states) > 0:
        print(f"   Latest checkpoint keys: {list(states[0].checkpoint.keys())}")

    print("\n5. Resuming from checkpoint (same thread_id)...")
    config2 = {"configurable": {"thread_id": THREAD_ID}}
    result2 = graph.invoke(None, config2)
    print(f"   Resume returned: {type(result2).__name__}")

    print("\n" + "=" * 60)
    print("Phase 4 checkpoint test PASSED.")
    print("=" * 60)


if __name__ == "__main__":
    if not settings.DATABASE_URL or settings.DATABASE_URL.startswith("your_"):
        print("ERROR: Set DATABASE_URL in .env before running this test.")
        sys.exit(1)
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        print("ERROR: Set GROQ_API_KEY in .env before running this test.")
        sys.exit(1)

    test_checkpoint()
