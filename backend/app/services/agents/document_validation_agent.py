from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent


class DocumentValidationAgent(BaseAgent):
    name = "DocumentValidationAgent"

    async def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Short-circuit for missing/unreadable docs; delegate all else to LLM."""
        doc_text  = (payload.get("doc_text") or "").strip()
        file_type = payload.get("doc_file_type") or "none"

        # Multi-doc format: check if ALL slots say [Not uploaded]
        if file_type.startswith("multi_doc") or "===" in doc_text:
            # Has at least some real content — let LLM validate
            if doc_text and "[Not uploaded]" not in doc_text.replace("\n", ""):
                return await super().run(payload)
            # Partially missing docs: still pass to LLM with what we have
            if doc_text and any(line.strip() and not line.startswith("===") and "[Not uploaded]" not in line
                                for line in doc_text.splitlines()):
                return await super().run(payload)
            # All slots empty
            return {
                "score": 0,
                "feedback": "No documents were uploaded in any of the four required slots. A proper submission must include supporting documentation.",
                "confidence": 1.0,
                "details": {
                    "is_valid_asset_doc": False,
                    "has_technical_content": False,
                    "matches_submission": False,
                    "issues": ["No documents uploaded"],
                },
            }

        # Single image upload: can't extract text, give partial credit
        if file_type == "image" or doc_text.startswith("[Image file uploaded"):
            return {
                "score": 35,
                "feedback": "An image file was uploaded as a supporting document. Content relevance cannot be validated automatically; a human reviewer should inspect it.",
                "confidence": 1.0,
                "details": {
                    "is_valid_asset_doc": True,
                    "has_technical_content": None,
                    "matches_submission": None,
                    "issues": ["Image file — automated text extraction not possible"],
                },
            }

        # No document at all
        if not doc_text:
            reason = (
                "No document was uploaded."
                if file_type == "none"
                else f"Document could not be read (type: {file_type})."
            )
            return {
                "score": 0,
                "feedback": f"{reason} A proper submission must include supporting documentation.",
                "confidence": 1.0,
                "details": {
                    "is_valid_asset_doc": False,
                    "has_technical_content": False,
                    "matches_submission": False,
                    "issues": [reason],
                },
            }

        return await super().run(payload)

    def build_prompt(self, payload: dict[str, Any]) -> str:
        doc_text    = (payload.get("doc_text") or "").strip()
        file_type   = payload.get("doc_file_type") or "unknown"
        title       = payload.get("title") or "(not provided)"
        description = (payload.get("description") or "").strip()
        tech_stack  = payload.get("tech_stack") or []

        return f"""You are a strict document relevance validator for InfoVision's Amplify AI accelerator catalog.

Your ONLY job: determine whether the uploaded document is actually documentation FOR the specific asset being submitted — not a document from a different project that happens to use similar tools.

=== SUBMISSION ===
Title:       {title}
Description: {description[:400] if description else "(none)"}
Tech Stack:  {tech_stack}

=== UPLOADED DOCUMENT ===
\"\"\"
{doc_text[:4000]}
\"\"\"

=== PRIMARY QUESTION ===
Does this document describe the SAME asset named in the submission title above?

To answer this, look for the product/platform/tool that the document is ABOUT:
- What is the document's own title, heading, or product name?
- What problem does the document say it solves?
- What use case or domain does it describe?

Then compare: is that the same product and use case as "{title}"?

=== CRITICAL RULE — SHARED TECH STACK IS NOT RELEVANCE ===
Two completely different products can use LangChain, FastAPI, Azure, or any other tool.
Shared technology does NOT mean the document is about this submission.
You MUST compare the SUBJECT MATTER (what the product does, what problem it solves) — not the tools.

Example of WRONG reasoning: "Document mentions LangChain and the submission uses LangChain → match"
Example of RIGHT reasoning: "Document is titled 'Agentic SDLC Platform' and describes software delivery workflows. Submission is 'Customer Support Automation' which automates customer queries. These are different products → NOT a match"

=== SCORING ===

IRRELEVANT — document describes a DIFFERENT product or topic (score 0–15):
- Document has its own product name/title that differs from the submission title
- Document solves a different business problem (e.g. doc=SDLC automation, submission=customer support)
- Document is HR policy, finance report, meeting notes, legal doc, resume, or anything non-technical

PARTIALLY RELEVANT — document is about the right domain but not specifically this asset (score 16–35):
- Document describes a related platform/tool but not exactly this one
- Generic architecture doc with no product-specific content

RELEVANT — document clearly describes this specific asset (score 36–100):
- Document's subject, product name, or use case aligns with the submission title and description
- Quality sub-scoring: 36–50 = weak/marketing only, 51–70 = some technical detail, 71–90 = solid technical doc, 91–100 = exceptional

Return ONLY valid JSON — no markdown, no text outside the JSON:
{{
  "score": <integer 0-100>,
  "is_valid_asset_doc": <boolean>,
  "has_technical_content": <boolean>,
  "matches_submission": <boolean>,
  "document_subject": "<what product/platform the document is actually about, in 1 sentence>",
  "feedback": "<2-3 sentences: name what the document is about, name what the submission is about, then state clearly whether they match and why>",
  "issues": ["<specific mismatch or issue>"],
  "confidence": <float 0.0-1.0>
}}"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        return {
            "score": int(data.get("score", 0)),
            "feedback": data.get("feedback", ""),
            "confidence": float(data.get("confidence", 0.5)),
            "details": {
                "is_valid_asset_doc": data.get("is_valid_asset_doc", False),
                "has_technical_content": data.get("has_technical_content", False),
                "matches_submission": data.get("matches_submission", False),
                "document_subject": data.get("document_subject", ""),
                "issues": data.get("issues", []),
            },
        }

    def _fallback(self) -> dict[str, Any]:
        return {
            "score": 0,
            "feedback": "Document validation agent failed.",
            "confidence": 0.0,
            "details": {
                "is_valid_asset_doc": False,
                "has_technical_content": False,
                "matches_submission": False,
                "issues": ["Agent error"],
            },
        }
