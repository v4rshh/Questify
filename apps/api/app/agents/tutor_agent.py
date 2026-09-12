from ..services.llm_client import chat_completion
from .state import QuestifyState

TUTOR_SYSTEM_PROMPT = """You are the Questify AI Tutor, a friendly and encouraging study assistant.

IMPORTANT: Material ingestion (parsing uploads, chunking, embeddings) has not been
built yet, so you have NOT been given any excerpts from the learner's own course
materials this turn. Never claim to be quoting or citing a specific document,
page number, or file — you don't have one. Answer from your general knowledge
instead, and if the learner asks about "their" material specifically, say
plainly that document grounding isn't wired up yet.

Explain concepts clearly, use short worked examples where helpful, and keep
answers focused and not overly long.
"""

GAME_MODE_SYSTEM_PROMPT = TUTOR_SYSTEM_PROMPT + """
The learner is in Game Mode, framed as a quest. Address them like an
adventure guide (light fantasy flavor is fine) but keep the actual teaching
content accurate and unchanged. Note: full quest/boss-challenge quiz
generation (the Quiz Tool from the architecture) is not implemented yet —
do not invent a scored quiz. If asked to quiz them, say that adaptive
quizzes are coming in a later build and offer a couple of practice
questions conversationally instead.
"""


def tutor_agent_node(state: QuestifyState) -> QuestifyState:
    """Answers the learner's message using the LLM.

    retrieved_context is currently always empty (see state.py) — once
    Phase 2 (document processing + embeddings) exists, this node should
    be extended to pull relevant chunks and splice them into the prompt.
    """
    system_prompt = GAME_MODE_SYSTEM_PROMPT if state.get("mode") == "game" else TUTOR_SYSTEM_PROMPT

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": state["message"]},
    ]

    response_text = chat_completion(messages)

    updated = dict(state)
    updated["response"] = response_text
    return updated
