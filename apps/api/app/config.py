from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


# Docker Compose owns the repository-level .env file, while a local Uvicorn
# session is usually started from apps/api. Read both explicitly so a key added
# to the documented root .env is available in either workflow. The API-local
# file comes second to preserve its SQLite development defaults.
API_DIRECTORY = Path(__file__).resolve().parent.parent
REPOSITORY_DIRECTORY = (
    API_DIRECTORY.parents[1]
    if len(API_DIRECTORY.parents) > 1
    else API_DIRECTORY
)

class Settings(BaseSettings):
    # Default to zero-setup SQLite database so the app runs without Docker/PostgreSQL
    database_url: str = "sqlite:///./questify.db"
    web_origin: str = "http://localhost:3000"
    secret_key: str = "questify-secret-key-change-in-production-super-secure-32bytes"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    # Groq is the single LLM provider for the tutor and RAG workflow.
    llm_api_key: str = ""
    llm_model: str = "openai/gpt-oss-20b"

    # Course-scoped RAG settings. Embeddings are generated locally; Groq is
    # the only remote model provider used for query rewriting and answers.
    chroma_persist_directory: str = "./data/chroma"
    chroma_collection_name: str = "questify_materials"
    embedding_model: str = "all-MiniLM-L6-v2"
    rag_chunk_size: int = 1000
    rag_chunk_overlap: int = 200
    rag_top_k: int = 5
    rag_max_retries: int = 1
    upload_directory: str = "./data/uploads"
    max_upload_size_mb: int = 25

    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_DIRECTORY / ".env", API_DIRECTORY / ".env"),
        env_ignore_empty=True,
        extra="ignore",
    )

settings = Settings()
