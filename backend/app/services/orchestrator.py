from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CatalogAsset, Submission, SubmissionStatus, AssetStatus
from app.services.agents.demo_readiness_agent import DemoReadinessAgent
from app.services.agents.description_agent import DescriptionAgent
from app.services.agents.document_validation_agent import DocumentValidationAgent
from app.services.agents.duplicate_check_agent import DuplicateCheckAgent
from app.services.agents.pre_approval_agent import PreApprovalCheckAgent
from app.services.agents.relevance_agent import RelevanceAgent
from app.services.agents.tech_quality_agent import TechQualityAgent
from app.services.agents.video_validation_agent import VideoValidationAgent
from app.services.document_reader import extract_document_text
from app.services.url_validator import validate_video_url, validate_demo_url, validate_repo_url

logger = logging.getLogger(__name__)


class SupersededEvaluation(RuntimeError):
    pass

WEIGHTS = {
    "relevance": 0.18,
    "tech_quality": 0.22,
    "description": 0.12,
    "demo_readiness": 0.13,
    "duplicate_check": 0.10,
    "document_validation": 0.13,
    "video_validation": 0.12,
}

MANUAL_REVIEW_THRESHOLD = 60.0   # score >= 60 → send to admin; < 60 → needs changes


def _completeness_cap(payload: dict) -> tuple[float, list[str]]:
    """
    Compute a hard score cap (0–100) based on field completeness.
    Returns (cap, list_of_missing_fields).
    No LLM generosity can override a structurally incomplete submission.
    """
    missing: list[str] = []
    cap = 100.0

    desc = (payload.get("description") or "").strip()
    desc_words = len(desc.split()) if desc else 0

    # Section 1 — submitter metadata
    if not (payload.get("owner_name") or "").strip():
        missing.append("owner_name")
        cap -= 5
    if not (payload.get("owner_email") or "").strip():
        missing.append("owner_email")
        cap -= 5
    if not (payload.get("manager_name") or "").strip():
        missing.append("manager_name")
        cap -= 3
    if not (payload.get("manager_email") or "").strip():
        missing.append("manager_email")
        cap -= 3
    if not (payload.get("designation") or "").strip():
        missing.append("designation")
        cap -= 3

    if not (payload.get("title") or "").strip():
        missing.append("title")
        cap -= 20

    if desc_words == 0:
        missing.append("description")
        cap -= 35
    elif desc_words < 20:
        missing.append("description too short (< 20 words)")
        cap -= 25
    elif desc_words < 50:
        cap -= 10  # partial penalty

    tech_stack = payload.get("tech_stack") or []
    if not tech_stack:
        missing.append("tech_stack")
        cap -= 15

    if not payload.get("family"):
        missing.append("family")
        cap -= 10

    if not payload.get("department"):
        missing.append("department")
        cap -= 5

    if not payload.get("cloud_provider"):
        missing.append("cloud_provider")
        cap -= 5

    # Repo URL legitimacy — must be a real code-hosting service
    if payload.get("repo_url") and not payload.get("repo_is_legitimate"):
        missing.append("repo_url is not a recognised code repository (use GitHub/GitLab/Bitbucket/Azure DevOps)")
        cap -= 10

    # Artifact validation — at least one supporting artifact is expected
    has_arch_file  = bool(payload.get("architecture_file_url"))
    has_repo       = bool(payload.get("repo_url"))
    has_demo_url   = bool(payload.get("demo_url"))
    has_video      = bool(payload.get("video_url"))
    has_deps       = bool((payload.get("dependencies") or "").strip())
    has_commands   = bool(payload.get("commands"))
    artifact_count = sum([has_arch_file, has_repo, has_demo_url, has_video, has_deps, has_commands])

    if artifact_count == 0:
        missing.append("no artifacts (architecture file, repo, demo, video, dependencies, or commands)")
        cap -= 15
    elif artifact_count == 1:
        cap -= 5  # partial — at least one present but could have more

    return max(cap, 0.0), missing


def _is_uuid(value: str) -> bool:
    import uuid as _uuid
    try:
        _uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError):
        return False


async def _fetch_existing_entries(
    db: AsyncSession,
    exclude_submission_id: str,
    exclude_catalog_asset_id: str | None = None,
) -> list[dict]:
    """
    Return {title, description} for published catalog assets + active pipeline submissions,
    EXCLUDING the current submission so it never matches itself.
    Also excludes the catalog asset being re-submitted (exclude_catalog_asset_id) so a
    re-submission is never flagged as a duplicate of its own existing entry.
    """
    from app.db.models import AssetStatus
    import uuid as _uuid

    asset_query = (
        select(CatalogAsset.title, CatalogAsset.description)
        .where(CatalogAsset.status == AssetStatus.Published)
    )
    if exclude_catalog_asset_id:
        try:
            _excl_uuid = _uuid.UUID(str(exclude_catalog_asset_id))
            asset_query = asset_query.where(CatalogAsset.id != _excl_uuid)
        except (ValueError, AttributeError):
            pass
    asset_result = await db.execute(asset_query.limit(60))
    asset_entries = [{"title": r[0], "description": r[1] or ""} for r in asset_result.all() if r[0]]

    # Active submissions (Manual_Approval and Approved only — NOT Submitted,
    # because the current submission is Submitted right now and would match itself)
    active_statuses = [
        SubmissionStatus.Manual_Approval,
        SubmissionStatus.Approved,
    ]
    try:
        exclude_uuid = _uuid.UUID(str(exclude_submission_id))
        sub_result = await db.execute(
            select(Submission.title, Submission.description)
            .where(
                Submission.status.in_(active_statuses),
                Submission.id != exclude_uuid,
            )
            .limit(60)
        )
    except Exception:
        sub_result = await db.execute(
            select(Submission.title, Submission.description)
            .where(Submission.status.in_(active_statuses))
            .limit(60)
        )
    sub_entries = [{"title": r[0], "description": r[1] or ""} for r in sub_result.all() if r[0]]

    # Deduplicate by title while preserving order
    seen: set[str] = set()
    combined: list[dict] = []
    for entry in asset_entries + sub_entries:
        key = entry["title"].strip().lower()
        if key not in seen:
            seen.add(key)
            combined.append(entry)
    return combined


async def run_scoring_pipeline(
    submission_id: str,
    _submission_data: Optional[dict] = None,
    _entity_type: Optional[str] = None,
) -> None:
    from app.db.base import get_session_factory
    options = _submission_data or {}
    preserve_status = options.get("preserve_status")
    sync_catalog_asset_id = options.get("sync_catalog_asset_id")
    is_catalog = _entity_type == "catalog_asset"
    try:
        await _run_scoring_pipeline_inner(
            submission_id,
            preserve_status=preserve_status,
            sync_catalog_asset_id=sync_catalog_asset_id,
            entity_type=_entity_type, options=options,
        )
    except Exception as exc:
        if isinstance(exc, SupersededEvaluation):
            raise
        logger.error("Scoring pipeline crashed for %s: %s", submission_id, exc, exc_info=True)
        # Mark submission as needing changes so it doesn't stay stuck at Submitted
        try:
            async with get_session_factory()() as db:
                model = CatalogAsset if is_catalog else Submission
                result = await db.execute(select(model).where(model.id == submission_id))
                sub = result.scalars().first()
                if sub and options.get('expected_updated_at') and sub.updated_at.isoformat() != options['expected_updated_at']:
                    raise SupersededEvaluation('Newer metadata must not be marked as failed')
                if options.get('job_id'):
                    from app.db.operations_models import EvaluationJob
                    lease = await db.get(EvaluationJob, options['job_id'])
                    if not lease or lease.lease_token != options.get('lease_token') or lease.state != 'Running':
                        raise SupersededEvaluation('Obsolete job must not mark evaluation failed')
                if sub and sub.ai_score is None:
                    sub.ai_score = 0
                    if not is_catalog and sub.status == SubmissionStatus.Submitted:
                        sub.status = SubmissionStatus.Needs_Changes
                    sub.ai_feedback = {"summary": "AI evaluation encountered an error. Please resubmit.", "error": "Evaluation failed; check provider configuration and backend logs."}
                    await db.commit()
        except Exception as inner:
            logger.error("Failed to mark submission %s as failed: %s", submission_id, inner)
        if options.get("job_run"):
            raise


async def _run_scoring_pipeline_inner(
    submission_id: str,
    preserve_status: str | None = None,
    sync_catalog_asset_id: str | None = None,
    entity_type: str | None = None, options: dict | None = None,
) -> None:
    from app.db.base import get_session_factory
    async with get_session_factory()() as db:
        is_catalog = entity_type == "catalog_asset"
        model = CatalogAsset if is_catalog else Submission
        result = await db.execute(select(model).where(model.id == submission_id))
        submission = result.scalars().first()
        if not submission:
            logger.error("Scoring pipeline: submission %s not found", submission_id)
            return

        from app.services.evaluation_jobs import evaluation_fingerprint
        input_fingerprint = evaluation_fingerprint(submission)

        existing_entries = await _fetch_existing_entries(
            db,
            exclude_submission_id=submission_id,
            exclude_catalog_asset_id=str(submission.id) if is_catalog else submission.catalog_code or None,
        )

        # Run document extraction + URL validation concurrently (before agents)
        arch_url  = submission.architecture_file_url
        video_url = submission.video_url
        demo_url  = submission.demo_url
        repo_url  = submission.repo_url

        doc_text, doc_file_type = ("", "none")

        async def _safe_extract():
            if not arch_url:
                return ("", "none")
            try:
                result = await extract_document_text(arch_url)
                logger.info("Document extracted: type=%s chars=%d", result[1], len(result[0]))
                return result
            except Exception as exc:
                logger.warning("Document extraction failed: %s", exc)
                return ("", "download_failed")

        logger.info("Running doc extraction + URL validation in parallel for %s", submission_id)
        (doc_text, doc_file_type), video_meta, demo_meta, repo_meta = await asyncio.gather(
            _safe_extract(),
            validate_video_url(video_url),
            validate_demo_url(demo_url),
            validate_repo_url(repo_url),
        )
        logger.info(
            "URL checks — video=%s demo=%s repo=%s",
            video_meta.get("valid"), demo_meta.get("valid"), repo_meta.get("valid"),
        )

        # Validate that repo_url is a recognised code-hosting domain
        repo_is_legitimate = False
        if repo_url:
            _legit_hosts = ("github.com", "gitlab.com", "bitbucket.org", "dev.azure.com", "visualstudio.com")
            repo_is_legitimate = any(h in (repo_url or "").lower() for h in _legit_hosts)

        payload: dict[str, Any] = {
            # Section 1 — submitter
            "owner_name": submission.owner_name or "",
            "owner_email": submission.owner_email or "",
            "manager_name": submission.manager_name or "",
            "manager_email": submission.manager_email or "",
            "designation": submission.designation or "",
            # Section 2 — asset
            "title": submission.title,
            "description": submission.description,
            "family": submission.family,
            "department": submission.department,
            "tech_stack": submission.tech_stack or [],
            "cloud_provider": submission.cloud_provider,
            "maturity": submission.maturity,
            "demo_ready": submission.demo_ready,
            "video_url": video_url,
            "demo_url": demo_url,
            "repo_url": repo_url,
            "repo_is_legitimate": repo_is_legitimate,
            "architecture_file_url": arch_url,
            "dependencies": submission.dependencies,
            "commands": submission.commands or [],
            "doc_text": doc_text,
            "doc_file_type": doc_file_type,
            "existing_entries": existing_entries,
            # Re-submission flag — set when editing an existing published asset
            "is_resubmission": bool(is_catalog or (submission.catalog_code and _is_uuid(submission.catalog_code))),
            # URL validation metadata
            "video_meta": video_meta,
            "demo_meta": demo_meta,
            "repo_meta": repo_meta,
        }

        agents = {
            "relevance": RelevanceAgent(),
            "tech_quality": TechQualityAgent(),
            "description": DescriptionAgent(),
            "demo_readiness": DemoReadinessAgent(),
            "duplicate_check": DuplicateCheckAgent(),
            "document_validation": DocumentValidationAgent(),
            "video_validation": VideoValidationAgent(),
        }

        logger.info("Starting 8-agent scoring for submission %s (doc_type=%s)", submission_id, doc_file_type)

        # Run all scoring agents + pre-approval checklist agent concurrently
        pre_approval_agent = PreApprovalCheckAgent()
        all_tasks = list(agent.run(payload) for agent in agents.values())
        all_tasks.append(pre_approval_agent.run(payload))

        all_names = list(agents.keys()) + ["pre_approval"]
        raw_results = await asyncio.gather(*all_tasks, return_exceptions=True)

        results: dict[str, dict] = {}
        for name, result_or_exc in zip(all_names, raw_results):
            if isinstance(result_or_exc, Exception):
                print(f"\n[ORCHESTRATOR] Agent '{name}' raised exception: {result_or_exc}", flush=True)
                logger.error("[%s] Agent failed: %s", name, result_or_exc)
                if name == "pre_approval":
                    results[name] = PreApprovalCheckAgent()._fallback()
                else:
                    results[name] = {"score": 0, "feedback": "Agent error.", "confidence": 0.0}
            else:
                import math
                valid_score = (isinstance(result_or_exc,dict) and isinstance(result_or_exc.get('score'),(int,float))
                    and not isinstance(result_or_exc.get('score'),bool) and math.isfinite(result_or_exc['score'])
                    and 0 <= result_or_exc['score'] <= 100)
                if name != 'pre_approval' and not valid_score:
                    results[name] = {'score':0,'confidence':0.0,'feedback':'Agent error: invalid score.'}
                elif name == 'pre_approval' and not isinstance(result_or_exc,dict):
                    results[name] = PreApprovalCheckAgent()._fallback()
                else:
                    results[name] = result_or_exc

        pre_approval_result = results.pop("pre_approval")

        print(f"\n[ORCHESTRATOR] All agent scores: { {n: r.get('score') for n, r in results.items()} }", flush=True)

        # Pre-approval fail enforcement — each "fail" status caps the score
        # "warn" applies a softer cap; "pass" is no penalty
        _FAIL_CAP  = 45  # hard fail on a checklist item → cannot reach Manual_Approval
        _WARN_CAP  = 72  # warn → soft cap, still reachable but flagged
        checklist_cap = 100.0
        checklist_fails: list[str] = []
        checklist_warns: list[str] = []
        for item_key, item_val in pre_approval_result.items():
            status = (item_val.get("status") or "warn").lower()
            if status == "fail":
                checklist_fails.append(item_key)
                checklist_cap = min(checklist_cap, _FAIL_CAP)
            elif status == "warn":
                checklist_warns.append(item_key)
                checklist_cap = min(checklist_cap, _WARN_CAP)
        if checklist_fails:
            print(f"[ORCHESTRATOR] Pre-approval FAIL items={checklist_fails} → cap={checklist_cap:.0f}", flush=True)
        if checklist_warns:
            print(f"[ORCHESTRATOR] Pre-approval WARN items={checklist_warns} → cap={checklist_cap:.0f}", flush=True)

        # Duplicate check — HARD BLOCK if LLM confirms duplicate
        # Re-submissions (editing an existing published asset) are exempt — they are expected
        # to match their own existing catalog entry and must never be blocked as duplicates.
        is_resubmission = bool(payload.get("is_resubmission"))
        if is_resubmission:
            is_duplicate = False
            similar_to = ""
            print(f"[ORCHESTRATOR] Re-submission detected — duplicate check bypassed", flush=True)
        else:
            dup_details = results["duplicate_check"].get("details", {})
            similar_to = (dup_details.get("similar_to") or "").strip()
            is_duplicate = bool(dup_details.get("is_duplicate", False))
            print(f"[ORCHESTRATOR] Duplicate info → is_duplicate={is_duplicate} similar_to='{similar_to}'", flush=True)

            # Also run a deterministic case-insensitive exact-match check independent of LLM
            new_title_norm = (payload.get("title") or "").strip().lower()
            existing_entries_list: list[dict] = payload.get("existing_entries", [])
            exact_match = next(
                (e["title"] for e in existing_entries_list if e["title"].strip().lower() == new_title_norm),
                None,
            )
            if exact_match and not is_duplicate:
                is_duplicate = True
                similar_to = exact_match
                print(f"[ORCHESTRATOR] Exact title match detected — overriding LLM: '{exact_match}'", flush=True)

        # Deterministic completeness cap — applied BEFORE LLM scores
        score_cap, missing_fields = _completeness_cap(payload)

        # Hard cap for confirmed duplicates
        if is_duplicate:
            missing_fields.append(f"duplicate title — similar to existing entry: '{similar_to or 'unknown'}'")
            score_cap = min(score_cap, 15)  # forces Needs_Changes regardless of other scores
            print(f"[ORCHESTRATOR] Duplicate hard cap applied → cap=15", flush=True)

        # Factor in URL validation into completeness cap
        if not video_meta.get("valid") and not demo_meta.get("valid") and not repo_meta.get("valid"):
            if video_url or demo_url or repo_url:
                # URLs were provided but none are accessible — cap at 75
                missing_fields.append("provided URLs are not accessible")
                score_cap = min(score_cap, 75)

        # If a document was uploaded but couldn't be read, add a note (but don't double-penalise)
        if arch_url and doc_file_type in ("download_failed", "unsupported"):
            missing_fields.append(f"architecture document unreadable (type={doc_file_type})")
            score_cap = min(score_cap, 70)

        # If the LLM determined the uploaded documents are irrelevant to the submission,
        # apply a hard cap — invalid documentation cannot score above Needs_Changes
        doc_details = results.get("document_validation", {}).get("details", {})
        if doc_details.get("matches_submission") is False and results.get("document_validation", {}).get("score", 100) <= 20:
            missing_fields.append("uploaded documents do not match the submitted asset — content appears unrelated")
            score_cap = min(score_cap, 45)
            print(f"[ORCHESTRATOR] Invalid document cap applied (matches_submission=False, doc_score≤20) → cap=45", flush=True)

        if missing_fields:
            print(f"[ORCHESTRATOR] Completeness cap={score_cap:.0f} missing={missing_fields}", flush=True)

        # Weighted composite score (capped by completeness AND pre-approval checklist)
        raw_score = sum(
            results[name]["score"] * weight
            for name, weight in WEIGHTS.items()
        )
        effective_cap = min(score_cap, checklist_cap)
        total_score = min(raw_score, effective_cap)
        print(f"[ORCHESTRATOR] raw={raw_score:.1f} completeness_cap={score_cap:.0f} checklist_cap={checklist_cap:.0f} final={total_score:.1f}", flush=True)

        # Aggregate feedback per agent
        feedback_lines = []
        for name, res in results.items():
            fb = res.get("feedback", "")
            if fb:
                feedback_lines.append(f"**{name.replace('_', ' ').title()}**: {fb}")

        ai_feedback = {
            "input_fingerprint": input_fingerprint,
            "summary": _classify_summary(total_score),
            "composite_score": round(total_score, 2),
            "weights": {key: round(value * 100) for key, value in WEIGHTS.items()},
            "raw_score": round(raw_score, 2),
            "applied_cap": effective_cap,
            "completeness_cap": score_cap,
            "checklist_cap": checklist_cap,
            "missing_fields": missing_fields,
            "agent_scores": {n: r["score"] for n, r in results.items()},
            "agent_feedback": results,
            "checklist": pre_approval_result,
            "checklist_fails": checklist_fails,
            "checklist_warns": checklist_warns,
            "is_duplicate": is_duplicate,
            "similar_to": similar_to or None,
        }

        # A job can be reclaimed after a restart; never persist results from an
        # obsolete lease or overwrite metadata edited while evaluation was running.
        job_options = options or {}
        if job_options.get('job_id'):
            from app.db.operations_models import EvaluationJob
            lease = (await db.execute(select(EvaluationJob.id).where(
                EvaluationJob.id == job_options['job_id'], EvaluationJob.lease_token == job_options['lease_token'],
                EvaluationJob.state == 'Running').with_for_update())).scalar_one_or_none()
            if not lease: raise SupersededEvaluation('Evaluation lease was superseded')
            await db.refresh(submission)
            version = job_options.get('expected_updated_at')
            if version and submission.updated_at.isoformat() != version:
                raise SupersededEvaluation('Asset changed during evaluation; retry with current metadata')
        failed_agents = [name for name, result in results.items()
                         if result.get('confidence') == 0 and 'error' in str(result.get('feedback', '')).lower()]
        if any('agent error' in str(item.get('note','')).lower() for item in pre_approval_result.values() if isinstance(item,dict)):
            failed_agents.append('pre_approval')
        ai_feedback['evaluation_status'] = 'Failed' if failed_agents else 'Complete'
        ai_feedback['evaluated_at'] = __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
        if failed_agents:
            ai_feedback['error'] = 'One or more evaluation agents failed. Retry after checking provider configuration.'
            ai_feedback['failed_agents'] = failed_agents
        submission.ai_score = round(total_score, 2)
        submission.ai_feedback = ai_feedback

        # All submissions with score >= 60 go to admin for manual review
        # Score < 60 → AI asks user to improve and resubmit
        status_type = AssetStatus if is_catalog else SubmissionStatus
        if preserve_status:
            submission.status = status_type(preserve_status)
        elif not failed_agents:
            submission.status = status_type.Manual_Approval if total_score >= MANUAL_REVIEW_THRESHOLD else status_type.Needs_Changes

        if sync_catalog_asset_id:
            import uuid as _uuid
            try:
                asset_id = _uuid.UUID(str(sync_catalog_asset_id))
                asset_result = await db.execute(
                    select(CatalogAsset).where(CatalogAsset.id == asset_id)
                )
                catalog_asset = asset_result.scalars().first()
                if catalog_asset:
                    catalog_asset.ai_score = submission.ai_score
                    catalog_asset.ai_feedback = submission.ai_feedback
            except (ValueError, AttributeError):
                logger.warning(
                    "Could not synchronize AI score: invalid catalog asset id %s",
                    sync_catalog_asset_id,
                )

        if is_catalog:
            from sqlalchemy import or_
            published_sources=(await db.execute(select(Submission).where(
                Submission.status==SubmissionStatus.Published,
                or_(Submission.catalog_code==str(submission.id),Submission.catalog_code==submission.catalog_code))
                .order_by(Submission.created_at.desc()).with_for_update())).scalars().all()
            for source in published_sources:
                if evaluation_fingerprint(source)==input_fingerprint:
                    source.ai_score=submission.ai_score;source.ai_feedback=submission.ai_feedback
        await db.commit()
        logger.info(
            "Scoring complete for %s — score=%.1f status=%s",
            submission_id, total_score, submission.status,
        )

        if preserve_status or is_catalog or failed_agents:
            return

        # Notify submitter and (if passed) all admins
        try:
            from app.services.notification_service import push_notification as _push
            if submission.status == SubmissionStatus.Needs_Changes:
                await _push(
                    db, str(submission.submitter_id),
                    "AI Review: Changes Needed 🔄",
                    f'Your submission "{submission.title}" scored {round(total_score)}. Please review the feedback and resubmit.',
                    "ai_needs_changes", str(submission.id),
                )
            else:
                await _push(
                    db, str(submission.submitter_id),
                    "AI Review Passed ✅",
                    f'Your submission "{submission.title}" scored {round(total_score)} and is now in the admin review queue.',
                    "ai_passed", str(submission.id),
                )
            await db.commit()
        except Exception as exc:
            logger.warning("Could not send scoring notification: %s", exc)

        try:
            from app.db.models import UserProfile, UserRole
            from app.services.email_service import (
                send_needs_changes_email,
                send_pending_review_email,
                send_admin_review_notification,
            )
            from app.config import get_settings
            settings = get_settings()
            frontend_url = settings.frontend_url

            sub_result = await db.execute(
                select(UserProfile).where(UserProfile.id == submission.submitter_id)
            )
            submitter = sub_result.scalars().first()
            ai_summary = (ai_feedback or {}).get("summary", "Please review the AI feedback in the pipeline.")

            if submission.status == SubmissionStatus.Needs_Changes:
                # Score < 60 — tell submitter to update and resubmit
                if submitter:
                    await send_needs_changes_email(
                        submitter.email,
                        submission.title,
                        total_score,
                        ai_summary,
                        frontend_url,
                    )
            else:
                # Score >= 60 — tell submitter it's in admin queue, notify all admins
                if submitter:
                    await send_pending_review_email(
                        submitter.email,
                        submission.title,
                        total_score,
                        f"{frontend_url}/pipeline",
                    )
                admin_result = await db.execute(
                    select(UserProfile).where(UserProfile.role.in_([UserRole.admin, UserRole.owner]))
                )
                admins = admin_result.scalars().all()
                submitter_name = submitter.display_name or submitter.email if submitter else "Unknown"
                for admin in admins:
                    await send_admin_review_notification(
                        admin.email,
                        submission.title,
                        submitter_name,
                        total_score,
                        f"{frontend_url}/pipeline?tab=queue",
                    )
        except Exception as exc:
            logger.warning("Could not send scoring notification email: %s", exc)


def _classify_summary(score: float) -> str:
    if score >= MANUAL_REVIEW_THRESHOLD:
        return "Good submission — forwarded to admin for review and approval."
    return "Submission needs improvements. Please revise and resubmit with more detail."
