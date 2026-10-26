from __future__ import annotations

import io
import logging
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from azure.storage.blob.aio import BlobServiceClient
from sqlalchemy.ext.asyncio import AsyncSession

from starlette.requests import ClientDisconnect

from app.config import get_settings
from app.db.base import get_db
from app.deps.rbac import require_role
from app.services.blob_service import delete_blob, make_blob_name, make_direct_upload_urls, make_html_attachment_url, upload_blob, upload_blob_stream

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/media", tags=["Media"])

MAX_VIDEO_BYTES = 800 * 1024 * 1024   # 800 MB
MAX_IMAGE_BYTES = 25 * 1024 * 1024    # 25 MB
MAX_DOC_BYTES = 50 * 1024 * 1024      # 50 MB

ALLOWED_DOC_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.ms-powerpoint",                                               # .ppt
    "image/png",
    "image/jpeg",
    "image/svg+xml",
    "text/html",
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
    "text/x-javascript",
    "application/octet-stream",  # browsers/OS may send this for any binary file
}

ALLOWED_DOC_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
    ".png", ".jpg", ".jpeg", ".svg", ".html", ".htm", ".js",
}

# Local uploads dir as fallback when blob storage not configured
_LOCAL_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "docs")


def _validate_raw(content_type: str, filename: str, media_type: str) -> None:
    ext = os.path.splitext(filename)[1].lower()
    # Strip charset/boundary suffixes: "video/mp4; charset=..." → "video/mp4"
    mime = content_type.split(";")[0].strip()

    print(f"[MEDIA_VALIDATE] media_type={media_type!r} content_type={mime!r} filename={filename!r} ext={ext!r}", flush=True)
    if media_type == "video":
        allowed_video_types = {
            "video/mp4", "video/quicktime", "video/x-msvideo",
            "video/webm", "video/ogg", "video/mpeg", "video/x-matroska",
            "application/octet-stream",
        }
        allowed_video_exts = {".mp4", ".mov", ".avi", ".webm", ".mkv", ".mpeg", ".mpg", ".m4v"}
        if mime not in allowed_video_types and ext not in allowed_video_exts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported video type '{ext or mime}'. Allowed: mp4, mov, avi, webm, mkv.",
            )
    elif media_type in ("image", "thumbnail"):
        if not mime.startswith("image/"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File must be an image.")
    elif media_type == "document":
        if (ext in (".html", ".htm") and mime not in ("text/html", "application/octet-stream")) or (mime == "text/html" and ext not in (".html", ".htm")):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="HTML uploads must use an .html or .htm filename.")
        js_types = ("text/javascript", "application/javascript", "application/x-javascript", "text/x-javascript")
        if (ext == ".js" and mime not in (*js_types, "text/plain", "application/octet-stream")) or (mime in js_types and ext != ".js"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="JavaScript uploads must use a .js filename.")
        if mime not in ALLOWED_DOC_TYPES and ext not in ALLOWED_DOC_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type '{ext or mime}'. Allowed: PDF, DOCX, DOC, XLSX, XLS, PPTX, PPT, image, HTML, or JS.",
            )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown media_type '{media_type}'.")


def _save_local(blob_name: str, data: bytes, content_type: str) -> str:
    os.makedirs(_LOCAL_UPLOADS_DIR, exist_ok=True)
    safe = blob_name.replace("/", "_")
    dest = os.path.join(_LOCAL_UPLOADS_DIR, safe)
    with open(dest, "wb") as f:
        f.write(data)
    return f"/media/local/{safe}"


@router.post("/upload-url")
async def create_direct_upload_url(
    filename: str = Query(...),
    content_type: str = Query("application/octet-stream"),
    media_type: str = Query("video"),
    family: str = Query(""),
    entity_id: str = Query(""),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> dict:
    """Issue a short-lived per-file SAS URL so large media bypasses App Service."""
    from urllib.parse import unquote
    decoded_filename = os.path.basename(unquote(filename))
    _validate_raw(content_type, decoded_filename, media_type)
    safe_filename = f"{uuid.uuid4().hex}_{decoded_filename.replace(' ', '_')}"
    blob_name = make_blob_name(
        media_type=media_type,
        filename=safe_filename,
        family=family.strip() or None,
        entity_id=entity_id.strip() or None,
    )
    try:
        upload_url, read_url = make_direct_upload_urls(blob_name, expiry_minutes=120)
    except Exception as exc:
        logger.error("Could not create direct upload URL: %s", exc)
        raise HTTPException(status_code=503, detail="Direct upload is not configured.")
    return {"upload_url": upload_url, "url": read_url, "blob_path": blob_name}


@router.post("/upload")
async def upload_media(
    request: Request,
    media_type: str = Query("image"),
    family: str = Query(""),
    entity_id: str = Query(""),
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> dict:
    """
    Upload a file to Azure Blob Storage (container: artifacts).

    Accepts raw binary body — no multipart/form-data parsing.
    Metadata is passed via query params; filename via X-Filename header.

    Blob path:
      {family_slug}/{entity_id}/{media_type}/{uuid}_{filename}   — asset upload
      {family_slug}/drafts/{media_type}/{uuid}_{filename}        — pre-submission (no asset id yet)
      drafts/{media_type}/{uuid}_{filename}                      — fallback (no family)
    """
    from urllib.parse import unquote
    content_type = request.headers.get("content-type", "application/octet-stream")
    filename = unquote(request.headers.get("x-filename", "upload"))
    mime = content_type.split(";")[0].strip() or "application/octet-stream"

    # Validate declared size before reading a single byte
    try:
        content_length = int(request.headers.get("content-length", 0))
    except ValueError:
        content_length = 0

    if media_type == "video":
        max_bytes = MAX_VIDEO_BYTES
    elif media_type == "document":
        max_bytes = MAX_DOC_BYTES
    else:
        max_bytes = MAX_IMAGE_BYTES

    if content_length > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File exceeds maximum size of {max_bytes // (1024 * 1024)} MB.",
        )

    print(
        f"[UPLOAD] media_type={media_type!r} filename={filename!r} "
        f"mime={mime!r} size={content_length:,}",
        flush=True,
    )

    _validate_raw(content_type, filename, media_type)

    safe_filename = f"{uuid.uuid4().hex}_{filename.replace(' ', '_')}"
    blob_name = make_blob_name(
        media_type=media_type,
        filename=safe_filename,
        family=family.strip() or None,
        entity_id=entity_id.strip() or None,
    )

    settings = get_settings()
    try:
        if settings.blob_connection_string:
            # Stream directly to Azure — never buffers full file in RAM
            url = await upload_blob_stream(
                blob_name, request.stream(), mime, content_length
            )
        else:
            # Local fallback (dev only, small files)
            data = await request.body()
            url = _save_local(blob_name, data, mime)
    except ClientDisconnect:
        raise HTTPException(
            status_code=499,
            detail="Upload cancelled: client disconnected before transfer completed.",
        )
    except Exception as exc:
        logger.error("Upload failed for %s: %s", blob_name, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Storage upload failed. Please try again.",
        )

    print(f"[UPLOAD] done → {blob_name}", flush=True)
    return {"url": url, "blob_path": blob_name}


@router.get("/html-download-url")
async def html_download_url(
    blob_path: str = Query(...),
    filename: str = Query(""),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> dict[str, str]:
    """Return a five-minute Blob URL that downloads HTML instead of rendering it."""
    from urllib.parse import unquote

    path = unquote(blob_path).lstrip("/")
    container, separator, name = path.partition("/")
    if container != "artifacts" or not separator or not name.lower().endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Only HTML collateral can be downloaded here.")
    try:
        return {"url": make_html_attachment_url(name, filename)}
    except RuntimeError as exc:
        logger.warning("Could not create HTML download URL: %s", exc)
        raise HTTPException(status_code=503, detail="Direct HTML download is not configured.")


@router.get("/download-html")
async def download_html_collateral(
    blob_path: str = Query(...),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> Response:
    """Download untrusted HTML as data; never render it on the portal origin."""
    from urllib.parse import unquote

    path = unquote(blob_path).lstrip("/")
    container, separator, name = path.partition("/")
    if container != "artifacts" or not separator or not name.lower().endswith((".html", ".htm")):
        raise HTTPException(status_code=400, detail="Only HTML collateral can be downloaded here.")
    settings = get_settings()
    if not settings.blob_connection_string:
        raise HTTPException(status_code=503, detail="Blob storage is not configured.")
    try:
        async with BlobServiceClient.from_connection_string(settings.blob_connection_string) as client:
            blob = client.get_blob_client(container=container, blob=name)
            properties = await blob.get_blob_properties()
            if properties.size > MAX_DOC_BYTES:
                raise HTTPException(status_code=413, detail="HTML file exceeds the 50 MB limit.")
            data = await (await blob.download_blob()).readall()
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("HTML collateral download failed: %s", exc)
        raise HTTPException(status_code=502, detail="HTML collateral could not be downloaded.")
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": "attachment", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store"},
    )


@router.get("/local/{filename:path}")
async def serve_local_file(filename: str) -> StreamingResponse:
    path = os.path.join(_LOCAL_UPLOADS_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="File not found.")
    with open(path, "rb") as f:
        data = f.read()
    # Guess content type from extension
    ext = os.path.splitext(filename)[1].lower()
    ct_map = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xls": "application/vnd.ms-excel",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt": "application/vnd.ms-powerpoint",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
    }
    ct = ct_map.get(ext, "application/octet-stream")
    if ext in (".html", ".htm"):
        return StreamingResponse(
            io.BytesIO(data), media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{os.path.basename(filename)}"', "X-Content-Type-Options": "nosniff"},
        )
    return StreamingResponse(io.BytesIO(data), media_type=ct)


@router.get("/templates/{fmt}")
async def download_template(
    fmt: str,
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> StreamingResponse:
    """Download a blank submission template (xlsx or docx)."""
    if fmt not in ("xlsx", "docx"):
        raise HTTPException(status_code=400, detail="fmt must be xlsx or docx.")

    if fmt == "xlsx":
        return _build_xlsx_template()
    return _build_docx_template()


# ── shared option lists ────────────────────────────────────────────────────
_CATEGORIES = [
    "AI & Machine Learning",
    "AI SDLC & Prompt Engineering",
    "RAG & Context Engineering",
    "MLOps & Model Management",
    "DataOps & Master Data",
    "Data & Analytics",
    "Software Engineering",
    "Application Development",
    "Cloud Native",
    "DevOps & Infrastructure",
    "Infrastructure & Managed AI Ops",
    "Quality Engineering & Test Automation",
    "Security & Compliance",
    "Process Automation & RPA",
    "Observability",
    "Others",
]
_FAMILIES  = [
    "Atlas — DataOps & Master Data",
    "Forge — Software Engineering & DevOps",
    "Sentinel — Quality & Security",
    "Relay — Integration & API Management",
    "Nexus — Infrastructure & Managed AI Ops",
    "Others",
]
_CLOUDS    = ["AWS", "Azure", "GCP", "Multi-cloud", "On-prem"]
_MATURITIES = ["Experimental", "Battle-Tested", "Production"]
_DEMO      = ["Yes", "No"]


def _build_xlsx_template() -> StreamingResponse:
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.worksheet.datavalidation import DataValidation

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Submission Form"

    # ── hidden Options sheet ──────────────────────────────────────────────
    opts = wb.create_sheet("_Options")
    opts.sheet_state = "hidden"
    for i, v in enumerate(_CATEGORIES,  1): opts.cell(i, 1, v)
    for i, v in enumerate(_FAMILIES,    1): opts.cell(i, 2, v)
    for i, v in enumerate(_CLOUDS,      1): opts.cell(i, 3, v)
    for i, v in enumerate(_MATURITIES,  1): opts.cell(i, 4, v)
    for i, v in enumerate(_DEMO,        1): opts.cell(i, 5, v)

    # ── column widths ─────────────────────────────────────────────────────
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 36
    ws.column_dimensions["C"].width = 30
    ws.column_dimensions["D"].width = 36

    # ── styles ────────────────────────────────────────────────────────────
    NAVY     = "0A2540"
    BLUE     = "1D4ED8"
    GREEN    = "0F766E"
    BROWN    = "92400E"
    INPUT_BG = "FFFDE7"   # yellow tint — matches "fill yellow cells" instruction
    LABEL_BG = "F1F5F9"
    RED      = "DC2626"

    def _font(bold=False, size=10, color="1F2937", italic=False):
        return Font(name="Calibri", bold=bold, size=size, color=color, italic=italic)

    def _fill(hex_color):
        return PatternFill("solid", fgColor=hex_color)

    def _border():
        s = Side(style="thin", color="CBD5E1")
        return Border(left=s, right=s, top=s, bottom=s)

    def _align(h="left", v="center", wrap=False):
        return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

    def _input_cell(cell):
        cell.fill = _fill(INPUT_BG)
        cell.border = _border()
        cell.alignment = _align(wrap=True)
        cell.font = _font(size=10)

    def _label_cell(cell, text, required=False):
        cell.value = text + (" *" if required else "")
        cell.font = _font(bold=True, size=10, color=(RED if required else "374151"))
        cell.fill = _fill(LABEL_BG)
        cell.border = _border()
        cell.alignment = _align(wrap=True)

    def _section_row(ws, row, title, color=NAVY):
        ws.merge_cells(f"A{row}:D{row}")
        c = ws[f"A{row}"]
        c.value = title
        c.font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
        c.fill = _fill(color)
        c.alignment = _align(h="left", v="center")
        c.border = _border()
        ws.row_dimensions[row].height = 22

    # ── Title ─────────────────────────────────────────────────────────────
    ws.merge_cells("A1:D1")
    c = ws["A1"]
    c.value = "InfoVision AIMPLIFY — Asset Submission Form"
    c.font = Font(name="Calibri", bold=True, size=15, color="FFFFFF")
    c.fill = _fill(NAVY)
    c.alignment = _align(h="center", v="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells("A2:D2")
    c = ws["A2"]
    c.value = "Fill in the yellow cells. Fields marked * are required. Use dropdowns where provided."
    c.font = _font(size=9, italic=True, color="64748B")
    c.fill = _fill("F8FAFC")
    c.alignment = _align(h="center")
    ws.row_dimensions[2].height = 16

    r = 3

    # ── SECTION 1 — SUBMITTER INFORMATION ────────────────────────────────
    _section_row(ws, r, "  SECTION 1 — SUBMITTER INFORMATION")
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Owner Name", required=True)
    _input_cell(ws[f"B{r}"])
    _label_cell(ws[f"C{r}"], "Owner Email", required=True)
    _input_cell(ws[f"D{r}"])
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Manager Name", required=True)
    _input_cell(ws[f"B{r}"])
    _label_cell(ws[f"C{r}"], "Manager Email", required=True)
    _input_cell(ws[f"D{r}"])
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Business Unit / Department", required=True)
    _input_cell(ws[f"B{r}"])
    _label_cell(ws[f"C{r}"], "Designation / Role", required=True)
    _input_cell(ws[f"D{r}"])
    r += 1

    # ── SECTION 2 — ASSET DETAILS ─────────────────────────────────────────
    _section_row(ws, r, "  SECTION 2 — ASSET DETAILS", color=BLUE)
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Asset Title", required=True)
    _input_cell(ws[f"B{r}"])
    _label_cell(ws[f"C{r}"], "Category", required=True)
    _input_cell(ws[f"D{r}"])
    cat_row = r
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Platform Family", required=True)
    _input_cell(ws[f"B{r}"])
    fam_row = r
    _label_cell(ws[f"C{r}"], "Cloud Provider")
    _input_cell(ws[f"D{r}"])
    cloud_row = r
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Maturity", required=True)
    _input_cell(ws[f"B{r}"])
    mat_row = r
    _label_cell(ws[f"C{r}"], "Demo Ready (Client-presentable)")
    _input_cell(ws[f"D{r}"])
    demo_row = r
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Tech Stack (comma-separated)", required=True)
    ws.merge_cells(f"B{r}:D{r}")
    _input_cell(ws[f"B{r}"])
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Collaborators (comma-separated)")
    ws.merge_cells(f"B{r}:D{r}")
    _input_cell(ws[f"B{r}"])
    r += 1

    ws.row_dimensions[r].height = 50
    _label_cell(ws[f"A{r}"], "Dependencies / Prerequisites")
    ws.merge_cells(f"B{r}:D{r}")
    _input_cell(ws[f"B{r}"])
    ws[f"B{r}"].alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Commands (comma-separated)")
    ws.merge_cells(f"B{r}:D{r}")
    _input_cell(ws[f"B{r}"])
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Repository URL", required=True)
    _input_cell(ws[f"B{r}"])
    _label_cell(ws[f"C{r}"], "Demo Video URL", required=True)
    _input_cell(ws[f"D{r}"])
    r += 1

    ws.row_dimensions[r].height = 30
    _label_cell(ws[f"A{r}"], "Live Demo URL", required=True)
    ws.merge_cells(f"B{r}:D{r}")
    _input_cell(ws[f"B{r}"])
    ws[f"B{r}"].value = ""
    # note for either/or
    note_row = r
    r += 1

    ws.merge_cells(f"A{r}:D{r}")
    note = ws[f"A{r}"]
    note.value = "ℹ  Either Demo Video URL or Live Demo URL is required (at least one must be provided)"
    note.font = _font(size=9, italic=True, color="92400E")
    note.fill = _fill("FFF7ED")
    note.alignment = _align(h="left", wrap=True)
    ws.row_dimensions[r].height = 18
    r += 1

    # ── SECTION 3 — DESCRIPTION ───────────────────────────────────────────
    _section_row(ws, r, "  SECTION 3 — DESCRIPTION", color=GREEN)
    r += 1

    ws.merge_cells(f"A{r}:A{r+3}")
    _label_cell(ws[f"A{r}"], "Full Description", required=True)
    ws.merge_cells(f"B{r}:D{r+3}")
    _input_cell(ws[f"B{r}"])
    ws[f"B{r}"].alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
    for rr in range(r, r + 4):
        ws.row_dimensions[rr].height = 28
    r += 4

    # ── SECTION 4 — ARCHITECTURE & DOCUMENTS ─────────────────────────────
    _section_row(ws, r, "  SECTION 4 — ARCHITECTURE & DOCUMENTS", color=BROWN)
    r += 1

    ws.merge_cells(f"A{r}:D{r}")
    hint = ws[f"A{r}"]
    hint.value = "Upload documents directly on the platform when submitting. Note URLs or filenames here if available."
    hint.font = _font(size=9, italic=True, color="64748B")
    hint.fill = _fill("F8FAFC")
    hint.alignment = _align(h="left", wrap=True)
    ws.row_dimensions[r].height = 16
    r += 1

    for doc_label, doc_hint, doc_required in [
        ("Architecture File",       "System/solution architecture diagram or document", True),
        ("Sales Pitch Deck",        "Client-facing pitch or presentation",              True),
        ("Marketing Collateral",    "Brochure, one-pager, or marketing material",       False),
        ("Technical Delivery Doc",  "Implementation guide, runbook, or delivery document", False),
    ]:
        ws.row_dimensions[r].height = 30
        _label_cell(ws[f"A{r}"], doc_label, required=doc_required)
        ws.merge_cells(f"B{r}:D{r}")
        c = ws[f"B{r}"]
        _input_cell(c)
        c.value = doc_hint
        c.font = _font(size=9, italic=True, color="94A3B8")
        r += 1

    # ── Data validations (dropdowns) ──────────────────────────────────────
    def _dv(formula, sqref):
        dv = DataValidation(type="list", formula1=formula, allow_blank=True, showDropDown=False)
        dv.sqref = sqref
        ws.add_data_validation(dv)

    _dv(f"'_Options'!$A$1:$A${len(_CATEGORIES)}", f"D{cat_row}")
    _dv(f"'_Options'!$B$1:$B${len(_FAMILIES)}",   f"B{fam_row}")
    _dv(f"'_Options'!$C$1:$C${len(_CLOUDS)}",     f"D{cloud_row}")
    _dv(f"'_Options'!$D$1:$D${len(_MATURITIES)}", f"B{mat_row}")
    _dv(f"'_Options'!$E$1:$E${len(_DEMO)}",       f"D{demo_row}")

    ws.freeze_panes = "A3"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=AIMPLIFY_Asset_Submission_Template.xlsx"},
    )


def _build_docx_template() -> StreamingResponse:
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches, Cm
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement

    def _set_cell_bg(cell, hex_color: str):
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:color"), "auto")
        shd.set(qn("w:fill"), hex_color)
        tcPr.append(shd)

    def _cell_text(cell, text, bold=False, size=10, color=None, italic=False, align=None):
        cell.text = ""
        p = cell.paragraphs[0]
        if align:
            p.alignment = align
        run = p.add_run(text)
        run.bold = bold
        run.italic = italic
        run.font.size = Pt(size)
        if color:
            run.font.color.rgb = RGBColor.from_string(color)

    def _section_header(doc, title: str, hex_color: str = "0A2540"):
        tbl = doc.add_table(rows=1, cols=1)
        tbl.style = "Table Grid"
        tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
        cell = tbl.rows[0].cells[0]
        _set_cell_bg(cell, hex_color)
        _cell_text(cell, f"  {title}", bold=True, size=12, color="FFFFFF")
        cell.paragraphs[0].paragraph_format.space_before = Pt(3)
        cell.paragraphs[0].paragraph_format.space_after  = Pt(3)
        doc.add_paragraph()

    def _word_dropdown(cell, options: list, placeholder: str = "Select…"):
        """Replace a cell's content with a Word drop-down content control (w:sdt)."""
        tc = cell._tc
        # Remove any existing paragraphs
        for p_el in list(tc.findall(qn("w:p"))):
            tc.remove(p_el)

        sdt = OxmlElement("w:sdt")

        # ── sdtPr (properties) ────────────────────────────────────────────
        sdtPr = OxmlElement("w:sdtPr")
        ddList = OxmlElement("w:dropDownList")
        # Blank "choose" entry
        blank = OxmlElement("w:listItem")
        blank.set(qn("w:displayText"), placeholder)
        blank.set(qn("w:value"), "")
        ddList.append(blank)
        for opt in options:
            item = OxmlElement("w:listItem")
            item.set(qn("w:displayText"), str(opt))
            item.set(qn("w:value"), str(opt))
            ddList.append(item)
        sdtPr.append(ddList)
        sdt.append(sdtPr)

        # ── sdtContent ───────────────────────────────────────────────────
        sdtContent = OxmlElement("w:sdtContent")
        p_el = OxmlElement("w:p")
        r_el = OxmlElement("w:r")
        rPr = OxmlElement("w:rPr")
        color_el = OxmlElement("w:color")
        color_el.set(qn("w:val"), "3B82F6")
        rPr.append(color_el)
        sz_el = OxmlElement("w:sz")
        sz_el.set(qn("w:val"), "18")  # 9 pt
        rPr.append(sz_el)
        rPr.append(OxmlElement("w:i"))
        r_el.append(rPr)
        t_el = OxmlElement("w:t")
        t_el.text = f"▼  {placeholder}"
        r_el.append(t_el)
        p_el.append(r_el)
        sdtContent.append(p_el)
        sdt.append(sdtContent)

        tc.append(sdt)

    def _set_row_height(row, pt: float):
        tr = row._tr
        trPr = tr.get_or_add_trPr()
        trHeight = OxmlElement("w:trHeight")
        trHeight.set(qn("w:val"), str(int(pt * 20)))
        trHeight.set(qn("w:hRule"), "atLeast")
        trPr.append(trHeight)

    def _input_cell(cell, ph: str, input_bg: str = "FFFFFF"):
        """Plain text input cell with subtle placeholder hint."""
        cell.text = ""
        p = cell.paragraphs[0]
        run = p.add_run(ph or "")
        run.italic = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor.from_string("BFDBFE")
        _set_cell_bg(cell, input_bg)

    def _form_table(doc, rows):
        """Single-row layout: [Label | Input] × 2 columns per row.
           rows = list of (lbl, ph, req, opts, lbl2, ph2, req2, opts2)
        """
        label_bg  = "EFF6FF"
        input_bg  = "FFFFFF"
        req_color = "DC2626"
        norm_color = "1E3A5F"

        for (lbl, ph, req, opts, lbl2, ph2, req2, opts2) in rows:
            ncols = 4 if lbl2 else 2
            tbl = doc.add_table(rows=1, cols=ncols)
            tbl.style = "Table Grid"
            tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
            _set_row_height(tbl.rows[0], 28)

            # ── set column widths ─────────────────────────────────────────
            col_widths = [Cm(4.8), Cm(7.8), Cm(4.8), Cm(7.8)]
            for ci in range(ncols):
                for cell in tbl.columns[ci].cells:
                    cell.width = col_widths[ci]

            row = tbl.rows[0]

            # ── Field 1 ───────────────────────────────────────────────────
            lbl_text = lbl + (" *" if req else "")
            _cell_text(row.cells[0], lbl_text, bold=True, size=10,
                       color=(req_color if req else norm_color))
            _set_cell_bg(row.cells[0], label_bg)

            if opts:
                _set_cell_bg(row.cells[1], "EFF6FF")
                _word_dropdown(row.cells[1], opts, "Select…")
            else:
                _input_cell(row.cells[1], ph, input_bg)

            # ── Field 2 ───────────────────────────────────────────────────
            if lbl2:
                lbl2_text = lbl2 + (" *" if req2 else "")
                _cell_text(row.cells[2], lbl2_text, bold=True, size=10,
                           color=(req_color if req2 else norm_color))
                _set_cell_bg(row.cells[2], label_bg)

                if opts2:
                    _set_cell_bg(row.cells[3], "EFF6FF")
                    _word_dropdown(row.cells[3], opts2, "Select…")
                else:
                    _input_cell(row.cells[3], ph2, input_bg)

            doc.add_paragraph()

    doc = Document()

    # Page margins
    section = doc.sections[0]
    section.page_width  = Inches(8.5)
    section.page_height = Inches(11)
    section.left_margin   = Inches(0.8)
    section.right_margin  = Inches(0.8)
    section.top_margin    = Inches(0.7)
    section.bottom_margin = Inches(0.7)

    # Title
    title_tbl = doc.add_table(rows=1, cols=1)
    title_tbl.style = "Table Grid"
    tc = title_tbl.rows[0].cells[0]
    _set_cell_bg(tc, "0A2540")
    p = tc.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r1 = p.add_run("InfoVision Amplify")
    r1.bold = True; r1.font.size = Pt(18); r1.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    p2 = tc.add_paragraph("Asset Submission Form")
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p2.runs[0].font.size = Pt(11); p2.runs[0].font.color.rgb = RGBColor(0xBA, 0xE6, 0xFD)
    doc.add_paragraph()

    note = doc.add_paragraph()
    note.add_run("Instructions: ").bold = True
    note.add_run(
        "Complete all fields marked * (required). For dropdown fields, select from the listed options. "
        "Upload completed form via the Amplify portal or email to your admin."
    )
    note.runs[-1].font.size = Pt(9)
    note.runs[-1].font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
    doc.add_paragraph()

    # ── Section 1 ─────────────────────────────────────────────────────────
    _section_header(doc, "SECTION 1 — SUBMITTER INFORMATION")
    _form_table(doc, [
        ("Owner Name",                  "e.g. Balram Aggarwal",         True,  None, "Owner Email",      "name@infovision.com",       True,  None),
        ("Manager Name",                "e.g. Rohini Sharma",           True,  None, "Manager Email",     "manager@infovision.com",    True,  None),
        ("Business Unit / Department",  "e.g. Digital Technology",      True,  None, "Designation / Role","e.g. Senior SW Engineer",   True,  None),
    ])

    # ── Section 2 ─────────────────────────────────────────────────────────
    _section_header(doc, "SECTION 2 — ASSET DETAILS", "1D4ED8")
    _form_table(doc, [
        ("Asset Title",      "e.g. Invoice Extraction Pipeline",  True,  None,         "Category",      None, True,  _CATEGORIES),
        ("Platform Family",  None,                                True,  _FAMILIES,    "Cloud Provider", None, False, _CLOUDS),
        ("Maturity",         None,                                True,  _MATURITIES,  "Demo Ready",    None, False, _DEMO),
    ])

    # Tech Stack — label | wide input
    def _wide_row(doc, label, ph, req=False, tall=False):
        tbl = doc.add_table(rows=1, cols=2)
        tbl.style = "Table Grid"
        tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
        _set_row_height(tbl.rows[0], 48 if tall else 28)
        tbl.columns[0].cells[0].width = Cm(4.8)
        tbl.columns[1].cells[0].width = Cm(20.6)
        lbl_text = label + (" *" if req else "")
        _cell_text(tbl.rows[0].cells[0], lbl_text, bold=True, size=10,
                   color=("DC2626" if req else "1E3A5F"))
        _set_cell_bg(tbl.rows[0].cells[0], "EFF6FF")
        _input_cell(tbl.rows[0].cells[1], ph)
        if tall:
            tbl.rows[0].cells[1].paragraphs[0].paragraph_format.space_after = Pt(36)
        doc.add_paragraph()

    _wide_row(doc, "Tech Stack", "e.g. Python, FastAPI, LangChain, Azure OpenAI (comma-separated)")
    _wide_row(doc, "Collaborators", "e.g. John Smith, Jane Doe (comma-separated names or emails)")
    _wide_row(doc, "Dependencies / Prerequisites", "List required libraries, services, or setup steps needed before running this asset.", tall=True)
    _wide_row(doc, "Commands", "e.g. pip install -r requirements.txt, python main.py (comma-separated)")

    _form_table(doc, [
        ("Repository URL", "https://github.com/...", False, None, "Demo Video URL", "https://...", False, None),
    ])
    _wide_row(doc, "Live Demo URL", "URL of the running live demo (e.g. https://demo.example.com/...)")

    # ── Section 3 ─────────────────────────────────────────────────────────
    _section_header(doc, "SECTION 3 — PROJECT OVERVIEW", "0F766E")
    _wide_row(doc, "Project Overview", "What does it do? Which business problems does it solve? What can delivery teams reuse?", req=True, tall=True)

    # ── Section 4 ─────────────────────────────────────────────────────────
    _section_header(doc, "SECTION 4 — ARCHITECTURE", "92400E")
    _wide_row(doc, "Architecture File URL", "Paste a SharePoint / OneDrive / portal URL, or describe the architecture briefly.", tall=True)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=amplify_submission_template.docx"},
    )


@router.delete("/{blob_path:path}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_media(
    blob_path: str,
    db: AsyncSession = Depends(get_db),
    user=require_role("Aimplify.User", "Aimplify.Admin", "Aimplify.Owner"),
) -> Response:
    """
    Delete a blob by path within the artifacts container.
    Non-admins can only delete blobs under their own user folder (users/{user_id}/...).
    """
    role_val = user.role.value if hasattr(user.role, "value") else user.role

    # Non-owners can only delete from the drafts prefix (their own pre-submission uploads)
    if role_val not in ("Aimplify.Owner", "Aimplify.Admin"):
        if not blob_path.startswith("drafts/"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own draft uploads.",
            )

    try:
        await delete_blob(blob_path)
    except Exception as exc:
        logger.error("Blob delete failed: %s", exc)
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Storage delete failed.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
