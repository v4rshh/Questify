"""Lazy, persistent Chroma store with mandatory learner/course filtering."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from ..config import settings
from .documents import MaterialChunk


@dataclass(frozen=True)
class RetrievedChunk:
    content: str
    source: str
    page: int | None
    chunk_index: int
    score: float


class CourseVectorStore:
    def __init__(self) -> None:
        self.client = chromadb.PersistentClient(
            path=settings.chroma_persist_directory,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.client.get_or_create_collection(
            name=settings.chroma_collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        self._embedding_model: SentenceTransformer | None = None

    @property
    def embedding_model(self) -> SentenceTransformer:
        if self._embedding_model is None:
            self._embedding_model = SentenceTransformer(settings.embedding_model)
        return self._embedding_model

    def add_material(
        self,
        *,
        chunks: list[MaterialChunk],
        user_id: str,
        course_id: str,
        material_id: str,
        filename: str,
    ) -> int:
        if not chunks:
            return 0
        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True).tolist()
        self.collection.upsert(
            ids=[f"{material_id}:{chunk.chunk_index}" for chunk in chunks],
            documents=texts,
            embeddings=embeddings,
            metadatas=[
                {
                    "user_id": user_id,
                    "course_id": course_id,
                    "material_id": material_id,
                    "source": filename,
                    "page": chunk.page if chunk.page is not None else -1,
                    "chunk_index": chunk.chunk_index,
                }
                for chunk in chunks
            ],
        )
        return len(chunks)

    def search(self, *, query: str, user_id: str, course_id: str, top_k: int | None = None) -> list[RetrievedChunk]:
        available = self.collection.count()
        if available == 0:
            return []
        query_embedding = self.embedding_model.encode(query, convert_to_numpy=True).tolist()
        result = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k or settings.rag_top_k, available),
            where={"$and": [{"user_id": {"$eq": user_id}}, {"course_id": {"$eq": course_id}}]},
            include=["documents", "metadatas", "distances"],
        )
        documents = result.get("documents") or [[]]
        metadatas = result.get("metadatas") or [[]]
        distances = result.get("distances") or [[]]
        chunks: list[RetrievedChunk] = []
        for document, metadata, distance in zip(documents[0], metadatas[0], distances[0]):
            page_value = metadata.get("page", -1)
            chunks.append(
                RetrievedChunk(
                    content=document,
                    source=str(metadata.get("source", "unknown")),
                    page=int(page_value) if int(page_value) >= 0 else None,
                    chunk_index=int(metadata.get("chunk_index", 0)),
                    score=1.0 - float(distance),
                )
            )
        return chunks

    def delete_material(self, material_id: str) -> None:
        self.collection.delete(where={"material_id": {"$eq": material_id}})


@lru_cache(maxsize=1)
def get_vector_store() -> CourseVectorStore:
    return CourseVectorStore()
