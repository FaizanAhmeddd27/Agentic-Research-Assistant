"""Phase 5 test: Long-term memory via LangGraph PostgresStore.

Tests:
  1. Store setup and connectivity
  2. Full agent run → finalize node writes memories
  3. Second agent run → more memories written
  4. list_memories returns all entries for the user
  5. delete_memory removes a single entry
  6. Cross-user isolation (second user sees nothing)

Usage:
    python test_memory.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from app.config import settings
from app.db.checkpointer import get_checkpointer, close_checkpointer
from app.db.store import get_store, close_store
from app.db.memory import save_memory, list_memories, delete_memory
from app.agent.graph import build_graph


TEST_USER_A = "test-memory-user-A"
TEST_USER_B = "test-memory-user-B"
THREAD_1 = "test-memory-thread-001"
THREAD_2 = "test-memory-thread-002"


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
    }


def test_memory():
    print("=" * 60)
    print("Phase 5: Long-Term Memory (Store API) Test")
    print("=" * 60)

    # --- Step 1: Setup ---
    print("\n1. Setting up store + checkpointer...")
    store = get_store()
    cp = get_checkpointer()
    print("   Store ready.")
    print("   Checkpointer ready.")

    # --- Step 2: Clean up any leftover test data ---
    print("\n2. Cleaning up previous test data...")
    for user in [TEST_USER_A, TEST_USER_B]:
        old = list_memories(store, user)
        for m in old:
            delete_memory(store, user, m["key"])
        print(f"   Cleared {len(old)} old entries for {user}")

    # --- Step 3: First agent run ---
    print("\n3. Running agent (session 1) — AI topic...")
    graph = build_graph(checkpointer=cp, store=store)
    query1 = "What are the main differences between supervised and unsupervised machine learning?"
    config1 = {"configurable": {"thread_id": THREAD_1}}
    result1 = graph.invoke(make_initial_state(query1, TEST_USER_A, THREAD_1), config1)

    mem1 = result1.get("memory_entries", [])
    print(f"   Memories extracted: {len(mem1)}")
    for m in mem1:
        print(f"     [{m.get('category', '?')}] {m.get('summary', '?')}")

    final1 = result1.get("final_report", "")
    print(f"   Final report length: {len(final1)} chars")
    assert len(final1) > 0, "FAIL: final_report should not be empty"
    print("   ✓ final_report is set")

    # --- Step 4: Second agent run (different topic, same user) ---
    print("\n4. Running agent (session 2) — Web dev topic...")
    query2 = "What is the difference between REST and GraphQL APIs?"
    config2 = {"configurable": {"thread_id": THREAD_2}}
    result2 = graph.invoke(make_initial_state(query2, TEST_USER_A, THREAD_2), config2)

    mem2 = result2.get("memory_entries", [])
    print(f"   Memories extracted: {len(mem2)}")
    for m in mem2:
        print(f"     [{m.get('category', '?')}] {m.get('summary', '?')}")

    # --- Step 5: List all memories for user A ---
    print("\n5. Listing all memories for user A...")
    all_memories = list_memories(store, TEST_USER_A)
    print(f"   Total stored: {len(all_memories)}")
    for i, m in enumerate(all_memories, 1):
        print(f"   {i}. [{m.get('category', '?')}] {m.get('summary', '?')} (key={m['key'][:8]}...)")

    assert len(all_memories) >= 1, "FAIL: Should have at least 1 memory entry"
    print("   ✓ Memories persisted in store")

    # --- Step 6: Delete one memory ---
    print("\n6. Deleting one memory entry...")
    target_key = all_memories[0]["key"]
    delete_memory(store, TEST_USER_A, target_key)
    after_delete = list_memories(store, TEST_USER_A)
    print(f"   Memories after delete: {len(after_delete)}")
    assert len(after_delete) == len(all_memories) - 1, "FAIL: Count should decrease by 1"
    assert all(m["key"] != target_key for m in after_delete), "FAIL: Deleted key should not appear"
    print("   ✓ Delete works correctly")

    # --- Step 7: Cross-user isolation ---
    print("\n7. Verifying cross-user isolation...")
    user_b_memories = list_memories(store, TEST_USER_B)
    print(f"   User B memories: {len(user_b_memories)}")
    assert len(user_b_memories) == 0, "FAIL: User B should have no memories"
    print("   ✓ User B sees nothing from User A")

    # --- Done ---
    print("\n" + "=" * 60)
    print("Phase 5 memory test PASSED.")
    print("=" * 60)


if __name__ == "__main__":
    if not settings.DATABASE_URL or settings.DATABASE_URL.startswith("your_"):
        print("ERROR: Set DATABASE_URL in .env before running this test.")
        sys.exit(1)
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        print("ERROR: Set GROQ_API_KEY in .env before running this test.")
        sys.exit(1)

    try:
        test_memory()
    finally:
        close_store()
        close_checkpointer()
