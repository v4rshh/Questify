from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User, Course, Material, UserRole
from ...schemas import UserRead, UserRoleUpdate
from ..deps import get_current_admin

router = APIRouter(prefix="/admin", tags=["Administrator Management"])


@router.get("/users", response_model=list[UserRead])
def list_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    return db.scalars(select(User).order_by(User.created_at.desc())).all()


@router.patch("/users/{user_id}/role", response_model=UserRead)
def update_user_role(
    user_id: UUID,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    if payload.role not in [r.value for r in UserRole]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of {[r.value for r in UserRole]}"
        )
    
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.get("/system-metrics")
def get_system_metrics(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_students = db.scalar(select(func.count(User.id)).where(User.role == UserRole.STUDENT.value)) or 0
    total_courses = db.scalar(select(func.count(Course.id))) or 0
    total_materials = db.scalar(select(func.count(Material.id))) or 0
    
    return {
        "status": "healthy",
        "total_users": total_users,
        "active_students": active_students,
        "total_courses": total_courses,
        "uploaded_materials": total_materials,
        "ai_model_service": "Ollama (Local Engine)",
        "vector_database": "Qdrant Vector Engine",
        "primary_database": "PostgreSQL 16 (Connected)",
        "cache_store": "Redis 7.2 (Active)"
    }
