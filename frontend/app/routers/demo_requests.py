from __future__ import annotations

import logging
import os
from html import escape
import uuid as _uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, AssetStatus, CatalogAsset, DemoRequest, DemoRequestBatch, PlatformFeedback, UserProfile, UserRole
from app.deps.rbac import get_current_user, require_role
from app.schemas.demo_request import DemoRequestCreate, DemoRequestDecision, DemoRequestResponse, MultiDemoRequestCreate, PlatformFeedbackCreate
from app.services.notification_service import push_notification, push_notifications_to_roles

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Demo Requests"])


def _owns_asset(asset, user) -> bool:
    return bool(asset and (str(asset.owner_id) == str(user.id) or
        (user.email and (asset.owner_email or '').strip().casefold() == user.email.strip().casefold())))


async def _asset_owner_profile(db, asset):
    # The nominated owner may differ from the original submitter (owner_id).
    if asset.owner_email:
        owner = (await db.execute(select(UserProfile).where(
            func.lower(func.trim(UserProfile.email)) == asset.owner_email.strip().lower()))).scalars().first()
        if owner:
            return owner
    if asset.owner_id:
        return (await db.execute(select(UserProfile).where(UserProfile.id == asset.owner_id))).scalars().first()
    return None


async def _platform_owner_emails(db) -> list[str]:
    distribution_list = os.environ.get("NOTIFICATION_DL_OWNERS", "").strip()
    if distribution_list:
        return [email.strip() for email in distribution_list.replace(';', ',').split(',') if email.strip()]
    return list((await db.execute(select(UserProfile.email).where(UserProfile.role == UserRole.owner))).scalars().all())


def _demo_email_recipients(requester_email, asset_owner_email, platform_owner_emails):
    return list(dict.fromkeys(email.strip().lower() for email in
        [requester_email, asset_owner_email, *(platform_owner_emails or [])] if email and email.strip()))


def _to_response(dr: DemoRequest) -> DemoRequestResponse:
    asset = dr.asset if hasattr(dr, "asset") and dr.asset else None
    requester = dr.requester if hasattr(dr, "requester") and dr.requester else None
    return DemoRequestResponse(
        id=dr.id, batch_id=dr.batch_id,
        asset_id=dr.asset_id, request_type=dr.request_type,
        asset_title=asset.title if asset else ("AImplify Platform Demo" if dr.request_type == "platform" else None),
        asset_slug=asset.slug if asset else None,
        requester_name=requester.display_name if requester else None,
        requester_email=requester.email if requester else None,
        customer_name=dr.customer_name,
        project_name=dr.project_name,
        vertical=dr.vertical,
        additional_details=dr.additional_details,
        status=dr.status,
        decision_notes=dr.decision_notes,
        reviewed_by=dr.reviewed_by,
        reviewed_at=dr.reviewed_at,
        requested_at=dr.requested_at,
    )


@router.post("/demo-requests", response_model=DemoRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_request(
    body: DemoRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> DemoRequestResponse:
    from app.config import get_settings

    asset_result = await db.execute(select(CatalogAsset).where(CatalogAsset.id == body.asset_id))
    asset = asset_result.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")
    if asset.status != AssetStatus.Published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset is not published.")

    dr = DemoRequest(
        id=_uuid.uuid4(),
        asset_id=body.asset_id,
        requester_id=user.id,
        customer_name=body.customer_name.strip(),
        project_name=body.project_name.strip(),
        vertical=body.vertical.strip() if body.vertical else None,
        additional_details=body.additional_details.strip() if body.additional_details else None,
        status="Pending",
        requested_at=datetime.now(timezone.utc),
    )
    db.add(dr)

    # Increment demo_request_count on the asset
    if hasattr(asset, "demo_request_count"):
        asset.demo_request_count = (asset.demo_request_count or 0) + 1

    await db.commit()
    await db.refresh(dr)

    await push_notifications_to_roles(
        db,
        [UserRole.admin, UserRole.owner],
        "New Demo Request",
        f'"{asset.title}" was requested for {dr.customer_name} / {dr.project_name}.',
        "demo_request_created",
        str(dr.id),
        exclude_user_id=str(user.id),
    )
    # A standard user who owns this asset is also part of its review audience.
    asset_owner = None
    if asset.owner_id or asset.owner_email:
        asset_owner = await _asset_owner_profile(db, asset)
        owner_role = asset_owner.role.value if asset_owner and hasattr(asset_owner.role, "value") else (asset_owner.role if asset_owner else None)
        if asset_owner and asset_owner.id != user.id and owner_role not in ("Aimplify.Admin", "Aimplify.Owner"):
            await push_notification(
                db,
                str(asset_owner.id),
                "New Demo Request",
                f'"{asset.title}" was requested for {dr.customer_name} / {dr.project_name}.',
                "demo_request_created",
                str(dr.id),
            )
    await db.commit()

    # Send notification email in background
    background_tasks.add_task(
        _notify_demo_request,
        asset_title=asset.title,
        asset_slug=asset.slug,
        requester_name=user.display_name or user.email,
        requester_email=user.email,
        customer_name=body.customer_name,
        project_name=body.project_name,
        asset_owner_email=asset.owner_email or (asset_owner.email if asset_owner else None),
        platform_owner_emails=await _platform_owner_emails(db),
    )

    return DemoRequestResponse(
        id=dr.id, batch_id=dr.batch_id,
        asset_id=dr.asset_id, request_type=dr.request_type,
        asset_title=asset.title,
        asset_slug=asset.slug,
        requester_name=user.display_name,
        requester_email=user.email,
        customer_name=dr.customer_name,
        project_name=dr.project_name,
        vertical=dr.vertical,
        additional_details=dr.additional_details,
        status=dr.status,
        decision_notes=dr.decision_notes,
        reviewed_by=dr.reviewed_by,
        reviewed_at=dr.reviewed_at,
        requested_at=dr.requested_at,
    )


async def _dispatch_multiple_demo_notifications(request_id, requester, customer_name, project_name, targets):
    """Use a separate session: notification failures cannot invalidate a saved request."""
    from app.db.base import get_session_factory
    from types import SimpleNamespace
    try:
        async with get_session_factory()() as db:
            platform_emails = []
            try:
                platform_emails = await _platform_owner_emails(db)
            except Exception:
                await db.rollback()
                logger.exception("[MULTI_DEMO_NOTIFY] request_id=%s platform recipient lookup failed", request_id)
            for target in targets:
                owner = None
                owner_email = None
                try:
                    platform = target['request_type'] == 'platform'
                    if not platform and (target['owner_id'] or target['owner_email']):
                        owner = await _asset_owner_profile(db, SimpleNamespace(**target))
                        owner_email = owner.email if owner else None
                    await push_notifications_to_roles(db, [UserRole.owner] if platform else [UserRole.admin, UserRole.owner],
                        "AImplify Platform Demo Request" if platform else "New Demo Request",
                        f'"{target["title"]}" was requested for {customer_name} / {project_name}.',
                        "demo_request_created", target['request_id'],
                        exclude_user_id=None if platform else requester['id'])
                    if owner and str(owner.id) != requester['id'] and owner.role not in (UserRole.admin, UserRole.owner):
                        await push_notification(db, str(owner.id), "New Demo Request",
                            f'"{target["title"]}" was requested for {customer_name} / {project_name}.',
                            "demo_request_created", target['request_id'])
                    await db.commit()
                except Exception:
                    await db.rollback()
                    logger.exception("[MULTI_DEMO_NOTIFY] request_id=%s demo_request_id=%s bell notification failed",
                                     request_id, target['request_id'])
                try:
                    await _notify_demo_request(asset_title=target['title'], asset_slug=target['slug'],
                        requester_name=requester['name'], requester_email=requester['email'],
                        customer_name=customer_name, project_name=project_name,
                        asset_owner_email=target['owner_email'] or owner_email,
                        platform_owner_emails=platform_emails)
                except Exception:
                    logger.exception("[MULTI_DEMO_NOTIFY] request_id=%s demo_request_id=%s email failed",
                                     request_id, target['request_id'])
    except Exception:
        logger.exception("[MULTI_DEMO_NOTIFY] request_id=%s notification dispatch failed; saved requests are retained", request_id)


@router.post("/demo-requests/multiple", status_code=201)
async def create_multiple_demo_requests(
    body: MultiDemoRequestCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
):
    from sqlalchemy.exc import SQLAlchemyError
    request_id = _uuid.uuid4()
    asset_ids = list(dict.fromkeys(body.asset_ids))
    logger.info("[MULTI_DEMO_CREATE] request_id=%s asset_count=%s platform_demo=%s", request_id, len(asset_ids), body.platform_demo)
    targets = []
    try:
        # Lock selected assets in a stable order so simultaneous requests do not lose counters.
        assets = (await db.execute(select(CatalogAsset).where(CatalogAsset.id.in_(asset_ids))
                                  .order_by(CatalogAsset.id).with_for_update())).scalars().all()
        if len(assets) != len(asset_ids) or any(asset.status != AssetStatus.Published for asset in assets):
            raise HTTPException(status_code=400, detail="Select available published assets only.")
        db.add(DemoRequestBatch(id=request_id, requester_id=user.id, customer_name=body.customer_name,
                               project_name=body.project_name, vertical=body.vertical))
        await db.flush()
        if body.platform_demo:
            dr = DemoRequest(id=_uuid.uuid4(), batch_id=request_id, asset_id=None, request_type="platform",
                requester_id=user.id, customer_name=body.customer_name, project_name=body.project_name,
                vertical=body.vertical, status="Pending", requested_at=datetime.now(timezone.utc))
            db.add(dr)
            targets.append(dict(request_id=str(dr.id), request_type='platform', title='AImplify Platform Demo',
                                slug='', owner_id=None, owner_email=None))
        for asset in assets:
            dr = DemoRequest(id=_uuid.uuid4(), batch_id=request_id, asset_id=asset.id, request_type="asset", requester_id=user.id,
                customer_name=body.customer_name, project_name=body.project_name, vertical=body.vertical,
                status="Pending", requested_at=datetime.now(timezone.utc))
            db.add(dr)
            asset.demo_request_count = (asset.demo_request_count or 0) + 1
            targets.append(dict(request_id=str(dr.id), request_type='asset', title=asset.title, slug=asset.slug,
                                owner_id=asset.owner_id, owner_email=asset.owner_email))
        db.add(ActivityLog(actor_id=user.id, action="multi_demo_request_created", entity_type="demo_request",
            entity_id=request_id, log_metadata={"asset_ids":[str(a) for a in asset_ids],
                "demo_request_ids":[t['request_id'] for t in targets], "platform_demo":body.platform_demo,
                "customer_name":body.customer_name, "project_name":body.project_name}))
        requester = {'id':str(user.id), 'name':user.display_name or user.email, 'email':user.email}
        await db.commit()
    except SQLAlchemyError as exc:
        await db.rollback()
        logger.exception("[MULTI_DEMO_CREATE_FAILED] request_id=%s database write failed", request_id)
        code = getattr(getattr(exc, 'orig', None), 'sqlstate', None)
        detail = "Could not save the demo request. Contact the platform team with reference " + str(request_id) + "."
        if code in ('42P01','42703','23502','23514'):
            detail += " Check demo-request schema migrations 034 and 035 in the deployed database."
        raise HTTPException(status_code=503, detail=detail) from exc
    except HTTPException:
        raise
    except Exception as exc:
        await db.rollback()
        logger.exception("[MULTI_DEMO_CREATE_FAILED] request_id=%s unexpected creation error", request_id)
        raise HTTPException(status_code=500, detail="Demo request could not be completed. Reference " + str(request_id) + ".") from exc
    background_tasks.add_task(_dispatch_multiple_demo_notifications, str(request_id), requester,
                              body.customer_name, body.project_name, targets)
    logger.info("[MULTI_DEMO_CREATED] request_id=%s asset_count=%s platform_demo=%s", request_id, len(assets), body.platform_demo)
    return {"request_id":str(request_id), "asset_count":len(assets), "platform_demo":body.platform_demo}


@router.post("/platform-feedback", status_code=201)
async def submit_platform_feedback(
    body: PlatformFeedbackCreate,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
):
    asset = None
    if body.asset_id:
        asset = (await db.execute(select(CatalogAsset).where(CatalogAsset.id == body.asset_id))).scalars().first()
        if not asset or asset.status != AssetStatus.Published:
            raise HTTPException(status_code=400, detail="Select an available published asset for feedback.")
    target_title = (asset.title or "Untitled asset") if asset else None
    feedback_id = _uuid.uuid4()
    db.add(PlatformFeedback(id=feedback_id, submitter_id=user.id, name=user.display_name,
                            email=user.email, comment=body.comment, asset_id=body.asset_id, asset_title=target_title))
    db.add(ActivityLog(actor_id=user.id, action="platform_feedback_created", entity_type="platform_feedback",
        entity_id=feedback_id, log_metadata={"comment": body.comment, "name": user.display_name, "email": user.email,
            "asset_id": str(body.asset_id) if body.asset_id else None, "asset_title": target_title}))
    await push_notifications_to_roles(db, [UserRole.admin, UserRole.owner], "Platform Feedback",
        f'{target_title or "AImplify Platform"} — {user.display_name or user.email}: {body.comment[:300]}', "platform_feedback_created", str(feedback_id))
    await db.commit()
    return {"id": str(feedback_id)}


@router.get("/platform-feedback")
async def list_platform_feedback(
    db: AsyncSession = Depends(get_db),
    user: UserProfile = require_role(UserRole.admin, UserRole.owner),
):
    rows = (await db.execute(select(PlatformFeedback)
        .order_by(PlatformFeedback.created_at.desc()).limit(200))).scalars().all()
    return [{"id": str(row.id), "created_at": row.created_at, "name": row.name,
             "email": row.email, "comment": row.comment,
             "asset_id": getattr(row,"asset_id",None), "asset_title": getattr(row,"asset_title",None)} for row in rows]


@router.get("/demo-requests/my", response_model=list[DemoRequestResponse])
async def get_my_demo_requests(
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> list[DemoRequestResponse]:
    result = await db.execute(
        select(DemoRequest)
        .where(DemoRequest.requester_id == user.id)
        .order_by(DemoRequest.requested_at.desc())
    )
    rows = result.scalars().all()

    # Load related assets/requesters
    out: list[DemoRequestResponse] = []
    for dr in rows:
        asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == dr.asset_id))
        asset = asset_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id, batch_id=dr.batch_id,
            asset_id=dr.asset_id, request_type=dr.request_type,
            asset_title=asset.title if asset else ("AImplify Platform Demo" if dr.request_type == "platform" else None),
            asset_slug=asset.slug if asset else None,
            requester_name=user.display_name,
            requester_email=user.email,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            vertical=dr.vertical,
            additional_details=dr.additional_details,
            status=dr.status,
            decision_notes=dr.decision_notes,
            reviewed_by=dr.reviewed_by,
            reviewed_at=dr.reviewed_at,
            requested_at=dr.requested_at,
        ))
    return out


@router.get("/demo-requests/asset/{asset_id}", response_model=list[DemoRequestResponse])
async def get_demo_requests_for_asset(
    asset_id: _uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> list[DemoRequestResponse]:
    asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == asset_id))
    asset = asset_res.scalars().first()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found.")

    is_owner = _owns_asset(asset, user)
    is_admin_or_owner_role = user.role in (UserRole.admin, UserRole.owner)
    if not is_owner and not is_admin_or_owner_role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

    result = await db.execute(
        select(DemoRequest)
        .where(DemoRequest.asset_id == asset_id)
        .order_by(DemoRequest.requested_at.desc())
    )
    rows = result.scalars().all()

    out: list[DemoRequestResponse] = []
    for dr in rows:
        req_res = await db.execute(select(UserProfile).where(UserProfile.id == dr.requester_id))
        requester = req_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id, batch_id=dr.batch_id,
            asset_id=dr.asset_id, request_type=dr.request_type,
            asset_title=asset.title,
            asset_slug=asset.slug,
            requester_name=requester.display_name if requester else None,
            requester_email=requester.email if requester else None,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            vertical=dr.vertical,
            additional_details=dr.additional_details,
            status=dr.status,
            decision_notes=dr.decision_notes,
            reviewed_by=dr.reviewed_by,
            reviewed_at=dr.reviewed_at,
            requested_at=dr.requested_at,
        ))
    return out


@router.get("/demo-requests", response_model=list[DemoRequestResponse])
async def get_all_demo_requests(
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> list[DemoRequestResponse]:
    role = user.role.value if hasattr(user.role, "value") else user.role
    stmt = select(DemoRequest)
    if role != "Aimplify.Owner":
        stmt = stmt.where(DemoRequest.request_type != "platform")
    if role not in ("Aimplify.Admin", "Aimplify.Owner"):
        # Asset owners may review requests only for assets they own.
        stmt = stmt.join(CatalogAsset, CatalogAsset.id == DemoRequest.asset_id).where(
            or_(CatalogAsset.owner_id == user.id,
                func.lower(func.trim(CatalogAsset.owner_email)) == (user.email or '').strip().lower())
        )
    result = await db.execute(stmt.order_by(DemoRequest.requested_at.desc()))
    rows = result.scalars().all()

    out: list[DemoRequestResponse] = []
    for dr in rows:
        asset_res = await db.execute(select(CatalogAsset).where(CatalogAsset.id == dr.asset_id))
        asset = asset_res.scalars().first()
        req_res = await db.execute(select(UserProfile).where(UserProfile.id == dr.requester_id))
        requester = req_res.scalars().first()
        out.append(DemoRequestResponse(
            id=dr.id, batch_id=dr.batch_id,
            asset_id=dr.asset_id, request_type=dr.request_type,
            asset_title=asset.title if asset else ("AImplify Platform Demo" if dr.request_type == "platform" else None),
            asset_slug=asset.slug if asset else None,
            requester_name=requester.display_name if requester else None,
            requester_email=requester.email if requester else None,
            customer_name=dr.customer_name,
            project_name=dr.project_name,
            vertical=dr.vertical,
            additional_details=dr.additional_details,
            status=dr.status,
            decision_notes=dr.decision_notes,
            reviewed_by=dr.reviewed_by,
            reviewed_at=dr.reviewed_at,
            requested_at=dr.requested_at,
        ))
    return out


async def _decide_demo_request(
    request_id: _uuid.UUID,
    decision: str,
    body: DemoRequestDecision,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
    user: UserProfile,
) -> DemoRequestResponse:
    result = await db.execute(select(DemoRequest).where(DemoRequest.id == request_id))
    dr = result.scalars().first()
    if not dr:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demo request not found.")
    if dr.status != "Pending":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Demo request is already {dr.status.lower()}.")

    asset = (await db.execute(select(CatalogAsset).where(CatalogAsset.id == dr.asset_id))).scalars().first()
    requester = (await db.execute(select(UserProfile).where(UserProfile.id == dr.requester_id))).scalars().first()
    role = user.role.value if hasattr(user.role, "value") else user.role
    is_platform_reviewer = role in ("Aimplify.Admin", "Aimplify.Owner")
    is_asset_owner = _owns_asset(asset, user)
    if dr.request_type == "platform" and role != "Aimplify.Owner":
        raise HTTPException(status_code=403, detail="Only platform owners can decide a platform demo request.")
    if not is_platform_reviewer and not is_asset_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the asset owner, an Admin, or an Owner can decide this request.")
    dr.status = decision
    dr.decision_notes = body.notes.strip() if body.notes else None
    dr.reviewed_by = user.id
    dr.reviewed_at = datetime.now(timezone.utc)
    db.add(ActivityLog(
        actor_id=user.id,
        action=f"demo_request_{decision.lower()}",
        entity_type="demo_request",
        entity_id=dr.id,
        log_metadata={"notes": dr.decision_notes, "asset_id": str(dr.asset_id)},
    ))
    await db.commit()
    await db.refresh(dr)

    if requester:
        await push_notification(
            db,
            str(requester.id),
            f"Demo Request {decision}",
            f'Your demo request for "{asset.title if asset else "AImplify Platform Demo"}" was {decision.lower()}.',
            f"demo_request_{decision.lower()}",
            str(dr.id),
        )
        await db.commit()
        decision_owner = await _asset_owner_profile(db, asset) if asset else None
        background_tasks.add_task(
            _notify_demo_decision,
            requester.email,
            asset.title if asset else "AImplify Platform Demo",
            decision,
            dr.decision_notes,
            asset_owner_email=(asset.owner_email or (decision_owner.email if decision_owner else None)) if asset else None,
            platform_owner_emails=await _platform_owner_emails(db),
        )

    return DemoRequestResponse(
        id=dr.id, batch_id=dr.batch_id, asset_id=dr.asset_id, request_type=dr.request_type,
        asset_title=asset.title if asset else ("AImplify Platform Demo" if dr.request_type == "platform" else None),
        asset_slug=asset.slug if asset else None,
        requester_name=requester.display_name if requester else None,
        requester_email=requester.email if requester else None,
        customer_name=dr.customer_name, project_name=dr.project_name,
        vertical=dr.vertical, additional_details=dr.additional_details,
        status=dr.status, decision_notes=dr.decision_notes,
        reviewed_by=dr.reviewed_by, reviewed_at=dr.reviewed_at,
        requested_at=dr.requested_at,
    )


@router.patch("/demo-requests/{request_id}/approve", response_model=DemoRequestResponse)
async def approve_demo_request(
    request_id: _uuid.UUID,
    body: DemoRequestDecision,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> DemoRequestResponse:
    return await _decide_demo_request(request_id, "Approved", body, background_tasks, db, user)


@router.patch("/demo-requests/{request_id}/reject", response_model=DemoRequestResponse)
async def reject_demo_request(
    request_id: _uuid.UUID,
    body: DemoRequestDecision,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: UserProfile = Depends(get_current_user),
) -> DemoRequestResponse:
    return await _decide_demo_request(request_id, "Rejected", body, background_tasks, db, user)


async def _notify_demo_decision(
    requester_email: str,
    asset_title: str,
    decision: str,
    notes: str | None,
    asset_owner_email: str | None = None,
    platform_owner_emails: list[str] | None = None,
) -> None:
    from app.services.email_service import _send, _wrap

    color = "#059669" if decision == "Approved" else "#DC2626"
    notes_html = f"<p><strong>Decision notes:</strong> {escape(notes)}</p>" if notes else ""
    body_html = f"""
    <tr><td style="padding:32px 40px;font-family:Arial,sans-serif;color:#374151;line-height:1.6;">
      <h2 style="margin:0 0 16px;color:#111827;">Demo Request {decision}</h2>
      <p>The demo request for <strong>{escape(asset_title)}</strong> was <strong>{escape(decision.lower())}</strong>.</p>
      {notes_html}
    </td></tr>
    """
    for email in _demo_email_recipients(requester_email, asset_owner_email, platform_owner_emails):
        try:
            await _send(email, f"[Amplify] Demo Request {decision} — {asset_title}",
                        _wrap(color, "DEMO REQUEST", body_html))
        except Exception as exc:
            logger.warning("Failed to send demo decision notification to %s: %s", email, exc)


async def _notify_demo_request(
    asset_title: str,
    asset_slug: str,
    requester_name: str,
    requester_email: str,
    customer_name: str,
    project_name: str,
    asset_owner_email: str | None,
    platform_owner_emails: list[str] | None = None,
) -> None:
    from app.services.email_service import _send, _wrap
    from app.config import get_settings

    settings = get_settings()
    frontend = settings.frontend_url or "https://aimplify-dev.infovision.ai"
    asset_url = f"{frontend}/pipeline"

    body_html = f"""
    <tr><td style="padding:32px 40px 8px;">
      <h2 style="margin:0;font-family:Arial,sans-serif;font-size:20px;color:#1e1b4b;">
        New Customer Demo Request
      </h2>
    </td></tr>
    <tr><td style="padding:8px 40px 24px;font-family:Arial,sans-serif;font-size:14px;color:#374151;line-height:1.6;">
      <p><strong>{escape(requester_name)}</strong> ({escape(requester_email)}) has raised a customer demo request for
         <strong>{escape(asset_title)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:140px;">Customer</td>
            <td style="padding:6px 0;font-weight:600;">{escape(customer_name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Project / Opp</td>
            <td style="padding:6px 0;font-weight:600;">{escape(project_name)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Requested by</td>
            <td style="padding:6px 0;">{escape(requester_name)} &lt;{escape(requester_email)}&gt;</td></tr>
      </table>
    </td></tr>
    """

    html = _wrap(
        accent_color="#7C3AED",
        accent_label="Demo Request",
        body_html=body_html,
        cta_url=asset_url,
        cta_label="View Demo Requests",
    )

    recipients = _demo_email_recipients(requester_email, asset_owner_email, platform_owner_emails)

    subject = f"[Amplify] Customer Demo Request — {asset_title}"
    for email in recipients:
        try:
            await _send(email, subject, html)
        except Exception as exc:
            logger.warning("Failed to send demo request notification to %s: %s", email, exc)


