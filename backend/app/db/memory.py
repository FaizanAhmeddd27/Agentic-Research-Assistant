"""Memory CRUD helpers — thin wrappers around the LangGraph Store API.

Every memory entry lives under namespace ("memory", <user_id>).
Each entry is keyed by a UUID and stores:
    {"summary": str, "category": str, "created_at": str}
"""

import uuid
from datetime import datetime, timezone

from langgraph.store.postgres import PostgresStore


def _namespace(user_id: str) -> tuple[str, ...]:
    """Build the Store namespace tuple for a given user."""
    return ("memory", user_id)


def save_memory(
    store: PostgresStore,
    user_id: str,
    summary: str,
    category: str = "general",
) -> str:
    """Write a single memory entry. Returns the generated key."""
    key = str(uuid.uuid4())
    store.put(
        _namespace(user_id),
        key,
        {
            "summary": summary,
            "category": category,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return key


def list_memories(store: PostgresStore, user_id: str) -> list[dict]:
    """Return all memory entries for a user, newest first."""
    items = store.search(_namespace(user_id), limit=100)
    results = []
    for item in items:
        results.append(
            {
                "key": item.key,
                "namespace": list(item.namespace),
                **item.value,
            }
        )
    # sort newest first
    results.sort(key=lambda m: m.get("created_at", ""), reverse=True)
    return results


def delete_memory(store: PostgresStore, user_id: str, memory_key: str) -> None:
    """Delete a single memory entry by key."""
    store.delete(_namespace(user_id), memory_key)
