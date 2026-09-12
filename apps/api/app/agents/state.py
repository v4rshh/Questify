from typing import TypedDict


class QuestifyState(TypedDict, total=False):
    """Shared state passed between LangGraph nodes for a single tutor turn.

    Field names mirror the spec (slide 34). Note that ``retrieved_context``
    will always come back empty for now: material ingestion/embedding
    (Phase 2 — parsing, chunking, vector storage) hasn't been built yet,
    so there is nothing to retrieve. The Tutor Agent is told this
    explicitly so it never pretends to cite documents it hasn't seen.
    """

    user_id: str
    message: str
    mode: str  # "normal" | "game"

    current_world_id: str | None
    current_level_id: str | None

    retrieved_context: list
    quiz_data: dict | None

    xp_earned: int
    response: str
