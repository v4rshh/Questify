import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from .config import settings
from .database import Base, engine
from .api.v1 import auth, courses, gamification, admin, tutor


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Auto-initialize database tables for prototype development.
    # Retries briefly in case the DB container's healthcheck passed but a
    # connection attempt still races the container's startup window.
    last_error: Exception | None = None
    for attempt in range(10):
        try:
            Base.metadata.create_all(bind=engine)
            last_error = None
            break
        except OperationalError as exc:
            last_error = exc
            time.sleep(2)
    if last_error is not None:
        raise last_error
    yield


app = FastAPI(
    title="Questify API Platform",
    description="Backend API powering Questify AI-driven gamified learning",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.web_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire API v1 routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(courses.router, prefix="/api/v1")
app.include_router(gamification.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(tutor.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "Questify API",
        "version": "1.0.0"
    }
