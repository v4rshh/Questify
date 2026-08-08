from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .api.v1 import auth, courses, gamification, admin


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Auto-initialize database tables for prototype development
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Questify API Platform",
    description="Backend API powering Questify AI-driven gamified learning",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Open CORS for local Next.js client
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire API v1 routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(courses.router, prefix="/api/v1")
app.include_router(gamification.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "Questify API",
        "version": "1.0.0"
    }
