from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Course, Flashcard, KnowledgeNode, Material, Quiz, QuizAttempt, User, ResourceWorld, LevelGame, WorldCurriculumAudit, WorldGenerationJob
from ...services.curriculum import generate_curriculum
from ...schemas import (
    WorldGenerateRequest,
    GameAnswerRequest,
    CourseAnalyticsRead,
    FlashcardRead,
    FlashcardReviewCreate,
    FlashcardReviewRead,
    KnowledgeNodeRead,
    LearningWorldRead,
    QuizAttemptRead,
    QuizRead,
    QuizSubmitCreate,
)
from ..deps import get_current_user


router = APIRouter(prefix="/learning", tags=["Learning Worlds"])


@router.post("/courses/{course_id}/world/generation", status_code=202)
def start_generation(course_id: UUID, payload: WorldGenerateRequest,
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ...services.world_jobs import enqueue, job_read
    _owned_course(db, course_id, current_user.id)
    material = db.get(Material, payload.material_id)
    if not material or material.course_id != course_id:
        raise HTTPException(404, "Resource not found")
    if material.status != "completed":
        raise HTTPException(422, "Wait for resource indexing to complete")
    job = db.get(WorldGenerationJob, material.id)
    if not job:
        job = WorldGenerationJob(material_id=material.id, user_id=current_user.id)
        db.add(job)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            job = db.get(WorldGenerationJob, material.id)
    elif job.status == "failed":
        job.status, job.message = "queued", "Resuming saved generation stages"
        db.commit()
    if job.status != "completed":
        enqueue(material.id)
    return job_read(job)


@router.get("/courses/{course_id}/materials/{material_id}/generation")
def generation_status(course_id: UUID, material_id: UUID,
                      db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from ...services.world_jobs import job_read
    _owned_course(db, course_id, current_user.id)
    material = db.get(Material, material_id)
    if not material or material.course_id != course_id:
        raise HTTPException(404, "Resource not found")
    job = db.get(WorldGenerationJob, material_id)
    return job_read(job) if job else {"status": "idle", "progress": 0, "message": "Ready to generate"}


def _owned_course(db: Session, course_id: UUID, user_id: UUID) -> Course:
    course = db.get(Course, course_id)
    if not course or course.created_by_id != user_id:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _world_title(course: Course) -> str:
    return f"{course.title} learning world"


def _world_read(db, world):
    audit = db.get(WorldCurriculumAudit, world.id)
    nodes = db.scalars(select(KnowledgeNode).join(LevelGame).where(
        LevelGame.world_id == world.id
    ).order_by(KnowledgeNode.level_index)).all()
    return LearningWorldRead(course_id=world.course_id, material_id=world.material_id,
                             title=world.title, generated=True, nodes=nodes,
                             coverage=audit.data if audit else None)


@router.get("/courses/{course_id}/world", response_model=LearningWorldRead)
def get_world(course_id: UUID, material_id: UUID | None = None,
              db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    course = _owned_course(db, course_id, current_user.id)
    query = select(ResourceWorld).where(ResourceWorld.course_id == course_id)
    if material_id:
        query = query.where(ResourceWorld.material_id == material_id)
    world = db.scalar(query.order_by(ResourceWorld.created_at.desc()))
    if world:
        return _world_read(db, world)
    return LearningWorldRead(course_id=course.id, material_id=material_id,
                             title=_world_title(course), generated=False, nodes=[])


@router.post("/courses/{course_id}/world", response_model=LearningWorldRead, status_code=201)
def generate_world(course_id: UUID, payload: WorldGenerateRequest,
                   db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return build_world(course_id, payload, db, current_user)


def build_world(course_id, payload, db, current_user, progress=None):
    _owned_course(db, course_id, current_user.id)
    material = db.get(Material, payload.material_id)
    if not material or material.course_id != course_id:
        raise HTTPException(404, "Resource not found in this workspace")
    if material.status != "completed":
        raise HTTPException(422, "Upload and index the resource before generating a world")
    world = db.scalar(select(ResourceWorld).where(ResourceWorld.material_id == material.id))
    if world:
        return _world_read(db, world)
    try:
        # Release the read transaction while the provider builds a long curriculum.
        db.commit()
        content = generate_curriculum(material=material, user_id=str(current_user.id), progress=progress)
    except ValueError as exc:
        raise HTTPException(422, "A curriculum stage could not be validated. Retry generation to resume completed stages.") from exc
    except Exception as exc:
        raise HTTPException(503, "World generation is unavailable. Please retry. No placeholder world was saved.") from exc

    world_index = (db.scalar(select(func.max(KnowledgeNode.world_index)).where(
        KnowledgeNode.course_id == course_id)) or 0) + 1
    world = ResourceWorld(material_id=material.id, course_id=course_id,
                          title=content["title"], world_index=world_index)
    db.add(world)
    try:
        db.flush()
        db.add(WorldCurriculumAudit(world_id=world.id, data={
            **content.get("coverage", {}),
            "plan": [{key: level.get(key) for key in ("key", "title", "difficulty", "prerequisites", "topic_ids")}
                     for level in content["levels"]],
        }))
        for index, level in enumerate(content["levels"], 1):
            node = KnowledgeNode(course_id=course_id, title=level["title"],
                                 description=level["description"], world_index=world_index,
                                 level_index=index, is_unlocked=index == 1, mastery_score=0)
            db.add(node)
            db.flush()
            difficulty = {1: "Beginner", 2: "Intermediate", 3: "Advanced"}[level["difficulty"]]
            db.add(LevelGame(node_id=node.id, world_id=world.id, difficulty=difficulty,
                             lesson=level["lesson"], questions=level["questions"], solved_count=0))
            for card in level["flashcards"]:
                db.add(Flashcard(node_id=node.id, front=card["front"], back=card["back"]))
            db.add(Quiz(node_id=node.id, title=(level["title"] + " practice")[:255],
                        difficulty=difficulty, questions_data={"questions": level["questions"]}))
        db.commit()
    except IntegrityError:
        db.rollback()
        world = db.scalar(select(ResourceWorld).where(ResourceWorld.material_id == material.id))
        if not world:
            raise
    return _world_read(db, world)


def _owned_game(db, node_id, user_id):
    node = db.get(KnowledgeNode, node_id)
    if not node:
        raise HTTPException(404, "Level not found")
    _owned_course(db, node.course_id, user_id)
    game = db.scalar(select(LevelGame).where(LevelGame.node_id == node_id))
    if not game:
        raise HTTPException(404, "Generate a resource world to play this level")
    if not node.is_unlocked:
        raise HTTPException(403, "Finish the previous level to unlock this game")
    return node, game


def _game_read(node, game):
    question = game.questions[game.solved_count] if game.solved_count < len(game.questions) else None
    return {
        "node_id": str(node.id), "title": node.title, "difficulty": game.difficulty,
        "lesson": game.lesson, "solved_count": game.solved_count, "total": len(game.questions),
        "points": game.solved_count * 10, "completed": question is None,
        "question": {key: question[key] for key in ("prompt", "options", "source", "page")} if question else None,
    }


@router.get("/levels/{node_id}/game")
def get_game(node_id: UUID, db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    return _game_read(*_owned_game(db, node_id, current_user.id))


@router.post("/levels/{node_id}/game/answer")
def answer_game(node_id: UUID, payload: GameAnswerRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    node, game = _owned_game(db, node_id, current_user.id)
    if payload.question_index != game.solved_count or game.solved_count >= len(game.questions):
        raise HTTPException(409, "This challenge was already answered. Reload the level to continue.")
    question = game.questions[game.solved_count]
    correct = payload.answer_index == question["answer_index"]
    if correct:
        # Compare-and-swap prevents duplicate clicks or retries from earning XP twice.
        changed = db.execute(update(LevelGame).where(
            LevelGame.id == game.id, LevelGame.solved_count == payload.question_index
        ).values(solved_count=payload.question_index + 1).execution_options(synchronize_session=False))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "This challenge was already answered. Reload the level.")
        db.execute(update(User).where(User.id == current_user.id).values(xp=User.xp + 10))
        node.mastery_score = (payload.question_index + 1) / len(game.questions) * 100
        if payload.question_index + 1 == len(game.questions):
            next_node = db.scalar(select(KnowledgeNode).join(LevelGame).where(
                LevelGame.world_id == game.world_id,
                KnowledgeNode.level_index == node.level_index + 1))
            if next_node:
                next_node.is_unlocked = True
        db.commit()
        db.refresh(game)
        db.refresh(current_user)
    return {"correct": correct, "explanation": question["explanation"],
            "correct_answer": question["options"][question["answer_index"]],
            "xp_earned": 10 if correct else 0, "total_xp": current_user.xp,
            "game": _game_read(node, game)}


@router.get("/courses/{course_id}/flashcards", response_model=list[FlashcardRead])
def list_flashcards(course_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owned_course(db, course_id, current_user.id)
    return db.scalars(
        select(Flashcard)
        .join(KnowledgeNode, Flashcard.node_id == KnowledgeNode.id)
        .where(KnowledgeNode.course_id == course_id)
        .order_by(Flashcard.next_review_date, Flashcard.created_at)
    ).all()


@router.post("/flashcards/{flashcard_id}/review", response_model=FlashcardReviewRead)
def review_flashcard(
    flashcard_id: UUID,
    payload: FlashcardReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = db.get(Flashcard, flashcard_id)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    node = db.get(KnowledgeNode, card.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Learning node not found")
    _owned_course(db, node.course_id, current_user.id)

    if payload.quality < 3:
        card.repetition_count = 0
        card.interval_days = 1
    else:
        if card.repetition_count == 0:
            card.interval_days = 1
        elif card.repetition_count == 1:
            card.interval_days = 6
        else:
            card.interval_days = max(1, round(card.interval_days * card.ease_factor))
        card.repetition_count += 1
    card.ease_factor = max(1.3, card.ease_factor + (0.1 - (5 - payload.quality) * (0.08 + (5 - payload.quality) * 0.02)))
    card.next_review_date = datetime.now(timezone.utc) + timedelta(days=card.interval_days)

    xp_earned = 5 if payload.quality >= 3 else 2
    current_user.xp += xp_earned
    if not db.scalar(select(LevelGame.id).where(LevelGame.node_id == node.id)):
        node.mastery_score = min(100.0, node.mastery_score + (4.0 if payload.quality >= 3 else 1.0))
    db.commit()
    db.refresh(card)
    db.refresh(current_user)
    return FlashcardReviewRead(card=card, xp_earned=xp_earned, total_xp=current_user.xp)


@router.get("/courses/{course_id}/quizzes", response_model=list[QuizRead])
def list_quizzes(course_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owned_course(db, course_id, current_user.id)
    return db.scalars(
        select(Quiz)
        .join(KnowledgeNode, Quiz.node_id == KnowledgeNode.id)
        .where(KnowledgeNode.course_id == course_id)
        .order_by(Quiz.created_at.desc())
    ).all()


@router.post("/quizzes/{quiz_id}/attempts", response_model=QuizAttemptRead, status_code=status.HTTP_201_CREATED)
def submit_quiz(
    quiz_id: UUID,
    payload: QuizSubmitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    node = db.get(KnowledgeNode, quiz.node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Learning node not found")
    _owned_course(db, node.course_id, current_user.id)

    questions = quiz.questions_data.get("questions", [])
    if len(payload.answers) != len(questions):
        raise HTTPException(status_code=422, detail="Submit one answer for each quiz question")
    score = sum(answer == question.get("answer_index") for answer, question in zip(payload.answers, questions))
    max_score = len(questions)
    accuracy = round((score / max_score) * 100, 2) if max_score else 0.0
    xp_earned = score * 10
    attempt = QuizAttempt(
        user_id=current_user.id,
        quiz_id=quiz.id,
        score=score,
        max_score=max_score,
        accuracy_percentage=accuracy,
        xp_earned=xp_earned,
    )
    current_user.xp += xp_earned
    has_game = db.scalar(select(LevelGame.id).where(LevelGame.node_id == node.id))
    if not has_game:
        node.mastery_score = max(node.mastery_score, accuracy)
    if accuracy >= 60 and not has_game:
        node.is_unlocked = True
        next_node = db.scalar(
            select(KnowledgeNode)
            .where(KnowledgeNode.course_id == node.course_id, KnowledgeNode.world_index == node.world_index, KnowledgeNode.level_index == node.level_index + 1)
        )
        if next_node:
            next_node.is_unlocked = True
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/courses/{course_id}/analytics", response_model=CourseAnalyticsRead)
def get_course_analytics(course_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owned_course(db, course_id, current_user.id)
    nodes = db.scalars(
        select(KnowledgeNode).where(KnowledgeNode.course_id == course_id).order_by(KnowledgeNode.level_index)
    ).all()
    total_flashcards = db.scalar(
        select(func.count(Flashcard.id)).join(KnowledgeNode).where(KnowledgeNode.course_id == course_id)
    ) or 0
    due_flashcards = db.scalar(
        select(func.count(Flashcard.id))
        .join(KnowledgeNode)
        .where(KnowledgeNode.course_id == course_id, Flashcard.next_review_date <= datetime.now(timezone.utc))
    ) or 0
    quiz_rows = db.execute(
        select(QuizAttempt.accuracy_percentage)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .join(KnowledgeNode, Quiz.node_id == KnowledgeNode.id)
        .where(KnowledgeNode.course_id == course_id, QuizAttempt.user_id == current_user.id)
    ).scalars().all()
    return CourseAnalyticsRead(
        course_id=course_id,
        total_nodes=len(nodes),
        mastered_nodes=sum(node.mastery_score >= 80 for node in nodes),
        total_flashcards=total_flashcards,
        due_flashcards=due_flashcards,
        completed_quizzes=len(quiz_rows),
        average_quiz_accuracy=round(sum(quiz_rows) / len(quiz_rows), 2) if quiz_rows else 0.0,
        node_mastery=nodes,
    )
