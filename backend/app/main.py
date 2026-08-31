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

app.include_router(auth_router)
app.include_router(threads_router)
app.include_router(documents_router)
app.include_router(settings_router)
app.include_router(reports_router)
app.include_router(memory_router)
app.include_router(stream_router)

# CORS: allow the configured production origins, or fall back to localhost dev.
from app.config import settings as app_settings

_cors_origins = [
    o.strip()
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
] or [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://[::1]:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://[::1]:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_agent_graph = None


def get_graph():
    global _agent_graph
    if _agent_graph is None:
        from app.agent.graph import get_agent_graph
        _agent_graph = get_agent_graph()
    return _agent_graph


@app.on_event("startup")
async def startup():
    from app.db.db import init_db
    from app.db.checkpointer import get_checkpointer
    from app.db.store import get_store
    init_db()
    get_checkpointer()
    get_store()


@app.get("/health")
async def health_check():
    return {"status": "ok"}


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
