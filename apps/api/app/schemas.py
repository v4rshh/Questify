from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# Auth & User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str


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


# Learning world, flashcard, and quiz schemas
class KnowledgeNodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    course_id: UUID
    title: str
    description: str | None = None
    world_index: int
    level_index: int
    mastery_score: float
    is_unlocked: bool
    created_at: datetime


class LearningWorldRead(BaseModel):
    coverage: dict | None = None
    material_id: UUID | None = None
    course_id: UUID
    title: str
    generated: bool
    nodes: list[KnowledgeNodeRead]


class WorldGenerateRequest(BaseModel):
    material_id: UUID


class GameAnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    answer_index: int = Field(ge=0, le=3)


class FlashcardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    node_id: UUID
    front: str
    back: str
    hint: str | None = None
    interval_days: int
    repetition_count: int
    ease_factor: float
    next_review_date: datetime


class FlashcardReviewCreate(BaseModel):
    quality: int = Field(ge=0, le=5, description="0 means forgotten; 5 means effortless recall")


class FlashcardReviewRead(BaseModel):
    card: FlashcardRead
    xp_earned: int
    total_xp: int


class QuizRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    node_id: UUID
    title: str
    difficulty: str
    questions_data: dict
    created_at: datetime


class QuizSubmitCreate(BaseModel):
    answers: list[int]


class QuizAttemptRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    quiz_id: UUID
    score: int
    max_score: int
    accuracy_percentage: float
    xp_earned: int
    completed_at: datetime


class CourseAnalyticsRead(BaseModel):
    course_id: UUID
    total_nodes: int
    mastered_nodes: int
    total_flashcards: int
    due_flashcards: int
    completed_quizzes: int
    average_quiz_accuracy: float
    node_mastery: list[KnowledgeNodeRead]


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


# AI Tutor Schemas
class TutorChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    mode: str = "normal"  # "normal" | "game"
    course_id: UUID
    node_id: UUID | None = None


class TutorCitation(BaseModel):
    source: str
    page: int | None = None
    excerpt: str
    chunk_index: int


class TutorChatResponse(BaseModel):
    response: str
    mode: str
    xp_earned: int = 0
    total_xp: int
    citations: list[TutorCitation] = Field(default_factory=list)
    grounded: bool
    retrieved_chunks: int = 0


class GamificationDashboardRead(BaseModel):
    xp: int
    streak_count: int
    mastery_tier: str
    total_courses: int
    completed_quizzes: int
    active_quests: list[QuestRead]
    recent_achievements: list[AchievementRead]
