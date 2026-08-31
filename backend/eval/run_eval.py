"""Evaluation runner.

Runs the agent graph over the fixed eval dataset and produces a baseline
score for retrieval relevance and answer groundedness.

Usage (from backend/):
    # 1) (Optional) create/refresh the LangSmith dataset (needs LANGSMITH_API_KEY)
    python eval/run_eval.py --push-dataset

    # 2) Run the eval over a subset (safe default when no arg)
    python eval/run_eval.py --limit 5

    # 3) Run everything and report a summary
    python eval/run_eval.py --limit -1

Notes:
- Running the eval makes real LLM + web-search calls and requires the backend
  environment (Postgres/Qdrant) to be reachable, exactly like the live app.
- It is a script, not part of the API server. Run it manually / in CI.

Exit criteria (DEV_PLAN Phase 10): every local run appears in LangSmith and the
printed "Baseline" acts as the reference score to compare future changes.
"""

import argparse
import json
import os
import sys
import uuid
from typing import Any

# Allow running from the repo root regardless of CWD.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings, apply_langsmith_env  # noqa: E402

apply_langsmith_env()

from eval.dataset import EVAL_DATASET  # noqa: E402



def _llm():
    from langchain_groq import ChatGroq

    return ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name="openai/gpt-oss-120b",
        temperature=0.0,
    )


def _score_retrieval_relevance(question: str, sources_text: str) -> dict:
    """Judge whether the retrieved sources are relevant to the question."""
    if not sources_text.strip():
        return {"score": 0, "reason": "No sources retrieved"}
    prompt = (
        "You are grading retrieval quality. Given a research question and the "
        "retrieved source snippets, judge how relevant the sources are for "
        "answering the question.\n"
        "Return a JSON object: {\"score\": <0-1 float>, \"reason\": <short string>}.\n\n"
        f"QUESTION:\n{question}\n\n"
        f"SOURCES:\n{sources_text}\n\n"
        "Relevance score (0.0-1.0):"
    )
    return _llm_json(prompt)


def _score_groundedness(question: str, report: str, sources_text: str) -> dict:
    """Judge whether the report is grounded in / supported by the sources."""
    if not report.strip():
        return {"score": 0, "reason": "No report produced"}
    prompt = (
        "You are grading answer groundedness. Given the original question, the "
        "sources the agent used, and the agent's report, judge whether the "
        "report stays grounded in the provided sources rather than "
        "hallucinating unsupported claims.\n"
        "Return a JSON object: {\"score\": <0-1 float>, \"reason\": <short string>}.\n\n"
        f"QUESTION:\n{question}\n\n"
        f"SOURCES:\n{sources_text}\n\n"
        f"REPORT:\n{report}\n\n"
        "Groundedness score (0.0-1.0):"
    )
    return _llm_json(prompt)


def _llm_json(prompt: str) -> dict:
    try:
        raw = _llm().invoke([("human", prompt)]).content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]
        return json.loads(raw.strip())
    except Exception as exc:  # noqa: BLE001
        return {"score": 0, "reason": f"Scorer error: {exc}"}


# --------------------------------------------------------------------------- #
# Graph runner
# --------------------------------------------------------------------------- #
def run_one(query: str, user_id: str) -> dict:
    """Run the agent graph to completion for a single query.

    The graph pauses at the HITL node, so we resume with an 'approve' decision
    to obtain a final report (mirrors the live 'approve' path).
    """
    from langgraph.types import Command
    from app.agent.graph import get_agent_graph

    graph = get_agent_graph()
    thread_id = f"eval-{uuid.uuid4().hex[:12]}"

    initial_state = {
        "query": query,
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

    graph.invoke(initial_state, config)

    # Resume from the HITL interrupt with an approval.
    result = graph.invoke(
        Command(resume={"decision": "approve", "edited_text": None, "feedback": None}),
        config,
    )

    return {
        "thread_id": thread_id,
        "sources": result.get("retrieved_sources", []) or [],
        "draft_report": result.get("draft_report", ""),
        "final_report": result.get("final_report", ""),
        "sub_questions": result.get("sub_questions", []),
        "review_status": result.get("review_status", ""),
    }


# --------------------------------------------------------------------------- #
# LangSmith dataset + results upload (optional / cloud)
# --------------------------------------------------------------------------- #
def push_dataset(client) -> None:
    dataset_name = "derve-eval-baseline"
    try:
        dataset = client.create_dataset(
            dataset_name=dataset_name,
            description="Phase 10 baseline: retrieval relevance + groundedness.",
        )
    except Exception:  # dataset likely already exists
        dataset = client.read_dataset(dataset_name=dataset_name)

    examples = [{"inputs": {"query": e["query"]}} for e in EVAL_DATASET]
    client.create_examples(inputs=[ex["inputs"] for ex in examples], dataset_id=dataset.id)
    print(f"Pushed {len(examples)} examples to LangSmith dataset '{dataset_name}'.")


def upload_results(client, results) -> None:
    """Record each eval run as a LangSmith project trace is automatic via
    LangChain tracing; this additionally stores the per-question scores."""
    # Results are already traced to LangSmith by LangGraph auto-tracing.
    # This is a lightweight human-readable artifact for the repo.
    return results


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 10 eval runner")
    parser.add_argument("--push-dataset", action="store_true",
                        help="Create/refresh the LangSmith eval dataset.")
    parser.add_argument("--limit", type=int, default=5,
                        help="Max questions to run (-1 = all). Default 5.")
    parser.add_argument("--user", default=os.environ.get("EVAL_USER_ID", "eval-user"),
                        help="user_id to scope the eval run under.")
    args = parser.parse_args()

    client = None
    if settings.LANGSMITH_API_KEY:
        try:
            from langsmith import Client
            client = Client()
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] LangSmith client unavailable: {exc}", file=sys.stderr)

    if args.push_dataset:
        if client is None:
            print("Cannot push dataset: LANGSMITH_API_KEY missing/configured.", file=sys.stderr)
            return 1
        push_dataset(client)
        return 0

    dataset = EVAL_DATASET
    if args.limit and args.limit != -1:
        dataset = dataset[: args.limit]

    print(f"Running eval over {len(dataset)} question(s)...\n")

    rows = []
    for entry in dataset:
        query = entry["query"]
        print(f"[*] {query}")
        run = run_one(query, args.user)

        sources_text = "\n\n".join(
            f"[{s.get('origin','?').upper()}] {s.get('source','')}\n{s.get('text','')[:300]}"
            for s in run["sources"]
        )
        report = run["final_report"] or run["draft_report"]

        rel = _score_retrieval_relevance(query, sources_text)
        grounded = _score_groundedness(query, report, sources_text)

        rows.append({
            "query": query,
            "category": entry["category"],
            "source_count": len(run["sources"]),
            "sub_questions": run["sub_questions"],
            "retrieval_relevance": rel.get("score", 0),
            "relevance_reason": rel.get("reason", ""),
            "groundedness": grounded.get("score", 0),
            "groundedness_reason": grounded.get("reason", ""),
        })
        print(f"    sources={len(run['sources'])} relevance={rel.get('score')} groundedness={grounded.get('score')}")

    # Baseline summary
    n = len(rows)
    if n:
        rel_avg = sum(r["retrieval_relevance"] for r in rows) / n
        grd_avg = sum(r["groundedness"] for r in rows) / n
        print("\n================ BASELINE ================")
        print(f"Retrieval relevance (avg): {rel_avg:.2f} / 1.00")
        print(f"Answer groundedness (avg): {grd_avg:.2f} / 1.00")
        print(f"Questions: {n}")

    out = {"rows": rows, "baseline_count": n}
    out_path = os.path.join(os.path.dirname(__file__), "results.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
    print(f"\nDetailed results written to {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
