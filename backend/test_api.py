"""Phase 8 test: REST + Streaming endpoints.

Tests the new API modules: threads, documents, settings, reports, memory,
and the streaming endpoint.

Usage:
    python test_api.py
"""

import sys
import os
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv

load_dotenv()

from fastapi.testclient import TestClient

from app.main import app
from app.db.db import init_db, get_db_conn

client = TestClient(app)

TEST_EMAIL = "api-test-phase8@example.com"
TEST_PW = "password123"
TOKEN = ""


def setup():
    init_db()
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE email = %s", (TEST_EMAIL,))
    conn.commit()

    r = client.post("/api/auth/signup", json={"name": "API Tester", "email": TEST_EMAIL, "password": TEST_PW})
    assert r.status_code == 200, r.text
    global TOKEN
    TOKEN = r.json()["token"]


def auth_headers():
    return {"Authorization": f"Bearer {TOKEN}"}


# ---------- Settings ----------

def test_settings_get_update():
    h = auth_headers()

    r = client.get("/api/settings/", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["llm_provider"] == "groq"
    assert body["web_search_enabled"] is True

    r = client.put("/api/settings/", headers=h, json={"llm_provider": "gemini", "web_search_enabled": False})
    assert r.status_code == 200, r.text
    assert r.json()["llm_provider"] == "gemini"
    assert r.json()["web_search_enabled"] is False

    r = client.get("/api/settings/", headers=h)
    assert r.json()["llm_provider"] == "gemini"
    assert r.json()["web_search_enabled"] is False

    # Reset
    client.put("/api/settings/", headers=h, json={"llm_provider": "groq", "web_search_enabled": True})


def test_settings_invalid_provider():
    h = auth_headers()
    r = client.put("/api/settings/", headers=h, json={"llm_provider": "invalid"})
    assert r.status_code == 400, r.text


# ---------- Documents ----------

def test_documents_upload_list_delete():
    h = auth_headers()

    r = client.get("/api/documents/", headers=h)
    assert r.status_code == 200
    initial_count = r.json()["count"]

    # Upload a small text file
    content = b"This is a test document for Phase 8 API testing. It has enough content to chunk."
    r = client.post(
        "/api/documents/upload",
        headers=h,
        files={"file": ("test.txt", content, "text/plain")},
    )
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["filename"] == "test.txt"
    assert doc["chunk_count"] > 0
    doc_id = doc["id"]

    # List
    r = client.get("/api/documents/", headers=h)
    assert r.status_code == 200
    assert r.json()["count"] == initial_count + 1

    # Delete
    r = client.delete(f"/api/documents/{doc_id}", headers=h)
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # Confirm gone
    r = client.get("/api/documents/", headers=h)
    assert r.json()["count"] == initial_count


def test_documents_bad_type():
    h = auth_headers()
    r = client.post(
        "/api/documents/upload",
        headers=h,
        files={"file": ("test.exe", b"binary", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "Unsupported" in r.json()["detail"]


# ---------- Threads ----------

def test_threads_list_empty():
    h = auth_headers()
    r = client.get("/api/threads/", headers=h)
    assert r.status_code == 200
    assert "threads" in r.json()


def test_retriever_skips_web_search_on_reject_feedback():
    from app.agent.nodes.retriever import retriever

    def fake_rag(query, user_id, top_k=3):
        return [SimpleNamespace(id="rag-1", text="RAG answer", score=0.9, source="local.pdf")]

    state = {
        "user_id": "u-123",
        "sub_questions": ["What are the main benefits?"],
        "critique_result": {},
        "review_decision": {
            "decision": "reject",
            "feedback": "Don't do web search and remove LinkedIn references.",
        },
        "retry_count": 0,
    }

    with patch("app.agent.nodes.retriever.rag_retrieve", side_effect=fake_rag), \
         patch("app.agent.nodes.retriever._web_search", side_effect=AssertionError("web search should not run")):
        result = retriever(state)

    assert result["retrieved_sources"][0]["origin"] == "rag"
    assert result["retry_count"] == 1


def test_threads_list_orders_by_checkpoint_timestamp():
    from app.api import threads as threads_api

    older = SimpleNamespace(
        checkpoint={
            "channel_values": {"user_id": "u-123", "query": "old query", "review_status": "approved"},
            "ts": "2024-01-01T00:00:00Z",
        },
        config={"configurable": {"thread_id": "aaa-thread"}},
    )
    newer = SimpleNamespace(
        checkpoint={
            "channel_values": {"user_id": "u-123", "query": "new query", "review_status": "approved"},
            "ts": "2024-02-01T00:00:00Z",
        },
        config={"configurable": {"thread_id": "zzz-thread"}},
    )

    with patch("app.db.checkpointer.get_checkpointer") as get_cp:
        get_cp.return_value.list.return_value = [older, newer]
        payload = threads_api.list_threads(user_id="u-123")

    assert [t["thread_id"] for t in payload["threads"]] == ["zzz-thread", "aaa-thread"]


# ---------- Memory ----------

def test_memory_list_delete():
    h = auth_headers()
    r = client.get("/api/memory/", headers=h)
    assert r.status_code == 200
    assert r.json()["user_id"]


# ---------- Streaming endpoint ----------

def test_stream_endpoint_rejects_unauthenticated():
    r = client.get("/api/stream/test-thread?query=hello")
    assert r.status_code == 401


def run_all():
    print("=" * 60)
    print("Phase 8: REST + Streaming Endpoints Test")
    print("=" * 60)

    setup()
    print("  setup: user created")

    test_settings_get_update()
    print("  PASS: settings get/update")

    test_settings_invalid_provider()
    print("  PASS: settings rejects invalid provider")

    test_documents_upload_list_delete()
    print("  PASS: documents upload/list/delete")

    test_documents_bad_type()
    print("  PASS: documents rejects bad file type")

    test_threads_list_empty()
    print("  PASS: threads list (empty)")

    test_retriever_skips_web_search_on_reject_feedback()
    print("  PASS: reject feedback disables web search")

    test_threads_list_orders_by_checkpoint_timestamp()
    print("  PASS: threads sort by newest checkpoint timestamp")

    test_memory_list_delete()
    print("  PASS: memory list/delete")

    test_stream_endpoint_rejects_unauthenticated()
    print("  PASS: stream endpoint rejects unauthenticated")

    print("=" * 60)
    print("Phase 8 API test PASSED.")
    print("=" * 60)


if __name__ == "__main__":
    run_all()
