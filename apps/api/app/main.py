from contextlib import asynccontextmanager
from uuid import UUID
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from .models import Course, Material
from .schemas import CourseCreate, CourseRead, MaterialCreate, MaterialRead

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="Questify API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[settings.web_origin], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/api/courses", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    course = Course(**payload.model_dump()); db.add(course); db.commit(); db.refresh(course)
    return course

@app.get("/api/courses", response_model=list[CourseRead])
def list_courses(db: Session = Depends(get_db)):
    return db.scalars(select(Course).order_by(Course.created_at.desc())).all()

@app.post("/api/courses/{course_id}/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
def create_material(course_id: UUID, payload: MaterialCreate, db: Session = Depends(get_db)):
    if not db.get(Course, course_id): raise HTTPException(status_code=404, detail="Course not found")
    material = Material(course_id=course_id, filename=payload.filename)
    db.add(material); db.commit(); db.refresh(material)
    return material
