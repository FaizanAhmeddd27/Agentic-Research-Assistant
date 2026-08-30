from langgraph.graph import StateGraph, START, END

from app.agent.state import AgentState
from app.agent.nodes.planner import planner
from app.agent.nodes.retriever import retriever
from app.agent.nodes.writer import writer
from app.agent.nodes.critique import critique, route_after_critique
from app.agent.nodes.finalize import finalize
from app.agent.nodes.hitl import hitl_review, process_review


def route_after_review(state: AgentState) -> str:
    """Route based on review decision."""
    decision = state.get("review_decision", {})
    action = decision.get("decision", "approve")

    if action == "reject":
        return "retriever"
    return "process_review"


def build_graph(checkpointer=None, store=None):
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner)
    graph.add_node("retriever", retriever)
    graph.add_node("critique", critique)
    graph.add_node("writer", writer)
    graph.add_node("hitl_review", hitl_review)
    graph.add_node("process_review", process_review)
    graph.add_node("finalize", finalize)

    graph.add_edge(START, "planner")
    graph.add_edge("planner", "retriever")
    graph.add_edge("retriever", "critique")
    graph.add_conditional_edges(
        "critique",
        route_after_critique,
        {"writer": "writer", "retriever": "retriever"},
    )
    graph.add_edge("writer", "hitl_review")
    graph.add_conditional_edges(
        "hitl_review",
        route_after_review,
        {"retriever": "retriever", "process_review": "process_review"},
    )
    graph.add_edge("process_review", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=checkpointer, store=store)


def get_agent_graph():
    from app.db.checkpointer import get_checkpointer
    from app.db.store import get_store
    cp = get_checkpointer()
    st = get_store()
    return build_graph(checkpointer=cp, store=st)
