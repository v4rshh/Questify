# Questify API reference

Base URL during local development: `http://localhost:8000/api/v1`

Interactive OpenAPI documentation: `http://localhost:8000/docs`

All endpoints except registration and login require this request header:

```http
Authorization: Bearer <access_token>
```

## Authentication

### Register a learner

`POST /auth/register`

```json
{
  "email": "learner@example.com",
  "password": "a-secure-password",
  "full_name": "Alex Rivera"
}
```

Returns a learner profile. Public registration always creates a `student` user.

### Sign in

`POST /auth/login`

```json
{
  "email": "learner@example.com",
  "password": "a-secure-password"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "full_name": "Alex Rivera",
    "xp": 100,
    "streak_count": 1,
    "mastery_tier": "Bronze"
  }
}
```

### Read the current learner

`GET /auth/me`

Returns the authenticated learner profile.

## Courses and resources

### Create a workspace

`POST /courses`

```json
{
  "title": "Machine learning notes",
  "description": "Semester revision material"
}
```

### List workspaces

`GET /courses`

Returns courses owned by the authenticated learner, newest first.

### Read a workspace

`GET /courses/{course_id}`

### Upload and index a resource

`POST /courses/{course_id}/materials/upload`

Request body: `multipart/form-data` with a `file` field.

Supported files: PDF, DOCX, TXT, MD, and Markdown. The API validates the configured size limit, extracts text, chunks it, embeds it, saves it in Chroma, and returns the completed `Material` record.

Response fields include `id`, `filename`, `course_id`, `status`, and `summary`.

### List resources

`GET /courses/{course_id}/materials`

## Tutor

### Ask the tutor

`POST /tutor/chat`

```json
{
  "course_id": "uuid",
  "message": "Explain the central idea in simple terms.",
  "mode": "normal"
}
```

`mode` accepts `normal` or `game`. Game mode awards XP after a successful response.

Response:

```json
{
  "response": "...",
  "mode": "normal",
  "xp_earned": 0,
  "total_xp": 125,
  "grounded": true,
  "retrieved_chunks": 2,
  "citations": [
    {
      "source": "notes.pdf",
      "page": 4,
      "excerpt": "...",
      "chunk_index": 2
    }
  ]
}
```

If the selected workspace has no indexed resource, the tutor uses the configured language model for a general study answer and returns grounded: false. Once a resource is indexed, the API only answers from retrieved course excerpts; if it cannot find support, it asks the learner to rephrase or upload relevant material instead of inventing an answer.

## Learning world

These endpoints power the roadmap, flashcards, quizzes, and analytics pages. Every endpoint verifies ownership of the parent course.

### Read a learning world

`GET /learning/courses/{course_id}/world?material_id={material_id}`

Response includes `generated`, world `title`, and ordered `nodes`. Each node has `level_index`, `mastery_score`, and `is_unlocked`.

### Generate a learning world

`POST /learning/courses/{course_id}/world`

Requires JSON `{ "material_id": "<uploaded material UUID>" }`. The resource must be indexed and belong to the authenticated learner's course. This synchronous compatibility endpoint builds a resource-sized curriculum; browser clients should use the background endpoint below. Each level has a lesson, 2–3 flashcards, 3–4 game challenges, and a practice quiz. A unique material constraint makes repeated generation return the same saved world. Invalid model output returns 422; provider failure returns 503. Neither saves placeholder content. Older course-only worlds are preserved but are not returned as resource worlds.

### Start or resume automatic world generation

`POST /learning/courses/{course_id}/world/generation`

Body: `{ "material_id": "<uploaded material UUID>" }`. Returns HTTP 202 with `{ "material_id": "...", "status": "queued", "progress": 0, "message": "Queued" }`.

`GET /learning/courses/{course_id}/materials/{material_id}/generation`

Returns `idle`, `queued`, `running`, `completed`, or `failed`, with percentage and stage message. Poll while running, then fetch the world using its material ID. Retrying a failed job reuses completed, validated stages. A process-level file lock prevents two API processes from generating the same material simultaneously on shared local storage. Queued/running jobs resume on API startup. Keep the API process running for generation to proceed.

Provider rate limits honor `Retry-After`, including daily token allowances. During the wait, status stays `running` and the message includes the next automatic retry time in UTC. Closing the browser does not stop the worker. Permanent errors or exhausted retry attempts become `failed`; clicking Generate world again resumes cached stages. Long books can require multiple quota windows on a free provider account.

The app sends extracted resource text to the configured Groq provider automatically when the learner requests generation. There is no per-excerpt approval step in Questify. Development-agent approval prompts are separate from app behavior.

World responses include a `coverage` audit: text sections processed, source batches, mapped and assigned topic counts, excluded noneducational sections, and the prerequisite plan. Every extracted-text batch is processed, and every mapped topic must occur exactly once in the validated plan. Level count follows the resource content. This does not guarantee image/OCR coverage or that an LLM identified every educational detail correctly.

### Read and play a level game

`GET /learning/levels/{node_id}/game`

Returns the lesson, difficulty, saved `solved_count`, challenge `total`, `points`, `completed`, and current `question` (prompt, options, source and page). It does not reveal the answer before submission. Locked levels return 403; other learners' levels return 404.

`POST /learning/levels/{node_id}/game/answer`

Request: `{ "question_index": 0, "answer_index": 2 }` (zero-based indexes).

Returns `correct`, `correct_answer`, `explanation`, `xp_earned`, `total_xp`, and refreshed `game`. A correct solve advances one checkpoint and awards 10 XP once. A wrong answer returns feedback with zero XP and leaves the checkpoint available to retry. Finishing all checkpoints unlocks the next level in the same resource world. Duplicate/stale submissions return 409. Progress and XP updates commit together.

For resource worlds, level mastery and unlocks are controlled by games. Flashcard reviews and practice quizzes retain their own XP and statistics, but do not bypass game progression.

### List flashcards

`GET /learning/courses/{course_id}/flashcards`

Cards are ordered by `next_review_date` so due cards appear first.

### Save a flashcard review

`POST /learning/flashcards/{flashcard_id}/review`

```json
{
  "quality": 4
}
```

`quality` ranges from 0 to 5. The endpoint updates interval, repetition count, ease factor, next review date, node mastery, and learner XP.

Response:

```json
{
  "card": {
    "id": "uuid",
    "interval_days": 6,
    "repetition_count": 2,
    "ease_factor": 2.5
  },
  "xp_earned": 5,
  "total_xp": 130
}
```

### List quizzes

`GET /learning/courses/{course_id}/quizzes`

Each quiz returns `questions_data.questions`. The correct option index is present in the current server response because the API grades client-submitted attempts. Before public deployment, split this into a learner-safe quiz payload and a private grading payload.

### Submit a quiz

`POST /learning/quizzes/{quiz_id}/attempts`

```json
{
  "answers": [1, 2, 1]
}
```

The answer array must contain one selected option index for every question.

Response:

```json
{
  "id": "uuid",
  "quiz_id": "uuid",
  "score": 3,
  "max_score": 3,
  "accuracy_percentage": 100.0,
  "xp_earned": 30,
  "completed_at": "2026-09-19T00:00:00Z"
}
```

At 60% or higher, the current learning node and the next node are unlocked. The current node’s mastery becomes at least the quiz accuracy.

### Read course analytics

`GET /learning/courses/{course_id}/analytics`

Response includes total and due flashcards, completed quiz count, average quiz accuracy, mastered node count, and every node’s saved mastery value.

## Gamification

### Read dashboard metrics

`GET /gamification/dashboard`

Returns learner XP, streak, tier, owned course count, completed quiz count, active quests, and recent achievements.


## Internal administration endpoints

The browser UI intentionally does not expose administration. These legacy API endpoints still exist for controlled internal use and require an existing `admin` user:

- `GET /admin/users`
- `PATCH /admin/users/{user_id}/role`
- `GET /admin/system-metrics`

## Common errors

- `401`: missing, expired, or invalid bearer token.
- `404`: course, material, card, or quiz does not exist for the authenticated learner.
- `413`: uploaded file exceeds the configured maximum size.
- `415`: unsupported file extension.
- `422`: malformed request, incomplete quiz answer list, invalid flashcard quality, or world generation requested before resource indexing finishes.
- `503`: the language model is unavailable or `LLM_API_KEY` is not configured.
