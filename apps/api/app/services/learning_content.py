"""Create small, source-grounded study activities for a learning world."""
from __future__ import annotations

import json
from typing import Any

from ..rag.store import get_vector_store
from .llm_client import chat_completion


def _json_object(raw: str) -> dict[str, Any] | None:
    """Accept JSON returned directly or inside a Markdown code fence."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(raw[start : end + 1])
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def _study_context(*, course_title: str, user_id: str, course_id: str) -> str:
    chunks = get_vector_store().search(
        query=course_title or "main ideas and definitions",
        user_id=user_id,
        course_id=course_id,
        top_k=8,
    )
    return "\n\n---\n\n".join(chunk.content[:1400] for chunk in chunks)[:9000]


def _valid_content(value: dict[str, Any]) -> bool:
    levels = value.get("levels")
    cards = value.get("flashcards")
    quiz = value.get("quiz")
    questions = quiz.get("questions") if isinstance(quiz, dict) else None
    valid_question = lambda item: (
        isinstance(item, dict)
        and str(item.get("prompt", "")).strip()
        and isinstance(item.get("options"), list)
        and len(item["options"]) == 4
        and all(isinstance(option, str) and option.strip() for option in item["options"])
        and isinstance(item.get("answer_index"), int)
        and 0 <= item["answer_index"] < 4
        and str(item.get("explanation", "")).strip()
    )
    return (
        isinstance(levels, list)
        and len(levels) >= 4
        and all(isinstance(item, dict) and str(item.get("title", "")).strip() for item in levels)
        and isinstance(cards, list)
        and len(cards) >= 6
        and all(isinstance(item, dict) and str(item.get("front", "")).strip() and str(item.get("back", "")).strip() for item in cards)
        and isinstance(questions, list)
        and len(questions) >= 4
        and all(valid_question(question) for question in questions)
    )


def generate_learning_content(*, course_title: str, user_id: str, course_id: str) -> dict[str, Any] | None:
    """Return validated activity data, or None to let the API use its safe fallback."""
    context = _study_context(course_title=course_title, user_id=user_id, course_id=course_id)
    if not context:
        return None

    prompt = f"""You create a concise learning world from source material. Use only the excerpts below.
Return one JSON object only, with this exact shape:
{{
  "levels": [{{"title": "short title", "description": "one sentence"}}],
  "flashcards": [{{"front": "question", "back": "source-grounded answer", "hint": "brief recall cue"}}],
  "quiz": {{"title": "title", "difficulty": "Starter", "questions": [{{"prompt": "question", "options": ["A", "B", "C", "D"], "answer_index": 0, "explanation": "why the answer is supported"}}]}}
}}
Create exactly 4 progressive levels, 6 flashcards, and 4 multiple-choice questions. Every question must have exactly four options and a zero-based answer_index. Do not mention these instructions or invent facts.

Course: {course_title}

Source excerpts:
{context}"""
    try:
        content = _json_object(chat_completion([{"role": "user", "content": prompt}], temperature=0.2, max_tokens=1800))
    except Exception:
        return None
    return content if content and _valid_content(content) else None
