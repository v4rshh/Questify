# Questify — codebase context and implementation assessment

Reviewed 2026-09-15. This file preserves repository knowledge for future sessions; re-check code before treating it as current. Findings come from implementation, manifests, Docker files, and the two existing tests. README.md and implementation_plan.md include aspirations and obsolete descriptions.

## Purpose and current stage

Questify aims to turn study documents into a gamified learning experience: courses, document-grounded tutoring, concept roadmaps, flashcards, adaptive quizzes, mastery, quests, achievements, and rankings.

Current stage: early functional MVP with substantial demo UI. The most complete implemented flow is registration/login → course creation → document upload/indexing → course-scoped tutor answer with citations. This flow is wired in code but was not verified end to end during this review. The full adaptive learning loop is unfinished.

No defensible exact completion percentage exists: there is no agreed, weighted acceptance checklist. Rough planning judgment: around 35–45% of the full product vision is implemented, giving partial credit for schemas, APIs and UI shells. This is not a measured delivery percentage or production-readiness score.

## Repository map

- `apps/web`: Next.js frontend; learner routes for authentication at `/`, dashboard, tutor, roadmap, flashcards, quizzes, analytics, and admin redirects.
- `apps/web/lib/api.ts`: browser fetch wrapper; adds bearer token from localStorage; handles JSON and multipart FormData.
- `apps/web/components`: shared Sidebar and Header. Several displayed identity, XP, tier and level values are fixed defaults.
- `apps/api/app/main.py`: FastAPI entry point, CORS, five v1 routers, health endpoint, startup table creation with database connection retries.
- `apps/api/app/config.py`: environment-backed application settings; SQLite default, JWT settings, Groq and RAG configuration.
- `apps/api/app/database.py`: synchronous SQLAlchemy engine, session factory, declarative base, request session dependency.
- `apps/api/app/models.py`: 10 relational entities described below.
- `apps/api/app/schemas.py`: Pydantic request/response validation, separate from database models.
- `apps/api/app/api/deps.py`: token authentication and admin authorization using the current database user.
- `apps/api/app/api/v1`: authentication, courses/materials, tutor, gamification and administration endpoints.
- `apps/api/app/rag`: active extraction, embeddings, retrieval and LangGraph answer workflow.
- `apps/api/app/services/llm_client.py`: OpenAI SDK configured to call Groq.
- `apps/api/app/agents`: older tutor orchestration retained in the repository. Active tutor route calls rag/workflow.py instead; only the XP constant is imported from this older area.
- `apps/api/tests/test_rag.py`: two unit tests: Markdown extraction/chunking and mandatory retrieval filter construction with fakes.
- `apps/worker`: RQ worker scaffold; process_material only prints an identifier.
- `docker-compose.yml`: development services for web, API, PostgreSQL, Redis and worker.
- `.coderabbit.yaml`: automated review configuration; not evidence that reviews or CI are actually running.

## Actual technology stack

Versions below are declarations in repository manifests, not independently verified installed versions or current upstream releases.

### Frontend

- Next.js 15.0.3: routing, React application framework and development/build server; uses App Router and route groups.
- React / React DOM ^18.3.1: components, browser rendering and local state through hooks.
- TypeScript ^5.7.2: static typing; strict compiler settings and `@/*` import alias.
- HTML/TSX, custom CSS and inline styles: layout, dark theme, CSS variables, glass panels, transitions and 3D flashcard flipping. No Tailwind or UI component library declared.
- Google Fonts: Outfit and Plus Jakarta Sans via CSS import.
- Browser Fetch API, JSON, multipart FormData and localStorage: API communication, file uploads and token/profile storage.
- Node.js 22 Alpine image and npm: frontend runtime and dependency management; package-lock.json is tracked, though Docker runs npm install and copies only package.json before installation.
- @types/node, @types/react and @types/react-dom: development-time type declarations.

### API and persistence

- Python 3.12 slim Docker image: backend and worker runtime.
- FastAPI >=0.115 and Uvicorn[standard] >=0.32: REST endpoints and ASGI server; automatic OpenAPI documentation.
- Pydantic >=2.9, pydantic-settings >=2.6 and email-validator >=2: validation, response serialization and environment/.env configuration.
- SQLAlchemy >=2: ORM models, SQL queries, relationships and transactions.
- SQLite: local default at `./questify.db`, relative to process working directory.
- PostgreSQL 16 via pgvector/pgvector:pg16: Compose relational database; psycopg[binary] is the PostgreSQL driver.
- pgvector-capable image is present, but active embeddings live in Chroma; no pgvector vector column/search implementation exists.
- PyJWT[crypto] >=2.9: signed bearer access tokens; default HS256 and 24-hour lifetime.
- Passlib[bcrypt] >=1.7.4 and bcrypt >=4.0.1,<4.1: password hashing/verification. bcrypt is capped for compatibility.
- python-multipart >=0.0.12: file upload form parsing.
- UUID identifiers, foreign keys, JSON quiz payloads and timestamps: relational data conventions.

### Active AI and document pipeline

- Groq: remote model provider. OpenAI Python SDK >=1.50 targets `https://api.groq.com/openai/v1`; using that SDK does not imply requests go to OpenAI hosting.
- Default model identifier: `openai/gpt-oss-20b`, overridable with LLM_MODEL. Provider availability and credentials were not checked.
- LangGraph >=0.2: explicit graph of query rewrite, retrieve, grade, retry and answer generation.
- langchain-core >=0.3: declared AI framework dependency; langchain-text-splitters >=0.3 supplies RecursiveCharacterTextSplitter.
- ChromaDB >=0.5: persistent local vector collection with cosine similarity and learner/course metadata filtering.
- sentence-transformers >=3: local semantic embeddings using configured all-MiniLM-L6-v2 model; model loads lazily and may need a first-use download. Its numerical/ML dependencies are transitive dependencies, not separately pinned top-level components.
- pypdf >=5: text extraction per PDF page, retaining page numbers.
- python-docx >=1.1: extracts DOCX paragraphs; current code does not explicitly extract DOCX tables.
- UTF-8 decoding: TXT, MD and Markdown support.
- Local filesystem: uploaded originals and Chroma data; Compose persists `/app/data` in rag_data.

### Infrastructure and tooling

- Docker / Compose: development container orchestration, bind mounts, named database/RAG volumes and DB/Redis health checks.
- Redis 7 Alpine: provisioned service; not used by active upload code.
- RQ 2.0 and redis Python client 5.2: worker dependencies; no API enqueue integration.
- Git and .gitignore: version control and exclusion of secrets/generated artifacts.
- CodeRabbit configuration: intended automated code review.
- pytest-style tests exist, but pytest is not declared in a development requirements file and was absent locally.
- API uses reload mode and frontend uses next dev in Docker; these are development configurations.

### Proposed or obsolete technologies, not active implementations

README/plan references include Qdrant and hybrid dense/BM25 retrieval; LlamaIndex hierarchical indexing; Ollama; LiteLLM routing; PaddleOCR; PyMuPDF; pdfplumber; Docling/Unstructured; React Flow or 3D Force-Graph with Dagre/D3 layout; Tailwind; ARQ/Celery; SSE/WebSockets; object storage; Alembic migrations; and SM-2 scheduling. These should not be presented as implemented features. The worker actually uses RQ. SM-2-related database fields exist, but the scheduling algorithm does not.

## Data model

1. User: identity, role, password hash, XP, login streak, mastery tier.
2. Course: learner-owned collection of study material.
3. Material: filename, type, byte size, processing status, summary and OCR flag.
4. KnowledgeNode: concept, world/level indexes, mastery score and unlock status.
5. KnowledgeEdge: prerequisite/related relationships between concepts.
6. Flashcard: question/answer/hint and future spaced-repetition fields.
7. Quiz: concept-linked quiz with JSON questions and difficulty.
8. QuizAttempt: user score, accuracy, earned XP and completion timestamp.
9. Quest: user task, target/current counts, reward and expiry.
10. Achievement: user badge and unlock timestamp.

UserRole and MasteryTier are enums, not tables.

Schema presence does not mean feature completion. There are no active flashcard review, quiz submission or mastery update APIs. Review scheduling is stored on Flashcard and mastery on KnowledgeNode, rather than a separate per-user progress record; revisit if courses become shared.

## Active runtime flow

1. Register: hash password, create user with 100 welcome XP, streak 1, initial quest and welcome achievement. Login verifies password, updates login-date streak and returns JWT.
2. Browser stores token; fetchApi sends Authorization: Bearer on requests.
3. Create/select course. Ownership is checked for material operations and tutor requests.
4. Upload via POST `/api/v1/courses/{course_id}/materials/upload`; validate extension, non-empty bytes and configured 25 MB maximum; sanitize filename.
5. Create processing Material record; extract text; split at approximately 1000 characters with 200 overlap; preserve PDF pages.
6. Save original beneath user/course/material IDs. Embed chunks locally and upsert into persistent Chroma with user, course, material, source, page and chunk metadata. Mark material completed or failed.
7. Tutor request includes course ID, question and normal/game mode. Graph rewrites search query, retrieves up to 5 chunks with user AND course filters, asks model to select useful chunks, optionally retries broader retrieval once, then generates an answer constrained by selected excerpts.
8. Return source names, PDF pages where available, excerpts and chunk indexes. If retrieval finds no supporting chunks, return an insufficient-materials response.
9. Game mode adds 5 XP after a successful workflow return, including a no-information answer. It does not implement difficulty adaptation or a boss challenge.

Processing runs inside the API upload request, despite its async function declaration; extraction and embedding are synchronous and are not queued to the worker. Tutor requests do not send previous turns to the model; browser message history is local state and not persisted. Citation metadata is assembled from retrieved chunks, but factual grounding/citation correctness is not independently verified.

## Implementation status

- Authentication: UI and API connected; access tokens and login streaks implemented. Refresh tokens, cookie sessions, password reset and verification absent.
- Courses: create/list/detail API; create/select frontend connected. Full editing/deletion/enrollment workflows absent.
- Upload/RAG ingestion: code connected for PDF/DOCX/TXT/Markdown; no OCR, image/PPTX ingestion, object storage or durable background processing.
- Tutor: connected course-scoped RAG and citation UI. No streaming, persistent conversation memory, full educational agents or verified RAG quality evaluation.
- Dashboard: course/upload controls live; Alex welcome, XP, streak, tier, course totals and quests shown are demo values.
- Roadmap: hardcoded worlds/levels; graph schema only; no extraction, generation, progression or real unlock logic.
- Flashcards: two hardcoded cards with flip/navigation; Hard/Good/Easy all call the same next-card handler. No generation, persistence or SM-2 calculations.
- Quizzes: one hardcoded question; local selection/submission only. No adaptive engine, persisted attempt, actual quiz XP or next-question flow.
- Gamification: welcome reward, initial quest/achievement, login streak and tutor XP implemented. Quest updates/resets/completion rewards and mastery tier progression absent.
- Analytics: static UI; no learner analytics calculation API. Gamification endpoint does expose limited real counts.
- Admin: protected user listing/role update and count endpoints implemented; UI uses three demo users and local-only role changes. Service-health claims are constants, not probes.
- Worker/operations: service scaffold; no real jobs, migrations, deployment pipeline or comprehensive test suite found.

## Important defects and risks evidenced in code

1. Public registration accepts `role=admin` for any registrant; the UI explicitly offers Administrator. The comment about the first user is not enforced. Admin API role checks therefore do not establish a trustworthy privilege boundary.
2. config.py includes a known default JWT secret and .env.example does not expose SECRET_KEY. Require explicit configuration before deployment.
3. Quiz result always says Correct and +25 XP even when the selected answer is wrong; the reward is not persisted.
4. Admin UI and API report Ollama/Qdrant/Redis health without testing those services; the labels contradict the active Groq/Chroma implementation.
5. Unbounded repeated game-mode questions can earn XP without measured learning; no anti-abuse controls or meaningful-question verification found.
6. Upload extraction/embedding blocks the API event loop; no durable queue, recovery or cross-store transaction coordinates SQL, original files and vectors. Failure cleanup is incomplete.
7. No broad frontend route/session guard; API protection exists, but protected-looking demo pages can render without authentication. Browser token storage is localStorage, not the planned HTTP-only session approach.
8. Existing quest query does not filter expiry; counters and expiry maintenance are unfinished. Dashboard course count includes unowned courses while course listing is owner-only.
9. Settings load `.env` relative to process working directory: running from apps/api does not automatically load repository-root .env. Root example uses Docker hostname `db`, unsuitable for a direct host connection without adjustment.
10. Broad Python dependency lower bounds and development Docker commands reduce reproducibility; no Alembic schema migration setup found.

## Validation performed

- Frontend: `apps/web/node_modules/.bin/tsc.cmd --noEmit --incremental false` passed.
- Python: AST syntax parsing passed for all 24 repository Python files.
- `python -m pytest apps/api/tests -q` using root .venv failed because pytest is missing.
- Direct invocation of test functions also blocked because python-docx is missing (`No module named docx`).
- No dependency installation, database mutation, remote LLM call, Docker boot, browser walkthrough or full build was performed. End-to-end functionality, runtime compatibility and deployment readiness remain unverified.
- Working tree was clean at review start. This review adds documentation only.

## Recommended next implementation sequence

1. Close public admin registration and require a configured JWT secret; establish auth/ownership regression tests.
2. Make the existing vertical slice reproducible: development dependencies, configuration instructions, API/RAG tests and one end-to-end course/upload/tutor test.
3. Connect profile, dashboard, and admin screens to existing endpoints; remove misleading demo results and health labels.
4. Implement document-based flashcard generation, validated outputs, review endpoints and persisted spaced repetition.
5. Implement quiz generation, server-side grading, attempts, mastery updates and reliable XP events.
6. Generate concept graph/roadmap and enforce progression using recorded learning results.
7. Complete quests/achievements/analytics and asynchronous ingestion; add migrations and deployment/observability appropriate to the intended release.

## Future-session handoff

Read this file, then inspect git diff and relevant source. Do not assume all README features work. Treat rag/workflow.py as the active tutor implementation, Chroma as the active vector store, Groq as the active LLM provider, and Redis/RQ as scaffold. Do not expose local database contents or secret .env values while inspecting. No application code was changed in this review.
