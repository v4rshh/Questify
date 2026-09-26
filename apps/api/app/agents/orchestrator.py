"""
LangGraph orchestrator for a single tutor turn.

Routing (matches the spec, slide 34):

    mode == "normal"  -> Tutor Agent -> END
    mode == "game"     -> Orchestrator -> Gamification Tool -> Tutor Agent -> END

The full game-mode pipeline in the spec (slide 35: Intent Detection -> Get
User Progress -> Get Current Level -> Get Concept -> Quiz Tool -> Generate
Challenge -> Quiz Evaluation) depends on agents that don't exist yet
(World Generation Agent, Flashcard Generator Agent, Roadmap Generator
Agent — none built). This graph only wires the piece that's actually
implemented: routing by mode and answering via the Tutor Agent, with a
small XP hook for game mode. Extend the "game" branch as those agents land.
"""
from langgraph.graph import StateGraph, START, END

from .state import QuestifyState
from .tutor_agent import tutor_agent_node
from .gamification_tool import gamification_tool_node


def _route_by_mode(state: QuestifyState) -> str:
    return "gamification_tool" if state.get("mode") == "game" else "tutor_agent"


def build_orchestrator():
    graph = StateGraph(QuestifyState)

    graph.add_node("tutor_agent", tutor_agent_node)
    graph.add_node("gamification_tool", gamification_tool_node)

    graph.add_conditional_edges(
        START,
        _route_by_mode,
        {"tutor_agent": "tutor_agent", "gamification_tool": "gamification_tool"},
    )
    graph.add_edge("gamification_tool", "tutor_agent")
    graph.add_edge("tutor_agent", END)

    return graph.compile()


# Compiled once at import time; stateless per-invoke, so reuse is safe.
orchestrator = build_orchestrator()
