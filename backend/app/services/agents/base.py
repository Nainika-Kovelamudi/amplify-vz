from __future__ import annotations

import asyncio
import json
import logging
import re
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Groq — OpenAI-compatible fallback
_GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

# Gemini — OpenAI-compatible primary
_GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


def _get_llm_configs(settings) -> list[tuple[str, str, str, str]]:
    """Return configured providers in primary-to-fallback order."""
    configs: list[tuple[str, str, str, str]] = []
    if settings.gemini_api_key:
        if not settings.gemini_model:
            raise RuntimeError("GEMINI_MODEL must be set when GEMINI_API_KEY is configured.")
        configs.append(
            ("Gemini", _GEMINI_API_URL, settings.gemini_model, settings.gemini_api_key)
        )
    if settings.groq_api_key:
        if not settings.groq_model:
            raise RuntimeError("GROQ_MODEL must be set when GROQ_API_KEY is configured.")
        configs.append(
            ("Groq", _GROQ_API_URL, settings.groq_model, settings.groq_api_key)
        )
    if not configs:
        raise RuntimeError(
            "No LLM API key configured. Set GEMINI_API_KEY (primary) and GROQ_API_KEY "
            "(fallback) in environment variables or Azure Key Vault."
        )
    return configs


class BaseAgent(ABC):
    temperature: float = 0.2

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    def build_prompt(self, payload: dict[str, Any]) -> str: ...

    @abstractmethod
    def parse_response(self, raw: str) -> dict[str, Any]: ...

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        settings = get_settings()
        try:
            llm_configs = _get_llm_configs(settings)
        except RuntimeError as exc:
            logger.error("[%s] %s", self.name, exc)
            print(f"[AGENT:{self.name}] NO API KEY — fallback score=0", flush=True)
            return self._fallback()

        prompt = self.build_prompt(payload)
        system_msg = (
            "You are an expert AI scoring agent for InfoVision's Amplify platform. "
            "Always respond with valid JSON only — no markdown, no explanation, "
            "just the raw JSON object."
        )

        last_exc: Exception | None = None
        for provider, api_url, model, api_key in llm_configs:
            logger.info(
                "[%s] AI scoring provider=%s model=%s",
                self.name, provider, model,
            )
            for attempt in range(3):
                try:
                    if attempt > 0:
                        await asyncio.sleep(2 ** attempt)  # 2s, 4s backoff
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        response = await client.post(
                            api_url,
                            headers={
                                "Authorization": f"Bearer {api_key}",
                                "Content-Type": "application/json",
                            },
                            json={
                                "model": model,
                                "temperature": self.temperature,
                                "messages": [
                                    {"role": "system", "content": system_msg},
                                    {"role": "user", "content": prompt},
                                ],
                            },
                        )
                        if response.status_code == 429:
                            retry_after = int(response.headers.get("retry-after", 10))
                            logger.warning(
                                "[%s] %s rate limited - waiting %ss",
                                self.name, provider, retry_after,
                            )
                            await asyncio.sleep(retry_after)
                            last_exc = Exception(
                                f"{provider} rate limited (attempt {attempt + 1})"
                            )
                            continue
                        if response.status_code >= 400:
                            body = response.text[:500]
                            raise RuntimeError(
                                f"{provider} HTTP {response.status_code}: {body}"
                            )
                        response.raise_for_status()
                        data = response.json()
                        raw = data["choices"][0]["message"]["content"]
                        print(
                            f"\n[AGENT:{self.name}] {provider} RAW RESPONSE:\n{raw[:800]}\n",
                            flush=True,
                        )
                        parsed = self.parse_response(raw)
                        print(
                            f"[AGENT:{self.name}] {provider} PARSED "
                            f"score={parsed.get('score')} confidence={parsed.get('confidence')}",
                            flush=True,
                        )
                        return parsed
                except Exception as exc:
                    last_exc = exc
                    print(
                        f"[AGENT:{self.name}] {provider} ATTEMPT "
                        f"{attempt + 1} FAILED: {exc}",
                        flush=True,
                    )
                    logger.warning(
                        "[%s] %s attempt %d failed: %s",
                        self.name, provider, attempt + 1, exc,
                    )

            logger.warning(
                "[%s] %s exhausted all retries; trying next configured provider",
                self.name, provider,
            )

        print(f"[AGENT:{self.name}] ALL ATTEMPTS FAILED → fallback score=0", flush=True)
        logger.error("[%s] All attempts failed: %s", self.name, last_exc)
        return self._fallback()

    def _fallback(self) -> dict[str, Any]:
        return {"score": 0, "feedback": f"{self.name} agent encountered an error.", "confidence": 0.0}

    @staticmethod
    def _safe_json(text: str) -> dict:
        text = text.strip()
        # strip markdown code fences
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # try to extract first JSON object
            m = re.search(r"\{.*\}", text, re.DOTALL)
            if m:
                try:
                    return json.loads(m.group())
                except json.JSONDecodeError:
                    pass
        return {}
