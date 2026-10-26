"""Non-destructive, plan-driven finalization of existing asset artifact references."""
import hashlib
import json
import re
from urllib.parse import urlsplit, unquote
from app.services.asset_quality_service import references


def configured_account(settings):
    values = dict(part.split('=',1) for part in settings.blob_connection_string.split(';') if '=' in part)
    return settings.blob_account_name or values.get('AccountName','')


def storage_plan(asset, account_name, renames=None):
    entries = []
    for ref in references(asset):
        if ref['category'] == 'Demo link': continue
        url = ref['_url']
        try: parsed = urlsplit(url)
        except ValueError: continue
        if parsed.hostname != f'{account_name}.blob.core.windows.net': continue
        parts = unquote(parsed.path).lstrip('/').split('/')
        if len(parts) < 3 or parts[0] != 'artifacts' or any(p in ('.','..','') for p in parts): continue
        old = '/'.join(parts[1:]); filename = parts[-1]
        if old in (renames or {}):
            replacement = renames[old].strip()
            if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_. -]{0,199}', replacement) or '..' in replacement:
                raise ValueError('Replacement file names must be plain filenames without paths')
            if replacement.rsplit('.',1)[-1].lower() != filename.rsplit('.',1)[-1].lower():
                raise ValueError('Renaming must preserve the file extension')
            filename = replacement.replace(' ', '_')
        family = re.sub(r'[^a-z0-9-]', '', asset.family.lower())
        if family not in ('forge','atlas','sentinel','titan'): continue
        media = 'video' if ref['category'] == 'Demo video' else 'document'
        destination = f'{family}/{asset.id}/{media}/{filename}'
        if old == destination: continue
        entries.append({'source': old, 'destination': destination, 'category': ref['category'], 'name': ref['name']})
    entries = list({(e['source'],e['destination']):e for e in entries}.values())
    entries.sort(key=lambda e:(e['source'],e['destination']))
    if len({e['destination'] for e in entries}) != len(entries):
        raise ValueError('Two source files cannot share the same destination')
    fingerprint = hashlib.sha256(json.dumps(entries,sort_keys=True).encode()).hexdigest()
    return {'asset_id':str(asset.id), 'asset_title':asset.title, 'fingerprint':fingerprint,
            'files':entries, 'originals_retained':True,
            'notice':'Relocates currently linked files only. An owner must confirm the recordings actually belong to this asset. Originals are never deleted.'}


async def _hash(blob):
    digest = hashlib.sha256(); size = 0
    stream = await blob.download_blob()
    async for chunk in stream.chunks():
        digest.update(chunk); size += len(chunk)
    return digest.hexdigest(), size


async def _copy_stream(source, destination, content_settings, source_hash, source_size):
    stream = await source.download_blob()

    async def chunks():
        # Azure's chunk iterator also exposes __iter__, which the upload helper
        # checks before __aiter__. A pure async generator avoids that sync path.
        async for chunk in stream.chunks():
            yield chunk

    await destination.upload_blob(chunks(), length=source_size, overwrite=False,
        content_settings=content_settings, metadata={'migration_source_sha256': source_hash})


async def migrate_artifacts(asset_id, expected_fingerprint, requested_by, renames=None, job_id=None, lease_token=None):
    from app.config import get_settings
    from app.db.base import get_session_factory
    from app.db.models import CatalogAsset, Submission, ActivityLog
    from sqlalchemy import select, or_
    from azure.storage.blob.aio import BlobServiceClient
    from azure.core.exceptions import ResourceExistsError
    from app.services.blob_service import _make_sas_url
    settings = get_settings()
    connection = dict(part.split('=',1) for part in settings.blob_connection_string.split(';') if '=' in part)
    key = settings.blob_account_key or connection.get('AccountKey','')
    if not key: raise ValueError('Storage account key is required to retain private downloadable references')
    async with BlobServiceClient.from_connection_string(settings.blob_connection_string) as storage:
        async with get_session_factory()() as db:
            asset = await db.get(CatalogAsset, asset_id)
            if not asset: raise ValueError('Asset no longer exists')
            plan = storage_plan(asset, storage.account_name, renames)
            if plan['fingerprint'] != expected_fingerprint: raise ValueError('Artifact references changed; generate a new plan')
            copies = {}
            for entry in plan['files']:
                source = storage.get_blob_client('artifacts', entry['source'])
                destination = storage.get_blob_client('artifacts', entry['destination'])
                properties = await source.get_blob_properties()
                source_hash, source_size = await _hash(source)
                try:
                    await _copy_stream(source, destination, properties.content_settings, source_hash, source_size)
                except ResourceExistsError:
                    pass  # Verify an existing destination before reusing it; never overwrite.
                copied_hash, copied_size = await _hash(destination)
                if (copied_hash, copied_size) != (source_hash, source_size):
                    raise ValueError('Copied content differs; originals and database references were retained')
                copies[entry['source']] = _make_sas_url(entry['destination'], storage.account_name, key, expiry_hours=24*365)
            if job_id:
                from app.db.operations_models import EvaluationJob
                lease=(await db.execute(select(EvaluationJob.id).where(EvaluationJob.id==job_id,
                    EvaluationJob.lease_token==lease_token,EvaluationJob.state=='Running').with_for_update())).scalar_one_or_none()
                if not lease: raise ValueError('Storage lease was superseded; originals and references were retained')
            # Re-read under a lock after network work; changing references cancels the database update.
            await db.refresh(asset, with_for_update=True)
            if storage_plan(asset, storage.account_name, renames)['fingerprint'] != expected_fingerprint:
                raise ValueError('Asset changed during copy; no database references changed')
            def replace_url(value):
                if not isinstance(value,str): return value
                p=urlsplit(value)
                if p.hostname != f'{storage.account_name}.blob.core.windows.net': return value
                path=unquote(p.path).lstrip('/')
                return copies.get(path.removeprefix('artifacts/'), value)
            def documents(value):
                try: parsed=json.loads(value or '')
                except ValueError: return replace_url(value)
                def walk(item):
                    if isinstance(item,list): return [walk(v) for v in item]
                    if isinstance(item,dict): return {k:walk(v) for k,v in item.items()}
                    return replace_url(item)
                return json.dumps(walk(parsed))
            def apply(entity):
                entity.video_url = replace_url(entity.video_url)
                entity.video_urls = [replace_url(u) for u in entity.video_urls or []]
                entity.architecture_file_url = documents(entity.architecture_file_url)
            apply(asset)
            submissions=(await db.execute(select(Submission).where(or_(Submission.catalog_code==str(asset.id),
                                                                       Submission.catalog_code==asset.catalog_code)))).scalars().all()
            for submission in submissions: apply(submission)
            db.add(ActivityLog(actor_id=requested_by, action='asset_artifacts_finalized',entity_type='catalog_asset',
                               entity_id=asset.id,log_metadata={'plan':plan,'copied_files':len(copies),'originals_retained':True}))
            await db.commit()
            return len(copies)


async def queue_artifact_finalization(db, asset, actor_id):
    from app.config import get_settings
    from app.services.evaluation_jobs import enqueue_evaluation
    settings = get_settings()
    account = configured_account(settings)
    if not account or not settings.blob_connection_string: return None
    try: plan = storage_plan(asset, account)
    except ValueError:
        from app.db.models import ActivityLog
        db.add(ActivityLog(actor_id=actor_id,action='artifact_finalization_requires_review',entity_type='catalog_asset',entity_id=asset.id,
                           log_metadata={'reason':'Conflicting destinations; review the linked files before migration.'}))
        return None
    if not plan['files']: return None
    return await enqueue_evaluation(db, asset.id, 'artifact_migration', actor_id,
        options={'fingerprint':plan['fingerprint'], 'actor_id':str(actor_id)}, force=True)
