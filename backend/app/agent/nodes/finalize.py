"""Finalize node — extracts long-term memory entries after a research session.

Runs after the Writer node. Uses the LLM to identify 0-3 durable takeaways
about the user's interests/preferences, writes them to the Store, and
promotes draft_report → final_report.
"""

import json
import uuid

from langchain_groq import ChatGroq

from app.config import settings
from app.agent.state import AgentState
from app.db.store import get_store
from app.db.memory import save_memory

FINALIZE_SYSTEM = """You are a research assistant that identifies durable insights about the user based on the research session they just completed.

Given the user's original question and the final report, extract 0-3 short memory entries that capture:
- Topics or domains the user is interested in
- Preferences about depth, format, or style of research
- Useful context that would help personalize future sessions

Rules:
- Each entry should be a single concise sentence (max 30 words)
- Assign each a category: one of "interest", "preference", or "context"
- If nothing is worth remembering, return an empty array
- Return ONLY a JSON array of objects with "summary" and "category" fields
- No markdown fences, no extra text"""

FINALIZE_USER = """Original question: {query}

Report summary (first 500 chars):
{report_preview}

Extract memory entries as JSON array:"""


def finalize(state: AgentState) -> dict:
    """Extract memory entries and finalize the report."""
    draft = state.get("draft_report", "")
    query = state.get("query", "")
    user_id = state.get("user_id", "")
    thread_id = state.get("thread_id", "")

    # --- Extract memories via LLM ---
    memory_entries: list[dict] = []

    try:
        llm = ChatGroq(
            groq_api_key=settings.GROQ_API_KEY,
            model_name="openai/gpt-oss-120b",
            temperature=0.3,
        )

        messages = [
            ("system", FINALIZE_SYSTEM),
            (
                "human",
                FINALIZE_USER.format(
                    query=query,
                    report_preview=draft[:500],
                ),
            ),
        ]

        response = llm.invoke(messages)
        raw = response.content.strip()

        # strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        raw = raw.strip()

        parsed = json.loads(raw)
        if isinstance(parsed, list):
            memory_entries = [
                {"summary": e.get("summary", ""), "category": e.get("category", "general")}
                for e in parsed
                if isinstance(e, dict) and e.get("summary")
            ]
    except (json.JSONDecodeError, Exception):
        # If extraction fails, proceed without memories — not critical
        memory_entries = []

    # --- Write memories to Store ---
    if user_id and memory_entries:
        try:
            store = get_store()
            for entry in memory_entries:
                save_memory(
                    store,
                    user_id,
                    summary=entry["summary"],
                    category=entry.get("category", "general"),
                )
        except Exception:
            # Store write failure is non-fatal
            pass

    # final_report may already be set by the HITL process_review node
    # (edited text or the approved draft). Only fall back to draft if
    # still empty.
    final = state.get("final_report") or draft

    # --- Persist final report to Postgres reports table ---
    if user_id and final:
        try:
            from app.db.db import get_db_conn
            conn = get_db_conn()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO reports (id, user_id, thread_id, content_markdown, status, version)
                    VALUES (%s, %s, %s, %s, 'final', 1)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (str(uuid.uuid4()), user_id, thread_id, final),
                )
        except Exception:
            pass

    return {
        "final_report": final,
        "memory_entries": memory_entries,
    }
