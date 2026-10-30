from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetLike, AssetStatus, CatalogAsset, CloneRequest, CloneStatus, PortalSetting, UserProfile, UserRole
from app.deps.rbac import dept_check, get_current_user, require_role
from app.schemas.catalog import (
    CatalogAssetCreate,
    CatalogAssetListResponse,
    CatalogAssetResponse,
    CatalogAssetUpdate,
    PlatformFamilyResponse,
)
from app.services.blob_service import refresh_sas_url
from app.services.catalog_code_service import next_catalog_code

from app.services.family_assignment import FamilyUpdate, change_family

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Catalog"])
from app.routers.meeting_plans import router as meeting_plan_router
router.include_router(meeting_plan_router)
from app.routers.asset_lifecycle import router as lifecycle_router
router.include_router(lifecycle_router)
from app.routers.catalog_review import router as catalog_review_router
router.include_router(catalog_review_router)

FAMILIES = ["Atlas", "Forge", "Titan", "Sentinel"]
FAMILY_META: dict[str, dict] = {
    "Titan": {
        "color": "#5B35CC",
        "tagline": "Agentic Automation & Functional AI",
        "department": "enterprise_ai",
        "description": "Agentic Automation & Functional AI",
        "summary": "TITAN puts AI to work through intelligent agents, automated workflows and AI-powered business operations.",
        "long_description": "TITAN is the execution and business-value layer of AIMPLIFY. It transforms AI capabilities into autonomous and semi-autonomous digital workers that can reason, make decisions, orchestrate workflows and execute business processes across enterprise systems.",
        "key_assets": ["Agents", "Workflows", "Process Automation", "Functional AI", "Digital Workers", "Business Operations"],
        "use_cases": [
            "Enterprise AI platform foundations and reference architectures",
            "Cross-business AI transformation and adoption patterns",
            "Governed integration and orchestration of AI services",
            "Reusable operating models for scaling AI into production",
        ],
        "depends_on": ["Enterprise architecture and cloud foundation", "Security and governance standards"],
        "enables": ["Forge", "Atlas", "Sentinel"],
    },
    "Atlas": {
        "color": "#147FE6",
        "tagline": "AI Foundation & Platform",
        "department": "dataops",
        "description": "AI Foundation & Platform",
        "summary": "ATLAS provides the data, models, knowledge, platform and infrastructure that power enterprise AI.",
        "long_description": "ATLAS is the foundational layer of AIMPLIFY, providing the technology ecosystem required to build and operate enterprise AI at scale. It brings together AI infrastructure, data, models, knowledge, compute, platforms and reusable services into a scalable and composable AI foundation.",
        "key_assets": ["AI Foundation", "Data", "Models", "Knowledge", "Platform", "Infrastructure"],
        "use_cases": [
            "Building cloud-native data pipelines (Azure Data Factory, AWS Glue, GCP Dataflow)",
            "Master data management and golden-record reconciliation",
            "Data quality frameworks and automated DQ rule engines",
            "Lakehouse and data mesh accelerators",
            "Real-time streaming and CDC pipelines",
        ],
        "depends_on": ["Cloud storage account (ADLS Gen2 / S3 / GCS)", "Orchestration service (ADF / Airflow / Step Functions)"],
        "enables": ["Forge (AI/ML feature stores)", "Titan (AI execution and automation)"],
    },
    "Forge": {
        "color": "#F05A0A",
        "tagline": "AI Engineering & Development",
        "department": "ai_sdlc",
        "description": "AI Engineering & Development",
        "summary": "Forge builds, engineers and operationalizes AI solutions from idea to production.",
        "long_description": "FORGE is the AI engineering and development family within AIMPLIFY, enabling organizations to design, build, test, deploy and continuously improve AI-powered solutions. It provides the engineering capabilities required across the AI Software Development Lifecycle, from experimentation and prototyping through production deployment and evolution.",
        "key_assets": ["AI Engineering", "AI Development", "AI SDLC", "GenAI", "Agentic AI", "AI Applications"],
        "use_cases": [
            "Retrieval-Augmented Generation (RAG) pipelines with vector search",
            "LLM prompt management and versioning systems",
            "AI-assisted code review and documentation generation",
            "Fine-tuning and RLHF workflow templates",
            "Multi-agent orchestration frameworks (LangChain, AutoGen, CrewAI)",
        ],
        "depends_on": ["LLM API (Azure OpenAI / AWS Bedrock / GCP Vertex AI)", "Vector store (Pinecone / Qdrant / pgvector)"],
        "enables": ["Atlas (knowledge base ingestion)", "Sentinel (AI security scanning)", "Titan (AI-driven automation)"],
    },
    "Sentinel": {
        "color": "#07885C",
        "tagline": "AI Security, Risk & Governance",
        "department": "security",
        "description": "AI Security, Risk & Governance",
        "summary": "SENTINEL secures, governs, monitors and assures AI across its entire lifecycle.",
        "long_description": "SENTINEL is AIMPLIFY's AI Trust, Security and Governance family, designed to protect AI systems from emerging threats while ensuring responsible, compliant and controlled AI adoption. It provides continuous security, risk management, governance, guardrails and observability across models, agents, applications and AI workflows.",
        "key_assets": ["AI Security", "Red Team", "Guardrails", "Observability", "Risk", "Compliance", "Governance"],
        "use_cases": [
            "Automated SAST/DAST pipeline integrations (Snyk, Checkmarx, OWASP ZAP)",
            "Zero-trust network and identity policy templates",
            "Compliance-as-code for SOC 2, HIPAA, GDPR, ISO 27001",
            "Secrets management and key rotation automation",
            "Audit logging and forensic evidence collection frameworks",
        ],
        "depends_on": ["IAM provider (Azure AD / AWS IAM / GCP IAM)", "CI/CD platform (GitHub Actions / Azure DevOps / Jenkins)"],
        "enables": ["Titan (secure workflow automation and governance monitoring)"],
    },
}


def default_portal_content() -> dict:
    return {
        "aiv_portal_name": "AIV Intelligence Portal",
        "aiv_portal_description": "Access InfoVision's AI intelligence hub for insights, tools, and resources",
        "aiv_portal_url": "https://aivportal.infovision.ai/",
        "banners": {
            "home": {"title": "AIMPLIFY", "subtitle": "One platform for discovering, reusing, and deploying proven AI accelerators."},
            "login": {"title": "AIMPLIFY", "subtitle": "AI Management for Process Lifecycle, Intelligence, Flow & Yield"},
            "catalog": {"title": "Asset Catalog", "subtitle": "Discover reusable, approved AI assets across the FAST platform families."},
            "pipeline": {"title": "Assets Pipeline", "subtitle": "Track submissions, reviews, requests, and publishing activity."},
            "submit": {"title": "Submit a New Asset", "subtitle": "Share a reusable AI capability for evaluation and publication."},
            "why": {"title": "Why AIMPLIFY?", "subtitle": "The platform that turns collective intelligence into company advantage."},
            "observability": {"title": "Observability Dashboard", "subtitle": "Monitor platform activity, governance, adoption, and engagement."},
            "executive": {"title": "Asset Governance & Adoption", "subtitle": "Executive reporting across AIMPLIFY performance and outcomes."},
        },
        "families": [dict(id=name, name=name, **FAMILY_META[name]) for name in FAMILIES],
        "family_order": FAMILIES.copy(),
    }


def _slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_-]+", "-", slug).strip("-")


def _to_response(asset: CatalogAsset, owner_name: str | None = None, clone_request_count: int = 0, deployment_count: int = 0, like_count: int = 0, liked_by_me: bool = False, owner_email: str | None = None) -> CatalogAssetResponse:
    return CatalogAssetResponse(
        id=asset.id,
        catalog_code=asset.catalog_code,
        slug=asset.slug,
        title=asset.title,
        description=asset.description,
        family=asset.family,
        department=asset.department,
        tech_stack=asset.tech_stack or [],
        collaborators=asset.collaborators or [],
        cloud_provider=asset.cloud_provider,
        maturity=asset.maturity.value if hasattr(asset.maturity, "value") else asset.maturity,
        demo_ready=asset.demo_ready,
        video_url=refresh_sas_url(asset.video_url),
        video_urls=[refresh_sas_url(u) for u in dict.fromkeys(asset.video_urls or ([asset.video_url] if asset.video_url else [])) if u],
        demo_url=asset.demo_url,
        repo_url=asset.repo_url,
        thumbnail_url=asset.thumbnail_url,
        dependencies=asset.dependencies,
        commands=asset.commands or [],
        architecture_file_url=asset.architecture_file_url,
        category=asset.category,
        status=asset.status.value if hasattr(asset.status, "value") else asset.status,
        ai_score=asset.ai_score,
        ai_feedback=asset.ai_feedback,
        owner_id=asset.owner_id,
        owner_name=asset.owner_name or owner_name,
        owner_email=asset.owner_email or owner_email,
        manager_name=asset.manager_name,
        aiv_ideation_id=asset.aiv_ideation_id,
        aiv_ideation_title=asset.aiv_ideation_title,
        manager_email=asset.manager_email,
        designation=asset.designation,
        clone_request_count=clone_request_count,
        deployment_count=deployment_count,
        like_count=like_count,
        liked_by_me=liked_by_me,
        artifact_download_count=asset.artifact_download_count or 0,
        demo_view_count=asset.demo_view_count or 0,
        view_count=asset.view_count or 0,
        demo_request_count=asset.demo_request_count or 0,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


@router.get("/catalog", response_model=CatalogAssetListResponse)
async def list_catalog(
    family: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    cloud_provider: Optional[str] = Query(None),
    maturity: Optional[str] = Query(None),
    demo_ready: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> CatalogAssetListResponse:
    stmt = select(CatalogAsset).where(CatalogAsset.status == AssetStatus.Published).execution_options(populate_existing=True)
    if family:
        stmt = stmt.where(CatalogAsset.family == family)
    if department:
        stmt = stmt.where(CatalogAsset.department == department)
    if cloud_provider:
        from app.schemas.metadata_rules import cloud_filter
        stmt = stmt.where(cloud_filter(CatalogAsset.cloud_provider, cloud_provider))
    if maturity:
        stmt = stmt.where(CatalogAsset.maturity == maturity)
    if demo_ready is not None:
        stmt = stmt.where(CatalogAsset.demo_ready == demo_ready)
    if search:
        term = f"%{search}%"
        stmt = stmt.where(CatalogAsset.title.ilike(term) | CatalogAsset.description.ilike(term))

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    clone_stats = (
        select(
            CloneRequest.asset_id.label("asset_id"),
            func.count(CloneRequest.id).label("clone_count"),
            func.count(CloneRequest.id).filter(
                CloneRequest.purpose == "Customer Demo",
                CloneRequest.status == CloneStatus.Approved,
            ).label("deployment_count"),
        ).group_by(CloneRequest.asset_id).subquery()
    )
    like_stats = (
        select(AssetLike.asset_id.label("asset_id"), func.count(AssetLike.id).label("like_count"))
        .group_by(AssetLike.asset_id).subquery()
    )
    enriched_stmt = (stmt
        .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
        .outerjoin(clone_stats, clone_stats.c.asset_id == CatalogAsset.id)
        .outerjoin(like_stats, like_stats.c.asset_id == CatalogAsset.id)
    ).add_columns(
        UserProfile.display_name.label("owner_display_name"),
        UserProfile.email.label("owner_profile_email"),
        func.coalesce(clone_stats.c.clone_count, 0).label("clone_count"),
        func.coalesce(clone_stats.c.deployment_count, 0).label("deployment_count"),
        func.coalesce(like_stats.c.like_count, 0).label("like_count"),
    )
    result = await db.execute(enriched_stmt.order_by(CatalogAsset.created_at.desc()).offset(skip).limit(limit))
    items = [
        _to_response(
            asset,
            owner_name=owner_display_name,
            owner_email=owner_profile_email,
            clone_request_count=clones,
            deployment_count=deployments,
            like_count=likes,
        )
        for asset, owner_display_name, owner_profile_email, clones, deployments, likes in result.all()
    ]
    return CatalogAssetListResponse(items=items, total=total)


@router.get("/catalog/families", response_model=list[PlatformFamilyResponse])
async def list_families(db: AsyncSession = Depends(get_db)) -> list[PlatformFamilyResponse]:
    responses = []
    setting = (await db.execute(select(PortalSetting).where(PortalSetting.key == "portal_content"))).scalar_one_or_none()
    configured = (setting.value or {}).get("families", []) if setting else []
    configured_by_id = {item.get("id"): item for item in configured if item.get("id") in FAMILIES}
    requested_order = (setting.value or {}).get("family_order", FAMILIES) if setting else FAMILIES
    family_order = [name for name in requested_order if name in FAMILIES]
    family_order.extend(name for name in FAMILIES if name not in family_order)
    for family_name in family_order:
        meta = {**FAMILY_META[family_name], **configured_by_id.get(family_name, {})}
        count_result = await db.execute(
            select(func.count()).where(
                CatalogAsset.family == family_name,
                CatalogAsset.status == AssetStatus.Published,
            )
        )
        responses.append(
            PlatformFamilyResponse(
                id=family_name,
                name=family_name,
                color=meta["color"],
                tagline=meta["tagline"],
                department=meta["department"],
                description=meta.get("description"),
                summary=meta.get("summary"),
                long_description=meta.get("long_description"),
                key_assets=meta.get("key_assets", []),
                use_cases=meta.get("use_cases", []),
                depends_on=meta.get("depends_on", []),
                enables=meta.get("enables", []),
                asset_count=count_result.scalar_one(),
            )
        )
    return responses


@router.get("/catalog/{slug}", response_model=CatalogAssetResponse)
async def get_asset(slug: str, db: AsyncSession = Depends(get_db), user=Depends(get_current_user)) -> CatalogAssetResponse:
    # Accept slug or UUID — edit flow passes the asset id directly
    import re as _re
    is_uuid = bool(_re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', slug, _re.I))
    condition = (CatalogAsset.id == uuid.UUID(slug)) if is_uuid else (CatalogAsset.slug == slug)

    is_privileged = user.role in (UserRole.admin, UserRole.owner)

    # Admins and owners can view any asset; regular users only see Published ones
    status_filter = [] if is_privileged else [CatalogAsset.status.in_([AssetStatus.Published, AssetStatus.Deprecated, AssetStatus.Decommissioned])]

    result = await db.execute(
        select(CatalogAsset, UserProfile.display_name, UserProfile.email)
        .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
        .where(condition, *status_filter)
        .execution_options(populate_existing=True)
    )
    row = result.first()

    # Non-privileged users: also allow the asset owner to view their own unpublished asset
    if not row and not is_privileged:
        result2 = await db.execute(
            select(CatalogAsset, UserProfile.display_name, UserProfile.email)
            .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
            .where(condition, CatalogAsset.owner_id == user.id)
        )
        row = result2.first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    asset, owner_display_name, owner_profile_email = row
    if not is_privileged and asset.status in (AssetStatus.Deprecated, AssetStatus.Decommissioned):
        from fastapi.responses import JSONResponse
        from app.services.asset_lifecycle import label
        return JSONResponse(label(asset))
    from app.db.models import CloneRequest, CloneStatus, AssetLike
    from sqlalchemy import func as _func
    clone_count_result = await db.execute(
        select(_func.count()).select_from(CloneRequest).where(CloneRequest.asset_id == asset.id)
    )
    clone_count = clone_count_result.scalar_one()
    deployment_count_result = await db.execute(
        select(_func.count()).select_from(CloneRequest).where(
            CloneRequest.asset_id == asset.id,
            CloneRequest.purpose == "Customer Demo",
            CloneRequest.status == CloneStatus.Approved,
        )
    )
    deployment_count = deployment_count_result.scalar_one()
    like_count_result = await db.execute(
        select(_func.count()).select_from(AssetLike).where(AssetLike.asset_id == asset.id)
    )
    like_count = like_count_result.scalar_one()
    liked_result = await db.execute(
        select(AssetLike).where(AssetLike.asset_id == asset.id, AssetLike.user_id == user.id)
    )
    liked_by_me = liked_result.scalars().first() is not None
    return _to_response(asset, owner_name=owner_display_name, owner_email=owner_profile_email, clone_request_count=clone_count, deployment_count=deployment_count, like_count=like_count, liked_by_me=liked_by_me)


@router.post("/catalog", response_model=CatalogAssetResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_catalog_asset(
    body: CatalogAssetCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> CatalogAssetResponse:
    from app.services.orchestrator import run_scoring_pipeline

    slug = _slugify(body.title)
    catalog_code = await next_catalog_code(db, body.family)

    asset = CatalogAsset(
        catalog_code=catalog_code,
        slug=slug,
        title=body.title,
        description=body.description,
        family=body.family,
        department=body.department,
        tech_stack=body.tech_stack,
        cloud_provider=body.cloud_provider,
        maturity=body.maturity,
        demo_ready=body.demo_ready,
        video_url=body.video_url,
        video_urls=list(dict.fromkeys(body.video_urls or ([body.video_url] if body.video_url else []))),
        thumbnail_url=body.thumbnail_url,
        repo_url=body.repo_url,
        status=AssetStatus.AI_Review,
        owner_id=user.id,
    )
    for field in ('owner_name','owner_email','manager_name','manager_email','designation','category','architecture_file_url','dependencies','commands','demo_url','collaborators'):
        setattr(asset, field, getattr(body, field, None))
    db.add(asset)
    await db.flush()
    await db.refresh(asset)

    submission_data = {
        "id": str(asset.id),
        "title": asset.title,
        "description": asset.description,
        "family": asset.family,
        "department": asset.department,
        "tech_stack": asset.tech_stack,
        "video_url": asset.video_url,
        "thumbnail_url": asset.thumbnail_url,
        "submitter_role": user.role.value if hasattr(user.role, "value") else user.role,
        "submitter_email": user.email,
        "entity": "catalog_asset",
    }
    from app.services.evaluation_jobs import enqueue_evaluation
    await enqueue_evaluation(db, asset.id, "catalog_asset", user.id)
    await db.commit()
    return _to_response(asset)


@router.patch("/catalog/{asset_id}", response_model=CatalogAssetResponse)
async def update_catalog_asset(
    asset_id: str,
    body: CatalogAssetUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
) -> CatalogAssetResponse:
    result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    is_admin = user.role in (UserRole.admin, UserRole.owner)
    is_owner = str(asset.owner_id) == str(user.id)

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the asset owner or an admin can update this asset.",
        )

    changes = body.model_dump(exclude_unset=True)
    from app.schemas.metadata_rules import validate_patch_pair
    validate_patch_pair(asset, changes)
    if 'family' in changes:
        await change_family(db, asset.id, changes.pop('family'), user.id, catalog=True)
    for field, value in changes.items():
        setattr(asset, field, value)

    asset.updated_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="catalog_asset_updated",
        entity_type="catalog_asset",
        entity_id=asset.id,
    ))
    await db.commit()
    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
    background_tasks.add_task(reindex_catalog_asset_by_id, str(asset.id))
    return _to_response(asset)


@router.delete("/catalog/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_catalog_asset(
    asset_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Owner"),
) -> Response:
    from app.db.models import Submission, SubmissionStatus

    result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
    asset = result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    asset.status = AssetStatus.Archived

    # Propagate: mark the linked submission(s) as Archived so the submitter sees it in their pipeline
    if asset.catalog_code:
        subs_result = await db.execute(
            select(Submission).where(Submission.catalog_code == asset.catalog_code)
        )
        for sub in subs_result.scalars().all():
            sub.status = SubmissionStatus.Archived

    db.add(ActivityLog(
        actor_id=user.id,
        action="catalog_asset_archived",
        entity_type="catalog_asset",
        entity_id=asset.id,
    ))
    await db.commit()
    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
    background_tasks.add_task(reindex_catalog_asset_by_id, str(asset.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/catalog/{asset_id}/family")
async def update_asset_family(asset_id: uuid.UUID, body: FamilyUpdate, background_tasks: BackgroundTasks,
                              db: AsyncSession = Depends(get_db), user=require_role("Aimplify.Admin", "Aimplify.Owner")):
    asset = await change_family(db, asset_id, body.family, user.id, catalog=True)
    await db.commit()
    from app.services.knowledge.ingestion_service import reindex_catalog_asset_by_id
    background_tasks.add_task(reindex_catalog_asset_by_id, str(asset.id))
    return {"id":str(asset.id), "family":asset.family, "slug":asset.slug}
