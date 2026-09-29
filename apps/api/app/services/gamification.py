from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import MasteryTier, Quest, User


GAME_MODE_QUESTION_XP = 5


MASTERY_THRESHOLDS: tuple[tuple[int, str], ...] = (
    (3000, MasteryTier.DIAMOND.value),
    (1500, MasteryTier.PLATINUM.value),
    (750, MasteryTier.GOLD.value),
    (250, MasteryTier.SILVER.value),
    (0, MasteryTier.BRONZE.value),
)


def mastery_tier_for_xp(xp: int) -> str:
    """Return the visible mastery tier for a learner's lifetime XP."""
    return next(tier for minimum, tier in MASTERY_THRESHOLDS if xp >= minimum)


def sync_mastery_tier(user: User) -> None:
    user.mastery_tier = mastery_tier_for_xp(user.xp)


DAILY_QUESTS: tuple[dict[str, object], ...] = (
    {
        "quest_type": "flashcard",
        "title": "Recall Ritual",
        "description": "Review five flashcards",
        "target_count": 5,
        "xp_reward": 35,
    },
    {
        "quest_type": "quiz",
        "title": "Knowledge Check",
        "description": "Complete one quiz session",
        "target_count": 1,
        "xp_reward": 45,
    },
    {
        "quest_type": "level",
        "title": "Trailblazer",
        "description": "Finish one learning-world level",
        "target_count": 1,
        "xp_reward": 50,
    },
    {
        "quest_type": "tutor",
        "title": "Ask the Wizard",
        "description": "Ask the tutor one study question",
        "target_count": 1,
        "xp_reward": 25,
    },
    {
        "quest_type": "streak",
        "title": "Streak Keeper",
        "description": "Build a three-day study streak",
        "target_count": 3,
        "xp_reward": 60,
    },
)


def ensure_daily_quests(db: Session, user: User) -> list[Quest]:
    """Ensure that each learner has the current set of daily objectives."""
    now = datetime.now(timezone.utc)
    current_quests = list(
        db.scalars(
            select(Quest).where(
                Quest.user_id == user.id,
                Quest.expires_at > now,
            )
        ).all()
    )
    active = [quest for quest in current_quests if not quest.is_completed]
    existing_types = {quest.quest_type for quest in current_quests}
    expires_at = now + timedelta(days=1)

    for template in DAILY_QUESTS:
        quest_type = str(template["quest_type"])
        if quest_type in existing_types:
            continue
        current_count = min(user.streak_count, 3) if quest_type == "streak" else 0
        quest = Quest(
            user_id=user.id,
            title=str(template["title"]),
            description=str(template["description"]),
            xp_reward=int(template["xp_reward"]),
            quest_type=quest_type,
            target_count=int(template["target_count"]),
            current_count=current_count,
            expires_at=expires_at,
        )
        db.add(quest)
        active.append(quest)

    return active


def record_quest_progress(
    db: Session, user: User, event_type: str, amount: int = 1
) -> None:
    """Apply one study event to matching active quests without over-counting."""
    now = datetime.now(timezone.utc)
    if user.last_active_date:
        elapsed_days = (now.date() - user.last_active_date.date()).days
        if elapsed_days == 1:
            user.streak_count += 1
        elif elapsed_days > 1:
            user.streak_count = 1
        if elapsed_days > 0:
            user.last_active_date = now
    else:
        user.streak_count = 1
        user.last_active_date = now

    quests = ensure_daily_quests(db, user)
    for quest in quests:
        if quest.quest_type == "streak":
            quest.current_count = min(quest.target_count, user.streak_count)
        elif quest.quest_type == event_type or (
            quest.quest_type == "daily" and event_type in {"material", "quiz"}
        ):
            quest.current_count = min(
                quest.target_count, quest.current_count + max(0, amount)
            )
