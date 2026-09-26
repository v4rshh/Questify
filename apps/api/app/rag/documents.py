"""Extract and chunk learner-owned course materials."""
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from docx import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from ..config import settings


SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".markdown"}


@dataclass(frozen=True)
class ExtractedSection:
    text: str
    page: int | None = None


@dataclass(frozen=True)
class MaterialChunk:
    text: str
    page: int | None
    chunk_index: int


def extract_sections(filename: str, content: bytes) -> list[ExtractedSection]:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Supported file types are PDF, DOCX, TXT, and Markdown")

    if extension == ".pdf":
        reader = PdfReader(BytesIO(content))
        sections = [
            ExtractedSection(text=(page.extract_text() or "").strip(), page=index + 1)
            for index, page in enumerate(reader.pages)
        ]
    elif extension == ".docx":
        document = Document(BytesIO(content))
        text = "\n\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text.strip())
        sections = [ExtractedSection(text=text)]
    else:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValueError("TXT and Markdown files must use UTF-8 encoding") from exc
        sections = [ExtractedSection(text=text)]

    sections = [section for section in sections if section.text.strip()]
    if not sections:
        raise ValueError("No extractable text was found in this document")
    return sections


def chunk_sections(sections: list[ExtractedSection]) -> list[MaterialChunk]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks: list[MaterialChunk] = []
    index = 0
    for section in sections:
        for text in splitter.split_text(section.text):
            if text.strip():
                chunks.append(MaterialChunk(text=text.strip(), page=section.page, chunk_index=index))
                index += 1
    return chunks
