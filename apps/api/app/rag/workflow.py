"""Groq-powered RAG workflow adapted from the standalone technical-doc agent."""
from __future__ import annotations

import json
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from ..config import settings
from ..services.llm_client import chat_completion
from .store import RetrievedChunk, get_vector_store


class RagState(TypedDict, total=False):
    question: str
    user_id: str
    course_id: str
    search_query: str
    retry_count: int
    chunks: list[RetrievedChunk]
    relevant_chunks: list[RetrievedChunk]
    answer: str
    citations: list[dict]


def _rewrite(state: RagState) -> dict:
    prompt = (
        "Rewrite the learner's question as a concise semantic-search query. "
        "Return only the rewritten query.\n\nQuestion: " + state["question"]
    )
    try:
        rewritten = chat_completion([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=100).strip()
    except Exception:
        rewritten = state["question"]
    return {"search_query": rewritten or state["question"]}


def _retrieve(state: RagState) -> dict:
    chunks = get_vector_store().search(
        query=state.get("search_query") or state["question"],
        user_id=state["user_id"],
        course_id=state["course_id"],
    )
    return {"chunks": chunks}


def _grade(state: RagState) -> dict:
    chunks = state.get("chunks", [])
    if not chunks:
        return {"relevant_chunks": []}
    candidates = "\n\n".join(f"[{i}] {chunk.content[:1200]}" for i, chunk in enumerate(chunks))
    prompt = f"""Select the chunks that help answer the question. Return only a JSON array of integer indexes.

Question: {state['question']}

Chunks:
{candidates}"""
    try:
        raw = chat_completion([{"role": "user", "content": prompt}], temperature=0.0, max_tokens=100).strip()
        if raw.startswith("```"):
            raw = raw.strip("`").removeprefix("json").strip()
        indexes = json.loads(raw)
        relevant = [chunks[index] for index in indexes if isinstance(index, int) and 0 <= index < len(chunks)]
    except Exception:
        relevant = chunks
    return {"relevant_chunks": relevant}


def _route_after_grade(state: RagState) -> str:
    if state.get("relevant_chunks") or state.get("retry_count", 0) >= settings.rag_max_retries:
        return "generate"
    return "retry"


def _retry(state: RagState) -> dict:
    retry_count = state.get("retry_count", 0) + 1
    prompt = (
        "Create a broader semantic-search query for this learner question. Return only the query.\n\nQuestion: "
        + state["question"]
    )
    try:
        query = chat_completion([{"role": "user", "content": prompt}], temperature=0.1, max_tokens=100).strip()
    except Exception:
        query = state["question"]
    return {"retry_count": retry_count, "search_query": query}


def _generate(state: RagState) -> dict:
    chunks = state.get("relevant_chunks", [])
    if not chunks:
        return {
            "answer": "I couldn't find information about that in the selected course materials. Try rephrasing the question or upload a relevant document.",
            "citations": [],
        }

    context_parts = []
    citations = []
    for index, chunk in enumerate(chunks, start=1):
        location = f", page {chunk.page}" if chunk.page is not None else ""
        context_parts.append(f"[Source {index}: {chunk.source}{location}]\n{chunk.content}")
        citations.append(
            {
                "source": chunk.source,
                "page": chunk.page,
                "excerpt": chunk.content[:300],
                "chunk_index": chunk.chunk_index,
            }
        )
    system = """You are the Questify AI Tutor. Answer using only the supplied course excerpts.
If the excerpts do not support an answer, say so. Explain clearly and concisely. Cite factual claims inline using [Source N]. Never invent a source or page number."""
    user = f"Question: {state['question']}\n\nCourse excerpts:\n\n" + "\n\n---\n\n".join(context_parts)
    answer = chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.2,
        max_tokens=1400,
    )
    return {"answer": answer, "citations": citations}


def _build_graph():
    graph = StateGraph(RagState)
    graph.add_node("rewrite", _rewrite)
    graph.add_node("retrieve", _retrieve)
    graph.add_node("grade", _grade)
    graph.add_node("retry", _retry)
    graph.add_node("generate", _generate)
    graph.add_edge(START, "rewrite")
    graph.add_edge("rewrite", "retrieve")
    graph.add_edge("retrieve", "grade")
    graph.add_conditional_edges("grade", _route_after_grade, {"retry": "retry", "generate": "generate"})
    graph.add_edge("retry", "retrieve")
    graph.add_edge("generate", END)
    return graph.compile()


rag_workflow = _build_graph()


def answer_course_question(*, question: str, user_id: str, course_id: str) -> dict:
    return rag_workflow.invoke(
        {
            "question": question,
            "user_id": user_id,
            "course_id": course_id,
            "search_query": question,
            "retry_count": 0,
            "chunks": [],
            "relevant_chunks": [],
            "answer": "",
            "citations": [],
        }
    )
