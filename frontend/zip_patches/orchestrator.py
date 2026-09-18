"""
app/services/orchestrator.py
Agentic Scoring Pipeline for Amplify.

Run as a FastAPI BackgroundTask after POST /submissions:

    background_tasks.add_task(
        run_scoring_pipeline,
        submission_id=str(submission.id),
        submission_data=submission_dict,
        db=db,
    )
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import re
from abc import ABC, abstractmethod
from typing import Any

import google.generativeai as genai
from openai import AsyncOpenAI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PASS_THRESHOLD = 60

WEIGHT_RELEVANCE = 0.30
WEIGHT_TECH = 0.25
WEIGHT_DESCRIPTION = 0.20
WEIGHT_DEMO = 0.15
DUPLICATE_PENALTY = 10

DUPLICATE_SIMILARITY_THRESHOLD = 0.85


# ---------------------------------------------------------------------------
# LLM helpers — Gemini (primary) with Groq fallback
# ---------------------------------------------------------------------------
_GEMINI_MODEL = "gemini-1.5-flash"
_GROQ_MODEL = "openai/gpt-oss-120b"
_GROQ_BASE_URL = "https://api.groq.com/openai/v1"


def _parse_llm_response(raw: str) -> dict[str, Any]:
    """Strip markdown fences and parse JSON from an LLM response."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    data = json.loads(raw)
    score = max(0, min(100, int(data.get("score", 0))))
    reasoning = str(data.get("reasoning", data.get("reason", "")))
    return {"score": score, "reasoning": reasoning}


async def _call_gemini(prompt: str, system: str) -> dict[str, Any]:
    """Call Gemini 1.5-flash. Raises on any failure."""
    model = genai.GenerativeModel(
        model_name=_GEMINI_MODEL,
        system_instruction=system,
    )
    response = await asyncio.to_thread(
        model.generate_content,
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )
    return _parse_llm_response(response.text)


async def _call_groq(prompt: str, system: str) -> dict[str, Any]:
    """Call Groq (openai/gpt-oss-120b) via OpenAI-compatible endpoint. Raises on any failure."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    client = AsyncOpenAI(api_key=api_key, base_url=_GROQ_BASE_URL)
    resp = await client.chat.completions.create(
        model=_GROQ_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
    )
    raw = resp.choices[0].message.content or ""
    return _parse_llm_response(raw)


async def call_llm(prompt: str, system: str) -> dict[str, Any]:
    """
    Primary: Gemini 1.5-flash.
    Fallback: Groq openai/gpt-oss-120b (OpenAI-compatible endpoint).

    Returns a dict with at least ``{"score": int, "reasoning": str}``.
    On total failure returns ``{"score": 0, "reasoning": "<error message>"}``.
    """
    try:
        return await _call_gemini(prompt, system)
    except Exception as gemini_exc:  # noqa: BLE001
        logger.warning("Gemini call failed (%s) — falling back to Groq", gemini_exc)
    try:
        return await _call_groq(prompt, system)
    except Exception as groq_exc:  # noqa: BLE001
        logger.error("Groq fallback also failed: %s", groq_exc)
        return {"score": 0, "reasoning": f"All LLM calls failed. Last error: {groq_exc}"}


# ---------------------------------------------------------------------------
# Embedding / similarity utilities
# ---------------------------------------------------------------------------
def get_text_embedding(text_input: str) -> list[float]:
    """Return a float embedding vector using the Gemini embedding model."""
    try:
        result = genai.embed_content(
            model="models/embedding-001",
            content=text_input,
            task_type="RETRIEVAL_DOCUMENT",
        )
        return result["embedding"]
    except Exception as exc:  # noqa: BLE001
        logger.error("get_text_embedding failed: %s", exc)
        return []


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two equal-length vectors. Returns 0.0 on error."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    mag_a = math.sqrt(sum(a * a for a in vec_a))
    mag_b = math.sqrt(sum(b * b for b in vec_b))
    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0
    return dot / (mag_a * mag_b)


# ---------------------------------------------------------------------------
# Base agent
# ---------------------------------------------------------------------------
class BaseAgent(ABC):
    """Abstract base class for all Amplify scoring agents."""

    @abstractmethod
    async def score(self, data: dict) -> tuple[int, str]:
        """
        Evaluate the submission.

        Parameters
        ----------
        data:
            Submission payload dict.

        Returns
        -------
        (score, reasoning)
            score   – integer in [0, 100]
            reasoning – human-readable explanation
        """


# ---------------------------------------------------------------------------
# Concrete agents
# ---------------------------------------------------------------------------
class RelevanceAgent(BaseAgent):
    """
    Agent 1 — RelevanceAgent
    Is the submission a genuine InfoVision POC?
    Powered by Gemini.
    """

    _SYSTEM = (
        "You are an expert evaluator for InfoVision, a global IT services company. "
        "Your task is to determine whether a submitted project is a genuine Proof-of-Concept (POC) "
        "that solves a real client or internal business problem aligned with InfoVision's service lines "
        "(AI/ML, cloud, digital transformation, data engineering, enterprise apps, etc.).\n\n"
        "Scoring guide:\n"
        "  80–100 : clearly relevant InfoVision POC with business impact\n"
        "  50–79  : partial relevance or unclear business alignment\n"
        "  0–49   : not relevant, purely academic, or generic open-source clone\n\n"
        "Respond ONLY with valid JSON: "
        "{\"score\": <integer 0-100>, \"reasoning\": \"<one or two sentences>\"}"
    )

    async def score(self, data: dict) -> tuple[int, str]:
        prompt = (
            f"Project Title: {data.get('title', 'N/A')}\n"
            f"Description: {data.get('description', 'N/A')}\n"
            f"Tech Stack: {data.get('tech_stack', 'N/A')}\n"
            f"Category: {data.get('category', 'N/A')}\n"
            f"Submitter Role: {data.get('role', 'N/A')}\n\n"
            "Evaluate the business relevance of this submission to InfoVision's POC catalog."
        )
        result = await call_llm(prompt, self._SYSTEM)
        return result["score"], result["reasoning"]


class TechQualityAgent(BaseAgent):
    """
    Agent 2 — TechQualityAgent
    Code / architecture completeness.
    Powered by Gemini.
    """

    _SYSTEM = (
        "You are a senior software architect reviewing POC submissions for technical quality.\n"
        "Assess: code completeness, architecture clarity, appropriate tech-stack choices, "
        "scalability considerations, basic security hygiene, and documentation of technical decisions.\n\n"
        "Scoring guide:\n"
        "  80–100 : production-ready or near-production quality\n"
        "  50–79  : functional but missing important technical elements\n"
        "  0–49   : incomplete, broken, or very low quality\n\n"
        "Respond ONLY with valid JSON: "
        "{\"score\": <integer 0-100>, \"reasoning\": \"<one or two sentences>\"}"
    )

    async def score(self, data: dict) -> tuple[int, str]:
        prompt = (
            f"Project Title: {data.get('title', 'N/A')}\n"
            f"Tech Stack: {data.get('tech_stack', 'N/A')}\n"
            f"GitHub URL: {data.get('github_url', 'N/A')}\n"
            f"Architecture Notes: {data.get('architecture_notes', 'N/A')}\n"
            f"Description: {data.get('description', 'N/A')}\n\n"
            "Evaluate the technical quality and completeness of this POC."
        )
        result = await call_llm(prompt, self._SYSTEM)
        return result["score"], result["reasoning"]


class DescriptionAgent(BaseAgent):
    """
    Agent 3 — DescriptionAgent
    Docs and description clarity.
    Powered by Gemini.
    """

    _SYSTEM = (
        "You are a technical writer and documentation expert reviewing POC submissions.\n"
        "Assess: clarity of the problem statement, solution description, setup/installation "
        "instructions, use-case explanation, target audience definition, and overall readability.\n\n"
        "Scoring guide:\n"
        "  80–100 : excellent, clear, and complete documentation\n"
        "  50–79  : adequate documentation but with noticeable gaps\n"
        "  0–49   : poor, confusing, or largely missing documentation\n\n"
        "Respond ONLY with valid JSON: "
        "{\"score\": <integer 0-100>, \"reasoning\": \"<one or two sentences>\"}"
    )

    async def score(self, data: dict) -> tuple[int, str]:
        prompt = (
            f"Project Title: {data.get('title', 'N/A')}\n"
            f"Description: {data.get('description', 'N/A')}\n"
            f"README Content: {data.get('readme', 'N/A')}\n"
            f"Setup Instructions: {data.get('setup_instructions', 'N/A')}\n\n"
            "Evaluate the documentation quality and description clarity of this POC."
        )
        result = await call_llm(prompt, self._SYSTEM)
        return result["score"], result["reasoning"]


class DemoReadinessAgent(BaseAgent):
    """
    Agent 4 — DemoReadinessAgent
    Demo video / assets present?
    Rule-based (video_url present → +40, live_demo_url → +10) plus a Gemini bonus (0-50).
    """

    _SYSTEM = (
        "You are evaluating whether a POC is ready for a client or internal demo.\n"
        "Consider the presence of: screenshots, live demo URL, presentation slides, "
        "or a detailed walkthrough document.\n\n"
        "Provide a BONUS score between 0 and 50 that supplements the rule-based score "
        "(which already accounts for whether a demo video exists).\n\n"
        "Scoring guide for bonus:\n"
        "  40–50 : excellent supplementary demo assets\n"
        "  20–39 : some supporting materials present\n"
        "  0–19  : minimal or no additional demo materials\n\n"
        "Respond ONLY with valid JSON: "
        "{\"score\": <integer 0-50>, \"reasoning\": \"<one or two sentences>\"}"
    )

    async def score(self, data: dict) -> tuple[int, str]:
        # --- Rule-based base score ---
        base_score = 0
        base_notes: list[str] = []

        if data.get("video_url"):
            base_score += 40
            base_notes.append("demo video present (+40)")
        else:
            base_notes.append("no demo video")

        if data.get("live_demo_url"):
            base_score += 10
            base_notes.append("live demo URL present (+10)")

        # --- Gemini bonus (capped at 50) ---
        prompt = (
            f"Project Title: {data.get('title', 'N/A')}\n"
            f"Video URL: {data.get('video_url', 'None')}\n"
            f"Live Demo URL: {data.get('live_demo_url', 'None')}\n"
            f"Screenshots: {data.get('screenshots', 'None')}\n"
            f"Presentation URL: {data.get('presentation_url', 'None')}\n"
            f"Description: {data.get('description', 'N/A')}\n\n"
            "Provide a bonus score (0-50) for demo readiness quality "
            "beyond the presence of a video."
        )
        llm_result = await call_llm(prompt, self._SYSTEM)
        bonus = max(0, min(50, llm_result["score"]))
        total = max(0, min(100, base_score + bonus))

        reasoning = (
            f"Rule-based: {'; '.join(base_notes)} (base={base_score}). "
            f"LLM bonus: {llm_result['reasoning']} (bonus={bonus}). "
            f"Total={total}."
        )
        return total, reasoning


class DuplicateCheckAgent(BaseAgent):
    """
    Agent 5 — DuplicateCheckAgent
    Semantic similarity vs catalog DB using embeddings + cosine similarity.

    Returns (0, reasoning)   when a duplicate is detected  → is_duplicate = True
    Returns (100, reasoning) otherwise                      → is_duplicate = False
    """

    def __init__(self, db: AsyncSession, submission_id: str) -> None:
        self.db = db
        self.submission_id = submission_id

    async def score(self, data: dict) -> tuple[int, str]:
        text_to_embed = (
            f"{data.get('title', '')} {data.get('description', '')} "
            f"{data.get('tech_stack', '')}"
        ).strip()

        new_embedding: list[float] = await asyncio.to_thread(
            get_text_embedding, text_to_embed
        )
        if not new_embedding:
            return 100, "Could not compute embedding; skipping duplicate check."

        try:
            rows = await self.db.execute(
                text(
                    "SELECT id, title, embedding FROM submissions "
                    "WHERE id != :sid "
                    "  AND status != 'Archived' "
                    "  AND embedding IS NOT NULL"
                ),
                {"sid": self.submission_id},
            )
            existing = rows.fetchall()
        except Exception as exc:  # noqa: BLE001
            logger.error("DuplicateCheckAgent DB query failed: %s", exc)
            return 100, f"DB query failed; skipping duplicate check: {exc}"

        max_similarity = 0.0
        most_similar_id: str | None = None
        most_similar_title: str | None = None

        for row in existing:
            stored_embedding = row.embedding
            if isinstance(stored_embedding, str):
                try:
                    stored_embedding = json.loads(stored_embedding)
                except Exception:  # noqa: BLE001
                    continue
            if not stored_embedding:
                continue
            sim = cosine_similarity(new_embedding, stored_embedding)
            if sim > max_similarity:
                max_similarity = sim
                most_similar_id = str(row.id)
                most_similar_title = row.title

        if max_similarity >= DUPLICATE_SIMILARITY_THRESHOLD:
            reasoning = (
                f"Potential duplicate detected (similarity={max_similarity:.2f}) "
                f"with submission '{most_similar_title}' (id={most_similar_id}). "
                "Duplicate penalty will be applied."
            )
            return 0, reasoning  # score=0 → is_duplicate=True

        reasoning = (
            f"No significant duplicate found. "
            f"Highest similarity={max_similarity:.2f} "
            f"(threshold={DUPLICATE_SIMILARITY_THRESHOLD})."
        )
        return 100, reasoning  # score=100 → is_duplicate=False


# ---------------------------------------------------------------------------
# Side-effect helpers (non-blocking, failures are logged but not raised)
# ---------------------------------------------------------------------------
async def send_low_score_email(
    submission_id: str,
    submission_data: dict,
    score: float,
) -> None:
    """Notify the submitter that their submission needs changes."""
    try:
        from app.services.email_service import send_email  # type: ignore[import]

        submitter_email = submission_data.get("submitter_email", "")
        if not submitter_email:
            return
        await send_email(
            to=submitter_email,
            subject="Your Amplify POC submission needs changes",
            body=(
                f"Hi {submission_data.get('submitter_name', 'there')},\n\n"
                f"Your submission '{submission_data.get('title', submission_id)}' received "
                f"an AI score of {score:.1f}/100, which is below our quality threshold of "
                f"{PASS_THRESHOLD}.\n\n"
                "Please review the detailed feedback in your Amplify dashboard and update "
                "your submission accordingly.\n\n"
                "— The Amplify Team"
            ),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("send_low_score_email failed (non-fatal): %s", exc)


async def _broadcast_to_admins(payload: dict) -> None:
    """Broadcast a WebSocket event to all connected admin sockets."""
    try:
        from app.services.websocket_manager import ws_manager  # type: ignore[import]

        await ws_manager.broadcast_to_admins(payload)
    except Exception as exc:  # noqa: BLE001
        logger.warning("WS broadcast_to_admins failed (non-fatal): %s", exc)


# ---------------------------------------------------------------------------
# Main pipeline entry-point
# ---------------------------------------------------------------------------
async def run_scoring_pipeline(
    submission_id: str,
    submission_data: dict,
    db: AsyncSession,
) -> None:
    """
    Agentic scoring pipeline for an Amplify submission.

    Designed to run as a FastAPI ``BackgroundTask``::

        background_tasks.add_task(
            run_scoring_pipeline,
            submission_id=str(submission.id),
            submission_data=payload.dict(),
            db=db,
        )

    Steps
    -----
    1. Fan out five agents concurrently with ``asyncio.gather``.
    2. Compute weighted final score and apply duplicate penalty.
    3. Apply decision gate → derive new status.
    4. Persist status, ai_score, and ai_feedback to DB.
    5. Insert activity_log row.
    6. Broadcast WebSocket event to admins.
    7. If score < threshold: send low-score email to submitter.
    """
    logger.info("Scoring pipeline started — submission_id=%s", submission_id)

    # ------------------------------------------------------------------
    # Step 1: Fan out all agents concurrently
    # ------------------------------------------------------------------
    relevance_agent = RelevanceAgent()
    tech_agent = TechQualityAgent()
    description_agent = DescriptionAgent()
    demo_agent = DemoReadinessAgent()
    duplicate_agent = DuplicateCheckAgent(db=db, submission_id=submission_id)

    (
        (relevance_score, relevance_reason),
        (tech_score, tech_reason),
        (description_score, description_reason),
        (demo_score, demo_reason),
        (dup_score, dup_reason),
    ) = await asyncio.gather(
        relevance_agent.score(submission_data),
        tech_agent.score(submission_data),
        description_agent.score(submission_data),
        demo_agent.score(submission_data),
        duplicate_agent.score(submission_data),
    )

    # ------------------------------------------------------------------
    # Step 2: Weighted scoring
    # ------------------------------------------------------------------
    # DuplicateCheckAgent returns 0 when a duplicate is found
    is_duplicate: bool = dup_score == 0

    raw_score: float = (
        relevance_score * WEIGHT_RELEVANCE
        + tech_score * WEIGHT_TECH
        + description_score * WEIGHT_DESCRIPTION
        + demo_score * WEIGHT_DEMO
        - (DUPLICATE_PENALTY if is_duplicate else 0)
    )
    final_score: float = max(0.0, min(100.0, raw_score))

    logger.info(
        "submission_id=%s | relevance=%d tech=%d description=%d demo=%d "
        "is_duplicate=%s raw=%.2f final=%.2f",
        submission_id,
        relevance_score,
        tech_score,
        description_score,
        demo_score,
        is_duplicate,
        raw_score,
        final_score,
    )

    # ------------------------------------------------------------------
    # Step 3: Decision gate
    # ------------------------------------------------------------------
    role: str = submission_data.get("role", "guest")

    if final_score >= PASS_THRESHOLD and role in ("admin", "super_admin"):
        new_status = "Published"
    elif final_score >= PASS_THRESHOLD:
        new_status = "Manual_Approval"
    else:
        new_status = "Needs_Changes"

    # ------------------------------------------------------------------
    # Step 4: Build ai_feedback payload
    # ------------------------------------------------------------------
    ai_feedback: dict[str, Any] = {
        "final_score": round(final_score, 2),
        "pass_threshold": PASS_THRESHOLD,
        "is_duplicate": is_duplicate,
        "decision": new_status,
        "agents": {
            "relevance": {
                "score": relevance_score,
                "weight": WEIGHT_RELEVANCE,
                "weighted_contribution": round(relevance_score * WEIGHT_RELEVANCE, 2),
                "reasoning": relevance_reason,
            },
            "tech_quality": {
                "score": tech_score,
                "weight": WEIGHT_TECH,
                "weighted_contribution": round(tech_score * WEIGHT_TECH, 2),
                "reasoning": tech_reason,
            },
            "description": {
                "score": description_score,
                "weight": WEIGHT_DESCRIPTION,
                "weighted_contribution": round(description_score * WEIGHT_DESCRIPTION, 2),
                "reasoning": description_reason,
            },
            "demo_readiness": {
                "score": demo_score,
                "weight": WEIGHT_DEMO,
                "weighted_contribution": round(demo_score * WEIGHT_DEMO, 2),
                "reasoning": demo_reason,
            },
            "duplicate_check": {
                "is_duplicate": is_duplicate,
                "penalty_applied": DUPLICATE_PENALTY if is_duplicate else 0,
                "reasoning": dup_reason,
            },
        },
    }

    # ------------------------------------------------------------------
    # Step 5: Persist to DB
    # ------------------------------------------------------------------
    try:
        await db.execute(
            text(
                "UPDATE submissions "
                "SET status      = :status, "
                "    ai_score    = :score, "
                "    ai_feedback = :feedback, "
                "    updated_at  = NOW() "
                "WHERE id = :sid"
            ),
            {
                "status": new_status,
                "score": round(final_score, 2),
                "feedback": json.dumps(ai_feedback),
                "sid": submission_id,
            },
        )

        await db.execute(
            text(
                "INSERT INTO activity_log "
                "    (submission_id, event, details, created_at) "
                "VALUES "
                "    (:sid, :event, :details, NOW())"
            ),
            {
                "sid": submission_id,
                "event": "ai_scoring_complete",
                "details": json.dumps(
                    {
                        "final_score": round(final_score, 2),
                        "status": new_status,
                        "is_duplicate": is_duplicate,
                    }
                ),
            },
        )

        await db.commit()
        logger.info(
            "submission_id=%s persisted — status=%s score=%.2f",
            submission_id,
            new_status,
            final_score,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "DB update failed for submission_id=%s: %s — rolling back",
            submission_id,
            exc,
        )
        await db.rollback()
        raise

    # ------------------------------------------------------------------
    # Step 6: WebSocket broadcast
    # ------------------------------------------------------------------
    await _broadcast_to_admins(
        {
            "event": "submission_scored",
            "submission_id": submission_id,
            "title": submission_data.get("title"),
            "final_score": round(final_score, 2),
            "status": new_status,
            "is_duplicate": is_duplicate,
            "submitter": submission_data.get("submitter_name"),
            "role": role,
        }
    )

    # ------------------------------------------------------------------
    # Step 7: Low-score email notification
    # ------------------------------------------------------------------
    if new_status == "Needs_Changes":
        await send_low_score_email(
            submission_id=submission_id,
            submission_data=submission_data,
            score=final_score,
        )

    logger.info(
        "Scoring pipeline complete — submission_id=%s → %s (score=%.2f)",
        submission_id,
        new_status,
        final_score,
    )
