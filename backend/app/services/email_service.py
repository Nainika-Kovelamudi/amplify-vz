from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)

# ── Brand constants ────────────────────────────────────────────────────────────
_BRAND_PRIMARY   = "#7C3AED"   # violet-600
_BRAND_SECONDARY = "#4C1D95"   # violet-900
_CURRENT_YEAR    = "2026"
_COMPANY         = "InfoVision"
_PLATFORM        = "Amplify"


# ── Shared layout ──────────────────────────────────────────────────────────────
def _wrap(
    accent_color: str,
    accent_label: str,
    body_html: str,
    cta_url: str = "",
    cta_label: str = "",
) -> str:
    """Wrap body content in the enterprise email shell."""
    cta_block = ""
    if cta_url and cta_label:
        cta_block = f"""
        <tr>
          <td style="padding:24px 40px 0;">
            <a href="{cta_url}"
               style="display:inline-block;background:{accent_color};color:#ffffff;
                      font-family:Arial,sans-serif;font-size:14px;font-weight:600;
                      text-decoration:none;padding:12px 28px;border-radius:6px;
                      letter-spacing:0.3px;">
              {cta_label} &rarr;
            </a>
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>{_PLATFORM} Notification</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px;width:100%;background:#ffffff;
                      border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header bar -->
          <tr>
            <td style="background:linear-gradient(135deg,{_BRAND_PRIMARY} 0%,{_BRAND_SECONDARY} 100%);
                       padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:22px;font-weight:700;
                                 letter-spacing:-0.5px;">{_PLATFORM}</span>
                    <span style="color:#c4b5fd;font-size:12px;font-weight:400;
                                 margin-left:8px;">by {_COMPANY}</span>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.15);color:#ffffff;
                                 font-size:11px;font-weight:600;padding:4px 12px;
                                 border-radius:20px;letter-spacing:0.5px;">
                      {accent_label}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent stripe -->
          <tr>
            <td style="background:{accent_color};height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 8px;color:#1f2937;font-size:15px;line-height:1.7;">
              {body_html}
            </td>
          </tr>

          <!-- CTA -->
          {cta_block}

          <!-- Divider -->
          <tr>
            <td style="padding:32px 40px 0;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#9ca3af;font-size:11px;line-height:1.6;">
                    This is an automated notification from <strong>{_PLATFORM}</strong> —
                    {_COMPANY}'s internal accelerator platform.<br />
                    Please do not reply to this email. For support, contact us at
                    <a href="mailto:IV.AIMPLIFY@infovision.com"
                       style="color:#7C3AED;text-decoration:none;">IV.AIMPLIFY@infovision.com</a>.
                  </td>
                  <td align="right" style="color:#d1d5db;font-size:11px;white-space:nowrap;
                                           vertical-align:top;padding-left:16px;">
                    &copy; {_CURRENT_YEAR} {_COMPANY}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>"""


def _meta_row(label: str, value: str) -> str:
    return f"""<tr>
      <td style="padding:6px 16px 6px 0;color:#6b7280;font-size:13px;
                 white-space:nowrap;vertical-align:top;">{label}</td>
      <td style="padding:6px 0;color:#111827;font-size:13px;
                 font-weight:600;">{value}</td>
    </tr>"""


def _meta_table(rows_html: str) -> str:
    return f"""<table cellpadding="0" cellspacing="0"
                      style="margin:20px 0;border-left:3px solid #e5e7eb;
                             padding-left:16px;">
      {rows_html}
    </table>"""


def _note_box(notes: str, color: str = "#f3f4f6", border: str = "#d1d5db",
              text_color: str = "#374151") -> str:
    if not notes:
        return ""
    return f"""<div style="margin:20px 0;padding:14px 18px;background:{color};
                           border-left:4px solid {border};border-radius:0 6px 6px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;
                text-transform:uppercase;letter-spacing:0.5px;color:{border};">
        Reviewer Notes
      </p>
      <p style="margin:0;font-size:14px;color:{text_color};line-height:1.6;">{notes}</p>
    </div>"""


# ── Transport layer ────────────────────────────────────────────────────────────
def _smtp_send_sync(to_email: str, subject: str, html_body: str) -> None:
    settings = get_settings()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_use_tls:
            server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from or settings.smtp_user, to_email, msg.as_string())
    logger.info("SMTP sent to %s OK", to_email)


async def _acs_send(to_email: str, subject: str, html_body: str) -> None:
    from azure.communication.email.aio import EmailClient
    settings = get_settings()
    async with EmailClient.from_connection_string(settings.email_connection_string) as client:
        poller = await client.begin_send({
            "senderAddress": settings.smtp_from or "DoNotReply@amplify.infovision.com",
            "recipients": {"to": [{"address": to_email}]},
            "content": {"subject": subject, "html": html_body},
        })
        await poller.result()


async def _send(to_email: str, subject: str, html_body: str) -> None:
    settings = get_settings()
    if settings.email_dev_override:
        logger.info("EMAIL_DEV_OVERRIDE — redirecting <%s> to <%s>", to_email, settings.email_dev_override)
        subject = f"[LOCAL DEV] {subject}"
        to_email = settings.email_dev_override
    try:
        if settings.smtp_user:
            await asyncio.to_thread(_smtp_send_sync, to_email, subject, html_body)
        elif settings.email_connection_string:
            await _acs_send(to_email, subject, html_body)
        else:
            logger.warning("No email provider configured — skipping email to %s", to_email)
    except Exception as exc:
        logger.error("Email send failed to %s: %s", to_email, exc, exc_info=True)
        raise


# ── Notification emails ────────────────────────────────────────────────────────

async def send_welcome_email(to: str, display_name: str) -> None:
    body = f"""<p style="margin:0 0 16px;">Hi <strong>{display_name}</strong>,</p>
    <p style="margin:0 0 16px;">
      Welcome to <strong>{_PLATFORM}</strong> — {_COMPANY}'s internal platform for discovering,
      sharing, and cloning reusable accelerators and solutions.
    </p>
    <p style="margin:0;">
      Explore the catalog, submit your own assets, and collaborate with your teams — all in one place.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Welcome to {_PLATFORM} — {_COMPANY}",
        _wrap("#7C3AED", "WELCOME", body, cta_url="/catalog", cta_label="Explore the Catalog"),
    )


async def send_pending_review_email(to: str, asset_title: str, score: float, pipeline_url: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your submission has passed the AI evaluation stage and has been forwarded to an admin for approval.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("AI Score", f"{score:.1f} / 100") +
        _meta_row("Next step", "Admin review &amp; approval")
    )}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      You will receive another notification once an admin has completed their review.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Submission in review — '{asset_title}'",
        _wrap("#8B5CF6", "IN REVIEW", body, cta_url=pipeline_url, cta_label="Track Submission"),
    )


async def send_needs_changes_email(
    to: str, asset_title: str, score: float, summary: str, frontend_url: str
) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your submission was evaluated by the AI review pipeline and did not meet the minimum quality
      threshold required for admin review.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("AI Score", f"{score:.1f} / 100") +
        _meta_row("Minimum required", "60 / 100")
    )}
    <div style="margin:20px 0;padding:14px 18px;background:#fef3c7;
                border-left:4px solid #f59e0b;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;
                text-transform:uppercase;letter-spacing:0.5px;color:#b45309;">
        AI Feedback
      </p>
      <p style="margin:0;font-size:14px;color:#78350f;line-height:1.6;">{summary}</p>
    </div>
    <p style="margin:0;color:#6b7280;font-size:13px;">
      Please improve your submission — add a detailed description, tech stack, demo readiness,
      and architecture documentation — then resubmit.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Action required — '{asset_title}' needs improvements",
        _wrap(
            "#F59E0B", "ACTION REQUIRED", body,
            cta_url=f"{frontend_url}/pipeline", cta_label="View Feedback &amp; Resubmit",
        ),
    )


async def send_admin_review_notification(
    admin_email: str, asset_title: str, submitter_name: str, score: float, queue_url: str
) -> None:
    body = f"""<p style="margin:0 0 16px;">
      A new submission is waiting for your review in the Amplify approval queue.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Submitted by", submitter_name) +
        _meta_row("AI Score", f"{score:.1f} / 100")
    )}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      Review the submission details, artifacts, and AI evaluation before making your decision.
    </p>"""
    await _send(
        admin_email,
        f"[{_PLATFORM}] New submission awaiting approval — '{asset_title}'",
        _wrap("#F59E0B", "PENDING REVIEW", body, cta_url=queue_url, cta_label="Open Approval Queue"),
    )


async def send_rejection_email(to: str, asset_title: str, notes: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your submission has been reviewed and requires changes before it can progress in the approval pipeline.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Status", "Needs Changes") +
        _meta_row("Next step", "Update &amp; resubmit")
    )}
    {_note_box(notes, "#fff7ed", "#f97316", "#7c2d12")}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      Please address the reviewer's notes, update your submission, and resubmit for review.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Changes requested — '{asset_title}'",
        _wrap("#EF4444", "NEEDS CHANGES", body, cta_url="/pipeline", cta_label="Update Submission"),
    )


async def send_on_hold_email(to: str, asset_title: str, notes: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your submission has been temporarily placed on hold by a reviewer and is paused in the
      approval pipeline.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Status", "On Hold") +
        _meta_row("Action required", "None — we will notify you when review resumes")
    )}
    {_note_box(notes, "#fffbeb", "#f59e0b", "#78350f")}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      No action is needed from you at this time. You will receive a follow-up notification
      when the reviewer resumes the decision.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Submission on hold — '{asset_title}'",
        _wrap("#F59E0B", "ON HOLD", body, cta_url="/pipeline", cta_label="View Submission"),
    )


async def send_final_rejection_email(to: str, asset_title: str, notes: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      After careful review, your submission has not been accepted into the Amplify catalog.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Status", "Rejected") +
        _meta_row("Decision by", "Amplify Review Team")
    )}
    {_note_box(notes, "#fef2f2", "#ef4444", "#7f1d1d")}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      If you believe this decision was made in error or would like further clarification,
      please reach out to your department administrator. You are welcome to submit a revised
      asset in the future.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Submission not accepted — '{asset_title}'",
        _wrap("#DC2626", "REJECTED", body),
    )


async def send_approval_email(to: str, asset_title: str, catalog_url: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Congratulations! Your submission has been approved and is now live in the Amplify catalog.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Status", "Published") +
        _meta_row("Visibility", "Available to all Amplify users")
    )}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      Thank you for contributing to the InfoVision Amplify ecosystem. Your asset is now
      discoverable by teams across the organisation.
    </p>"""
    await _send(
        to,
        f"[{_PLATFORM}] Your asset is live — '{asset_title}'",
        _wrap("#10B981", "PUBLISHED", body, cta_url=catalog_url, cta_label="View in Catalog"),
    )


async def send_clone_request_email(
    owner_email: str, requester_name: str, asset_title: str,
    reason: str, approve_url: str, deny_url: str,
) -> None:
    body = f"""<p style="margin:0 0 16px;">
      A team member has requested clone access to one of your assets.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Requested by", requester_name) +
        _meta_row("Reason", reason or "—")
    )}
    <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">
      Use the buttons below to approve or deny this request. The requester will be notified
      automatically.
    </p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:12px;">
          <a href="{approve_url}"
             style="display:inline-block;background:#10b981;color:#ffffff;
                    font-family:Arial,sans-serif;font-size:14px;font-weight:600;
                    text-decoration:none;padding:11px 24px;border-radius:6px;">
            &#10003;&nbsp; Approve
          </a>
        </td>
        <td>
          <a href="{deny_url}"
             style="display:inline-block;background:#ef4444;color:#ffffff;
                    font-family:Arial,sans-serif;font-size:14px;font-weight:600;
                    text-decoration:none;padding:11px 24px;border-radius:6px;">
            &#10007;&nbsp; Deny
          </a>
        </td>
      </tr>
    </table>"""
    await _send(
        owner_email,
        f"[{_PLATFORM}] Clone access requested — '{asset_title}'",
        _wrap("#0EA5E9", "CLONE REQUEST", body),
    )


async def send_clone_approved_email(
    requester_email: str, asset_title: str, download_url: str, expires_at: str,
) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your clone request has been approved. Use the link below to download the asset.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Link expires", expires_at) +
        _meta_row("Usage", "Single-use download link")
    )}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      This link is single-use and will expire at the time shown above. Do not share it.
    </p>"""
    await _send(
        requester_email,
        f"[{_PLATFORM}] Clone request approved — '{asset_title}'",
        _wrap("#10B981", "APPROVED", body, cta_url=download_url, cta_label="Download Asset"),
    )


async def send_clone_denied_email(requester_email: str, asset_title: str) -> None:
    body = f"""<p style="margin:0 0 16px;">
      Your clone request for the asset below has been reviewed and denied by the asset owner.
    </p>
    {_meta_table(
        _meta_row("Asset", asset_title) +
        _meta_row("Decision", "Denied by asset owner")
    )}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      If you believe this is an error, please reach out directly to the asset owner or your
      department administrator.
    </p>"""
    await _send(
        requester_email,
        f"[{_PLATFORM}] Clone request denied — '{asset_title}'",
        _wrap("#6B7280", "REQUEST DENIED", body),
    )
