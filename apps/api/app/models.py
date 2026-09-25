import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import DateTime, ForeignKey, String, Text, Integer, Boolean, Float, JSON, Uuid as UUID, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class UserRole(str, Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class MasteryTier(str, Enum):
    BRONZE = "Bronze"
    SILVER = "Silver"
    GOLD = "Gold"
    PLATINUM = "Platinum"
    DIAMOND = "Diamond"


class User(Base):
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default=UserRole.STUDENT.value)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    
    # Gamification Attributes
    xp: Mapped[int] = mapped_column(Integer, default=0)
    streak_count: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    mastery_tier: Mapped[str] = mapped_column(String(50), default=MasteryTier.BRONZE.value)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    courses: Mapped[list["Course"]] = relationship(back_populates="creator", cascade="all, delete-orphan")
    quests: Mapped[list["Quest"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    achievements: Mapped[list["Achievement"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserAdventureState(Base):
    """Adventure-only currency kept separate from the legacy user table.

    A separate table lets existing prototype databases pick up the feature via
    ``create_all`` without requiring an in-place column migration.
    """

    __tablename__ = "user_adventure_states"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    gems: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )


class LevelAdventureProgress(Base):
    """Per-learner story progress layered on top of the existing level game."""

    __tablename__ = "level_adventure_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    mistakes: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    correct_answers: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    level_reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    treasure_claimed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        # SQLAlchemy emits this on fresh installs; existing installs receive the
        # whole table through create_all.
        UniqueConstraint("user_id", "node_id", name="uq_level_adventure_user_node"),
    )


class Course(Base):
    __tablename__ = "courses"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    creator: Mapped[User | None] = relationship(back_populates="courses")
    materials: Mapped[list["Material"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    knowledge_nodes: Mapped[list["KnowledgeNode"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class Material(Base):
    __tablename__ = "materials"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), default="pdf")
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending, processing, completed, failed
    ocr_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    course: Mapped[Course] = relationship(back_populates="materials")


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    world_index: Mapped[int] = mapped_column(Integer, default=1)
    level_index: Mapped[int] = mapped_column(Integer, default=1)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0 to 100.0
    is_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    course: Mapped[Course] = relationship(back_populates="knowledge_nodes")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="node", cascade="all, delete-orphan")
    quizzes: Mapped[list["Quiz"]] = relationship(back_populates="node", cascade="all, delete-orphan")


class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), default="prerequisite")  # prerequisite, related, part_of


class ResourceWorld(Base):
    __tablename__ = "resource_worlds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materials.id"), unique=True, nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    world_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LevelGame(Base):
    __tablename__ = "level_games"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id"), unique=True, nullable=False)
    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resource_worlds.id"), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(30), nullable=False)
    lesson: Mapped[str] = mapped_column(Text, nullable=False)
    questions: Mapped[list] = mapped_column(JSON, nullable=False)
    solved_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class WorldGenerationJob(Base):
    __tablename__ = "world_generation_jobs"

    material_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("materials.id"), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="queued", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[str] = mapped_column(Text, default="Queued", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorldCurriculumAudit(Base):
    __tablename__ = "world_curriculum_audits"

    world_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resource_worlds.id"), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)


class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    front: Mapped[str] = mapped_column(Text, nullable=False)
    back: Mapped[str] = mapped_column(Text, nullable=False)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # SM-2 Spaced Repetition Fields
    interval_days: Mapped[int] = mapped_column(Integer, default=1)
    repetition_count: Mapped[int] = mapped_column(Integer, default=0)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    next_review_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    node: Mapped[KnowledgeNode] = relationship(back_populates="flashcards")


class Quiz(Base):
    __tablename__ = "quizzes"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("knowledge_nodes.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")  # Easy, Medium, Hard, Boss
    questions_data: Mapped[dict] = mapped_column(JSON, nullable=False)  # JSON structure of question items
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    node: Mapped[KnowledgeNode] = relationship(back_populates="quizzes")
    attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quiz_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("quizzes.id", ondelete="CASCADE"), nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    accuracy_percentage: Mapped[float] = mapped_column(Float, nullable=False)
    xp_earned: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user: Mapped[User] = relationship(back_populates="quiz_attempts")
    quiz: Mapped[Quiz] = relationship(back_populates="attempts")


class Quest(Base):
    __tablename__ = "quests"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    xp_reward: Mapped[int] = mapped_column(Integer, default=50)
    quest_type: Mapped[str] = mapped_column(String(50), default="daily")  # daily, weekly
    target_count: Mapped[int] = mapped_column(Integer, default=1)
    current_count: Mapped[int] = mapped_column(Integer, default=0)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    user: Mapped[User] = relationship(back_populates="quests")


class Achievement(Base):
    __tablename__ = "achievements"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    badge_icon: Mapped[str] = mapped_column(String(100), default="trophy")
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    user: Mapped[User] = relationship(back_populates="achievements")
