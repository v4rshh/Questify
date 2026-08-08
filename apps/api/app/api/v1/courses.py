from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import Course, Material, User
from ...schemas import CourseCreate, CourseRead, MaterialCreate, MaterialRead
from ..deps import get_current_user

router = APIRouter(prefix="/courses", tags=["Courses & Materials"])


@router.post("", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = Course(
        title=payload.title,
        description=payload.description,
        created_by_id=current_user.id
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.get("", response_model=list[CourseRead])
def list_courses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.scalars(
        select(Course)
        .where((Course.created_by_id == current_user.id) | (Course.created_by_id.is_(None)))
        .order_by(Course.created_at.desc())
    ).all()


@router.get("/{course_id}", response_model=CourseRead)
def get_course(
    course_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/{course_id}/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
def create_material(
    course_id: UUID,
    payload: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    material = Material(
        course_id=course_id,
        filename=payload.filename,
        file_type=payload.file_type,
        file_size_bytes=payload.file_size_bytes,
        status="pending"
    )
    db.add(material)
    db.commit()
    db.refresh(material)
    return material


@router.get("/{course_id}/materials", response_model=list[MaterialRead])
def list_materials(
    course_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.scalars(
        select(Material)
        .where(Material.course_id == course_id)
        .order_by(Material.created_at.desc())
    ).all()
