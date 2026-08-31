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
        # LangGraph's PostgresStore expects an autocommit connection (it manages
        # its own transactions internally). Keeping autocommit off rolls back
        # every write when the connection closes on shutdown -> memory loss.
        _conn = psycopg.connect(settings.DATABASE_URL)
        _conn.autocommit = True
        _store = PostgresStore(_conn)
        _store.setup()
    return _store


def close_store():
    """Tear down the store connection."""
    global _store, _conn
    if _conn is not None:
        _conn.close()
        _conn = None
        _store = None
