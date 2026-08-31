"""Evaluation dataset.

A fixed set of 10-15 questions used to benchmark the agent across runs.

Each entry:
  - query:         the research question submitted to the agent
  - category:      "rag" | "web" | "hybrid"  (what the question primarily needs)
  - reference_facts: list of key facts/entities the report should contain
                     (used by the LLM-graded groundedness / completeness scorer)

The dataset is split between questions answerable from the private
ComplyEncrypt RAG knowledge base, questions that require live web search,
and hybrid questions that benefit from both.
"""

EVAL_DATASET = [
    # ---- Public/product questions (web + private KB) ----
    {
        "query": "How does the SQLite write-ahead logging (WAL) mode handle concurrent reads and writes?",
        "category": "web",
        "reference_facts": [
            "write-ahead logging",
            "WAL",
            "concurrent readers",
            "readers do not block writers",
            "single writer",
        ],
    },
    {
        "query": "What are the main differences between PostgreSQL and SQLite for read-heavy workloads?",
        "category": "web",
        "reference_facts": [
            "Postgres",
            "SQLite",
            "concurrency",
            "read-heavy",
            "locking",
        ],
    },
    # ---- Private ComplyEncrypt RAG knowledge base ----
    {
        "query": "Does ComplyEncrypt use a subscription model or a one-time purchase?",
        "category": "rag",
        "reference_facts": [
            "one-time purchase",
            "per framework",
            "no subscriptions",
            "per-seat fees",
        ],
    },
    {
        "query": "What ISO 27001 features does ComplyEncrypt offer?",
        "category": "rag",
        "reference_facts": [
            "gap analysis",
            "roadmap",
            "Statement of Applicability (SoA)",
            "control mapping",
            "evidence collection",
            "audit-pack generation",
        ],
    },
    {
        "query": "What GDPR compliance features are available in ComplyEncrypt?",
        "category": "rag",
        "reference_facts": [
            "DPIAs",
            "consent",
            "ROPA management",
            "DSAR workflows",
            "privacy posture",
        ],
    },
    {
        "query": "Who is the CEO of ComplyEncrypt and what is their role in the platform?",
        "category": "rag",
        "reference_facts": [
            "Faizan Ahmed",
            "CEO",
            "leadership",
        ],
    },
    {
        "query": "How does the ComplyEncrypt platform workflow move from organizational context to ISO 27001 compliance?",
        "category": "rag",
        "reference_facts": [
            "organizational context",
            "gap analysis",
            "control mapping",
            "risk treatment",
            "evidence",
            "audit preparation",
            "ISO/IEC 27001:2022",
        ],
    },
    # ---- Hybrid: private KB + web ----
    {
        "query": "How many policy documents does ComplyEncrypt advertise and how do these compare to typical ISO 27001 policy requirements?",
        "category": "hybrid",
        "reference_facts": [
            "40+ policy documents",
            "AI-drafted policies",
            "ISO 27001",
            "compliance lifecycle",
        ],
    },
    {
        "query": "What compliance standards does ComplyEncrypt support and what is a Statement of Applicability?",
        "category": "hybrid",
        "reference_facts": [
            "ISO/IEC 27001",
            "Statement of Applicability",
            "SoA",
            "GDPR",
            "compliance",
        ],
    },
    # ---- Additional web questions ----
    {
        "query": "What are the benefits of using vector embeddings for semantic search over keyword-based search?",
        "category": "web",
        "reference_facts": [
            "semantic search",
            "embeddings",
            "meaning",
            "keyword",
            "context",
        ],
    },
    {
        "query": "How does Retrieval-Augmented Generation (RAG) reduce hallucinations in LLM answers?",
        "category": "web",
        "reference_facts": [
            "retrieval-augmented generation",
            "RAG",
            "grounding",
            "sources",
            "reduce hallucination",
        ],
    },
    {
        "query": "What is the role of human-in-the-loop review in an AI research or content pipeline?",
        "category": "web",
        "reference_facts": [
            "human-in-the-loop",
            "review",
            "approval",
            "quality control",
            "bias",
        ],
    },
    {
        "query": "What are the main differences between full-text search and vector (semantic) search?",
        "category": "web",
        "reference_facts": [
            "full-text search",
            "BM25",
            "vector search",
            "semantic",
            "synonyms",
        ],
    },
    {
        "query": "What is a Statement of Applicability in the context of ISO 27001 compliance audits?",
        "category": "web",
        "reference_facts": [
            "Statement of Applicability",
            "SoA",
            "ISO 27001",
            "controls",
            "audit",
        ],
    },
    {
        "query": "How do GDPR data subject access requests (DSARs) typically work in a compliance platform?",
        "category": "web",
        "reference_facts": [
            "data subject access request",
            "DSAR",
            "GDPR",
            "request",
            "data",
        ],
    },
]

# Convenience accessors
def all_queries() -> list[str]:
    return [entry["query"] for entry in EVAL_DATASET]


def by_category(category: str) -> list[dict]:
    return [entry for entry in EVAL_DATASET if entry["category"] == category]
