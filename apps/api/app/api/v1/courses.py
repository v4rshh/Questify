import re
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...config import settings
from ...database import get_db
from ...models import Course, Material, User
from ...rag.documents import SUPPORTED_EXTENSIONS, chunk_sections, extract_sections
from ...rag.store import get_vector_store
from ...schemas import CourseCreate, CourseRead, MaterialCreate, MaterialRead
from ..deps import get_current_user

router = APIRouter(prefix="/courses", tags=["Courses & Materials"])


def _owned_course(db: Session, course_id: UUID, user_id: UUID) -> Course:
    course = db.get(Course, course_id)
    if not course or course.created_by_id != user_id:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _safe_filename(filename: str | None) -> str:
    name = (filename or "document").replace("\\", "/").split("/")[-1]
    return re.sub(r"[^A-Za-z0-9._ -]", "_", name)[:240] or "document"


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    course = Course(title=payload.title, description=payload.description, created_by_id=current_user.id)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("", response_model=list[CourseRead])
def list_courses(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.scalars(
        select(Course).where(Course.created_by_id == current_user.id).order_by(Course.created_at.desc())
    ).all()


@router.get("/{course_id}", response_model=CourseRead)
def get_course(course_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _owned_course(db, course_id, current_user.id)


@router.post("/{course_id}/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
def create_material_metadata(
    course_id: UUID,
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Legacy metadata-only endpoint; use /materials/upload for RAG ingestion."""
    _owned_course(db, course_id, current_user.id)
    material = Material(
        course_id=course_id,
        filename=payload.filename,
        file_type=payload.file_type,
        file_size_bytes=payload.file_size_bytes,
        status="pending",
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.post("/{course_id}/materials/upload", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
async def upload_material(
    course_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_course(db, course_id, current_user.id)
    filename = _safe_filename(file.filename)
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Supported file types are PDF, DOCX, TXT, and Markdown")

    content = await file.read(settings.max_upload_size_mb * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    if len(content) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds the {settings.max_upload_size_mb} MB limit")

    material = Material(
        course_id=course_id,
        filename=filename,
        file_type=extension.lstrip("."),
        file_size_bytes=len(content),
        status="processing",
    )
    db.add(material)
    db.commit()
    db.refresh(material)

    upload_path = Path(settings.upload_directory) / str(current_user.id) / str(course_id) / str(material.id) / filename
    try:
        sections = extract_sections(filename, content)
        chunks = chunk_sections(sections)
        upload_path.parent.mkdir(parents=True, exist_ok=True)
        upload_path.write_bytes(content)
        chunks_created = get_vector_store().add_material(
            chunks=chunks,
            user_id=str(current_user.id),
            course_id=str(course_id),
            material_id=str(material.id),
            filename=filename,
        )
        if chunks_created == 0:
            raise ValueError("No searchable chunks were created")
        material.status = "completed"
        material.summary = f"Indexed {chunks_created} searchable chunks"
        db.commit()
        db.refresh(material)
        return material
    except ValueError as exc:
        material.status = "failed"
        material.summary = str(exc)
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        material.status = "failed"
        material.summary = "Document processing failed"
        db.commit()
        raise HTTPException(status_code=500, detail="Document processing failed") from exc


@router.get("/{course_id}/materials", response_model=list[MaterialRead])
def list_materials(course_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _owned_course(db, course_id, current_user.id)
    return db.scalars(
        select(Material).where(Material.course_id == course_id).order_by(Material.created_at.desc())
    ).all()
