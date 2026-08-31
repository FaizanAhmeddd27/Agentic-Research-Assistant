import psycopg
from langgraph.checkpoint.postgres import PostgresSaver

from app.config import settings

_checkpointer: PostgresSaver | None = None
_conn: psycopg.Connection | None = None


def get_checkpointer() -> PostgresSaver:
    global _checkpointer, _conn
    if _checkpointer is None:
        # LangGraph's PostgresSaver expects an autocommit connection (it manages
        # its own transactions/commits internally). autocommit=False rolls back
        # every checkpoint when the connection closes on shutdown -> threads lost.
        _conn = psycopg.connect(settings.DATABASE_URL)
        _conn.autocommit = True
        _checkpointer = PostgresSaver(_conn)
        _checkpointer.setup()
    return _checkpointer


def close_checkpointer():
    global _checkpointer, _conn
    if _conn is not None:
        _conn.close()
        _conn = None
        _checkpointer = None
