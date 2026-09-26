# Questify: AI-Powered Gamified Learning Platform

**Questify** is an AI-driven, gamified study platform designed to transform textbooks, PDFs, DOCX files, and lecture notes into personalized learning roadmaps, interactive knowledge graphs, active recall flashcards, adaptive quizzes, and grounded AI tutor assistance.

---

## 🌟 Key Features

- **Personalized Learning Roadmap**: Divided into progressive **Worlds & Levels** that unlock based on concept mastery.
- **Interactive AI Tutor Chat**: Grounded RAG assistant with page-level document citations (`📄 OS_Chapter_3.pdf (p. 14)`).
- **Active Recall Flashcards**: Spaced repetition system powered by the **SuperMemo 2 (SM-2)** algorithm.
- **Adaptive Quiz Engine**: Dynamic difficulty scaling (Easy $\rightarrow$ Hard $\rightarrow$ Boss Level) with instant feedback & XP rewards.
- **Gamification Mechanics**: Experience Points (XP), streak tracking (🔥 7 Days), Mastery Tiers (Bronze $\rightarrow$ Diamond), and personal learning milestones.
- **Administrator Dashboard**: User management, role assignment (`student`, `instructor`, `admin`), and live AI service health telemetry.

---

## 🛠️ Tech Stack

| Layer | Component | Technology |
| :--- | :--- | :--- |
| **Frontend** | Framework & Language | **Next.js 15**, **React 18**, **TypeScript** |
| | Styling & UI | Custom Vanilla CSS with Design System Tokens, Glassmorphism, 3D Flip Card animations |
| | Typography | Google Fonts (*Outfit* + *Plus Jakarta Sans*) |
| **Backend** | API Framework | **FastAPI** (Python 3.11+) |
| | Web Server | **Uvicorn** (ASGI Engine) |
| | Security & Auth | **PyJWT** (Bearer JWT Tokens), **Passlib[bcrypt]** (Password Hashing) |
| | Data Access | **SQLAlchemy 2.0** ORM, **Pydantic v2** Schema Validation |
| **Databases & Cache**| Primary DB | **PostgreSQL 16** (Production) / **SQLite** (Zero-setup local dev fallback) |
| | Vector Database | **Qdrant** (Hybrid Dense + BM25 Vector Search) |
| | Background infrastructure | **Redis 7.2** (available for future job processing) |
| **AI Framework** | Agent Orchestration | **LangGraph** (Stateful multi-agent cycles) |
| | RAG & Indexing | **LlamaIndex** (Hierarchical node chunking & document retrieval) |
| | LLM Engine | **Ollama** (Local Dev) / **LiteLLM Router** (Cloud production APIs) |

---

## 🚀 How to Run the Project (Detailed Guide)

### Option 1: Local Development Mode (Zero Docker Required)

You can run Questify directly on your machine without installing Docker. The backend will automatically use a zero-setup local SQLite database (`apps/api/questify.db`).

#### 1. Start the Backend API (FastAPI)

Open a terminal in the project root:
```powershell
cd apps/api

# Option A: Run via Python module (Recommended for Windows/VS Code)
python -m uvicorn app.main:app --reload --port 8000

# Option B: Run directly via Uvicorn CLI (if Scripts is in PATH)
uvicorn app.main:app --reload --port 8000

# Option C: Run via FastAPI CLI (FastAPI 0.115+)
fastapi dev app/main.py
```
- **Backend API**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Start the Frontend UI (Next.js)

Open a second terminal:
```powershell
cd apps/web
npm run dev
```
- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)

---

### Option 2: Using Python Virtual Environment (`.venv`)

If you are using a virtual environment in VS Code:

```powershell
cd apps/api

# Create & activate virtual environment (if not already created)
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install requirements inside .venv
pip install -r requirements.txt

# Run Uvicorn backend
python -m uvicorn app.main:app --reload --port 8000
```

---

### Option 3: Docker Compose Mode (Full Stack with PostgreSQL & Redis)

If you have Docker Desktop installed, you can launch all infrastructure containers together:

```powershell
# 1. Copy environment template
cp .env.example .env

# 2. Build and start containers
docker compose up --build
```
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🔑 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register a new user (`student`, `instructor`, `admin`) |
| `POST` | `/api/v1/auth/login` | Authenticate user and return JWT bearer token |
| `GET` | `/api/v1/auth/me` | Fetch current user profile & streak details |
| `GET` | `/api/v1/courses` | List enrolled courses |
| `POST` | `/api/v1/courses/{id}/materials` | Upload study material metadata |
| `GET` | `/api/v1/gamification/dashboard` | Get XP, streak counter, active quests, and badges |
| `GET` | `/api/v1/admin/users` | List all registered users (Admin only) |
| `PATCH`| `/api/v1/admin/users/{id}/role` | Update user role (Admin only) |

### Course-scoped RAG tutor

Learners create a course, upload a `.pdf`, `.docx`, `.txt`, `.md`, or
`.markdown` document from the dashboard, and select that course in the tutor.
Questify extracts and chunks the file, creates local sentence-transformer
embeddings, and stores them in persistent ChromaDB storage. Every vector is
tagged with both the authenticated learner ID and course ID; the API applies
both filters on every retrieval. Groq rewrites and grades the query, then
generates a grounded answer with source citations and PDF page numbers.

The first ingestion downloads the configured embedding model and can take
longer than later uploads. Docker Compose persists uploaded files and vectors
in the `rag_data` volume.

---

---

## 📌 Original Questify MVP Documentation

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
