from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class DescriptionAgent(BaseAgent):
    name = "DescriptionAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        desc = (payload.get("description") or "").strip()
        desc_words = len(desc.split()) if desc else 0
        return f"""You are a technical content quality evaluator for InfoVision's Amplify platform.

STRICT SCORING RULES — YOU MUST FOLLOW THESE:
- If description is empty or None → score MUST be 0. There is nothing to evaluate.
- If description has fewer than 10 words → score MUST be 0–10.
- If description has fewer than 20 words → score MUST be 0–20.
- If description has fewer than 50 words → score MUST NOT exceed 40.
- If description lacks: (a) what problem it solves, (b) how it works, (c) who uses it → deduct 15 points each.
- A title alone is NOT a description. Score the description field only.

Submission word count: {desc_words} words.
Has architecture/design document: {bool(payload.get("architecture_file_url"))}.

Asset Details:
- Title: {payload.get("title") or "(not provided)"}
- Description: {desc or "(empty — no description provided)"}
- Family: {payload.get("family") or "(not provided)"}
- Tech Stack: {payload.get("tech_stack") or "(none listed)"}
- Architecture/Design Doc: {"uploaded — award +5 on completeness" if payload.get("architecture_file_url") else "(not uploaded — deduct 5 from completeness)"}

Evaluate on these dimensions (0-100):
1. Clarity and completeness of the description
2. Technical accuracy and precision of language
3. Presence of key info: problem solved, solution approach, usage prerequisites
4. SEO/discoverability — would engineers find this searching for the problem it solves?

Return JSON:
{{
  "score": <integer 0-100>,
  "clarity": <integer 0-100>,
  "completeness": <integer 0-100>,
  "discoverability": <integer 0-100>,
  "feedback": "<2-3 sentence summary>",
  "suggested_tags": ["<tag1>", "<tag2>", "<tag3>"],
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "clarity": data.get("clarity", 0),
                "completeness": data.get("completeness", 0),
                "discoverability": data.get("discoverability", 0),
                "suggested_tags": data.get("suggested_tags", []),
            },
        }
