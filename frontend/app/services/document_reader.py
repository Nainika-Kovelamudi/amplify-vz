"""
document_reader.py — fetch and extract text from uploaded artifact documents.

Supported formats: PDF (.pdf), Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx),
plain text (.txt / .md / .rst). Images (.png/.jpg/.svg) are acknowledged
but not text-extracted (no OCR).

architecture_file_url may be a JSON object with four named slots:
  { overall_architecture, sales_pitch, marketing_collateral, technical_delivery }
Each value is a blob URL.  extract_document_text() handles both the new JSON
format and the legacy single-URL format transparently.

Returns up to MAX_CHARS_TOTAL characters total for AI evaluation.
"""
from __future__ import annotations

import io
import json
import logging
import posixpath
import re
import zipfile
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

import httpx

logger = logging.getLogger(__name__)

MAX_CHARS_PER_DOC = 2000   # per-document cap to give each slot fair weight
MAX_CHARS_TOTAL   = 6000   # overall cap across all docs

_SLOT_LABELS: dict[str, str] = {
    "overall_architecture": "Overall Architecture",
    "sales_pitch":          "Sales Pitch Doc",
    "marketing_collateral": "Marketing Collateral",
    "technical_delivery":   "Technical Delivery Doc",
}

_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"}


async def extract_document_text(url: str) -> tuple[str, str]:
    """
    Download a document (or multiple) and return (extracted_text, file_type).

    If *url* is a JSON string with named doc slots, each URL is fetched and the
    extracted text is concatenated with section headers.  For legacy single-URL
    submissions the original behaviour is preserved.
    """
    if not url:
        return "", "none"

    # ── Multi-doc JSON format ──────────────────────────────────────────────────
    try:
        parsed = json.loads(url)
        if isinstance(parsed, dict) and not isinstance(parsed, list):
            return await _extract_multi_doc(parsed)
    except (json.JSONDecodeError, ValueError):
        pass

    # ── Legacy single-URL format ───────────────────────────────────────────────
    return await _fetch_and_extract(url, cap=MAX_CHARS_TOTAL)


async def _extract_multi_doc(slots: dict[str, str]) -> tuple[str, str]:
    """Extract text from all named document slots and concatenate with headers."""
    sections: list[str] = []
    types_seen: list[str] = []

    for key, label in _SLOT_LABELS.items():
        doc_url = slots.get(key, "")
        if not doc_url:
            sections.append(f"=== {label} ===\n[Not uploaded]")
            continue

        text, file_type = await _fetch_and_extract(doc_url, cap=MAX_CHARS_PER_DOC)
        types_seen.append(file_type)

        if text:
            sections.append(f"=== {label} ===\n{text}")
        else:
            sections.append(f"=== {label} ===\n[Could not extract text — file type: {file_type}]")

    combined = "\n\n".join(sections)
    if len(combined) > MAX_CHARS_TOTAL:
        combined = combined[:MAX_CHARS_TOTAL] + "\n\n[... truncated ...]"

    summary_type = "multi_doc:" + ",".join(t for t in types_seen if t not in ("none", "download_failed"))
    return combined, summary_type or "multi_doc"


async def _fetch_and_extract(url: str, cap: int) -> tuple[str, str]:
    """Download a single URL and extract its text, up to *cap* characters."""
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = resp.content
            content_type = resp.headers.get("content-type", "")
    except Exception as exc:
        logger.warning("document_reader: failed to download %s — %s", url, exc)
        return "", "download_failed"

    path_suffix = PurePosixPath(unquote(urlsplit(url).path)).suffix.lower()
    content_type = content_type.lower()

    # ── PDF ───────────────────────────────────────────────────────────────────
    if path_suffix == ".pdf" or "pdf" in content_type:
        return _read_pdf(raw, cap), "pdf"

    # ── Word (.docx / .doc) ───────────────────────────────────────────────────
    if path_suffix in (".docx", ".doc") or "wordprocessingml" in content_type or "msword" in content_type:
        return _read_docx(raw, cap), "docx"

    # ── Excel (.xlsx / .xls) ─────────────────────────────────────────────────
    if path_suffix in (".xlsx", ".xls") or "spreadsheetml" in content_type or "ms-excel" in content_type:
        return _read_xlsx(raw, cap), "xlsx"

    # ── PowerPoint (.pptx): slide text, grouped shapes and table cells ─────────
    if path_suffix == ".pptx" or "presentationml.presentation" in content_type:
        return _read_pptx(raw, cap), "pptx"

    # ── Plain text / Markdown ─────────────────────────────────────────────────
    if path_suffix in (".txt", ".md", ".rst", ".csv") or content_type.startswith("text/"):
        return _read_text(raw, cap), "text"

    # ── Images — acknowledge but cannot extract text ──────────────────────────
    if path_suffix in _IMAGE_EXTS or content_type.startswith("image/"):
        return (
            "[Image file uploaded — text extraction not supported. "
            "The AI will evaluate this submission based on the description and other fields.]",
            "image",
        )

    logger.info("document_reader: unsupported type suffix=%s content_type=%s", path_suffix, content_type)
    return "", "unsupported"


def _read_pdf(data: bytes, cap: int) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            parts.append(text)
            if sum(len(p) for p in parts) >= cap:
                break
        return _truncate("".join(parts), cap)
    except Exception as exc:
        logger.warning("document_reader: PDF extraction failed — %s", exc)
        return ""


def _read_docx(data: bytes, cap: int) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        parts = [para.text for para in doc.paragraphs if para.text.strip()]
        return _truncate("\n".join(parts), cap)
    except Exception as exc:
        logger.warning("document_reader: DOCX extraction failed — %s", exc)
        return ""


def _read_xlsx(data: bytes, cap: int) -> str:
    """Extract text from all sheets of an Excel workbook."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        parts: list[str] = []
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            parts.append(f"[Sheet: {sheet_name}]")
            for row in ws.iter_rows(values_only=True):
                cells = [str(c) for c in row if c is not None and str(c).strip()]
                if cells:
                    parts.append(" | ".join(cells))
                if sum(len(p) for p in parts) >= cap:
                    break
            if sum(len(p) for p in parts) >= cap:
                break
        wb.close()
        return _truncate("\n".join(parts), cap)
    except Exception as exc:
        logger.warning("document_reader: XLSX extraction failed — %s", exc)
        return ""


def _read_text(data: bytes, cap: int) -> str:
    try:
        return _truncate(data.decode("utf-8", errors="replace"), cap)
    except Exception:
        return ""


def _read_pptx(data: bytes, cap: int) -> str:
    """Read bounded OOXML slide text without running Office or adding dependencies.

    Presentation relationships determine slide order, including reordered decks.
    Images, speaker notes, masters and embedded files are not treated as slide text.
    """
    drawing = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
    presentation = '{http://schemas.openxmlformats.org/presentationml/2006/main}'
    relationship = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            if len(archive.infolist()) > 10000:raise ValueError('Too many presentation members')
            total_xml = 0

            def xml(name):
                nonlocal total_xml
                info = archive.getinfo(name)
                total_xml += info.file_size
                if info.file_size > 2 * 1024 * 1024 or total_xml > 8 * 1024 * 1024:
                    raise ValueError('Presentation XML exceeds extraction limits')
                content = archive.read(info)
                if b'<!DOCTYPE' in content.upper() or b'<!ENTITY' in content.upper():
                    raise ValueError('Presentation XML contains unsupported declarations')
                return ElementTree.fromstring(content)

            names = set(archive.namelist())
            if {'ppt/presentation.xml','ppt/_rels/presentation.xml.rels'} <= names:
                relations = {}
                for rel in xml('ppt/_rels/presentation.xml.rels'):
                    if rel.get('TargetMode') == 'External' or not (rel.get('Type') or '').endswith('/slide'):continue
                    target = rel.get('Target','')
                    target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join('ppt',target))
                    if target.startswith('ppt/slides/') and target.endswith('.xml') and target in names:
                        relations[rel.get('Id')] = target
                slides = [relations[node.get(relationship+'id')] for node in xml('ppt/presentation.xml').iter(presentation+'sldId')
                          if node.get(relationship+'id') in relations]
            else:
                slides = sorted((name for name in names if re.fullmatch(r'ppt/slides/slide\d+\.xml',name)),
                                key=lambda name:int(re.search(r'slide(\d+)',name).group(1)))

            parts = []; length = 0
            for number, name in enumerate(slides[:200],1):
                paragraphs = []
                for paragraph in xml(name).iter(drawing+'p'):
                    text = ''.join((node.text or '') if node.tag == drawing+'t' else '\n' if node.tag == drawing+'br' else ''
                                   for node in paragraph.iter()).strip()
                    if text:paragraphs.append(text)
                    if sum(len(value) for value in paragraphs) >= cap:break
                if paragraphs:
                    section = f'[Slide {number}]\n'+'\n'.join(paragraphs)
                    parts.append(section);length += len(section)
                    if length >= cap:break
            return _truncate('\n\n'.join(parts),cap)
    except Exception as exc:
        logger.warning('document_reader: PPTX extraction failed — %s',exc)
        return ''


def _truncate(text: str, cap: int) -> str:
    text = text.strip()
    if len(text) > cap:
        return text[:cap] + "\n\n[... document truncated ...]"
    return text
