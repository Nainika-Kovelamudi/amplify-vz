from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.db.models import ActivityLog, Submission, SubmissionComment, UserProfile, UserRole
from app.deps.rbac import require_role
from app.schemas.comment import CommentCreate, CommentResponse
from app.services.notification_service import push_notification

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Comments"])


def _can_access(submission: Submission, user: UserProfile) -> bool:
    """Submitter, Admin, or Platform Owner can read/write comments."""
    role = user.role.value if hasattr(user.role, "value") else user.role
    if role in ("Aimplify.Admin", "Aimplify.Owner"):
        return True
    return str(submission.submitter_id) == str(user.id)


def _to_response(comment: SubmissionComment, author: UserProfile) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        submission_id=comment.submission_id,
        author_id=comment.author_id,
        author_name=author.display_name or author.email,
        author_email=author.email,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.get("/submissions/{submission_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> list[CommentResponse]:
    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if not _can_access(sub, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    rows = (await db.execute(
        select(SubmissionComment, UserProfile)
        .join(UserProfile, UserProfile.id == SubmissionComment.author_id)
        .where(SubmissionComment.submission_id == sub.id)
        .order_by(SubmissionComment.created_at.asc())
    )).all()
    return [_to_response(c, author) for c, author in rows]


@router.post("/submissions/{submission_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def add_comment(
    submission_id: str,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> CommentResponse:
    sub_result = await db.execute(select(Submission).where(Submission.id == submission_id))
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if not _can_access(sub, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    comment = SubmissionComment(
        submission_id=sub.id,
        author_id=user.id,
        body=body.body,
    )
    db.add(comment)
    db.add(ActivityLog(
        actor_id=user.id,
        action="submission_comment_added",
        entity_type="submission",
        entity_id=sub.id,
    ))
    await db.flush()
    await db.refresh(comment)

    # Notify the other party by email
    await _notify_comment(db, sub, comment, user)

    return _to_response(comment, user)


async def _notify_comment(db: AsyncSession, sub: Submission, comment: SubmissionComment, author: UserProfile) -> None:
    """Notify every submission participant except the comment author."""
    try:
        from app.services.email_service import _send, _wrap, _meta_table, _meta_row, _PLATFORM  # type: ignore[attr-defined]
        from app.config import get_settings
        settings = get_settings()

        # The conversation audience is the submitter plus every Admin and Owner.
        # Deduplicate users and never send a notification back to the author.
        recipients: dict[str, UserProfile] = {}
        submitter_result = await db.execute(select(UserProfile).where(UserProfile.id == sub.submitter_id))
        submitter = submitter_result.scalars().first()
        if submitter:
            recipients[str(submitter.id)] = submitter

        reviewers_result = await db.execute(
            select(UserProfile).where(UserProfile.role.in_([UserRole.admin, UserRole.owner]))
        )
        for reviewer in reviewers_result.scalars().all():
            recipients[str(reviewer.id)] = reviewer
        recipients.pop(str(author.id), None)

        notification_title = f'New comment on "{sub.title}"'
        notification_body = f'{author.display_name or author.email}: {comment.body}'
        for recipient in recipients.values():
            await push_notification(
                db,
                str(recipient.id),
                notification_title,
                notification_body,
                "submission_comment_added",
                str(sub.id),
            )

        detail_url = f"{settings.frontend_url}/pipeline/{sub.id}"
        body_html = f"""<p style="margin:0 0 16px;">
          <strong>{author.display_name or author.email}</strong> left a comment on submission
          <strong>"{sub.title}"</strong>.
        </p>
        {_meta_table(_meta_row("Comment", comment.body))}
        <p style="margin:16px 0 0;">
          <a href="{detail_url}"
             style="display:inline-block;background:#0EA5E9;color:#ffffff;
                    font-family:Arial,sans-serif;font-size:14px;font-weight:600;
                    text-decoration:none;padding:11px 24px;border-radius:6px;">
            View Submission
          </a>
        </p>"""

        for recipient in recipients.values():
            try:
                await _send(
                    recipient.email,
                    f"[{_PLATFORM}] New comment on '{sub.title}'",
                    _wrap("#0EA5E9", "SUBMISSION COMMENT", body_html),
                )
            except Exception as exc:
                logger.warning("Failed to send comment notification to %s: %s", recipient.email, exc)
    except Exception as exc:
        logger.warning("Comment notification skipped: %s", exc)
