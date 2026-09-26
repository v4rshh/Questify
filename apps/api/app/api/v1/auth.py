from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import User, UserRole, Quest, Achievement
from ...schemas import PasswordChange, UserCreate, UserRead, UserLogin, Token
from ...core.security import get_password_hash, verify_password, create_access_token
from ..deps import get_current_user
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.scalar(select(User).where(User.email == payload.email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Questify is a learner workspace. Administrative roles are internal and
    # cannot be selected during public registration.
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        role=UserRole.STUDENT.value,
        xp=100,  # Welcome bonus
        streak_count=1,
        last_active_date=datetime.now(timezone.utc)
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Initialize initial daily quest & welcome achievement
    initial_quest = Quest(
        user_id=user.id,
        title="Complete Your Profile",
        description="Upload your first study material or take a practice quiz",
        xp_reward=50,
        quest_type="daily",
        target_count=1,
        current_count=0,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1)
    )
    initial_achievement = Achievement(
        user_id=user.id,
        title="Welcome Scholar!",
        description="Joined the Questify learning realm",
        badge_icon="rocket"
    )
    db.add(initial_quest)
    db.add(initial_achievement)
    db.commit()
    
    return user


@router.post("/login", response_model=Token)
def login_user(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user account"
        )

    # Update active streak
    now = datetime.now(timezone.utc)
    if user.last_active_date:
        delta_days = (now.date() - user.last_active_date.date()).days
        if delta_days == 1:
            user.streak_count += 1
        elif delta_days > 1:
            user.streak_count = 1
    else:
        user.streak_count = 1
    user.last_active_date = now
    db.commit()
    db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return Token(access_token=access_token, token_type="bearer", user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=422, detail="The new passwords do not match")
    if not any(character.isalpha() for character in payload.new_password) or not any(character.isdigit() for character in payload.new_password):
        raise HTTPException(status_code=422, detail="Use at least one letter and one number")
    if len(payload.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password is too long")
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(status_code=422, detail="Choose a password different from your current password")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
