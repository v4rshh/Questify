from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User, Course, KnowledgeNode, QuizAttempt, Quest, Achievement, UserAdventureState
from ...schemas import (AchievementRead, GamificationDashboardRead, LearnerProfileRead,
                        ProfileBadgeRead, ProfileTopicRead, QuestRead)
from ...services.gamification import mastery_tier_for_xp
from ..deps import get_current_user

router = APIRouter(prefix="/gamification", tags=["Gamification & Analytics"])

TIER_PATH = (("Bronze", 0), ("Silver", 250), ("Gold", 750),
             ("Platinum", 1500), ("Diamond", 3000))


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

    adventure = db.get(UserAdventureState, current_user.id)
    changed = False
    if not adventure:
        adventure = UserAdventureState(user_id=current_user.id, gems=20)
        db.add(adventure)
        changed = True
    expected_tier = mastery_tier_for_xp(current_user.xp)
    if current_user.mastery_tier != expected_tier:
        current_user.mastery_tier = expected_tier
        changed = True
    if changed:
        db.commit()
        db.refresh(adventure)
    return GamificationDashboardRead(
        xp=current_user.xp,
        gems=adventure.gems if adventure else 0,
        streak_count=current_user.streak_count,
        mastery_tier=current_user.mastery_tier,
        total_courses=total_courses,
        completed_quizzes=completed_quizzes,
        active_quests=[QuestRead.model_validate(q) for q in active_quests],
        recent_achievements=[AchievementRead.model_validate(a) for a in recent_achievements]
    )


@router.get("/profile", response_model=LearnerProfileRead)
def get_learner_profile(db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    adventure = db.get(UserAdventureState, current_user.id)
    if not adventure:
        adventure = UserAdventureState(user_id=current_user.id, gems=20)
        db.add(adventure)

    expected_tier = mastery_tier_for_xp(current_user.xp)
    if current_user.mastery_tier != expected_tier:
        current_user.mastery_tier = expected_tier
    db.commit()

    topics = db.scalars(
        select(KnowledgeNode).join(Course).where(Course.created_by_id == current_user.id)
        .order_by(KnowledgeNode.mastery_score.desc(), KnowledgeNode.world_index, KnowledgeNode.level_index)
    ).all()
    total_courses = db.scalar(select(func.count(Course.id)).where(Course.created_by_id == current_user.id)) or 0
    completed_quizzes = db.scalar(select(func.count(QuizAttempt.id)).where(QuizAttempt.user_id == current_user.id)) or 0
    achievements = db.scalars(select(Achievement).where(Achievement.user_id == current_user.id).order_by(Achievement.unlocked_at.desc())).all()
    total_learners = db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 1
    rank = (db.scalar(select(func.count(User.id)).where(User.is_active.is_(True), User.xp > current_user.xp)) or 0) + 1

    current_index = next((index for index, (tier, _) in enumerate(TIER_PATH) if tier == expected_tier), 0)
    current_floor = TIER_PATH[current_index][1]
    next_entry = TIER_PATH[current_index + 1] if current_index + 1 < len(TIER_PATH) else None
    if next_entry:
        tier_progress = round(max(0, min(100, (current_user.xp - current_floor) / (next_entry[1] - current_floor) * 100)), 1)
    else:
        tier_progress = 100.0

    mastered = sum(topic.mastery_score >= 80 for topic in topics)
    badges = [
        ProfileBadgeRead(title="World Builder", description="Created a study workspace", icon="world", earned=total_courses > 0),
        ProfileBadgeRead(title="Knowledge Seeker", description="Completed a quiz attempt", icon="target", earned=completed_quizzes > 0),
        ProfileBadgeRead(title="Gem Keeper", description="Collected at least 25 gems", icon="gem", earned=adventure.gems >= 25),
        ProfileBadgeRead(title="Master Scholar", description="Mastered at least five topics", icon="crown", earned=mastered >= 5),
        ProfileBadgeRead(title="Streak Keeper", description="Maintained a three-day streak", icon="flame", earned=current_user.streak_count >= 3),
    ]
    return LearnerProfileRead(
        username=current_user.full_name, email=current_user.email, member_since=current_user.created_at,
        xp=current_user.xp, gems=adventure.gems, mastery_tier=expected_tier,
        next_tier=next_entry[0] if next_entry else None,
        next_tier_xp=next_entry[1] if next_entry else None,
        tier_progress_percentage=tier_progress, rank=rank, total_learners=total_learners,
        streak_count=current_user.streak_count, total_courses=total_courses,
        completed_quizzes=completed_quizzes, mastered_topics=mastered, total_topics=len(topics),
        topics=[ProfileTopicRead.model_validate(topic, from_attributes=True) for topic in topics],
        badges=badges,
        achievements=[AchievementRead.model_validate(item) for item in achievements],
    )
