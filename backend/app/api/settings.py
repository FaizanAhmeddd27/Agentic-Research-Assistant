"""Settings API — get and update per-user agent preferences.

Settings are stored in the `user_settings` Postgres table.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.deps import get_current_user
from app.db.db import get_db_conn

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsUpdate(BaseModel):
    llm_provider: str | None = None
    web_search_enabled: bool | None = None


def _get_settings_row(user_id: str):
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT llm_provider, web_search_enabled FROM user_settings WHERE user_id = %s",
            (user_id,),
        )
        return cur.fetchone()


def _upsert_settings(user_id: str, llm_provider: str, web_search_enabled: bool):
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_settings (user_id, llm_provider, web_search_enabled)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                llm_provider = EXCLUDED.llm_provider,
                web_search_enabled = EXCLUDED.web_search_enabled
            """,
            (user_id, llm_provider, web_search_enabled),
        )
    conn.commit()


@router.get("/")
def get_settings(user_id: str = Depends(get_current_user)):
    row = _get_settings_row(user_id)
    if row:
        return {"llm_provider": row[0], "web_search_enabled": row[1]}
    # Default settings
    return {"llm_provider": "groq", "web_search_enabled": True}


@router.put("/")
def update_settings(req: SettingsUpdate, user_id: str = Depends(get_current_user)):
    row = _get_settings_row(user_id)
    current_llm = row[0] if row else "groq"
    current_search = row[1] if row else True

    new_llm = req.llm_provider if req.llm_provider is not None else current_llm
    new_search = req.web_search_enabled if req.web_search_enabled is not None else current_search

    if new_llm not in ("groq", "gemini"):
        raise HTTPException(status_code=400, detail="llm_provider must be 'groq' or 'gemini'")

    _upsert_settings(user_id, new_llm, new_search)
    return {"llm_provider": new_llm, "web_search_enabled": new_search}
