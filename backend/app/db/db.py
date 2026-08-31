"""Shared Postgres connection helper for application tables (users, sessions).

Uses the same Neon DATABASE_URL as the checkpointer and store.
Follows the existing psycopg pattern with autocommit for DDL.
"""

import psycopg

from app.config import settings

_conn: psycopg.Connection | None = None


def get_db_conn() -> psycopg.Connection:
    """Return a live psycopg connection for app tables, auto-reconnecting if dropped."""
    global _conn
    if _conn is not None:
        try:
            if _conn.closed:
                _conn = None
            else:
                _conn.execute("SELECT 1")
        except Exception:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None

    if _conn is None:
        _conn = psycopg.connect(settings.DATABASE_URL)
        _conn.autocommit = True
    return _conn


def close_db_conn():
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def init_db():
    """Create application tables if they don't exist."""
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id          TEXT PRIMARY KEY,
                email       TEXT NOT NULL UNIQUE,
                name        TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                token      TEXT PRIMARY KEY,
                user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                expires_at TIMESTAMPTZ NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                filename    TEXT NOT NULL,
                mime_type   TEXT NOT NULL DEFAULT '',
                size_bytes  INTEGER NOT NULL DEFAULT 0,
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id              TEXT PRIMARY KEY,
                thread_id       TEXT NOT NULL,
                user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content_markdown TEXT NOT NULL DEFAULT '',
                status          TEXT NOT NULL DEFAULT 'draft',
                version         INTEGER NOT NULL DEFAULT 1,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                llm_provider      TEXT NOT NULL DEFAULT 'groq',
                web_search_enabled BOOLEAN NOT NULL DEFAULT TRUE
            )
            """
        )
    conn.commit()
