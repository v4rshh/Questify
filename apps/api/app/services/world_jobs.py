"""Persistent job status and resumable curriculum generation for the local API."""
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Lock
from pathlib import Path

from filelock import FileLock, Timeout
from sqlalchemy import select

from ..config import settings
from ..database import SessionLocal
from ..models import WorldGenerationJob, Material, User
from ..schemas import WorldGenerateRequest

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="world-generation")
active = set()
lock = Lock()


def job_read(job):
    return {"material_id": str(job.material_id), "status": job.status,
            "progress": job.progress, "message": job.message}


def _run(material_id):
    from ..api.v1.learning import build_world

    directory = Path(settings.upload_directory) / '.generation-locks'
    directory.mkdir(parents=True, exist_ok=True)
    file_lock = FileLock(str(directory / f'{material_id}.lock'))
    try:
        file_lock.acquire(timeout=0)
    except Timeout:
        with lock:
            active.discard(material_id)
        return

    def progress(percent, message):
        with SessionLocal() as db:
            job = db.get(WorldGenerationJob, material_id)
            job.status = "running"
            if percent is not None:
                job.progress = percent
            job.message = message
            job.updated_at = datetime.now(timezone.utc)
            db.commit()
    try:
        progress(0, "Reading your resource")
        with SessionLocal() as db:
            job = db.get(WorldGenerationJob, material_id)
            material = db.get(Material, material_id)
            user = db.get(User, job.user_id)
            build_world(material.course_id, WorldGenerateRequest(material_id=material_id), db, user, progress)
        with SessionLocal() as db:
            job = db.get(WorldGenerationJob, material_id)
            job.status, job.progress, job.message = "completed", 100, "Your world is ready"
            db.commit()
    except Exception as exc:
        logger.exception("World generation failed for material %s", material_id)
        with SessionLocal() as db:
            job = db.get(WorldGenerationJob, material_id)
            job.status = "failed"
            job.message = getattr(exc, "detail", "Generation could not finish. Retry to resume saved stages.")
            db.commit()
    finally:
        file_lock.release()
        with lock:
            active.discard(material_id)


def enqueue(material_id):
    with lock:
        if material_id in active:
            return
        active.add(material_id)
        executor.submit(_run, material_id)


def resume_jobs():
    with SessionLocal() as db:
        ids = db.scalars(select(WorldGenerationJob.material_id).where(
            WorldGenerationJob.status.in_(["queued", "running"]))).all()
    for material_id in ids:
        enqueue(material_id)
