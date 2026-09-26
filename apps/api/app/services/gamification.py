from __future__ import annotations

from ..models import MasteryTier, User


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
