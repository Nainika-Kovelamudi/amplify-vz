from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class TechQualityAgent(BaseAgent):
    name = "TechQualityAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        desc = (payload.get("description") or "").strip()
        desc_words = len(desc.split()) if desc else 0
        tech_stack = payload.get("tech_stack") or []
        has_repo = bool(payload.get("repo_url"))
        has_deps = bool((payload.get("dependencies") or "").strip())
        has_commands = bool(payload.get("commands"))
        return f"""You are a senior software architect evaluating technical quality for InfoVision's Amplify platform.

STRICT SCORING RULES — YOU MUST FOLLOW THESE:
- If description is empty or None → score MUST be 0–10.
- If description has fewer than 20 words → score MUST be 0–20.
- If description has fewer than 50 words → score MUST NOT exceed 40.
- If tech_stack is empty → score MUST NOT exceed 25 (cannot evaluate technical quality without a stack).
- If no repo URL is provided → deduct 10 points (no evidence of actual code).
- If no dependencies or commands are listed → deduct 5 points each.
- If cloud_provider is missing → deduct 10 points.
- Do NOT assume or infer technical choices not listed. Score only what is explicitly stated.

Submission word count: {desc_words} words. Tech stack items: {len(tech_stack)}.
Has repo: {has_repo}. Has dependencies: {has_deps}. Has setup commands: {has_commands}.

Asset Details:
- Title: {payload.get("title") or "(not provided)"}
- Description: {desc or "(empty — no description provided)"}
- Tech Stack: {tech_stack or "(none listed)"}
- Cloud Provider: {payload.get("cloud_provider") or "(not provided)"}
- Maturity Level: {payload.get("maturity") or "(not provided)"}
- Repo URL: {"provided" if has_repo else "(not provided)"}
- Dependencies: {payload.get("dependencies") or "(not provided)"}
- Setup Commands: {payload.get("commands") or "(none listed)"}

Evaluate on these dimensions (0-100):
1. Technical sophistication and modern architecture patterns
2. Cloud-native maturity (12-factor app, containerisation, IaC)
3. Security posture (auth, secrets management, least privilege)
4. Scalability and resilience design
5. Code quality signals from description, dependencies and commands

Return JSON:
{{
  "score": <integer 0-100>,
  "architecture_score": <integer 0-100>,
  "cloud_native_score": <integer 0-100>,
  "security_score": <integer 0-100>,
  "feedback": "<2-3 sentence summary>",
  "red_flags": ["<flag1>", "<flag2>"],
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "architecture_score": data.get("architecture_score", 0),
                "cloud_native_score": data.get("cloud_native_score", 0),
                "security_score": data.get("security_score", 0),
                "red_flags": data.get("red_flags", []),
            },
        }
