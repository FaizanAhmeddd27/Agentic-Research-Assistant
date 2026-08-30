from dataclasses import dataclass

from app.rag.ingest import embed_query
from app.config import settings
from app.vectorstore.qdrant_client import get_qdrant_client, build_user_filter


@dataclass
class RetrievedChunk:
    id: str
    text: str
    score: float
    source: str
    metadata: dict


def retrieve(
    query: str,
    user_id: str,
    top_k: int = 5,
) -> list[RetrievedChunk]:
    client = get_qdrant_client()
    query_vector = embed_query(query)

    results = client.query_points(
        collection_name=settings.QDRANT_COLLECTION,
        query=query_vector,
        query_filter=build_user_filter(user_id),
        limit=top_k,
    )

    chunks = []
    for point in results.points:
        payload = point.payload or {}
        chunks.append(
            RetrievedChunk(
                id=str(point.id),
                text=payload.get("text", ""),
                score=point.score,
                source=payload.get("source", "unknown"),
                metadata={k: v for k, v in payload.items() if k not in ("text", "user_id")},
            )
        )
    return chunks
