"""Documents API — upload, list, delete user documents.

Uploads are chunked, embedded, and stored in Qdrant.
Metadata is tracked in the Postgres `documents` table.
"""

import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth.deps import get_current_user
from app.db.db import get_db_conn

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def extract_text_from_bytes(filename: str, content: bytes) -> str:
    """Return plain text from uploaded file content."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="PDF extraction dependency unavailable") from exc

        try:
            reader = PdfReader(BytesIO(content))
            pages = []
            for page in reader.pages:
                text = page.extract_text() or ""
                pages.append(text)
            return "\n\n".join(pages).strip()
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Unable to read PDF content: {exc}") from exc

    return content.decode("utf-8", errors="replace")


@router.get("/")
def list_documents(user_id: str = Depends(get_current_user)):
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, filename, mime_type, size_bytes, uploaded_at "
            "FROM documents WHERE user_id = %s ORDER BY uploaded_at DESC",
            (user_id,),
        )
        rows = cur.fetchall()

    return {
        "documents": [
            {
                "id": r[0],
                "filename": r[1],
                "mime_type": r[2],
                "size_bytes": r[3],
                "uploaded_at": r[4].isoformat() if r[4] else None,
            }
            for r in rows
        ],
        "count": len(rows),
    }


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    filename = file.filename or "unknown"
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    text = extract_text_from_bytes(filename, content)
    if not text.strip():
        raise HTTPException(status_code=400, detail="Uploaded file does not contain readable text")

    from app.rag.ingest import ingest_text

    chunk_ids = ingest_text(text, user_id, source=filename)

    doc_id = str(uuid.uuid4())
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO documents (id, user_id, filename, mime_type, size_bytes) "
            "VALUES (%s, %s, %s, %s, %s)",
            (doc_id, user_id, filename, file.content_type or "", len(content)),
        )
    conn.commit()

    return {
        "id": doc_id,
        "filename": filename,
        "chunk_count": len(chunk_ids),
    }


@router.delete("/{document_id}")
def delete_document(document_id: str, user_id: str = Depends(get_current_user)):
    conn = get_db_conn()
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM documents WHERE id = %s AND user_id = %s RETURNING filename",
            (document_id, user_id),
        )
        row = cur.fetchone()
    conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    return {"deleted": True, "id": document_id, "filename": row[0]}
