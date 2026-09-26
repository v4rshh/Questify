"""Thin wrapper around Groq's OpenAI-compatible chat completions API."""
from openai import OpenAI

from ..config import settings

_client: OpenAI | None = None


def strict_schema(schema: dict) -> dict:
    """Require object fields recursively; Pydantic still checks content bounds."""
    def convert(value):
        if isinstance(value, list):
            return [convert(item) for item in value]
        if not isinstance(value, dict):
            return value
        result = {key: convert(item) for key, item in value.items() if key != 'default'}
        if result.get('type') == 'object':
            result['additionalProperties'] = False
            result['required'] = list(result.get('properties', {}))
        return result
    return convert(schema)


def get_llm_client() -> OpenAI:
    global _client
    if _client is None:
        if not settings.llm_api_key:
            raise RuntimeError("LLM_API_KEY is not set. Add a Groq API key to your .env file.")
        _client = OpenAI(
            api_key=settings.llm_api_key,
            base_url="https://api.groq.com/openai/v1",
            timeout=120.0,
        )
    return _client


def chat_completion(messages: list[dict], temperature: float = 0.4, max_tokens: int = 1024,
                    json_schema: dict | None = None) -> str:
    client = get_llm_client()
    options = {}
    if json_schema is not None:
        # Curriculum stages own their retries and honor provider reset times.
        client = client.with_options(max_retries=0)
        options['response_format'] = {'type': 'json_object'}
        if settings.llm_model in ('openai/gpt-oss-20b', 'openai/gpt-oss-120b'):
            options['response_format'] = {'type': 'json_schema', 'json_schema': {
                'name': 'curriculum_stage', 'strict': True, 'schema': strict_schema(json_schema),
            }}
            options['reasoning_effort'] = 'low'
    response = client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        **options,
    )
    return response.choices[0].message.content or ""
