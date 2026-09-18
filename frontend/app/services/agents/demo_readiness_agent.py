from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class DemoReadinessAgent(BaseAgent):
    name = "DemoReadinessAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        video_meta  = payload.get("video_meta") or {}
        demo_meta   = payload.get("demo_meta") or {}
        has_video   = bool(payload.get("video_url"))
        has_demo    = bool(payload.get("demo_url"))
        has_arch    = bool(payload.get("architecture_file_url"))
        demo_ready  = bool(payload.get("demo_ready"))
        desc        = (payload.get("description") or "").strip()
        desc_words  = len(desc.split()) if desc else 0

        size_mb = video_meta.get("file_size_mb")
        video_status = (
            f"uploaded video accessible ({size_mb} MB)" if video_meta.get("valid")
            else ("not provided" if not has_video else "uploaded but inaccessible or corrupt")
        )
        demo_status  = "valid & live" if demo_meta.get("valid") else ("not provided" if not has_demo else "inaccessible/broken")

        return f"""You are a client-delivery readiness evaluator for InfoVision's Amplify platform.

STRICT SCORING RULES — YOU MUST FOLLOW THESE:
- If description is empty → score MUST be 0–15. You cannot assess demo readiness with no information.
- If description has fewer than 20 words → score MUST NOT exceed 35.
- If no demo URL AND no video uploaded → cap the demo-artifact sub-score at 40 (but overall score can still reach 60 based on description, maturity, and architecture doc).
- If maturity is "Experimental" → overall score MUST NOT exceed 65.
- If maturity is "Battle-Tested" → score may reach up to 80.
- If maturity is "Production" → score may reach up to 100.
- Video URL valid and accessible → award up to +15 bonus points. Video inaccessible → NO bonus.
- Live demo URL valid and live → award up to +20 bonus points. Demo inaccessible → NO bonus.
- Having an architecture/design document: award up to +5 bonus points.
- Demo Ready flag being True (submitter self-certifies) is worth +5 points only if supported by evidence (demo URL or video). Do NOT penalise heavily for demo_ready=False alone.
- Do NOT award points for things the submitter has not provided or that are inaccessible.

Submission word count: {desc_words} words.
Demo flag: {demo_ready}. Video status: {video_status}. Demo URL status: {demo_status}. Has architecture doc: {has_arch}.

Asset Details:
- Title: {payload.get("title") or "(not provided)"}
- Description: {desc or "(empty — no description provided)"}
- Demo Ready Flag: {demo_ready}
- Live Demo URL: {demo_status}
- Video Demo URL: {video_status}
- Architecture/Design Document: {"uploaded" if has_arch else "(not uploaded)"}
- Maturity Level: {payload.get("maturity") or "(not provided)"}
- Tech Stack: {payload.get("tech_stack") or "(none listed)"}

Evaluate on these dimensions (0-100):
1. Demo readiness — can this be shown to a client TODAY?
2. Setup complexity — how hard is it to spin up a demo environment?
3. Visual polish — does the solution likely have a presentable UI/output?
4. Completeness — is this MVP, beta, or production-grade?

Return JSON:
{{
  "score": <integer 0-100>,
  "client_ready": <boolean>,
  "setup_complexity": "low" | "medium" | "high",
  "feedback": "<2-3 sentence summary>",
  "blockers": ["<blocker1>"],
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "client_ready": data.get("client_ready", False),
                "setup_complexity": data.get("setup_complexity", "high"),
                "blockers": data.get("blockers", []),
            },
        }
