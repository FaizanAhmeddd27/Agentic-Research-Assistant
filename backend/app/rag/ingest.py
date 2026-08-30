import uuid

from app.config import settings
from app.vectorstore.qdrant_client import get_qdrant_client, ensure_collection

_embedding_model = None


def get_embeddings():
    from fastembed import TextEmbedding
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _embedding_model


def embed_text(texts: list[str]) -> list[list[float]]:
    model = get_embeddings()
    return [list(v) for v in model.embed(texts)]


def embed_query(query: str) -> list[float]:
    model = get_embeddings()
    return list(list(model.embed([query]))[0])


def get_splitter():
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    return RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )


def ingest_text(
    text: str,
    user_id: str,
    source: str = "manual",
    metadata: dict | None = None,
) -> list[str]:
    from qdrant_client.models import PointStruct
    client = get_qdrant_client()
    ensure_collection(client)

    splitter = get_splitter()
    chunks = splitter.split_text(text)

    embeddings_model = get_embeddings()
    vectors = embed_text(chunks)

    points = []
    chunk_ids = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        chunk_id = str(uuid.uuid4())
        chunk_ids.append(chunk_id)
        payload = {
            "user_id": user_id,
            "source": source,
            "chunk_index": i,
            "text": chunk,
        }
        if metadata:
            payload.update(metadata)
        points.append(PointStruct(id=chunk_id, vector=vector, payload=payload))

    client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)
    return chunk_ids


def ingest_files(
    file_paths: list[str],
    user_id: str,
) -> dict[str, list[str]]:
    results = {}
    for path in file_paths:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        chunk_ids = ingest_text(text, user_id, source=path)
        results[path] = chunk_ids
    return results
