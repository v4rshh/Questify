from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User, Course, QuizAttempt, Quest, Achievement
from ...schemas import GamificationDashboardRead, QuestRead, AchievementRead
from ..deps import get_current_user

router = APIRouter(prefix="/gamification", tags=["Gamification & Analytics"])


@router.get("/dashboard", response_model=GamificationDashboardRead)
def get_gamification_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_courses = db.scalar(
        select(func.count(Course.id)).where(
            (Course.created_by_id == current_user.id) | (Course.created_by_id.is_(None))
        )
    ) or 0

    completed_quizzes = db.scalar(
        select(func.count(QuizAttempt.id)).where(QuizAttempt.user_id == current_user.id)
    ) or 0

    active_quests = db.scalars(
        select(Quest).where(Quest.user_id == current_user.id, Quest.is_completed == False)
    ).all()

    recent_achievements = db.scalars(
        select(Achievement)
        .where(Achievement.user_id == current_user.id)
        .order_by(Achievement.unlocked_at.desc())
        .limit(5)
    ).all()

    return GamificationDashboardRead(
        xp=current_user.xp,
        streak_count=current_user.streak_count,
        mastery_tier=current_user.mastery_tier,
        total_courses=total_courses,
        completed_quizzes=completed_quizzes,
        active_quests=[QuestRead.model_validate(q) for q in active_quests],
        recent_achievements=[AchievementRead.model_validate(a) for a in recent_achievements]
    )


@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    users = db.scalars(
        select(User)
        .where(User.is_active == True)
        .order_by(User.xp.desc())
        .limit(20)
    ).all()

    return [
        {
            "rank": idx + 1,
            "id": str(u.id),
            "full_name": u.full_name,
            "xp": u.xp,
            "streak_count": u.streak_count,
            "mastery_tier": u.mastery_tier,
            "is_current_user": u.id == current_user.id
        }
        for idx, u in enumerate(users)
    ]
