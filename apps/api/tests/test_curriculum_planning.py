import unittest
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.rag.documents import ExtractedSection
from app.services.curriculum import Plan, order_plan, source_batches, generate_curriculum, provider_retry_delay
from tests.test_resource_worlds import curriculum
from app.services.llm_client import strict_schema


def level(key, topics, prerequisites=None, difficulty=1):
    return {"key": key, "title": "Concept " + key, "description": "A focused concept lesson.",
            "difficulty": difficulty, "topic_ids": topics, "prerequisites": prerequisites or []}


class PlanningTests(unittest.TestCase):
    def test_daily_quota_wait_honors_provider_reset(self):
        error = SimpleNamespace(response=SimpleNamespace(headers={'retry-after': '1393'}))
        self.assertEqual(provider_retry_delay(error, 10), 1393)
        error.response.headers['retry-after'] = 'invalid'
        self.assertEqual(provider_retry_delay(error, 10), 10)

    def test_strict_provider_schema_requires_nested_fields_without_mutation(self):
        original = Plan.model_json_schema()
        converted = strict_schema(original)
        self.assertFalse(converted['additionalProperties'])
        nested = converted['$defs']['PlannedLevel']
        self.assertFalse(nested['additionalProperties'])
        self.assertEqual(set(nested['required']), set(nested['properties']))
        self.assertNotIn('default', nested['properties']['description'])
        self.assertIn('default', original['$defs']['PlannedLevel']['properties']['description'])

    def test_every_character_processed_including_long_page(self):
        sections = [ExtractedSection("a" * 26000, 1), ExtractedSection("b" * 8700, 2)]
        batches = source_batches(sections, size=10000)
        self.assertEqual("".join(item["text"] for batch in batches for item in batch), "a" * 26000 + "b" * 8700)
        self.assertTrue(all(sum(len(item["text"]) for item in batch) <= 10000 for batch in batches))

    def test_prerequisite_order_wins_over_model_order(self):
        plan = Plan(title="A study plan", levels=[level("advanced", ["t3"], ["core"], 3),
            level("core", ["t2"], ["basics"], 2), level("basics", ["t1"])])
        self.assertEqual([item.key for item in order_plan(plan, ["t1", "t2", "t3"])], ["basics", "core", "advanced"])

    def test_missing_duplicate_and_invented_topics_rejected(self):
        for assigned in (["t1"], ["t1", "t1", "t2"], ["t1", "t2", "fake"]):
            plan = Plan(title="A study plan", levels=[level("first", assigned)])
            with self.assertRaises(ValueError):
                order_plan(plan, ["t1", "t2"])

    def test_circular_or_unknown_prerequisites_rejected(self):
        for dependencies in (["second"], ["missing"], ["first"]):
            plan = Plan(title="A study plan", levels=[level("first", ["t1"], dependencies),
                level("second", ["t2"], ["first"])])
            with self.assertRaises(ValueError):
                order_plan(plan, ["t1", "t2"])

    def test_short_resource_does_not_require_advanced_levels(self):
        plan = Plan(title="A short resource", levels=[level("first", ["t1"])])
        self.assertEqual(len(order_plan(plan, ["t1"])), 1)

    def test_multi_level_plan_cannot_omit_all_dependencies(self):
        plan = Plan(title="A study plan", levels=[level("first", ["t1"]), level("second", ["t2"])])
        with self.assertRaisesRegex(ValueError, "prerequisites"):
            order_plan(plan, ["t1", "t2"])

    def test_staged_generation_resumes_without_repeating_provider_calls(self):
        with TemporaryDirectory() as directory:
            material = SimpleNamespace(id="resource", course_id="course", filename="lesson.txt")
            path = Path(directory) / "user" / "course" / "resource" / "lesson.txt"
            path.parent.mkdir(parents=True)
            path.write_text("Storage foundations. Replication builds on storage foundations.")
            stages = [
                {"topics": [{"title": "Storage", "summary": "Understand basic data storage and retrieval."},
                            {"title": "Replication", "summary": "Replicate stored data across multiple machines."}]},
                {"title": "Storage world", "levels": [level("replicas", ["b1t2"]), level("basics", ["b1t1"])]},
                {"levels": [{"key": "replicas", "prerequisites": ["basics"], "difficulty": 2},
                            {"key": "basics", "prerequisites": [], "difficulty": 1}]},
                *curriculum("Storage")["levels"][:2],
            ]
            with patch("app.services.curriculum.settings.upload_directory", directory), \
                 patch("app.services.curriculum.chat_completion", side_effect=[json.dumps(item) for item in stages]) as provider:
                result = generate_curriculum(material=material, user_id="user")
                resumed = generate_curriculum(material=material, user_id="user")
            self.assertEqual(provider.call_count, 5)
            self.assertEqual(result, resumed)
            self.assertEqual([item["key"] for item in result["levels"]], ["basics", "replicas"])
            self.assertEqual(result["coverage"]["assigned_topics"], 2)
            self.assertEqual(result["levels"][1]["questions"][0]["source"], "lesson.txt")


if __name__ == "__main__":
    unittest.main()
