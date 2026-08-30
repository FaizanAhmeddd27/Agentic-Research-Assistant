"""Human-in-the-Loop node — interrupts after writer for user review.

Three resume paths:
  - approve: draft_report → final_report as-is
  - edit: user-provided text → final_report
  - reject: feedback loops back to retriever/writer
"""

from langgraph.types import interrupt

from app.agent.state import AgentState


def hitl_review(state: AgentState) -> dict:
    """Pause execution and wait for human review decision.

    The interrupt() call suspends the graph. When resumed via
    Command(resume=...), the returned value becomes the output
    of this node.
    """
    decision = interrupt(
        {
            "action": "review_report",
            "draft_report": state.get("draft_report", ""),
            "prompt": "Review the draft report. Choose: approve, edit, or reject.",
        }
    )

    return {"review_decision": decision}


def process_review(state: AgentState) -> dict:
    """Apply the user's review decision to produce final_report."""
    decision = state.get("review_decision", {})
    action = decision.get("decision", "approve")
    draft = state.get("draft_report", "")

    if action == "approve":
        return {
            "final_report": draft,
            "review_status": "approved",
        }

    if action == "edit":
        edited_text = decision.get("edited_text", draft)
        return {
            "final_report": edited_text,
            "review_status": "edited",
        }

    if action == "reject":
        # Return empty final_report — graph will loop back
        return {
            "final_report": "",
            "review_status": "rejected",
        }

    # Default: approve
    return {
        "final_report": draft,
        "review_status": "approved",
    }
