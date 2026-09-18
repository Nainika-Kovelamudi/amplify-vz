from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def get_notification_dl() -> str | None:
    """
    Common Admin/Owner notification DL.
    """

    dl = os.getenv("APPROVAL_NOTIFICATION_DL")

    if not dl:
        logger.warning(
            "APPROVAL_NOTIFICATION_DL is not configured"
        )
        return None

    return dl.strip()


def get_requestor_and_dl(
    requestor_email: str | None,
) -> list[str]:
    """
    Requestor + common Admin/Owner DL.
    """

    recipients: list[str] = []

    if requestor_email:
        recipients.append(requestor_email.strip())

    dl = get_notification_dl()

    if dl:
        recipients.append(dl)

    # Remove duplicates
    return list(
        dict.fromkeys(
            email
            for email in recipients
            if email
        )
    )


def get_requestor_only(
    requestor_email: str | None,
) -> list[str]:
    """
    Requestor only.
    """

    if not requestor_email:
        return []

    return [requestor_email.strip()]