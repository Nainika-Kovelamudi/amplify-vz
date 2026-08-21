from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class VideoValidationAgent(BaseAgent):
    name = "VideoValidationAgent"

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Short-circuit when none of video / demo / repo are provided at all."""
        has_video = bool(payload.get("video_url"))
        has_demo  = bool(payload.get("demo_url"))
        has_repo  = bool(payload.get("repo_url"))
        if not has_video and not has_demo and not has_repo:
            return {
                "score": 0,
                "feedback": "No demo video, live demo URL, or repository link was provided. At least one artifact is required.",
                "confidence": 1.0,
                "details": {
                    "video_valid": False,
                    "demo_valid": False,
                    "repo_valid": False,
                    "relevance_match": False,
                    "issues": ["No video uploaded", "No demo URL provided", "No repo URL provided"],
                },
            }
        return await super().run(payload)

    def build_prompt(self, payload: dict[str, Any]) -> str:
        video_meta  = payload.get("video_meta") or {}
        demo_meta   = payload.get("demo_meta") or {}
        repo_meta   = payload.get("repo_meta") or {}
        title       = payload.get("title") or "(not provided)"
        description = (payload.get("description") or "").strip()[:300]

        # ── Video summary ──────────────────────────────────────────────────────
        if not video_meta:
            video_line = "Uploaded video: not provided"
        elif not video_meta.get("valid"):
            video_line = f"Uploaded video: INVALID — {video_meta.get('reason', 'unknown error')}"
        else:
            size_mb = video_meta.get("file_size_mb", "?")
            ct = video_meta.get("content_type", "unknown")
            video_line = f"Uploaded video: accessible | size={size_mb} MB | type={ct}"

        # ── Demo URL summary ───────────────────────────────────────────────────
        if not demo_meta:
            demo_line = "Demo URL: not provided"
        elif not demo_meta.get("valid"):
            demo_line = f"Demo URL: NOT accessible — {demo_meta.get('reason', 'unknown error')}"
        else:
            page_title = demo_meta.get("page_title", "")
            page_title_part = f' | page_title="{page_title}"' if page_title else ''
            demo_line = f"Demo URL: live{page_title_part}"

        # ── Repo URL summary ───────────────────────────────────────────────────
        if not repo_meta:
            repo_line = "Repo URL: not provided"
        elif not repo_meta.get("valid"):
            repo_line = f"Repo URL: NOT accessible — {repo_meta.get('reason', 'unknown error')}"
        else:
            lang = repo_meta.get("language", "")
            desc = repo_meta.get("description", "")
            parts = ["Repo URL: accessible"]
            if lang:
                parts.append(f"language={lang}")
            if desc:
                parts.append(f'description="{desc[:80]}"')
            repo_line = " | ".join(parts)

        return f"""You are an artifact validator for InfoVision's Amplify platform.

Your task: evaluate the quality of the asset's supporting artifacts — uploaded demo video, live demo URL, and source repository — based on the metadata retrieved from each.

Submission context:
- Title: {title}
- Description: {description or "(none)"}

Artifact Check Results (automatically verified):
- {video_line}
- {demo_line}
- {repo_line}

Evaluate on these dimensions:
1. **Uploaded video** — Is a video file present and accessible? Is the file size reasonable (> 1 MB means real content; very small files are likely empty/corrupt)?
2. **Demo accessibility** — Is the live demo URL live and returning a valid page?
3. **Repo quality** — Is the repo URL accessible? Does the language/description align with the submission?
4. **Overall artifact coverage** — How well do the artifacts collectively support the submission?

STRICT SCORING RULES:
- No video AND no live demo AND no repo → score MUST NOT exceed 25.
- Video uploaded but NOT accessible or file is corrupt/empty → treat as missing — deduct 15 points.
- Video accessible and file size > 1 MB → award up to +20 bonus points (it's a real recording).
- Demo URL not accessible → deduct 10 points.
- Repo URL not accessible → deduct 10 points.
- All three artifacts present and valid → score can reach 90–100.
- One artifact valid → score ceiling is 50.
- Two artifacts valid → score ceiling is 75.

Return JSON:
{{
  "score": <integer 0-100>,
  "video_valid": <boolean>,
  "demo_valid": <boolean>,
  "repo_valid": <boolean>,
  "relevance_match": <boolean>,
  "feedback": "<2-3 sentence assessment>",
  "issues": ["<issue1>", "<issue2>"],
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "video_valid": data.get("video_valid", False),
                "demo_valid": data.get("demo_valid", False),
                "repo_valid": data.get("repo_valid", False),
                "relevance_match": data.get("relevance_match", False),
                "issues": data.get("issues", []),
            },
        }

    def _fallback(self) -> dict[str, Any]:
        return {
            "score": 0,
            "feedback": "Video/URL validation agent failed.",
            "confidence": 0.0,
            "details": {
                "video_valid": False,
                "demo_valid": False,
                "repo_valid": False,
                "relevance_match": False,
                "issues": ["Agent error"],
            },
        }
