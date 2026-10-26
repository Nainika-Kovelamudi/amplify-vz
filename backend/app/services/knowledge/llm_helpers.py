from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings
from app.services.agents.base import _get_llm_configs

logger = logging.getLogger(__name__)

_GEMINI_EMBED_URL_TMPL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent"


def _safe_json(text: str) -> dict[str, Any]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


async def call_llm_text(system_msg: str, prompt: str, temperature: float = 0.3) -> str:
    """Single-shot chat completion, provider fallback (Gemini -> Groq), plain text out."""
    settings = get_settings()
    llm_configs = _get_llm_configs(settings)

    last_exc: Exception | None = None
    for provider, api_url, model, api_key in llm_configs:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    api_url,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "temperature": temperature,
                        "messages": [
                            {"role": "system", "content": system_msg},
                            {"role": "user", "content": prompt},
                        ],
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001 - fall through to next provider
            last_exc = exc
            logger.warning("[knowledge-bot] %s call failed: %s", provider, exc)

    raise RuntimeError(f"All LLM providers failed for knowledge-bot call: {last_exc}")


async def call_llm_json(system_msg: str, prompt: str, temperature: float = 0.2) -> dict[str, Any]:
    raw = await call_llm_text(system_msg, prompt, temperature=temperature)
    return _safe_json(raw)


async def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Embed text via Gemini's embedContent endpoint. Requires GEMINI_API_KEY specifically —
    Groq has no embeddings API, so there is no fallback provider for this call.

    task_type distinguishes indexing calls (RETRIEVAL_DOCUMENT, the default — used by
    ingestion_service.py) from query-time calls (RETRIEVAL_QUERY — used by
    retrieval_service.py); Gemini's embedding model is asymmetric and expects this for
    good retrieval quality.

    outputDimensionality is pinned to settings.gemini_embedding_dimensions (768) because
    gemini-embedding-001 defaults to 3072 dimensions, which would not match the Atlas
    Vector Search index's numDimensions (see docs/knowledge-bot-plan.md §7a #3)."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is required for the knowledge bot's embeddings (Groq has no embeddings API)."
        )

    url = _GEMINI_EMBED_URL_TMPL.format(model=settings.gemini_embedding_model)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
            json={
                "model": f"models/{settings.gemini_embedding_model}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
                "outputDimensionality": settings.gemini_embedding_dimensions,
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["embedding"]["values"]
