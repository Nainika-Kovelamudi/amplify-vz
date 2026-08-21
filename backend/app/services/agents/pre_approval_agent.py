from __future__ import annotations

from typing import Any

from app.services.agents.base import BaseAgent

_VALID_STATUSES = {"pass", "warn", "fail"}


class PreApprovalCheckAgent(BaseAgent):
    name = "PreApprovalCheckAgent"

    def build_prompt(self, payload: dict[str, Any]) -> str:
        tech_stack = ", ".join(payload.get("tech_stack") or []) or "not declared"
        repo_url = payload.get("repo_url") or "none"
        repo_legit = payload.get("repo_is_legitimate", False)
        repo_status = (
            "not provided" if repo_url == "none"
            else (f"provided and legitimate ({repo_url})" if repo_legit
                  else f"provided but NOT a recognised code-hosting platform ({repo_url}) — flag as fail")
        )
        return f"""You are a senior platform engineer performing a pre-approval compliance review
for InfoVision's Amplify AI accelerator catalog.

Evaluate the submission against SIX mandatory checklist items and return a structured verdict.

=== SUBMISSION METADATA (Section 1) ===
Owner Name:     {payload.get("owner_name") or "(missing)"}
Owner Email:    {payload.get("owner_email") or "(missing)"}
Manager Name:   {payload.get("manager_name") or "(missing)"}
Manager Email:  {payload.get("manager_email") or "(missing)"}
Designation:    {payload.get("designation") or "(missing)"}
Department:     {payload.get("department") or "(missing)"}

=== ASSET DETAILS ===
Title:        {payload.get("title") or "(missing — fail ownership check)"}
Description:  {payload.get("description")}
Tech Stack:   {tech_stack}
Cloud:        {payload.get("cloud_provider") or "not declared"}
Maturity:     {payload.get("maturity") or "not declared"}
Demo Ready:   {payload.get("demo_ready", False)}
Video URL:    {payload.get("video_url") or "none"}
Repository:   {repo_status}

=== CHECKLIST ITEMS ===

1. OWNERSHIP & METADATA (Section 1 completeness)
   Are all submitter fields present and valid? Owner name, owner email, manager name,
   manager email, designation, and department must all be filled.
   Also verify: asset title is descriptive (not generic like "test" or blank).
   Pass = all fields present and plausible. Fail = any field missing or clearly invalid.

2. SECURITY
   Does the submission adequately address input sanitization, secrets management,
   authentication/authorization, and security hardening for production use?
   Consider: tech stack, maturity, description mentions of auth/security.

3. DOCUMENTATION
   Is the description clear, complete, and detailed enough for another engineer to
   understand what the asset does, how to set it up, and when to use it?
   Consider: length, presence of use cases, setup steps, architecture notes.

4. TESTING
   Is there evidence of testing or demo readiness? Look for: demo_ready flag,
   video/screenshot URL, mention of eval results or test coverage in the description.

5. CLOUD
   Is cloud deployment compatibility clearly declared and appropriate?
   Consider: cloud_provider field, any multi-cloud support mentioned.

6. REPOSITORY & COMPLIANCE
   Is the repository URL a real, recognised code-hosting platform (GitHub/GitLab/Bitbucket/Azure DevOps)?
   A random or non-code URL must be marked fail.
   Also: are audit logging, data ownership, IP ownership, and regulatory considerations
   addressed (even briefly) in the description or metadata?

=== RESPONSE FORMAT ===
Return ONLY valid JSON — no markdown, no explanation:
{{
  "ownership":     {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }},
  "security":      {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }},
  "documentation": {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }},
  "testing":       {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }},
  "cloud":         {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }},
  "compliance":    {{ "status": "pass"|"warn"|"fail", "note": "<one actionable sentence>" }}
}}

Rules:
- "pass"  = clearly addressed, no action needed
- "warn"  = partially addressed or needs manual confirmation before approval
- "fail"  = not addressed at all, must be fixed before approval
- "note"  = what the approver should do or verify — be specific, not generic"""

    def parse_response(self, raw: str) -> dict[str, Any]:
        data = self._safe_json(raw)
        result: dict[str, Any] = {}
        for key in ("ownership", "security", "documentation", "testing", "cloud", "compliance"):
            item = data.get(key, {})
            status = str(item.get("status", "warn")).lower()
            if status not in _VALID_STATUSES:
                status = "warn"
            result[key] = {
                "status": status,
                "note": str(item.get("note", "Manual review required.")),
            }
        return result

    def _fallback(self) -> dict[str, Any]:
        return {
            key: {"status": "warn", "note": "Agent error — manual review required."}
            for key in ("ownership", "security", "documentation", "testing", "cloud", "compliance")
        }
