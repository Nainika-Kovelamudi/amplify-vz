"""
url_validator.py — validate asset URLs (video, demo, repo) and extract metadata.

All functions are async and safe — they never raise; they return a result dict.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(15.0)


# ─────────────────────────────────────────────────────────────────────────────
# Video URL — uploaded files only (Azure Blob Storage)
# ─────────────────────────────────────────────────────────────────────────────

async def validate_video_url(url: str | None) -> dict[str, Any]:
    """Validate a directly-uploaded video file (Azure Blob Storage or hosted .mp4/.mov/etc.)."""
    if not url:
        return {"valid": False, "platform": "uploaded_video", "reason": "No video uploaded"}
    return await _validate_uploaded_video(url)


async def _validate_uploaded_video(url: str) -> dict[str, Any]:
    """Validate a directly-uploaded video file (Azure Blob or any hosted .mp4/.mov/etc.)."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = await client.head(url)
            ct = r.headers.get("content-type", "")
            size_raw = r.headers.get("content-length")
            size_bytes = int(size_raw) if size_raw else None

            if r.status_code >= 400:
                return {
                    "valid": False,
                    "platform": "uploaded_video",
                    "status_code": r.status_code,
                    "reason": f"Video not accessible — HTTP {r.status_code}. File may have been deleted or is not yet uploaded.",
                }

            # Verify it's actually a video by content-type
            is_video_content = ct.startswith("video/") or "octet-stream" in ct
            if not is_video_content:
                return {
                    "valid": False,
                    "platform": "uploaded_video",
                    "content_type": ct,
                    "reason": f"URL is accessible but does not appear to be a video file (content-type: {ct or 'not set'}).",
                }

            # Size sanity check — a real demo video should be at least 500 KB
            size_mb = round(size_bytes / (1024 * 1024), 2) if size_bytes else None
            if size_bytes is not None and size_bytes < 500 * 1024:
                return {
                    "valid": False,
                    "platform": "uploaded_video",
                    "content_type": ct,
                    "file_size_bytes": size_bytes,
                    "file_size_mb": size_mb,
                    "reason": f"Video file is suspiciously small ({size_mb} MB) — likely corrupt or a placeholder.",
                }

            return {
                "valid": True,
                "platform": "uploaded_video",
                "content_type": ct,
                "file_size_bytes": size_bytes,
                "file_size_mb": size_mb,
                "is_azure_blob": ".blob.core.windows.net" in url,
                "reason": f"Uploaded video is accessible ({size_mb or '?'} MB, {ct})",
            }
    except Exception as exc:
        return {"valid": False, "platform": "uploaded_video", "reason": str(exc)}


async def _head_check(url: str, platform: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = await client.head(url)
            ct = r.headers.get("content-type", "")
            size = r.headers.get("content-length")
            return {
                "valid": r.status_code < 400,
                "platform": platform,
                "status_code": r.status_code,
                "content_type": ct,
                "file_size_bytes": int(size) if size else None,
                "reason": "accessible" if r.status_code < 400 else f"HTTP {r.status_code}",
            }
    except Exception as exc:
        return {"valid": False, "platform": platform, "reason": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Demo URL
# ─────────────────────────────────────────────────────────────────────────────

async def validate_demo_url(url: str | None) -> dict[str, Any]:
    if not url:
        return {"valid": False, "reason": "No demo URL provided"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            r = await client.get(url)
            title = ""
            m = re.search(r"<title[^>]*>(.*?)</title>", r.text, re.IGNORECASE | re.DOTALL)
            if m:
                title = m.group(1).strip()
            return {
                "valid": r.status_code < 400,
                "status_code": r.status_code,
                "page_title": title[:200],
                "reason": "Demo URL is live" if r.status_code < 400 else f"HTTP {r.status_code}",
            }
    except Exception as exc:
        return {"valid": False, "reason": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Repo URL
# ─────────────────────────────────────────────────────────────────────────────

async def validate_repo_url(url: str | None) -> dict[str, Any]:
    if not url:
        return {"valid": False, "reason": "No repo URL provided"}

    # GitHub API enrichment (public repos — unauthenticated)
    gh_match = re.match(r"https?://github\.com/([^/]+/[^/?\s#]+)", url)
    if gh_match:
        return await _github_repo(gh_match.group(1).rstrip("/"))

    # GitLab API enrichment
    gl_match = re.match(r"https?://gitlab\.com/([^/]+(?:/[^/?\s#]+)+)", url)
    if gl_match:
        return await _gitlab_repo(gl_match.group(1).rstrip("/"))

    # Azure DevOps — just confirm the URL is reachable
    if "dev.azure.com" in url or "visualstudio.com" in url:
        result = await _head_check(url, "azure_devops")
        result["platform"] = "azure_devops"
        result["reason"] = result.get("reason", "") + " (Azure DevOps URL — metadata not available without auth)"
        return result

    # Bitbucket — HEAD check + detect it's a real code host
    if "bitbucket.org" in url:
        result = await _head_check(url, "bitbucket")
        result["platform"] = "bitbucket"
        return result

    # Generic fallback — HEAD check
    return await _head_check(url, "repo")


async def _github_repo(slug: str) -> dict[str, Any]:
    slug = slug.replace(".git", "")
    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            headers={"Accept": "application/vnd.github+json"},
        ) as client:
            r = await client.get(f"https://api.github.com/repos/{slug}")
            if r.status_code == 200:
                data = r.json()
                return {
                    "valid": True,
                    "platform": "github",
                    "repo_name": data.get("full_name", ""),
                    "description": data.get("description", ""),
                    "language": data.get("language", ""),
                    "stars": data.get("stargazers_count", 0),
                    "has_readme": True,
                    "is_private": data.get("private", False),
                    "topics": data.get("topics", []),
                    "reason": "GitHub repo accessible (public)",
                }
            if r.status_code == 404:
                # Could be private — still accessible to the owner; don't hard-fail
                return {
                    "valid": True,  # treat as valid — private repos legitimately return 404
                    "platform": "github",
                    "is_private": True,
                    "reason": "GitHub repo exists but is private (unauthenticated API returns 404 for private repos — this is expected)",
                }
            return {"valid": False, "platform": "github", "reason": f"GitHub API returned {r.status_code}"}
    except Exception as exc:
        return {"valid": False, "platform": "github", "reason": str(exc)}


async def _gitlab_repo(path: str) -> dict[str, Any]:
    """GitLab project metadata via unauthenticated API (public projects only)."""
    encoded = path.replace("/", "%2F")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            r = await client.get(f"https://gitlab.com/api/v4/projects/{encoded}")
            if r.status_code == 200:
                data = r.json()
                return {
                    "valid": True,
                    "platform": "gitlab",
                    "repo_name": data.get("path_with_namespace", path),
                    "description": data.get("description", ""),
                    "language": "",  # GitLab API doesn't return primary language in basic endpoint
                    "stars": data.get("star_count", 0),
                    "topics": data.get("topics", []),
                    "reason": "GitLab project accessible (public)",
                }
            if r.status_code in (404, 401):
                # Private project — treat same as private GitHub
                return {
                    "valid": True,
                    "platform": "gitlab",
                    "is_private": True,
                    "reason": "GitLab project exists but is private (unauthenticated API cannot access it — this is expected)",
                }
            return {"valid": False, "platform": "gitlab", "reason": f"GitLab API returned {r.status_code}"}
    except Exception as exc:
        return {"valid": False, "platform": "gitlab", "reason": str(exc)}
