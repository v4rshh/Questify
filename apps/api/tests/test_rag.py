from app.rag.documents import chunk_sections, extract_sections
from app.rag.store import CourseVectorStore
from app.rag.workflow import _generate


class _FakeEmbeddingModel:
    def encode(self, value, convert_to_numpy=True):
        class _Vector:
            def tolist(self):
                return [0.1, 0.2, 0.3]

        return _Vector()


class _FakeCollection:
    def __init__(self):
        self.where = None

    def count(self):
        return 3

    def query(self, **kwargs):
        self.where = kwargs["where"]
        return {
            "documents": [["owner-only content"]],
            "metadatas": [[{"source": "lesson.md", "page": -1, "chunk_index": 0}]],
            "distances": [[0.1]],
        }


def test_markdown_extraction_and_chunking():
    sections = extract_sections("lesson.md", b"# Scheduling\n\nA scheduler selects the next process.")
    chunks = chunk_sections(sections)
    assert chunks
    assert "scheduler" in chunks[0].text
    assert chunks[0].page is None


def test_search_always_filters_by_user_and_course():
    store = object.__new__(CourseVectorStore)
    store.collection = _FakeCollection()
    store._embedding_model = _FakeEmbeddingModel()

    chunks = store.search(query="scheduler", user_id="learner-a", course_id="course-b")

    assert len(chunks) == 1
    assert store.collection.where == {
        "$and": [
            {"user_id": {"$eq": "learner-a"}},
            {"course_id": {"$eq": "course-b"}},
        ]
    }


def test_indexed_course_does_not_fall_back_to_general_answer_without_sources():
    result = _generate({"has_indexed_material": True, "relevant_chunks": []})

    assert result["grounded"] is False
    assert result["citations"] == []
    assert "indexed resources" in result["answer"]
