"""End-to-end test for the Phase 1 RAG pipeline.

Usage:
    1. Fill in .env with real API keys
    2. Run: python test_rag.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from app.config import settings
from app.rag.ingest import ingest_text
from app.rag.retrieve import retrieve
from app.rag.answer import answer


TEST_USER = "test-user-001"

SAMPLE_DOCS = [
    """
    Retrieval-Augmented Generation (RAG) is a technique that combines information retrieval
    with language model generation. RAG systems first retrieve relevant documents from a
    knowledge base, then use those documents as context for the language model to generate
    an answer. This approach helps reduce hallucination by grounding responses in real sources.
    """,
    """
    LangGraph is a library for building stateful, multi-actor applications with LLMs.
    It extends LangChain with the ability to coordinate multiple chains (or actors) across
    multiple steps of computation in a cyclic manner. LangGraph supports persistence,
    human-in-the-loop workflows, and streaming.
    """,
    """
    Qdrant is an open-source vector similarity search engine. It provides a production-ready
    vector search with filtering support. Qdrant is designed to work with high-dimensional
    vectors and supports payloads — additional information stored alongside vectors that can
    be used for filtering during search.
    """,
]


def test_ingest():
    print("=" * 60)
    print("STEP 1: Ingesting sample documents into Qdrant")
    print("=" * 60)

    for i, doc in enumerate(SAMPLE_DOCS):
        chunk_ids = ingest_text(
            text=doc.strip(),
            user_id=TEST_USER,
            source=f"sample_doc_{i+1}",
        )
        print(f"  Doc {i+1}: ingested {len(chunk_ids)} chunks")

    print("  Ingestion complete.\n")


def test_retrieve():
    print("=" * 60)
    print("STEP 2: Retrieving chunks for test queries")
    print("=" * 60)

    queries = [
        "What is RAG?",
        "How does LangGraph work?",
        "What is Qdrant used for?",
    ]

    for q in queries:
        chunks = retrieve(q, TEST_USER, top_k=2)
        print(f"\n  Query: {q}")
        for c in chunks:
            print(f"    - [{c.score:.3f}] {c.source}: {c.text[:80]}...")

    print()


def test_answer():
    print("=" * 60)
    print("STEP 3: Generating grounded answers via Groq LLM")
    print("=" * 60)

    query = "Explain what Retrieval-Augmented Generation is and why it is useful."
    print(f"\n  Query: {query}\n")

    result = answer(query, TEST_USER, top_k=3)

    print(f"  Answer:\n{result['answer']}\n")
    print("  Sources used:")
    for s in result["sources"]:
        print(f"    - [{s['score']:.3f}] {s['source']}")


if __name__ == "__main__":
    if not settings.QDRANT_URL or settings.QDRANT_URL.startswith("your_"):
        print("ERROR: Set QDRANT_URL in .env before running this test.")
        sys.exit(1)
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        print("ERROR: Set GROQ_API_KEY in .env before running this test.")
        sys.exit(1)

    test_ingest()
    test_retrieve()
    test_answer()

    print("\n" + "=" * 60)
    print("Phase 1 RAG pipeline test PASSED.")
    print("=" * 60)
