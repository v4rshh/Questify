from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import (Course, Flashcard, KnowledgeEdge, KnowledgeNode, Material, Quiz, QuizAttempt,
                       User, ResourceWorld, LevelGame, WorldCurriculumAudit,
                       WorldGenerationJob, UserAdventureState, LevelAdventureProgress)
from ...services.curriculum import generate_curriculum
from ...schemas import (
    WorldGenerateRequest,
    GameAnswerRequest,
    WizardHelpRequest,
    WorldRetryRequest,
    CourseAnalyticsRead,
    FlashcardRead,
    FlashcardReviewCreate,
    FlashcardReviewRead,
    KnowledgeNodeRead,
    LearningWorldRead,
    QuizAttemptRead,
    QuizRead,
    QuizSessionAttemptRead,
    QuizSessionSubmitCreate,
    QuizSubmitCreate,
)
from ..deps import get_current_user
from ...services.gamification import mastery_tier_for_xp, sync_mastery_tier


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


@router.delete("/courses/{course_id}/world")
def delete_world(course_id: UUID, material_id: UUID,
                 db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete one generated world while preserving its uploaded source."""
    _owned_course(db, course_id, current_user.id)
    world = db.scalar(select(ResourceWorld).where(
        ResourceWorld.course_id == course_id,
        ResourceWorld.material_id == material_id,
    ))
    if not world:
        raise HTTPException(404, "Learning world not found")

    node_ids = list(db.scalars(select(LevelGame.node_id).where(LevelGame.world_id == world.id)).all())
    if node_ids:
        db.execute(delete(LevelAdventureProgress).where(LevelAdventureProgress.node_id.in_(node_ids)))
        db.execute(delete(KnowledgeEdge).where(or_(
            KnowledgeEdge.source_node_id.in_(node_ids),
            KnowledgeEdge.target_node_id.in_(node_ids),
        )))
    db.execute(delete(LevelGame).where(LevelGame.world_id == world.id))
    db.execute(delete(WorldCurriculumAudit).where(WorldCurriculumAudit.world_id == world.id))
    # ORM deletion is used here so quiz attempts and flashcards follow their
    # configured delete-orphan cascades.
    for node in db.scalars(select(KnowledgeNode).where(KnowledgeNode.id.in_(node_ids))).all():
        db.delete(node)
    db.delete(world)
    job = db.get(WorldGenerationJob, material_id)
    if job:
        db.delete(job)
    db.commit()
    return {"deleted": True, "material_id": str(material_id)}


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


def _adventure_progress(db, user_id, node_id, create=False):
    progress = db.scalar(select(LevelAdventureProgress).where(
        LevelAdventureProgress.user_id == user_id,
        LevelAdventureProgress.node_id == node_id,
    ))
    if not progress and create:
        progress = LevelAdventureProgress(user_id=user_id, node_id=node_id)
        db.add(progress)
        db.flush()
    return progress


def _game_read(node, game, progress=None):
    question = game.questions[game.solved_count] if game.solved_count < len(game.questions) else None
    return {
        "node_id": str(node.id), "title": node.title, "difficulty": game.difficulty,
        "lesson": game.lesson, "solved_count": game.solved_count, "total": len(game.questions),
        "points": game.solved_count * 10, "completed": question is None,
        # Hints are intentionally omitted here. They are purchased from the
        # Wizard endpoint so simply opening a level never leaks paid help.
        "question": {key: question.get(key) for key in ("prompt", "options", "source", "page")} if question else None,
        "adventure": {
            "mistakes": progress.mistakes if progress else [],
            "correct_answers": progress.correct_answers if progress else [],
            "level_reward_claimed": progress.level_reward_claimed if progress else False,
            "treasure_claimed": progress.treasure_claimed if progress else False,
        },
    }


@router.get("/levels/{node_id}/game")
def get_game(node_id: UUID, db: Session = Depends(get_db),
             current_user: User = Depends(get_current_user)):
    node, game = _owned_game(db, node_id, current_user.id)
    return _game_read(node, game, _adventure_progress(db, current_user.id, node_id))


@router.post("/levels/{node_id}/game/answer")
def answer_game(node_id: UUID, payload: GameAnswerRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    node, game = _owned_game(db, node_id, current_user.id)
    if payload.question_index != game.solved_count or game.solved_count >= len(game.questions):
        raise HTTPException(409, "This challenge was already answered. Reload the level to continue.")
    question = game.questions[game.solved_count]
    correct = payload.answer_index == question["answer_index"]
    progress = _adventure_progress(db, current_user.id, node_id, create=True)
    answer_record = {
        "question": question["prompt"],
        "answer": question["options"][payload.answer_index],
        "correct_answer": question["options"][question["answer_index"]],
        "concept": node.title,
    }
    if correct:
        # Compare-and-swap prevents duplicate clicks or retries from earning XP twice.
        changed = db.execute(update(LevelGame).where(
            LevelGame.id == game.id, LevelGame.solved_count == payload.question_index
        ).values(solved_count=payload.question_index + 1).execution_options(synchronize_session=False))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "This challenge was already answered. Reload the level.")
        new_xp = current_user.xp + 10
        db.execute(update(User).where(User.id == current_user.id).values(
            xp=new_xp, mastery_tier=mastery_tier_for_xp(new_xp)
        ))
        progress.correct_answers = [*progress.correct_answers, answer_record]
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
    else:
        progress.mistakes = [*progress.mistakes, answer_record]
        db.commit()
    return {"correct": correct, "explanation": question["explanation"],
            "correct_answer": question["options"][question["answer_index"]],
            "xp_earned": 10 if correct else 0, "total_xp": current_user.xp,
            "game": _game_read(node, game, progress)}


def _adventure_state(db, user_id):
    state = db.get(UserAdventureState, user_id)
    if not state:
        state = UserAdventureState(user_id=user_id, gems=20)
        db.add(state)
        db.flush()
    return state


@router.post("/levels/{node_id}/wizard-help")
def wizard_help(node_id: UUID, payload: WizardHelpRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    node, game = _owned_game(db, node_id, current_user.id)
    cost = 2 if payload.mode == "hint" else 5
    state = _adventure_state(db, current_user.id)
    # A guarded update prevents rapid double clicks from taking the balance
    # below zero, including when two requests arrive at nearly the same time.
    charged = db.execute(update(UserAdventureState).where(
        UserAdventureState.user_id == current_user.id,
        UserAdventureState.gems >= cost,
    ).values(gems=UserAdventureState.gems - cost).execution_options(synchronize_session=False))
    if charged.rowcount != 1:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail=f"You need {cost} gems for this Wizard help. Complete levels and open treasures to earn more.")

    if payload.mode == "concept":
        content = game.lesson
        title = f"Full concept: {node.title}"
    else:
        index = game.solved_count if payload.question_index is None else payload.question_index
        if index != game.solved_count or index >= len(game.questions):
            db.rollback()
            raise HTTPException(409, "That question is no longer active. Reload the level before asking for a hint.")
        question = game.questions[index]
        content = question.get("hint") or f"Focus on the central rule behind {node.title}, then eliminate options that contradict it."
        title = "Wizard hint"

    db.commit()
    db.refresh(state)
    return {"mode": payload.mode, "title": title, "content": content,
            "cost": cost, "remaining_gems": state.gems}


@router.post("/levels/{node_id}/reward")
def claim_level_reward(node_id: UUID, db: Session = Depends(get_db),
                       current_user: User = Depends(get_current_user)):
    node, game = _owned_game(db, node_id, current_user.id)
    if game.solved_count < len(game.questions):
        raise HTTPException(409, "Finish every question before claiming this milestone")
    progress = _adventure_progress(db, current_user.id, node_id, create=True)
    state = _adventure_state(db, current_user.id)
    xp_gained = gems_gained = 0
    claimed = db.execute(update(LevelAdventureProgress).where(
        LevelAdventureProgress.id == progress.id,
        LevelAdventureProgress.level_reward_claimed.is_(False),
    ).values(level_reward_claimed=True).execution_options(synchronize_session=False))
    if claimed.rowcount == 1:
        current_user.xp += 25
        sync_mastery_tier(current_user)
        state.gems += 10
        xp_gained, gems_gained = 25, 10
        db.commit()
    return {"xp_gained": xp_gained, "gems_gained": gems_gained,
            "total_xp": current_user.xp, "total_gems": state.gems,
            "claimed": True}


@router.post("/levels/{node_id}/treasure")
def claim_treasure(node_id: UUID, db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    node, _ = _owned_game(db, node_id, current_user.id)
    progress = _adventure_progress(db, current_user.id, node_id, create=True)
    state = _adventure_state(db, current_user.id)
    xp_gained = gems_gained = 0
    claimed = db.execute(update(LevelAdventureProgress).where(
        LevelAdventureProgress.id == progress.id,
        LevelAdventureProgress.treasure_claimed.is_(False),
    ).values(treasure_claimed=True).execution_options(synchronize_session=False))
    if claimed.rowcount == 1:
        current_user.xp += 15
        sync_mastery_tier(current_user)
        state.gems += 5
        xp_gained, gems_gained = 15, 5
        db.commit()
    return {"xp_gained": xp_gained, "gems_gained": gems_gained,
            "total_xp": current_user.xp, "total_gems": state.gems,
            "claimed": True}


@router.post("/world/retry")
def retry_world(payload: WorldRetryRequest, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    nodes = [db.get(KnowledgeNode, node_id) for node_id in payload.node_ids]
    if any(node is None for node in nodes):
        raise HTTPException(404, "One or more levels were not found")
    for node in nodes:
        _owned_course(db, node.course_id, current_user.id)
    for index, node in enumerate(nodes):
        game = db.scalar(select(LevelGame).where(LevelGame.node_id == node.id))
        if game:
            game.solved_count = 0
        node.mastery_score = 0
        node.is_unlocked = index == 0
        progress = _adventure_progress(db, current_user.id, node.id)
        if progress:
            progress.mistakes = []
            progress.correct_answers = []
            # Claimed rewards remain claimed so retrying cannot mint currency.
    db.commit()
    return {"reset": len(nodes), "first_node_id": str(nodes[0].id)}


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
    sync_mastery_tier(current_user)
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
        .order_by(KnowledgeNode.world_index, KnowledgeNode.level_index)
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
    sync_mastery_tier(current_user)
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


@router.post("/quizzes/session", response_model=QuizSessionAttemptRead, status_code=status.HTTP_201_CREATED)
def submit_quiz_session(
    payload: QuizSessionSubmitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Score a level, mixed, or all-question practice session atomically."""
    keys = [(item.quiz_id, item.question_index) for item in payload.answers]
    if len(keys) != len(set(keys)):
        raise HTTPException(422, "Each quiz question can only appear once in a practice session")

    grouped: dict[UUID, list] = {}
    nodes: dict[UUID, KnowledgeNode] = {}
    quizzes: dict[UUID, Quiz] = {}
    total_score = 0
    for item in payload.answers:
        quiz = quizzes.get(item.quiz_id) or db.get(Quiz, item.quiz_id)
        if not quiz:
            raise HTTPException(404, "One of the selected quizzes was not found")
        quizzes[quiz.id] = quiz
        node = nodes.get(quiz.node_id) or db.get(KnowledgeNode, quiz.node_id)
        if not node:
            raise HTTPException(404, "A learning node for this session was not found")
        nodes[node.id] = node
        _owned_course(db, node.course_id, current_user.id)
        questions = quiz.questions_data.get("questions", [])
        if item.question_index >= len(questions):
            raise HTTPException(422, "A selected question is no longer available")
        question = questions[item.question_index]
        is_correct = item.answer_index == question.get("answer_index")
        total_score += int(is_correct)
        grouped.setdefault(quiz.id, []).append((item, is_correct))

    for quiz_id, rows in grouped.items():
        quiz = quizzes[quiz_id]
        node = nodes[quiz.node_id]
        score = sum(int(correct) for _, correct in rows)
        maximum = len(rows)
        accuracy = round(score / maximum * 100, 2)
        db.add(QuizAttempt(
            user_id=current_user.id, quiz_id=quiz.id, score=score,
            max_score=maximum, accuracy_percentage=accuracy, xp_earned=score * 10,
        ))
        has_game = db.scalar(select(LevelGame.id).where(LevelGame.node_id == node.id))
        if not has_game:
            node.mastery_score = max(node.mastery_score, accuracy)
            if accuracy >= 60:
                node.is_unlocked = True

    maximum = len(payload.answers)
    xp_earned = total_score * 10
    current_user.xp += xp_earned
    sync_mastery_tier(current_user)
    db.commit()
    return QuizSessionAttemptRead(
        score=total_score,
        max_score=maximum,
        accuracy_percentage=round(total_score / maximum * 100, 2),
        xp_earned=xp_earned,
        total_xp=current_user.xp,
        attempts_created=len(grouped),
    )


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
