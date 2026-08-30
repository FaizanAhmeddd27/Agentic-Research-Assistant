import json

from langchain_groq import ChatGroq

from app.config import settings
from app.agent.state import AgentState, CritiqueResult

MAX_RETRIES = 3

CRITIQUE_SYSTEM = """You are a research quality critic. Given the original question, the sub-questions, and the retrieved sources, evaluate whether the sources are sufficient to write a comprehensive, well-cited report.

Return a JSON object with exactly these fields:
- "sufficient": boolean (true if sources cover the topic well enough)
- "reason": string (brief explanation of your judgment)
- "refined_sub_questions": array of strings (if insufficient, suggest 2-3 new sub-questions to fill gaps; if sufficient, return an empty array)

Return ONLY the JSON object, no markdown fences or extra text."""

CRITIQUE_USER = """Original question: {query}

Sub-questions researched:
{sub_questions}

Retrieved sources ({source_count} total):
{sources}

Evaluate sufficiency and return JSON:"""


def _format_sources(sources) -> str:
    lines = []
    for i, s in enumerate(sources, 1):
        origin_tag = f"[{s['origin'].upper()}]"
        text_preview = s["text"][:200]
        lines.append(f"[Source {i}] {origin_tag} {s['source']}\n{text_preview}")
    return "\n\n".join(lines)


def critique(state: AgentState) -> dict:
    retry_count = state.get("retry_count", 0)

    if retry_count >= MAX_RETRIES:
        return {
            "critique_result": CritiqueResult(
                sufficient=True,
                reason=f"Max retries ({MAX_RETRIES}) reached — proceeding with available sources.",
                refined_sub_questions=[],
            )
        }

    llm = ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name="openai/gpt-oss-120b",
        temperature=0.2,
    )

    sq_text = "\n".join(f"- {sq}" for sq in state["sub_questions"])
    sources_text = _format_sources(state["retrieved_sources"])

    messages = [
        ("system", CRITIQUE_SYSTEM),
        (
            "human",
            CRITIQUE_USER.format(
                query=state["query"],
                sub_questions=sq_text,
                source_count=len(state["retrieved_sources"]),
                sources=sources_text,
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

    try:
        parsed = json.loads(raw)
        result = CritiqueResult(
            sufficient=parsed.get("sufficient", True),
            reason=parsed.get("reason", ""),
            refined_sub_questions=parsed.get("refined_sub_questions", []),
        )
    except (json.JSONDecodeError, KeyError):
        result = CritiqueResult(
            sufficient=True,
            reason="Critique response parsing failed — proceeding with available sources.",
            refined_sub_questions=[],
        )

    return {"critique_result": result}


def route_after_critique(state: AgentState) -> str:
    critique_result = state.get("critique_result", {})
    sufficient = critique_result.get("sufficient", True)

    if sufficient:
        return "writer"
    return "retriever"
