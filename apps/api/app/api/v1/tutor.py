from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Course, User
from ...schemas import TutorChatRequest, TutorChatResponse
from ...agents.gamification_tool import GAME_MODE_QUESTION_XP
from ...rag.workflow import answer_course_question
from ..deps import get_current_user

router = APIRouter(prefix="/tutor", tags=["AI Tutor"])


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

    try:
        result = answer_course_question(
            question=payload.message,
            user_id=str(current_user.id),
            course_id=str(course.id),
        )
    except RuntimeError as exc:
        # Raised by llm_client when LLM_API_KEY isn't configured.
        raise HTTPException(status_code=503, detail=str(exc))

    xp_earned = GAME_MODE_QUESTION_XP if payload.mode == "game" else 0
    if xp_earned:
        current_user.xp += xp_earned
        db.commit()
        db.refresh(current_user)

    return TutorChatResponse(
        response=result.get("answer", ""),
        mode=payload.mode,
        xp_earned=xp_earned,
        total_xp=current_user.xp,
        citations=result.get("citations", []),
    )
