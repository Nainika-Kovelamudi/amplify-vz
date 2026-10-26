from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.services.knowledge import aiv_vector_client
from app.services.knowledge.llm_helpers import call_llm_json, embed_text

logger = logging.getLogger(__name__)

_QUERY_SYSTEM_MSG = (
    "You extract search signals from a user's question for InfoVision's Amplify knowledge base. "
    "Always respond with valid JSON only — no markdown, no explanation, just the raw JSON object."
)

# Below this fused score, a result is treated as a "no exact match" candidate rather
# than a confident hit — see docs/knowledge-bot-plan.md §4.6.
CONFIDENT_MATCH_THRESHOLD = 0.35

# Fusion weights for combining the three retrieval signals (§4.3 step 3).
_WEIGHTS = {"vector": 0.5, "tag": 0.3, "keyword": 0.2}


async def _extract_query_signals(message: str) -> dict[str, Any]:
    prompt = f"""User question: "{message}"

Extract search signals for retrieving relevant entries from a catalog of AI accelerators/tools.

Return ONLY valid JSON:
{{
  "tags": ["<likely category tags: family name, department, cloud provider, tech, maturity>"],
  "keywords": ["<key terms or use-case phrases from the question>"],
  "intent": "<one of: lookup, explain, compare, navigate, troubleshoot, small_talk, list_all, platform_stats, my_submissions>"
}}

Use "small_talk" for greetings, acknowledgments, thanks, or anything that isn't actually
asking about the platform (e.g. "hi", "ok", "thanks", "not sure") — tags/keywords can be
empty arrays in that case.

Use "my_submissions" when the user asks about THEIR OWN submissions/activity — e.g.
"what's the update on my submissions," "how many have I submitted," "what's the status
of mine," "did my asset get approved." This is different from "list_all" (which is about
the whole catalog, not the caller specifically).

Use "platform_stats" for a pure NUMERIC/aggregate question about the whole platform —
"how many assets are published," "how many Forge assets are there," "what's the
breakdown by maturity," "how many are demo-ready." These want a count/number, not a
list of names.

Use "list_all" when the user wants the actual NAMES/ITEMS of a complete enumeration
rather than a count — e.g. "list all assets," "what ideas/assets are currently there,"
"show me everything in Forge." Still extract tags if they narrow the list to one
category (e.g. a family name); leave tags empty for a fully unscoped "list everything."
Do not use "list_all" for a question about a specific capability or problem (that's
"lookup" or "explain")."""
    try:
        data = await call_llm_json(_QUERY_SYSTEM_MSG, prompt)
        return {
            "tags": [str(t).strip().lower() for t in (data.get("tags") or []) if str(t).strip()],
            "keywords": [str(k).strip().lower() for k in (data.get("keywords") or []) if str(k).strip()],
            "intent": str(data.get("intent") or "lookup").strip().lower(),
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("[knowledge-bot] query signal extraction failed, falling back to raw message: %s", exc)
        return {"tags": [], "keywords": [], "intent": "lookup"}


def _fuse(vector_hits: list[dict], tag_hits: list[dict], keyword_hits: list[dict], top_k: int) -> list[dict]:
    """Reciprocal-rank-ish weighted fusion, deduped by source_id."""
    fused: dict[str, dict[str, Any]] = {}

    def _accumulate(hits: list[dict], weight: float) -> None:
        for hit in hits:
            key = f"{hit.get('source_type')}:{hit.get('source_id')}"
            score = float(hit.get("score") or 0.0) * weight
            if key not in fused:
                fused[key] = {**hit, "fused_score": 0.0}
            fused[key]["fused_score"] += score

    _accumulate(vector_hits, _WEIGHTS["vector"])
    _accumulate(tag_hits, _WEIGHTS["tag"])
    _accumulate(keyword_hits, _WEIGHTS["keyword"])

    ranked = sorted(fused.values(), key=lambda r: r["fused_score"], reverse=True)
    return ranked[:top_k]


async def hybrid_search(message: str, top_k: int = 6) -> dict[str, Any]:
    """Runs the query-understanding + hybrid retrieval pipeline from
    docs/knowledge-bot-plan.md §4.3. Returns confident results plus a flag when
    only weak/no matches were found so the caller can frame the answer as an
    alternative rather than a direct hit."""
    signals = await _extract_query_signals(message)

    if signals["intent"] == "small_talk":
        # Skip embedding + all three searches entirely — cheaper and avoids the
        # "nothing exact, but here's something related" framing kicking in for
        # a plain "hi". See assistant_agent.answer_question for the short-reply path.
        return {
            "signals": signals, "results": [], "is_confident": False,
            "is_small_talk": True, "is_complete_list": False, "is_platform_stats": False,
            "is_my_submissions": False,
        }

    if signals["intent"] == "my_submissions":
        # RBAC-sensitive — never indexed, never searched in Mongo. Handled entirely
        # by assistant_agent calling live_tools.get_my_submissions(user_id), where
        # user_id is always the server-verified caller, never client-supplied.
        return {
            "signals": signals, "results": [], "is_confident": True,
            "is_small_talk": False, "is_complete_list": False, "is_platform_stats": False,
            "is_my_submissions": True,
        }

    if signals["intent"] == "platform_stats":
        # Phase 2, step 1 (docs/knowledge-bot-plan.md §8): a pure numeric/aggregate
        # question about the platform. This is answered by a live Postgres query
        # (live_tools.get_platform_stats), not Mongo retrieval — skip search entirely
        # and let assistant_agent call the tool directly.
        return {
            "signals": signals, "results": [], "is_confident": True,
            "is_small_talk": False, "is_complete_list": False, "is_platform_stats": True,
            "is_my_submissions": False,
        }

    if signals["intent"] == "list_all":
        # "List everything" is a completeness question, not a relevance question —
        # top-K similarity ranking is the wrong tool here (it silently drops most of
        # the catalog and presents a sample as if it were the whole list). Fetch the
        # true complete set instead, optionally narrowed by any extracted tags.
        results = await aiv_vector_client.list_all("catalog_asset", tags=signals["tags"] or None)
        return {
            "signals": signals,
            "results": results,
            "is_confident": True,
            "is_small_talk": False,
            "is_complete_list": True,
            "is_platform_stats": False,
            "is_my_submissions": False,
        }

    try:
        embedding = await embed_text(message, task_type="RETRIEVAL_QUERY")
    except Exception as exc:  # noqa: BLE001 - embeddings require Gemini; degrade to tag/keyword only
        logger.warning("[knowledge-bot] query embedding failed, continuing without vector search: %s", exc)
        embedding = None

    vector_hits, tag_hits, keyword_hits = await asyncio.gather(
        aiv_vector_client.vector_search(embedding, top_k=top_k) if embedding else _empty(),
        aiv_vector_client.tag_search(signals["tags"], top_k=top_k),
        aiv_vector_client.keyword_search(message, top_k=top_k),
    )

    results = _fuse(vector_hits, tag_hits, keyword_hits, top_k=top_k)
    confident = [r for r in results if r["fused_score"] >= CONFIDENT_MATCH_THRESHOLD]

    return {
        "signals": signals,
        "results": confident or results,
        "is_confident": bool(confident),
        "is_small_talk": False,
        "is_complete_list": False,
        "is_platform_stats": False,
        "is_my_submissions": False,
    }


async def _empty() -> list[dict]:
    return []
