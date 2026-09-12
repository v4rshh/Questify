"""Thin wrapper around Groq's OpenAI-compatible chat completions API."""
from openai import OpenAI

from ..config import settings

_client: OpenAI | None = None


def get_llm_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY is not set. Add a Groq API key to your .env file.")
        _client = OpenAI(
            api_key=settings.llm_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
    return _client


def chat_completion(messages: list[dict], temperature: float = 0.4, max_tokens: int = 1024) -> str:
    client = get_llm_client()
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""
