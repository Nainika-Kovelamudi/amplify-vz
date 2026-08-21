from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class RelevanceAgent(BaseAgent):
    name = "RelevanceAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        desc = (payload.get("description") or "").strip()
        desc_words = len(desc.split()) if desc else 0
        return f"""You are an enterprise technology relevance evaluator for InfoVision's internal Amplify platform.

STRICT SCORING RULES — YOU MUST FOLLOW THESE:
- If description is empty or None → score MUST be 0–10.
- If description has fewer than 20 words → score MUST be 0–25.
- If description has fewer than 50 words → score MUST NOT exceed 45.
- If tech_stack is empty → deduct 15 points from your score.
- If family or department is missing → deduct 10 points.
- Do NOT assume, infer, or imagine information that is not explicitly provided.
- Base your score ONLY on information actually present in the submission.

Submission word count: {desc_words} words.

Asset Details:
- Title: {payload.get("title") or "(not provided)"}
- Description: {desc or "(empty — no description provided)"}
- Family: {payload.get("family") or "(not provided)"}
- Department: {payload.get("department") or "(not provided)"}
- Tech Stack: {payload.get("tech_stack") or "(none listed)"}
- Cloud Provider: {payload.get("cloud_provider") or "(not provided)"}

Evaluate on these dimensions (0-100):
1. Business relevance to InfoVision's service lines
2. Reusability potential across multiple projects
3. Alignment with current enterprise technology trends
4. Competitive differentiation value

Return JSON:
{{
  "score": <integer 0-100>,
  "business_relevance": <integer 0-100>,
  "reusability": <integer 0-100>,
  "market_alignment": <integer 0-100>,
  "feedback": "<2-3 sentence summary>",
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "business_relevance": data.get("business_relevance", 0),
                "reusability": data.get("reusability", 0),
                "market_alignment": data.get("market_alignment", 0),
            },
        }
