"""Postgres-backed LangGraph Store for long-term memory.

Uses the same Neon DATABASE_URL as the checkpointer.
Namespace convention: ("memory", user_id) — one namespace per user.
"""

import psycopg
from langgraph.store.postgres import PostgresStore

from app.config import settings

_store: PostgresStore | None = None
_conn: psycopg.Connection | None = None


def get_store() -> PostgresStore:
    """Return a singleton PostgresStore, creating it on first call."""
    global _store, _conn
    if _store is None:
        _conn = psycopg.connect(settings.DATABASE_URL)
        _store = PostgresStore(_conn)
        _conn.autocommit = True
        _store.setup()
        _conn.autocommit = False
    return _store


def close_store():
    """Tear down the store connection."""
    global _store, _conn
    if _conn is not None:
        _conn.close()
        _conn = None
        _store = None
