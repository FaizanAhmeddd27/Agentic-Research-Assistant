from typing import TypedDict, Literal


class Source(TypedDict):
    id: str
    text: str
    score: float
    source: str
    origin: Literal["rag", "web"]


class CritiqueResult(TypedDict):
    sufficient: bool
    reason: str
    refined_sub_questions: list[str]


class AgentState(TypedDict):
    query: str
    sub_questions: list[str]
    retrieved_sources: list[Source]
    critique_result: CritiqueResult
    draft_report: str
    final_report: str
    user_id: str
    thread_id: str
    retry_count: int
    memory_entries: list[dict]
    review_status: Literal["pending", "approved", "edited", "rejected"]
    review_decision: dict
