import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Course, Material, User
from ...schemas import TutorChatRequest, TutorChatResponse
from ...agents.gamification_tool import GAME_MODE_QUESTION_XP
from ...rag.workflow import answer_course_question
from ...services.gamification import sync_mastery_tier
from ..deps import get_current_user

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])
logger = logging.getLogger(__name__)


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

    xp_earned = GAME_MODE_QUESTION_XP if payload.mode == "game" else 0
    if xp_earned:
        current_user.xp += xp_earned
        sync_mastery_tier(current_user)
        db.commit()
        db.refresh(current_user)

    return TutorChatResponse(
        response=result.get("answer", ""),
        mode=payload.mode,
        xp_earned=xp_earned,
        total_xp=current_user.xp,
        citations=result.get("citations", []),
        grounded=bool(result.get("grounded", False)),
        retrieved_chunks=len(result.get("citations", [])),
    )
