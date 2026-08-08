from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict


# Auth & User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    avatar_url: str | None = None
    xp: int
    streak_count: int
    mastery_tier: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class TokenData(BaseModel):
    user_id: UUID | None = None
    role: str | None = None


class UserRoleUpdate(BaseModel):
    role: str


# Course & Material Schemas
class CourseCreate(BaseModel):
    title: str
    description: str | None = None


class CourseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None = None
    created_at: datetime


class MaterialCreate(BaseModel):
    filename: str
    file_type: str = "pdf"
    file_size_bytes: int = 0


class MaterialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    filename: str
    file_type: str
    file_size_bytes: int
    status: str
    ocr_applied: bool
    summary: str | None = None
    created_at: datetime


# Gamification & Analytics Schemas
class QuestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    xp_reward: int
    quest_type: str
    target_count: int
    current_count: int
    is_completed: bool
    expires_at: datetime


class AchievementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str
    badge_icon: str
    unlocked_at: datetime


class GamificationDashboardRead(BaseModel):
    xp: int
    streak_count: int
    mastery_tier: str
    total_courses: int
    completed_quizzes: int
    active_quests: list[QuestRead]
    recent_achievements: list[AchievementRead]
