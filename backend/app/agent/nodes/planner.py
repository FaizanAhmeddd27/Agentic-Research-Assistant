from langchain_groq import ChatGroq

from app.config import settings
from app.agent.state import AgentState

PLANNER_SYSTEM = """You are a research planner. Given a user's research question, break it into 2-5 focused sub-questions that together would provide enough information to write a comprehensive answer.

Rules:
- Each sub-question should be specific and self-contained
- Cover different angles/aspects of the main question
- Return ONLY the sub-questions, one per line, numbered 1-5
- Do not include any explanation or preamble"""

PLANNER_USER = """Research question: {query}

Break this into 2-5 sub-questions:"""


def planner(state: AgentState) -> dict:
    llm = ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name="openai/gpt-oss-120b",
        temperature=0.3,
    )

    messages = [
        ("system", PLANNER_SYSTEM),
        ("human", PLANNER_USER.format(query=state["query"])),
    ]

    response = llm.invoke(messages)
    raw = response.content.strip()

    sub_questions = []
    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        # strip leading number/period
        if line[0].isdigit():
            line = line.split(".", 1)[-1].strip()
        if line:
            sub_questions.append(line)

    return {"sub_questions": sub_questions}
