import psycopg
from langgraph.checkpoint.postgres import PostgresSaver

from app.config import settings

_checkpointer: PostgresSaver | None = None
_conn: psycopg.Connection | None = None


def get_checkpointer() -> PostgresSaver:
    global _checkpointer, _conn
    if _checkpointer is None:
        _conn = psycopg.connect(settings.DATABASE_URL)
        _checkpointer = PostgresSaver(_conn)
        # setup needs autocommit for DDL
        _conn.autocommit = True
        _checkpointer.setup()
        _conn.autocommit = False
    return _checkpointer


def close_checkpointer():
    global _checkpointer, _conn
    if _conn is not None:
        _conn.close()
        _conn = None
        _checkpointer = None
