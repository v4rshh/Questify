from .state import QuestifyState

# XP awarded for "ask a meaningful AI question" per the gamification spec's
# XP source list. This is the only gamification hook wired up so far —
# quests/streaks/achievements triggered by tutor use are not implemented.
GAME_MODE_QUESTION_XP = 5


def gamification_tool_node(state: QuestifyState) -> QuestifyState:
    """Marks XP earned for a game-mode tutor interaction.

    This does NOT talk to the database — the API route layer is responsible
    for persisting xp_earned to the user's record, since LangGraph nodes
    here are kept DB-agnostic. Note this is a placeholder: the full
    Quiz Tool / World Generation Agent / boss-challenge flow described in
    the spec's Game Mode example (slide 35) is not built yet. This node
    only tags XP for engaging the tutor in game mode.
    """
    updated = dict(state)
    updated["xp_earned"] = GAME_MODE_QUESTION_XP
    return updated
