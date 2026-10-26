from __future__ import annotations

import logging
import re
import uuid
from app.services.blob_service import refresh_sas_url
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, UserProfile, UserRole
from app.deps.rbac import dept_check, get_current_user, require_role
from app.schemas.catalog import (
    CatalogAssetCreate,
    CatalogAssetListResponse,
    CatalogAssetResponse,
    CatalogAssetUpdate,
    PlatformFamilyResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Catalog"])

FAMILIES = ["Atlas", "Forge", "Sentinel", "Relay", "Nexus"]
FAMILY_META: dict[str, dict] = {
    "Atlas": {
        "color": "#3B82F6",
        "tagline": "DataOps & Master Data",
        "department": "dataops",
        "description": "Data pipelines, master data management, and analytics accelerators.",
        "long_description": (
            "Atlas is InfoVision's DataOps and Master Data family — a curated set of "
            "reusable accelerators for building, testing, and operating data pipelines at scale. "
            "From ingestion and quality rules to MDM patterns and lakehouse templates, Atlas "
            "assets help delivery teams stand up reliable, observable data platforms faster. "
            "Every Atlas asset is designed to connect cleanly with cloud-native storage and "
            "orchestration services so teams spend less time plumbing and more time building insight."
        ),
        "use_cases": [
            "Building cloud-native data pipelines (Azure Data Factory, AWS Glue, GCP Dataflow)",
            "Master data management and golden-record reconciliation",
            "Data quality frameworks and automated DQ rule engines",
            "Lakehouse and data mesh accelerators",
            "Real-time streaming and CDC pipelines",
        ],
        "depends_on": ["Cloud storage account (ADLS Gen2 / S3 / GCS)", "Orchestration service (ADF / Airflow / Step Functions)"],
        "enables": ["Forge (AI/ML feature stores)", "Nexus (DataOps observability dashboards)"],
    },
    "Forge": {
        "color": "#8B5CF6",
        "tagline": "AI SDLC & Prompt Engineering",
        "department": "ai_sdlc",
        "description": "LLM toolchains, RAG frameworks, and AI-assisted SDLC accelerators.",
        "long_description": (
            "Forge is the AI SDLC and Prompt Engineering family — the engine room for building "
            "production-grade GenAI solutions. It houses RAG pipelines, prompt-management "
            "frameworks, fine-tuning templates, AI code-review agents, and evaluation harnesses. "
            "Whether a team is integrating an LLM into an existing product or building a "
            "greenfield AI application, Forge accelerators provide battle-tested patterns that "
            "reduce time-to-POC and time-to-production for GenAI workloads."
        ),
        "use_cases": [
            "Retrieval-Augmented Generation (RAG) pipelines with vector search",
            "LLM prompt management and versioning systems",
            "AI-assisted code review and documentation generation",
            "Fine-tuning and RLHF workflow templates",
            "Multi-agent orchestration frameworks (LangChain, AutoGen, CrewAI)",
        ],
        "depends_on": ["LLM API (Azure OpenAI / AWS Bedrock / GCP Vertex AI)", "Vector store (Pinecone / Qdrant / pgvector)"],
        "enables": ["Atlas (knowledge base ingestion)", "Sentinel (AI security scanning)", "Relay (AI-driven automation)"],
    },
    "Sentinel": {
        "color": "#EF4444",
        "tagline": "Security & Compliance",
        "department": "security",
        "description": "Security scanning, compliance automation, and zero-trust access accelerators.",
        "long_description": (
            "Sentinel is InfoVision's Security and Compliance family — a library of accelerators "
            "for embedding security and regulatory compliance into every layer of the delivery "
            "pipeline. It covers SAST/DAST integrations, IAM policy templates, zero-trust network "
            "patterns, audit-log frameworks, and compliance-as-code modules for SOC 2, ISO 27001, "
            "HIPAA, and GDPR. Sentinel assets are designed to be plugged into existing CI/CD "
            "pipelines and infrastructure-as-code repositories with minimal configuration."
        ),
        "use_cases": [
            "Automated SAST/DAST pipeline integrations (Snyk, Checkmarx, OWASP ZAP)",
            "Zero-trust network and identity policy templates",
            "Compliance-as-code for SOC 2, HIPAA, GDPR, ISO 27001",
            "Secrets management and key rotation automation",
            "Audit logging and forensic evidence collection frameworks",
        ],
        "depends_on": ["IAM provider (Azure AD / AWS IAM / GCP IAM)", "CI/CD platform (GitHub Actions / Azure DevOps / Jenkins)"],
        "enables": ["Relay (secure workflow automation)", "Nexus (compliance monitoring dashboards)"],
    },
    "Relay": {
        "color": "#F59E0B",
        "tagline": "Process Automation & QE",
        "department": "automation",
        "description": "RPA bots, test automation frameworks, and intelligent workflow accelerators.",
        "long_description": (
            "Relay is the Process Automation and Quality Engineering family — connecting people, "
            "systems, and data through intelligent automation. It includes RPA accelerators, "
            "API-integration templates, test-automation frameworks (Selenium, Playwright, Cypress), "
            "BDD scaffolding, and low-code workflow builders. Relay assets help teams eliminate "
            "repetitive manual work, accelerate QA cycles, and build resilient end-to-end "
            "automation that survives UI and API changes."
        ),
        "use_cases": [
            "RPA bots for ERP, HRMS, and back-office processes (UiPath, Power Automate, Blue Prism)",
            "End-to-end test automation suites (Playwright, Selenium, Cypress)",
            "BDD test frameworks and living-documentation generators",
            "API integration and event-driven workflow templates",
            "Intelligent document processing (IDP) pipelines",
        ],
        "depends_on": ["Target application / API surface", "Test environment or sandbox"],
        "enables": ["Forge (automated QA for AI outputs)", "Sentinel (compliance test suites)"],
    },
    "Nexus": {
        "color": "#10B981",
        "tagline": "Infrastructure & Managed AI Ops",
        "department": "infra",
        "description": "IaC modules, MLOps pipelines, and cloud cost-optimisation accelerators.",
        "long_description": (
            "Nexus is the Infrastructure and Managed AI Ops family — the platform foundation that "
            "everything else runs on. It provides Terraform and Bicep modules for provisioning "
            "cloud environments, Kubernetes Helm charts, MLOps pipeline templates (Azure ML, "
            "SageMaker, Vertex AI), FinOps dashboards, and observability stacks. Nexus assets "
            "give delivery teams a reproducible, cost-optimised, and observable infrastructure "
            "baseline so they can focus on value delivery rather than undifferentiated heavy lifting."
        ),
        "use_cases": [
            "Infrastructure-as-Code templates (Terraform, Bicep, Pulumi, CDK)",
            "Kubernetes Helm charts and GitOps workflows (ArgoCD, Flux)",
            "MLOps pipelines and model registry integrations",
            "Cloud cost visibility, tagging governance, and FinOps dashboards",
            "Centralised observability stacks (OpenTelemetry, Grafana, Datadog)",
        ],
        "depends_on": ["Cloud subscription (Azure / AWS / GCP)", "Container registry"],
        "enables": ["All families (shared infrastructure baseline)"],
    },
}


def _slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[\s_-]+", "-", slug).strip("-")


def _to_response(asset: CatalogAsset, owner_name: str | None = None, clone_request_count: int = 0, deployment_count: int = 0, like_count: int = 0, liked_by_me: bool = False) -> CatalogAssetResponse:
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
        owner_email=asset.owner_email,
        manager_name=asset.manager_name,
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
    stmt = select(CatalogAsset).where(CatalogAsset.status == AssetStatus.Published)
    if family:
        stmt = stmt.where(CatalogAsset.family == family)
    if department:
        stmt = stmt.where(CatalogAsset.department == department)
    if cloud_provider:
        stmt = stmt.where(CatalogAsset.cloud_provider == cloud_provider)
    if maturity:
        stmt = stmt.where(CatalogAsset.maturity == maturity)
    if demo_ready is not None:
        stmt = stmt.where(CatalogAsset.demo_ready == demo_ready)
    if search:
        term = f"%{search}%"
        stmt = stmt.where(CatalogAsset.title.ilike(term) | CatalogAsset.description.ilike(term))

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    result = await db.execute(stmt.order_by(CatalogAsset.created_at.desc()).offset(skip).limit(limit))
    items = [_to_response(a) for a in result.scalars().all()]
    return CatalogAssetListResponse(items=items, total=total)


@router.get("/catalog/families", response_model=list[PlatformFamilyResponse])
async def list_families(db: AsyncSession = Depends(get_db)) -> list[PlatformFamilyResponse]:
    responses = []
    for family_name, meta in FAMILY_META.items():
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
                long_description=meta.get("long_description"),
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
    status_filter = [] if is_privileged else [CatalogAsset.status == AssetStatus.Published]

    result = await db.execute(
        select(CatalogAsset, UserProfile.display_name)
        .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
        .where(condition, *status_filter)
    )
    row = result.first()

    # Non-privileged users: also allow the asset owner to view their own unpublished asset
    if not row and not is_privileged:
        result2 = await db.execute(
            select(CatalogAsset, UserProfile.display_name)
            .outerjoin(UserProfile, CatalogAsset.owner_id == UserProfile.id)
            .where(condition, CatalogAsset.owner_id == user.id)
        )
        row = result2.first()

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    asset, owner_display_name = row
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
    return _to_response(asset, owner_name=owner_display_name, clone_request_count=clone_count, deployment_count=deployment_count, like_count=like_count, liked_by_me=liked_by_me)


@router.post("/catalog", response_model=CatalogAssetResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_catalog_asset(
    body: CatalogAssetCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.Admin", "Aimplify.Owner"),
) -> CatalogAssetResponse:
    from app.services.orchestrator import run_scoring_pipeline

    slug = _slugify(body.title)
    family_prefix = body.family[:3].upper()
    catalog_code = f"{family_prefix}-{uuid.uuid4().hex[:6].upper()}"

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
        thumbnail_url=body.thumbnail_url,
        repo_url=body.repo_url,
        status=AssetStatus.AI_Review,
        owner_id=user.id,
    )
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
    background_tasks.add_task(run_scoring_pipeline, str(asset.id), submission_data, "catalog_asset")
    return _to_response(asset)


@router.patch("/catalog/{asset_id}", response_model=CatalogAssetResponse)
async def update_catalog_asset(
    asset_id: str,
    body: CatalogAssetUpdate,
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

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)

    asset.updated_at = datetime.now(tz=timezone.utc)

    db.add(ActivityLog(
        actor_id=user.id,
        action="catalog_asset_updated",
        entity_type="catalog_asset",
        entity_id=asset.id,
    ))
    return _to_response(asset)


@router.delete("/catalog/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_catalog_asset(
    asset_id: str,
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
    return Response(status_code=status.HTTP_204_NO_CONTENT)
