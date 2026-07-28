# Questify MVP

The first working slice of Questify: a learner can create a course, upload learning material, process it asynchronously, and later attach retrieval, flashcard, quiz, and mastery workflows.

## Included services

- `apps/web`: Next.js learner dashboard shell
- `apps/api`: FastAPI API and PostgreSQL schema
- `apps/worker`: Redis-backed material-processing worker placeholder
- PostgreSQL with `pgvector` and Redis via Docker Compose

## Run locally

1. Copy `.env.example` to `.env` and set a non-default database password.
2. Run `docker compose up --build`.
3. Open http://localhost:3000 and API docs at http://localhost:8000/docs.

The API initializes its schema on startup for this prototype. Replace that with Alembic migrations before deploying.

## First API calls

```bash
curl -X POST http://localhost:8000/api/courses -H "Content-Type: application/json" -d '{"title":"Operating Systems"}'
curl http://localhost:8000/api/courses
```

## Build next

1. Persist uploaded files in object storage and extract text in the worker.
2. Create chunks and embeddings in `document_chunks` using pgvector.
3. Add structured flashcard/quiz generation, validated with Pydantic.
4. Track attempts and calculate a per-concept mastery score.
5. Add grounded tutor answers with chunk citations.

