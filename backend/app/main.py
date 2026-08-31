import uuid

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import apply_langsmith_env
from app.auth.routes import router as auth_router
from app.auth.deps import get_current_user
from app.api.threads import router as threads_router
from app.api.documents import router as documents_router
from app.api.settings import router as settings_router
from app.api.reports import router as reports_router
from app.api.memory import router as memory_router
from app.api.stream import router as stream_router

# Wire LangSmith tracing into the process env before the graph runs.
apply_langsmith_env()

app = FastAPI(title="Agentic Research Assistant", version="0.1.0")

# CORS: allow configured origins, Vercel subdomains, and local development
from app.config import settings as app_settings

_raw_origins = [
    o.strip().rstrip("/")
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
]
_default_origins = [
    "https://derve.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://[::1]:3001",
]
_cors_origins = list(dict.fromkeys(_raw_origins + _default_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(threads_router)
app.include_router(documents_router)
app.include_router(settings_router)
app.include_router(reports_router)
app.include_router(memory_router)
app.include_router(stream_router)

_agent_graph = None


def get_graph():
    global _agent_graph
    if _agent_graph is None:
        from app.agent.graph import get_agent_graph
        _agent_graph = get_agent_graph()
    return _agent_graph


@app.on_event("startup")
async def startup():
    import logging
    logger = logging.getLogger("uvicorn.error")
    try:
        from app.db.db import init_db
        from app.db.checkpointer import get_checkpointer
        from app.db.store import get_store
        init_db()
        get_checkpointer()
        get_store()
        logger.info("Startup complete: DB, checkpointer, and store initialized successfully.")
    except Exception as exc:
        logger.error(f"Startup initialization warning/error: {exc}", exc_info=True)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/health/db")
async def health_db():
    """Schema/diagnostic: confirms env vars are present and Neon is reachable.
    Useful when debugging 500s on auth routes after deployment."""
    from app.config import settings
    env_summary = {
        key: ("set" if getattr(settings, key, "") else "MISSING")
        for key in ["DATABASE_URL", "AUTH_SECRET", "QDRANT_URL", "QDRANT_API_KEY",
                    "GROQ_API_KEY", "TAVILY_API_KEY"]
    }
    db_status = "unknown"
    detail = ""
    try:
        from app.db.db import get_db_conn
        conn = get_db_conn()
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001
        db_status = "error"
        detail = f"{type(exc).__name__}: {exc}"
    return {"env": env_summary, "database": db_status, "detail": detail}


class IngestRequest(BaseModel):
    text: str
    source: str = "api"


@app.post("/api/ingest")
async def ingest(req: IngestRequest, user_id: str = Depends(get_current_user)):
    from app.rag.ingest import ingest_text
    chunk_ids = ingest_text(req.text, user_id, req.source)
    return {"chunk_ids": chunk_ids, "count": len(chunk_ids)}


class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 5


@app.post("/api/retrieve")
async def retrieve_chunks(req: RetrieveRequest, user_id: str = Depends(get_current_user)):
    from app.rag.retrieve import retrieve
    chunks = retrieve(req.query, user_id, req.top_k)
    return {
        "chunks": [
            {"id": c.id, "text": c.text, "score": c.score, "source": c.source}
            for c in chunks
        ]
    }


class AnswerRequest(BaseModel):
    query: str
    top_k: int = 5


@app.post("/api/answer")
async def answer_query(req: AnswerRequest, user_id: str = Depends(get_current_user)):
    from app.rag.answer import answer
    result = answer(req.query, user_id, req.top_k)
    return result


class AgentRequest(BaseModel):
    query: str
    thread_id: str | None = None


@app.post("/api/agent/run")
async def agent_run(req: AgentRequest, user_id: str = Depends(get_current_user)):
    thread_id = req.thread_id or str(uuid.uuid4())

    initial_state = {
        "query": req.query,
        "sub_questions": [],
        "retrieved_sources": [],
        "critique_result": {},
        "draft_report": "",
        "final_report": "",
        "user_id": user_id,
        "thread_id": thread_id,
        "retry_count": 0,
        "memory_entries": [],
        "review_status": "pending",
        "review_decision": {},
    }

    config = {"configurable": {"thread_id": thread_id}}
    graph = get_graph()
    result = graph.invoke(initial_state, config)

    return {**result, "thread_id": thread_id}


class ResumeRequest(BaseModel):
    thread_id: str
    decision: str
    edited_text: str | None = None
    feedback: str | None = None


@app.post("/api/agent/resume")
async def agent_resume(req: ResumeRequest, user_id: str = Depends(get_current_user)):
    from langgraph.types import Command

    config = {"configurable": {"thread_id": req.thread_id}}
    graph = get_graph()

    payload = {
        "decision": req.decision,
        "edited_text": req.edited_text,
        "feedback": req.feedback,
    }

    result = graph.invoke(Command(resume=payload), config)
    return result
