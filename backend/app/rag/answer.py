from langchain_groq import ChatGroq

from app.config import settings
from app.rag.retrieve import retrieve


SYSTEM_PROMPT = """You are a research assistant. Answer the user's question using ONLY the provided context chunks.
If the context does not contain enough information to answer, say so explicitly.
Always cite which source chunks support your answer by referencing their source labels."""

CONTEXT_TEMPLATE = """<context>
{context}
</context>"""

CHUNK_TEMPLATE = """[Source: {source} | Relevance: {score:.2f}]
{text}"""


def format_context(chunks) -> str:
    formatted = []
    for i, chunk in enumerate(chunks, 1):
        formatted.append(
            CHUNK_TEMPLATE.format(
                source=chunk.source,
                score=chunk.score,
                text=chunk.text,
            )
        )
    return "\n\n".join(formatted)


def answer(
    query: str,
    user_id: str,
    top_k: int = 5,
    model: str = "openai/gpt-oss-120b",
) -> dict:
    chunks = retrieve(query, user_id, top_k=top_k)
    context = format_context(chunks)

    llm = ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name=model,
        temperature=0.2,
    )

    messages = [
        ("system", SYSTEM_PROMPT),
        ("human", f"{CONTEXT_TEMPLATE.format(context=context)}\n\nQuestion: {query}"),
    ]

    response = llm.invoke(messages)

    return {
        "answer": response.content,
        "sources": [
            {
                "id": c.id,
                "text": c.text[:200],
                "score": c.score,
                "source": c.source,
            }
            for c in chunks
        ],
    }
