from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class CourseCreate(BaseModel):
    title: str
    description: str | None = None


class CourseRead(CourseCreate):
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MaterialCreate(BaseModel):
    filename: str


class MaterialRead(MaterialCreate):
    id: UUID
    status: str
    course_id: UUID
    model_config = ConfigDict(from_attributes=True)
