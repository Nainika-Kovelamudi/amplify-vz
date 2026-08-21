from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class DuplicateCheckAgent(BaseAgent):
    name = "DuplicateCheckAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        existing_entries = payload.get("existing_entries", [])
        existing_sample = existing_entries[:40]
        new_title = (payload.get("title") or "").strip()
        new_desc  = (payload.get("description") or "").strip()[:600]
        new_stack = payload.get("tech_stack") or []

        def _entry_block(entries: list) -> str:
            if not entries:
                return "(no existing entries)"
            lines = []
            for i, e in enumerate(entries, 1):
                desc_snippet = (e.get("description") or "").strip()[:200]
                lines.append(f"{i}. Title: {e['title']}\n   Description: {desc_snippet or '(none)'}")
            return "\n".join(lines)

        catalog_block = _entry_block(existing_sample)

        return f"""You are a deduplication evaluator for InfoVision's Amplify AI accelerator catalog.

Your job is to determine whether the NEW SUBMISSION is the same asset being re-submitted, or a near-duplicate of an existing entry.
Compare on BOTH title AND description — a different title does not save a submission if the description solves the exact same problem.

=== NEW SUBMISSION ===
Title:       {new_title or "(not provided)"}
Description: {new_desc or "(none)"}
Tech Stack:  {new_stack}
Family:      {payload.get("family") or "(not specified)"}

=== EXISTING CATALOG ENTRIES ===
{catalog_block}

=== EVALUATION RULES (apply in order) ===

RULE 1 — EXACT RE-SUBMISSION:
Title AND description are essentially the same (same wording, same problem, same solution).
→ is_duplicate = true, score = 0. This is the same asset re-submitted.

RULE 2 — SAME ASSET, DIFFERENT TITLE:
The description, problem statement, and solution are the same as an existing entry even if the title was changed.
→ is_duplicate = true, score = 5–15.

RULE 3 — NEAR-DUPLICATE (same problem domain + same core approach):
The new submission solves the same business problem using the same technology/approach as an existing entry,
providing no additional value or differentiation.
→ is_duplicate = true, score = 20–40.

RULE 4 — OVERLAPPING BUT DIFFERENTIATED:
Covers a similar area but has a meaningfully different scope, tech stack, use case, or integration target.
→ is_duplicate = false, score = 50–70.

RULE 5 — GENUINELY NOVEL:
Solves a different problem, uses a different approach, or fills a clear gap not covered by any existing entry.
→ is_duplicate = false, score = 75–100.

IMPORTANT GUIDELINES:
- Only compare against the entries listed above. Do NOT invent entries.
- If the existing list is empty → is_duplicate = false, score = 90.
- If the title is different but the description is nearly identical → still is_duplicate = true (Rule 2).
- Generic descriptions (< 20 words, no technical detail) → lower confidence, do not assume duplicate.

Return ONLY valid JSON — no markdown, no explanation outside the JSON:
{{
  "score": <integer 0-100>,
  "is_duplicate": <boolean>,
  "similar_to": "<title of the most similar existing entry, or null>",
  "novelty_score": <integer 0-100>,
  "feedback": "<2-3 sentences: name the matching entry if any, explain why it is or is not a duplicate>",
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 50)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "is_duplicate": bool(data.get("is_duplicate", False)),
                "similar_to": data.get("similar_to"),
                "novelty_score": int(data.get("novelty_score", 50)),
            },
        }
