from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Default to zero-setup SQLite database so the app runs without Docker/PostgreSQL
    database_url: str = "sqlite:///./questify.db"
    web_origin: str = "http://localhost:3000"
    secret_key: str = "questify-secret-key-change-in-production-super-secure-32bytes"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 1 day

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
