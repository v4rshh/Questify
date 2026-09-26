# Questify architecture

Last updated: 2026-09-19

Questify is a learner-owned study workspace. A learner uploads a resource, asks grounded questions, generates a learning world, reviews flashcards, takes quizzes, and sees progress from stored activity.

## Product boundaries

- Every course belongs to its creator.
- Materials, tutor retrieval, worlds, flashcards, quizzes, and analytics are scoped to that course and authenticated learner.
- Public registration always creates a learner account. The web product does not expose instructor or administrator workflows.
- A course can answer general questions before material exists. After a resource is indexed, tutor retrieval supplies course excerpts and citations.

## Runtime layout

```text
Browser (Next.js / React)
  |
  | HTTPS JSON + multipart upload, bearer token
  v
FastAPI /api/v1
  |-- Auth and JWT validation
  |-- Course and material ingestion
  |-- Tutor / RAG workflow
  |-- Learning-world, flashcard, quiz, and analytics APIs
  |-- Personal progress and gamification APIs
  |
  +--> SQLite locally or PostgreSQL in Docker (SQLAlchemy)
  +--> ChromaDB persistent vectors
  +--> filesystem uploads
  +--> Groq via the OpenAI-compatible SDK
```

Redis and the RQ worker are present in Docker but are not on the active material-processing path. Material extraction, embedding, and indexing currently run synchronously in the API request.

## Frontend

`apps/web` is a Next.js 15 App Router application with React 18 and TypeScript.

### Shared application shell

- `app/layout.tsx` sets the saved light or dark theme before the app paints.
- `app/globals.css` owns semantic color variables for both themes.
- `components/Sidebar.tsx` provides workspace navigation, recent browser-persisted chats, and the theme toggle.
- `components/ThemeToggle.tsx` stores the selected theme in `localStorage` under `questify_theme`.
- `components/Icon.tsx` provides the local SVG icon set, keeping the project dependency-free.
- `lib/api.ts` attaches the bearer token from `localStorage` to every API request and supports JSON or multipart bodies.

### User journey

1. The learner registers or signs in at `/`.
2. `/dashboard` is the chat-first home. It loads courses, user statistics, and recent browser-local chats.
3. Sending the first general question creates a `General Study` course if one does not exist.
4. The plus button uploads a PDF, DOCX, TXT, or Markdown resource into a fresh course named after the file. Uploading from an existing resource chat creates another chat; its material ID is stored explicitly.
5. After indexing succeeds, the dashboard offers **Generate world**.
6. World generation runs as a persisted background job with progress and resumable stages. It creates as many focused levels as the resource plan requires, orders prerequisites before dependent concepts, and groups difficulty from beginner through advanced as appropriate. Each level has a lesson, flashcards, a quiz, and a concept trail game. Correct game answers advance checkpoints and award 10 XP; wrong answers explain the solution and allow retry. Completing a game unlocks the next level.

### Page responsibilities

- `/dashboard`: tutor chat, uploads, course context, world generation, citations, local chat persistence.
- `/roadmap`: read or generate the current course world and show level unlock state.
- `/flashcards`: load course cards, reveal answers, submit a recall quality score.
- `/quizzes`: load a course quiz, collect answers, submit an attempt, show explanations.
- `/analytics`: read course-specific reviews, quiz attempts, and node mastery.
- `/tutor` and `/admin`: redirect to `/dashboard` so there is one learner workspace.

## Backend

`apps/api/app/main.py` creates database tables for prototype development, configures CORS, and mounts each versioned router under `/api/v1`.

### Authentication

- Passwords are hashed with Passlib/bcrypt.
- Login returns a JWT access token.
- `get_current_user` validates the token and loads the live user from the database.
- `POST /auth/register` always assigns the `student` role, regardless of extra request fields.

### Course and material ingestion

- Courses are learner-owned `Course` records.
- Material upload validates extension and size, stores the original file, extracts text, chunks it, embeds it, and writes vectors to Chroma.
- Chroma metadata includes both `user_id` and `course_id`. Retrieval always applies both filters.
- Supported inputs are PDF, DOCX, TXT, MD, and Markdown.

### Tutor workflow

The active tutor pipeline is in `rag/workflow.py`.

1. Rewrite the learner question for semantic retrieval.
2. Retrieve the best matching course chunks from Chroma.
3. Ask the model to select relevant chunks.
4. Retry once with a broader query if retrieval is empty.
5. Generate a response constrained to supplied excerpts, with citation metadata. If the workspace contains indexed material but retrieval is not supportive, return an explicit no-source answer rather than an ungrounded one.

When no resource is attached, the tutor uses the configured Groq model for a short general answer and invites the learner to attach notes for a grounded answer.

### Learning-world API

The learning router is `apps/api/app/api/v1/learning.py`.

- `GET /learning/courses/{course_id}/world` returns the generated levels, if any.
- `POST /learning/courses/{course_id}/world` requires an explicit indexed `material_id`. Worlds are unique per material, including when older uploads share a course. GET accepts the same ID as a query parameter.
- `GET /learning/courses/{course_id}/flashcards` returns cards ordered by next review date.
- `POST /learning/flashcards/{flashcard_id}/review` accepts a quality score from 0 to 5. It updates SM-2-style interval fields, node mastery, and learner XP.
- `GET /learning/courses/{course_id}/quizzes` returns course quizzes.
- `POST /learning/quizzes/{quiz_id}/attempts` grades answers on the server, saves the attempt, awards XP, updates mastery, and unlocks the next level after a passing score.
- `GET /learning/courses/{course_id}/analytics` returns stored card, quiz, and level metrics.

`services/curriculum.py` divides all extracted text into bounded batches and maps teachable concepts in every batch. Groq groups concepts into focused levels, then a separate compact request builds their prerequisite graph. Validation requires every mapped topic exactly once, known prerequisites, distinct level titles and no dependency cycles. Multi-level plans cannot omit all dependencies. A topological sort places prerequisites first; difficulty never decreases along the resulting path. Each lesson uses one complete source batch and its assigned concept titles to keep requests within provider limits. Pydantic validates lessons, games, flashcards and source references. Text maps, plans, dependency graphs and lessons are cached beside the upload by content/model fingerprint; lesson cache keys also include their plan metadata. Retries reuse successful stages. No generic fallback world is saved. Coverage counts refer to extracted text and mapped concepts; image-only content and semantic completeness still need review.

`services/world_jobs.py` uses a single-worker executor with persisted `WorldGenerationJob` status. File locks prevent duplicate workers per resource. Jobs survive navigation, and pending jobs resume on API restart. Transient provider failures retry with bounded backoff. Sustained quota failures surface a retryable status. This is a local prototype job runner; multi-host deployment should move jobs to a shared queue with distributed locking.

`WorldCurriculumAudit` stores source coverage and the prerequisite plan with each completed world. The UI polls generation status and displays saved coverage. Users click Generate world once; the backend calls Groq automatically using server configuration. No runtime approval prompts are implemented.

GPT-OSS models use Groq's strict JSON schema output mode, followed by local content and source validation. Other configured models use JSON object mode with the same local validation. Background retries honor the provider's `Retry-After` header, including daily token resets, and expose a UTC retry time in the status message. A free-tier quota can delay a large book across multiple windows; completed stages remain cached.

`ResourceWorld` links a unique material to its generated world. `LevelGame` links each node to its world, lesson, difficulty, questions, and saved checkpoint count. New tables are created by the existing prototype startup initializer without altering existing tables. The answer endpoint uses a conditional checkpoint update in the same transaction as XP and unlock updates, so retries cannot award points twice. Game mastery is independent of practice-quiz and flashcard XP.

### Existing API catalogue

Authentication:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Courses and materials:

- `POST /courses`
- `GET /courses`
- `GET /courses/{course_id}`
- `POST /courses/{course_id}/materials/upload`
- `GET /courses/{course_id}/materials`

Tutor:

- `POST /tutor/chat`

Learning:

- all endpoints listed in the learning-world API section

Gamification:

- `GET /gamification/dashboard`

Interactive API documentation is served by FastAPI at `/docs` while the backend is running.

## Data model

- `User`: learner identity, credential hash, XP, streak, mastery tier.
- `Course`: learner-owned workspace.
- `Material`: uploaded file metadata, processing state, and summary.
- `KnowledgeNode`: ordered world level with mastery and unlock state.
- `KnowledgeEdge`: prerequisite or related-node relation, reserved for richer world graphs.
- `Flashcard`: prompt, answer, hint, and review scheduling fields.
- `Quiz`: a node-scoped question payload.
- `QuizAttempt`: learner score, accuracy, XP, and completion time.
- `Quest` and `Achievement`: existing gamification records.

## Theme design

The application uses CSS semantic variables instead of separate duplicated themes. Light and dark themes define background, surface, border, text, muted text, accent, and status colors. Components consume those variables, and `ThemeToggle` updates `document.documentElement.dataset.theme` plus local storage. The saved preference applies before React renders to avoid a visible flash of the wrong theme.

## Development and deployment

Local development uses SQLite by default. Run the backend from `apps/api` and the frontend from `apps/web`. Set `LLM_API_KEY` and optionally `LLM_MODEL` in `apps/api/.env` for tutor responses.

Docker Compose adds PostgreSQL, Redis, the API, the worker, and the web app. PostgreSQL is the relational database in Compose; Chroma and uploads are persisted under the API data volume.

## Next engineering steps

1. Move material processing to the existing RQ worker and report indexing progress to the browser.
2. Add diagram/OCR extraction and independent curriculum quality evaluation.
3. Persist chat threads and messages in database tables rather than only browser local storage.
4. Add migrations before changing production data models.
5. Add API tests for ownership, quiz grading, review scheduling, and world idempotency.
6. Add rate limits, a production JWT secret, and provider error observability before public deployment.
