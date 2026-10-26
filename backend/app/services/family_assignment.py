"""Narrow, audited reclassification without resubmitting legacy metadata."""
from datetime import datetime, timezone
from fastapi import HTTPException
from pydantic import ConfigDict
from sqlalchemy import select
from app.db.models import CatalogAsset, Submission, SubmissionStatus, ActivityLog
from app.schemas.metadata_rules import MetadataRules


class FamilyUpdate(MetadataRules):
    model_config = ConfigDict(extra="forbid")
    family: str


async def change_family(db, entity_id, family, actor_id, catalog=False):
    model = CatalogAsset if catalog else Submission
    item = (await db.execute(select(model).where(model.id == entity_id).with_for_update())).scalars().first()
    if not item:
        raise HTTPException(404, 'Asset or submission not found.')
    if not catalog and item.status not in (SubmissionStatus.Manual_Approval, SubmissionStatus.Approved, SubmissionStatus.On_Hold):
        raise HTTPException(409, 'Family can be changed here during review or publishing only.')
    previous = item.family
    if previous == family:
        return item
    item.family = family
    item.updated_at = datetime.now(timezone.utc)
    synced = []
    if catalog:
        refs = [str(item.id)] + ([item.catalog_code] if item.catalog_code else [])
        sources = (await db.execute(select(Submission).where(Submission.catalog_code.in_(refs),
            Submission.status.notin_([SubmissionStatus.Archived, SubmissionStatus.Rejected])).with_for_update())).scalars().all()
        for source in sources:
            synced.append({'id':str(source.id),'previous_family':source.family})
            source.family = family
            source.updated_at = item.updated_at
    db.add(ActivityLog(actor_id=actor_id, action='asset_family_changed' if catalog else 'submission_family_changed',
        entity_type='catalog_asset' if catalog else 'submission', entity_id=item.id,
        log_metadata={'previous_family':previous,'family':family,'linked_submissions':synced}))
    return item
