"""End-to-end test for Phase 3 LangGraph agent with critique loop.

Usage:
    1. Fill in .env with real API keys + Qdrant data from Phase 1
    2. Run: python test_agent.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from app.config import settings
from app.agent.graph import get_agent_graph


TEST_USER = "test-user-001"


def test_agent():
    print("=" * 60)
    print("Phase 3: LangGraph Agent — Critique Loop Test")
    print("=" * 60)

    query = "What is Retrieval-Augmented Generation and how does it work?"
    print(f"\nQuery: {query}\n")

    initial_state = {
        "query": query,
        "sub_questions": [],
        "retrieved_sources": [],
        "critique_result": {},
        "draft_report": "",
        "final_report": "",
        "user_id": TEST_USER,
        "thread_id": "test-thread-001",
        "retry_count": 0,
    }

    print("Running agent graph (with critique loop)...")
    result = get_agent_graph().invoke(initial_state)

    print(f"\n--- Sub-questions ---")
    for i, sq in enumerate(result["sub_questions"], 1):
        print(f"  {i}. {sq}")

    print(f"\n--- Sources retrieved ---")
    rag_count = sum(1 for s in result["retrieved_sources"] if s["origin"] == "rag")
    web_count = sum(1 for s in result["retrieved_sources"] if s["origin"] == "web")
    print(f"  RAG: {rag_count} | Web: {web_count} | Total: {len(result['retrieved_sources'])}")

    print(f"\n--- Critique ---")
    critique_result = result.get("critique_result", {})
    print(f"  Sufficient: {critique_result.get('sufficient', 'N/A')}")
    print(f"  Reason: {critique_result.get('reason', 'N/A')}")
    refined = critique_result.get("refined_sub_questions", [])
    if refined:
        print(f"  Refined sub-questions: {refined}")

    print(f"\n--- Retry count: {result['retry_count']} ---")

    print(f"\n--- Draft Report ---")
    print(result["draft_report"][:500])

    print("\n" + "=" * 60)
    print("Phase 3 agent test PASSED.")
    print("=" * 60)


if __name__ == "__main__":
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        print("ERROR: Set GROQ_API_KEY in .env before running this test.")
        sys.exit(1)

    test_agent()
