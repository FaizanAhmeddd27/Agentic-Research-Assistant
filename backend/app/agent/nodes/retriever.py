from langchain_groq import ChatGroq
from tavily import TavilyClient
from duckduckgo_search import DDGS

from app.config import settings
from app.rag.retrieve import retrieve as rag_retrieve
from app.agent.state import AgentState, Source


def _web_search_enabled(user_id: str) -> bool:
    """Return whether web search is enabled for the user (default True)."""
    try:
        from app.db.db import get_db_conn

        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT web_search_enabled FROM user_settings WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            return row[0] if row else True
    except Exception:
        return True


def _should_skip_web_search(state: AgentState) -> bool:
    if not _web_search_enabled(state["user_id"]):
        return True

    review_decision = state.get("review_decision", {})
    review_decision = state.get("review_decision", {})
    if review_decision.get("decision") != "reject":
        return False

    feedback = (review_decision.get("feedback") or "").lower()
    normalized = feedback.replace("\n", " ")
    if not normalized:
        return False

    phrases = (
        "do not search the web",
        "don't search the web",
        "no web search",
        "dont do web search",
        "don't do web search",
        "without web search",
        "no web",
        "remove linkedin",
        "linkedin",
        "omit linkedin",
        "no linkedin",
    )
    return any(p in normalized for p in phrases)


def _web_search_tavily(query: str, max_results: int = 3) -> list[Source]:
    try:
        client = TavilyClient(api_key=settings.TAVILY_API_KEY)
        results = client.search(query=query, max_results=max_results)
        sources = []
        for r in results.get("results", []):
            sources.append(
                Source(
                    id=r.get("url", ""),
                    text=r.get("content", ""),
                    score=r.get("score", 0.0),
                    source=r.get("url", "web"),
                    origin="web",
                )
            )
        return sources
    except Exception:
        return []


def _web_search_ddg(query: str, max_results: int = 3) -> list[Source]:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        sources = []
        for r in results:
            sources.append(
                Source(
                    id=r.get("href", ""),
                    text=r.get("body", ""),
                    score=0.5,
                    source=r.get("href", "web"),
                    origin="web",
                )
            )
        return sources
    except Exception:
        return []


def _web_search(query: str, max_results: int = 3) -> list[Source]:
    results = _web_search_tavily(query, max_results)
    if not results:
        results = _web_search_ddg(query, max_results)
    return results


def retriever(state: AgentState) -> dict:
    user_id = state["user_id"]

    # Use refined sub-questions from critique if available, else original
    critique_result = state.get("critique_result", {})
    refined = critique_result.get("refined_sub_questions", [])
    sub_questions = refined if refined else state["sub_questions"]

    all_sources: list[Source] = []
    skip_web_search = _should_skip_web_search(state)

    for sq in sub_questions:
        rag_chunks = rag_retrieve(sq, user_id, top_k=3)
        for chunk in rag_chunks:
            all_sources.append(
                Source(
                    id=chunk.id,
                    text=chunk.text,
                    score=chunk.score,
                    source=chunk.source,
                    origin="rag",
                )
            )

        if not skip_web_search:
            web_sources = _web_search(sq, max_results=2)
            all_sources.extend(web_sources)

    retry_count = state.get("retry_count", 0) + 1

    return {
        "retrieved_sources": all_sources,
        "sub_questions": sub_questions,
        "retry_count": retry_count,
    }
