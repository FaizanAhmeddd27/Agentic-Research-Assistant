from langchain_groq import ChatGroq

from app.config import settings
from app.agent.state import AgentState

WRITER_SYSTEM = """You are a research report writer. Using the provided sources, write a well-structured, cited report that answers the user's original question.

Rules:
- Write in clear, professional Markdown
- Every factual claim MUST cite its source using [Source N] notation
- Number sources sequentially as they appear in the provided context
- If sources are insufficient for a claim, note the gap rather than fabricating
- Include a "## Sources" section at the end listing all referenced sources with their URLs/labels"""

WRITER_USER = """Original question: {query}

Sub-questions researched:
{sub_questions}

Retrieved sources:
{sources}

Write the research report:"""


def _format_sources(sources) -> str:
    lines = []
    for i, s in enumerate(sources, 1):
        origin_tag = f"[{s['origin'].upper()}]"
        text_preview = s["text"][:300]
        lines.append(f"[Source {i}] {origin_tag} {s['source']}\n{text_preview}")
    return "\n\n".join(lines)


def writer(state: AgentState) -> dict:
    llm = ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name="openai/gpt-oss-120b",
        temperature=0.4,
    )

    sq_text = "\n".join(f"- {sq}" for sq in state["sub_questions"])
    sources_text = _format_sources(state["retrieved_sources"])

    messages = [
        ("system", WRITER_SYSTEM),
        (
            "human",
            WRITER_USER.format(
                query=state["query"],
                sub_questions=sq_text,
                sources=sources_text,
            ),
        ),
    ]

    response = llm.invoke(messages)
    return {"draft_report": response.content}
