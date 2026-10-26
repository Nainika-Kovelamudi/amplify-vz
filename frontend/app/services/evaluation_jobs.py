"""Database-backed queue; leases survive restarts and are shared across App Service instances."""
import asyncio
import logging
import uuid
import hashlib
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update, or_, and_
from fastapi import HTTPException
from app.db.models import CatalogAsset, Submission, ActivityLog
from app.db.operations_models import EvaluationJob

logger = logging.getLogger(__name__)
EXPECTED = {'relevance','tech_quality','description','demo_readiness','duplicate_check','document_validation','video_validation'}


def evaluation_fingerprint(entity):
    fields=('title','description','family','department','tech_stack','cloud_provider','maturity','demo_ready',
            'video_url','video_urls','demo_url','repo_url','architecture_file_url','dependencies','commands',
            'owner_name','owner_email','manager_name','manager_email','designation')
    return hashlib.sha256(json.dumps({key:getattr(entity,key,None) for key in fields},sort_keys=True,default=str).encode()).hexdigest()


def evaluation_health(entity):
    feedback = getattr(entity, 'ai_feedback', None)
    if isinstance(feedback, dict) and (feedback.get('error') or feedback.get('evaluation_status') == 'Failed'):
        return 'Failed'
    if getattr(entity, 'ai_score', None) is None: return 'Missing'
    if not isinstance(feedback, dict): return 'Incomplete'
    scores = feedback.get('agent_scores')
    if not isinstance(scores, dict) or not EXPECTED.issubset(scores): return 'Incomplete'
    if any(not isinstance(scores[k], (int, float)) or isinstance(scores[k], bool) or not 0 <= scores[k] <= 100 for k in EXPECTED): return 'Incomplete'
    if feedback.get('input_fingerprint') and feedback['input_fingerprint']!=evaluation_fingerprint(entity): return 'Stale'
    return 'Complete'


async def enqueue_evaluation(db, entity_id, entity_type, requested_by=None, options=None, force=False):
    model = CatalogAsset if entity_type in ('catalog_asset','artifact_migration') else Submission
    await db.flush()
    target = (await db.execute(select(model).where(model.id == entity_id).with_for_update())).scalars().first()
    if target is None: raise HTTPException(404, 'Evaluation target not found.')
    job = (await db.execute(select(EvaluationJob).where(EvaluationJob.entity_type == entity_type,
                                                      EvaluationJob.entity_id == target.id).with_for_update())).scalars().first()
    now = datetime.now(timezone.utc)
    if job and job.state == 'Running' and job.lease_until and job.lease_until > now:
        raise HTTPException(409, 'Evaluation is already running. Wait for completion before retrying or editing.')
    if entity_type != 'artifact_migration' and evaluation_health(target) == 'Complete' and not force:
        raise HTTPException(409, 'A complete evaluation already exists. Use an explicit owner/admin refresh if required.')
    settings = dict(options or {})
    settings['previous_score'] = target.ai_score
    previous = getattr(target,'ai_feedback',None) or {}
    settings['previous_agent_scores'] = previous.get('agent_scores') if isinstance(previous,dict) else None
    current = getattr(target.status, 'value', target.status)
    if current in ('Approved', 'Published', 'Archived'):
        settings['preserve_status'] = current
    if entity_type == 'submission' and current == 'Published':
        linked = (await db.execute(select(CatalogAsset).where(or_(
            CatalogAsset.id == target.catalog_code if _uuid(target.catalog_code) else False,
            CatalogAsset.catalog_code == target.catalog_code)))).scalars().first()
        if linked: settings['sync_catalog_asset_id'] = str(linked.id)
    settings['expected_updated_at'] = target.updated_at.isoformat() if target.updated_at else None
    if not job:
        job = EvaluationJob(entity_type=entity_type, entity_id=target.id)
        db.add(job)
    job.requested_by = requested_by
    job.state = 'Queued'; job.attempts = 0; job.error = None
    job.options = settings; job.lease_until = None; job.lease_token = None; job.updated_at = now
    await db.flush()
    return job


def _uuid(value):
    try: return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError): return None


async def claim_job(db):
    now = datetime.now(timezone.utc)
    candidate = (await db.execute(select(EvaluationJob).where(or_(
        EvaluationJob.state == 'Queued',
        and_(EvaluationJob.state == 'Running', EvaluationJob.lease_until < now)))
        .order_by(EvaluationJob.created_at).with_for_update(skip_locked=True).limit(1))).scalars().first()
    if not candidate: return None
    if candidate.attempts >= 3:
        candidate.state = 'Failed'; candidate.error = 'Interrupted repeatedly; manual retry required.'
        await db.commit(); return None
    candidate.state = 'Running'; candidate.attempts += 1
    candidate.lease_token = str(uuid.uuid4()); candidate.lease_until = now + timedelta(seconds=90)
    candidate.updated_at = now
    await db.commit()
    return candidate


async def run_evaluation_worker():
    from app.db.base import get_session_factory
    from app.config import get_settings
    from app.services.orchestrator import run_scoring_pipeline
    if not get_settings().evaluation_worker_enabled: return
    async def heartbeat(job_id, token):
        while True:
            await asyncio.sleep(20)
            async with get_session_factory()() as db:
                await db.execute(update(EvaluationJob).where(EvaluationJob.id == job_id,
                    EvaluationJob.lease_token == token, EvaluationJob.state == 'Running')
                    .values(lease_until=datetime.now(timezone.utc)+timedelta(seconds=90)))
                await db.commit()
    while True:
        try:
            async with get_session_factory()() as db:
                job = await claim_job(db)
                if job: snapshot = (job.id, job.entity_id, job.entity_type, dict(job.options or {}), job.lease_token)
            if not job:
                await asyncio.sleep(3); continue
            job_id, entity_id, kind, options, token = snapshot
            options.update(job_id=str(job_id), lease_token=token, job_run=True)
            pulse = asyncio.create_task(heartbeat(job_id, token))
            error = None
            try:
                if kind == 'artifact_migration':
                    from app.services.artifact_migration import migrate_artifacts
                    await asyncio.wait_for(migrate_artifacts(entity_id, options['fingerprint'], options.get('actor_id'), options.get('renames'), job_id=job_id, lease_token=token), timeout=1800)
                else:
                    await asyncio.wait_for(run_scoring_pipeline(str(entity_id), options, kind), timeout=480)
            except asyncio.CancelledError: raise
            except Exception:
                logger.exception('Evaluation job %s failed', job_id)
                error = 'Operation failed or was superseded. Review configuration and logs, then create a new request; originals are retained for storage operations.'
            finally:
                pulse.cancel()
                await asyncio.gather(pulse, return_exceptions=True)
            async with get_session_factory()() as db:
                model = CatalogAsset if kind in ('catalog_asset','artifact_migration') else Submission
                target = await db.get(model, entity_id)
                success = target is not None and not error and (kind == 'artifact_migration' or evaluation_health(target) == 'Complete')
                outcome = await db.execute(update(EvaluationJob).where(EvaluationJob.id == job_id, EvaluationJob.lease_token == token)
                                 .values(state='Completed' if success else 'Failed', error=None if success else (error or 'Incomplete agent results; retry required.'),
                                         lease_until=None, updated_at=datetime.now(timezone.utc)).returning(EvaluationJob.id))
                if outcome.scalar_one_or_none() is None:
                    await db.rollback()
                    continue  # A newer lease owns this operation; do not report its result.
                db.add(ActivityLog(actor_id=job.requested_by, action='asset_operation_completed' if success else 'asset_operation_failed',
                    entity_type='catalog_asset' if kind in ('catalog_asset','artifact_migration') else 'submission', entity_id=entity_id,
                    log_metadata={'job_id':str(job_id),'kind':kind,'previous_score':options.get('previous_score'),
                        'previous_agent_scores':options.get('previous_agent_scores'), 'result_score':target.ai_score if target else None,
                        'result_agent_scores':(target.ai_feedback or {}).get('agent_scores') if target and isinstance(target.ai_feedback,dict) else None,
                        'state':'Completed' if success else 'Failed'}))
                await db.commit()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception('Evaluation worker unavailable; verify migration 036 and database connectivity')
            await asyncio.sleep(30)
