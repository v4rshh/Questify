"""Resource isolation and game scoring regressions; no network or user DB writes."""
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session

from app.database import Base
from app.models import User, Course, Material, ResourceWorld, LevelGame, Flashcard
from app.api.v1.learning import generate_world, get_game, answer_game, start_generation, generation_status
from app.models import WorldGenerationJob
from app.schemas import WorldGenerateRequest, GameAnswerRequest
from app.services.curriculum import Curriculum


def curriculum(title):
    return {"title": title, "levels": [
        {"title": f"{title} concept {index}", "description": "Learn this concept with simple examples.",
         "difficulty": difficulty, "lesson": "A clear source-grounded lesson explains this concept before the learner plays.",
         "flashcards": [{"front": "What is this concept?", "back": "The source explains this concept."}] * 2,
         "questions": [{"prompt": "Which option explains the concept?", "options": ["Correct", "Other", "Third", "Fourth"],
                        "answer_index": 0, "explanation": "The first choice matches the definition in the resource.",
                        "source_excerpt": 1, "source": title + ".pdf", "page": 1}] * 3}
        for index, difficulty in enumerate([1, 1, 2, 3], 1)]}


class WorldTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.user = User(email="world-test@example.com", hashed_password="unused", full_name="Test", xp=0)
        self.other = User(email="other-test@example.com", hashed_password="unused", full_name="Other", xp=0)
        self.db.add_all([self.user, self.other]); self.db.flush()
        self.course = Course(title="Old AI workspace", created_by_id=self.user.id)
        self.db.add(self.course); self.db.flush()
        self.ai = Material(course_id=self.course.id, filename="AI.pdf", status="completed")
        self.design = Material(course_id=self.course.id, filename="System Design.pdf", status="completed")
        self.db.add_all([self.ai, self.design]); self.db.commit()

    def tearDown(self):
        self.db.close(); self.engine.dispose()

    def generate(self, material):
        with patch("app.api.v1.learning.generate_curriculum", return_value=curriculum(material.filename)):
            return generate_world(self.course.id, WorldGenerateRequest(material_id=material.id), self.db, self.user)

    def test_each_resource_has_distinct_idempotent_world(self):
        ai = self.generate(self.ai)
        design = self.generate(self.design)
        again = self.generate(self.design)
        self.assertNotEqual(ai.title, design.title)
        self.assertTrue(set(node.id for node in ai.nodes).isdisjoint(node.id for node in design.nodes))
        self.assertEqual([node.id for node in design.nodes], [node.id for node in again.nodes])
        self.assertEqual(self.db.scalar(select(func.count(ResourceWorld.id))), 2)
        self.assertEqual(self.db.scalar(select(func.count(Flashcard.id))), 16)

    def test_wrong_answer_retry_unlock_and_duplicate_points(self):
        world = self.generate(self.design)
        first, second = world.nodes[:2]
        with self.assertRaises(HTTPException) as locked:
            get_game(second.id, self.db, self.user)
        self.assertEqual(locked.exception.status_code, 403)
        game = get_game(first.id, self.db, self.user)
        self.assertNotIn("answer_index", game["question"])
        wrong = answer_game(first.id, GameAnswerRequest(question_index=0, answer_index=1), self.db, self.user)
        self.assertFalse(wrong["correct"])
        self.assertEqual(wrong["game"]["solved_count"], 0)
        self.assertEqual(wrong["xp_earned"], 0)
        self.assertTrue(wrong["explanation"])
        for index in range(3):
            result = answer_game(first.id, GameAnswerRequest(question_index=index, answer_index=0), self.db, self.user)
            self.assertEqual(result["xp_earned"], 10)
        self.assertTrue(result["game"]["completed"])
        self.assertEqual(self.user.xp, 30)
        with self.assertRaises(HTTPException) as replay:
            answer_game(first.id, GameAnswerRequest(question_index=2, answer_index=0), self.db, self.user)
        self.assertEqual(replay.exception.status_code, 409)
        self.assertEqual(self.user.xp, 30)
        self.assertEqual(get_game(second.id, self.db, self.user)["solved_count"], 0)
        self.db.expire_all()
        self.assertTrue(get_game(first.id, self.db, self.user)["completed"])

    def test_ownership_and_failed_generation(self):
        world = self.generate(self.ai)
        with self.assertRaises(HTTPException) as denied:
            get_game(world.nodes[0].id, self.db, self.other)
        self.assertEqual(denied.exception.status_code, 404)
        with patch("app.api.v1.learning.generate_curriculum", side_effect=ValueError("invalid output")):
            with self.assertRaises(HTTPException):
                generate_world(self.course.id, WorldGenerateRequest(material_id=self.design.id), self.db, self.user)
        self.assertEqual(self.db.scalar(select(func.count(ResourceWorld.id))), 1)

    def test_curriculum_validation(self):
        data = curriculum("System design")
        Curriculum.model_validate(data)
        data["levels"][0]["difficulty"] = 3
        with self.assertRaises(ValueError):
            Curriculum.model_validate(data)

    def test_generation_job_status_and_resume(self):
        with patch('app.services.world_jobs.enqueue') as enqueue:
            status = start_generation(self.course.id, WorldGenerateRequest(material_id=self.design.id), self.db, self.user)
            self.assertEqual(status['status'], 'queued')
            enqueue.assert_called_once_with(self.design.id)
            job = self.db.get(WorldGenerationJob, self.design.id)
            job.status, job.progress = 'failed', 55
            self.db.commit()
            status = start_generation(self.course.id, WorldGenerateRequest(material_id=self.design.id), self.db, self.user)
            self.assertEqual(status['status'], 'queued')
            self.assertEqual(status['progress'], 55)
            self.assertEqual(generation_status(self.course.id, self.design.id, self.db, self.user)['status'], 'queued')
            self.assertEqual(self.db.scalar(select(func.count(WorldGenerationJob.material_id))), 1)
        with self.assertRaises(HTTPException) as denied:
            generation_status(self.course.id, self.design.id, self.db, self.other)
        self.assertEqual(denied.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
