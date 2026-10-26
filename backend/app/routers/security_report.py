from io import BytesIO
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.base import get_db
from app.db.models import CatalogAsset, UserProfile, Submission, ActivityLog
from app.deps.rbac import require_role
from app.services.security_report_service import build_report, export_csv

router = APIRouter(prefix='/admin/security-report', tags=['Security evidence report'])
quality_router = APIRouter(prefix='/admin/asset-quality-report', tags=['Asset quality report'])


@quality_router.get('')
async def asset_quality_report(
    format: str = Query('json', pattern='^(json|csv|xlsx)$'),
    verify: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user=require_role('Aimplify.Owner'),
):
    from urllib.parse import urlsplit
    from app.config import get_settings
    from app.services.asset_quality_service import build_quality_report, export_quality_csv, export_quality_xlsx
    from app.services.quality_link_checker import checker_for_hosts
    settings = get_settings()
    rows = (await db.execute(select(CatalogAsset, UserProfile)
                            .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
                            .order_by(CatalogAsset.title, CatalogAsset.id))).all()
    # Only stable codes are matched; use explicit review fields rather than loading
    # unrelated request tables or allowing an asset to disappear on a failed join.
    submissions = (await db.execute(select(Submission.id, Submission.catalog_code, Submission.created_at,
                                          Submission.reviewed_by, Submission.reviewed_at)
                                   )).all()
    publications = (await db.execute(select(ActivityLog.entity_id, ActivityLog.log_metadata)
                                    .where(ActivityLog.action == 'submission_published')
                                    .order_by(ActivityLog.created_at))).all()
    links = {str(sub_id): (metadata or {}).get('catalog_asset_id') for sub_id, metadata in publications}
    hosts = settings.quality_report_allowed_hosts.split(',')
    frontend_host = urlsplit(settings.frontend_url).hostname
    if frontend_host: hosts.append(frontend_host)
    if settings.blob_account_name: hosts.append(settings.blob_account_name + '.blob.core.windows.net')
    report = await build_quality_report(rows, submissions, verify, checker_for_hosts(hosts), publication_links=links)
    if format == 'json': return report
    builder, media_type = (export_quality_xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') if format == 'xlsx' else (export_quality_csv, 'text/csv; charset=utf-8')
    return StreamingResponse(BytesIO(builder(report)), media_type=media_type,
                             headers={'Content-Disposition': f'attachment; filename="AIMPLIFY_Asset_Quality_Report.{format}"'})


@router.get('')
async def security_report(
    format: str = Query('json', pattern='^(json|csv)$'),
    db: AsyncSession = Depends(get_db),
    user=require_role('Aimplify.Owner'),
):
    # No catalog pagination/status filter: inventory includes every catalog asset.
    rows = (await db.execute(select(CatalogAsset, UserProfile)
                            .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
                            .order_by(CatalogAsset.title, CatalogAsset.id))).all()
    report = build_report(rows)
    if format == 'json':
        return report
    return StreamingResponse(BytesIO(export_csv(report)), media_type='text/csv; charset=utf-8',
                             headers={'Content-Disposition': 'attachment; filename="AIMPLIFY_Security_Evidence_Report.csv"'})
