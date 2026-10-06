import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Course, KnowledgeNode, Material, Quiz, TutorChallenge, User
from ...schemas import (
    TutorChallengeAnswerCreate,
    TutorChallengeAnswerRead,
    TutorChatRequest,
    TutorChatResponse,
)
from ...services.gamification import GAME_MODE_QUESTION_XP, record_quest_progress, sync_mastery_tier
from ...rag.workflow import answer_course_question, generate_course_challenge
from ..deps import get_current_user

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])
logger = logging.getLogger(__name__)


def _challenge_markdown(challenge: dict) -> str:
    """Keep game questions readable for clients that lack interactive controls."""
    option_lines = [
        f"{chr(65 + index)}. {option}"
        for index, option in enumerate(challenge["options"])
    ]
    return "\n\n".join(
        [
            "### Game challenge",
            str(challenge["prompt"]),
            "\n".join(option_lines),
            "Choose the best answer. A correct response earns 5 XP.",
        ]
    )


def _quiz_challenge(db: Session, course_id, node_id, request: str) -> dict | None:
    statement = select(Quiz).join(KnowledgeNode).where(KnowledgeNode.course_id == course_id)
    if node_id:
        statement = statement.where(Quiz.node_id == node_id)
    quizzes = list(db.scalars(statement).all())
    candidates = []
    request_terms = set(re.findall(r"[a-z0-9]+", request.lower()))
    for quiz in quizzes:
        for question in quiz.questions_data.get("questions", []):
            options = question.get("options")
            answer_index = question.get("answer_index")
            if (
                str(question.get("prompt", "")).strip()
                and isinstance(options, list)
                and len(options) == 4
                and isinstance(answer_index, int)
                and 0 <= answer_index < 4
            ):
                searchable = f"{quiz.title} {question['prompt']}".lower()
                score = sum(term in searchable for term in request_terms if len(term) > 2)
                candidates.append((score, question))
    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    question = candidates[0][1]
    return {
        "prompt": str(question["prompt"]).strip(),
        "options": [str(option).strip() for option in question["options"]],
        "answer_index": question["answer_index"],
        "explanation": str(
            question.get("explanation")
            or "That option best matches the course material."
        ),
        "citations": [
            {
                "source": str(question["source"]),
                "page": question.get("page"),
                "excerpt": str(question.get("explanation") or question["prompt"])[:300],
                "chunk_index": 0,
            }
        ] if question.get("source") else [],
        "grounded": True,
    }


@router.post("/chat", response_model=TutorChatResponse)
def chat_with_tutor(
    payload: TutorChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.mode not in ("normal", "game"):
        raise HTTPException(status_code=422, detail="mode must be 'normal' or 'game'")

    course = db.get(Course, payload.course_id)
    if not course or course.created_by_id != current_user.id:
        raise HTTPException(status_code=404, detail="Course not found")

    has_indexed_material = db.scalar(
        select(Material.id)
        .where(Material.course_id == course.id, Material.status == "completed")
        .limit(1)
    ) is not None

    try:
        if payload.mode == "game":
            result = _quiz_challenge(db, course.id, payload.node_id, payload.message)
            if result is None:
                result = generate_course_challenge(
                    question=payload.message,
                    user_id=str(current_user.id),
                    course_id=str(course.id),
                    has_indexed_material=has_indexed_material,
                )
        else:
            result = answer_course_question(
                question=payload.message,
                user_id=str(current_user.id),
                course_id=str(course.id),
                has_indexed_material=has_indexed_material,
            )
    except Exception as exc:
        # Covers missing provider configuration and transient provider errors
        # without exposing internal request or credential details to learners.
        logger.exception("Tutor generation failed for course %s", course.id)
        raise HTTPException(status_code=503, detail="The tutor service is unavailable. Check the configured LLM provider and try again.") from exc

    challenge = None
    if payload.mode == "game":
        saved_challenge = TutorChallenge(
            user_id=current_user.id,
            course_id=course.id,
            challenge_data={
                key: result[key]
                for key in ("prompt", "options", "answer_index", "explanation")
            },
        )
        db.add(saved_challenge)
        db.flush()
        challenge = {
            "id": saved_challenge.id,
            "prompt": result["prompt"],
            "options": result["options"],
        }
    else:
        record_quest_progress(db, current_user, "tutor")
    db.commit()
    db.refresh(current_user)

    return TutorChatResponse(
        response=(
            _challenge_markdown(result)
            if payload.mode == "game"
            else result.get("answer", "")
        ),
        mode=payload.mode,
        xp_earned=0,
        total_xp=current_user.xp,
        citations=result.get("citations", []),
        grounded=bool(result.get("grounded", False)),
        retrieved_chunks=len(result.get("citations", [])),
        challenge=challenge,
    )


@router.post(
    "/challenges/{challenge_id}/answer", response_model=TutorChallengeAnswerRead
)
def answer_tutor_challenge(
    challenge_id: UUID,
    payload: TutorChallengeAnswerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = db.scalar(
        select(TutorChallenge)
        .where(TutorChallenge.id == challenge_id)
        .with_for_update()
    )
    if not challenge or challenge.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Challenge not found")

    data = challenge.challenge_data
    correct_index = int(data["answer_index"])
    already_answered = challenge.answered_at is not None
    if already_answered:
        return TutorChallengeAnswerRead(
            correct=bool(challenge.is_correct),
            selected_answer_index=int(challenge.selected_answer_index),
            correct_answer_index=correct_index,
            explanation=str(data["explanation"]),
            xp_earned=0,
            total_xp=current_user.xp,
            already_answered=True,
        )

    correct = payload.answer_index == correct_index
    challenge.selected_answer_index = payload.answer_index
    challenge.is_correct = correct
    challenge.answered_at = datetime.now(timezone.utc)
    xp_earned = GAME_MODE_QUESTION_XP if correct else 0
    if xp_earned:
        current_user.xp += xp_earned
        sync_mastery_tier(current_user)
    record_quest_progress(db, current_user, "tutor")
    db.commit()
    db.refresh(current_user)
    return TutorChallengeAnswerRead(
        correct=correct,
        selected_answer_index=payload.answer_index,
        correct_answer_index=correct_index,
        explanation=str(data["explanation"]),
        xp_earned=xp_earned,
        total_xp=current_user.xp,
    )
