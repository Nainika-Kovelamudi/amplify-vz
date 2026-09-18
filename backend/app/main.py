from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

# Windows ProactorEventLoop has bugs with certain async socket ops (WinError 121).
# Switch to SelectorEventLoop on Windows before anything else runs.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from starlette.formparsers import MultiPartParser
from fastapi.middleware.cors import CORSMiddleware

# Must be patched before any requests are handled.
# Starlette 0.37.x uses max_file_size (not max_part_size) to gate file uploads.
MultiPartParser.max_file_size = 800 * 1024 * 1024  # 800 MB
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings, load_secrets
from app.db.base import get_engine
from app.routers import (
    admin,
    audit,
    auth,
    catalog,
    clone_requests,
    comments,
    demo_requests,
    feedback,
    likes,
    integrations,
    media,
    notifications,
    portal_settings,
    submissions,
    users,
)
from app.websocket.manager import websocket_notifications_endpoint

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await load_secrets(settings)

    engine = get_engine()  # initialise connection pool at startup
    # Azure App Service can be configured with a custom startup command that
    # bypasses startup.sh. Keep this small, idempotent guard so deployments
    # cannot run new AIV-mapping models against an older database schema.
    from sqlalchemy import text
    async with engine.begin() as connection:
        await connection.execute(text(
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS aiv_ideation_id VARCHAR"
        ))
        await connection.execute(text(
            "ALTER TABLE submissions ADD COLUMN IF NOT EXISTS aiv_ideation_title VARCHAR"
        ))
        await connection.execute(text(
            "ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS aiv_ideation_id VARCHAR"
        ))
        await connection.execute(text(
            "ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS aiv_ideation_title VARCHAR"
        ))
        await connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_submissions_aiv_ideation_id ON submissions (aiv_ideation_id)"
        ))
        await connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_catalog_assets_aiv_ideation_id ON catalog_assets (aiv_ideation_id)"
        ))
    logger.info("AIV ideation mapping schema verified.")
    from app.services.executive_report_service import run_executive_report_scheduler
    report_scheduler_task = asyncio.create_task(run_executive_report_scheduler())
    logger.info("Amplify API started — debug=%s", settings.debug)
    yield
    report_scheduler_task.cancel()
    try:
        await report_scheduler_task
    except asyncio.CancelledError:
        pass
    logger.info("Amplify API shutting down.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Amplify API",
        description="InfoVision Amplify — Internal Accelerator Platform API",
        version="1.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
        lifespan=lifespan,
    )

    # Read CORS_ORIGINS directly from os.environ to avoid pydantic-settings
    # JSON-decoding list fields — accepts comma-separated or JSON array.
    import os as _os, json as _json
    _raw = _os.environ.get("CORS_ORIGINS", "").strip()
    try:
        _cors_list: list[str] = _json.loads(_raw) if _raw else []
    except Exception:
        _cors_list = [o.strip() for o in _raw.split(",") if o.strip()]

    default_origins = {settings.frontend_url} if settings.frontend_url else set()
    # Canonical AIMPLIFY frontends must remain allowed even when an Azure slot
    # still carries an older Static Web Apps hostname in FRONTEND_URL/CORS_ORIGINS.
    default_origins.update({
        "https://aimplify.infovision.ai",
        "https://aimplify-dev.infovision.ai",
    })
    origins = list(set(_cors_list) | default_origins)
    # Always allow localhost variants — the backend never runs on port 8000 in production
    # (Azure App Service terminates externally), so this is safe unconditionally.
    dev_origins = set(origins) | {
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:8080", "http://127.0.0.1:8080",
    }
    for o in list(origins):
        if "localhost" in o:
            dev_origins.add(o.replace("localhost", "127.0.0.1"))
        if "127.0.0.1" in o:
            dev_origins.add(o.replace("127.0.0.1", "localhost"))
    origins = list(dev_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # Debug: log all 400/422 errors so we can see what's being rejected and why
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        print(f"[VALIDATION_ERROR] {request.method} {request.url.path} — {exc.errors()}", flush=True)
        # Pydantic may place the original ValueError instance in error.ctx.
        # That object is not JSON serializable and previously turned a valid
        # 422 response into an unhandled 500 response.
        return JSONResponse(
            status_code=422,
            content={
                "detail": jsonable_encoder(
                    exc.errors(),
                    custom_encoder={ValueError: str},
                )
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException):
        if exc.status_code < 500:
            print(f"[HTTP_ERROR] {request.method} {request.url.path} → {exc.status_code}: {exc.detail}", flush=True)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception):
        # Returning the error through FastAPI keeps the response inside the
        # middleware stack, including CORS, while the full cause stays in logs.
        logger.exception("Unhandled API error: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "The server could not complete the request. Check the backend logs for the recorded exception."},
        )

    app.include_router(auth.router)
    app.include_router(catalog.router)
    app.include_router(submissions.router)
    app.include_router(clone_requests.router)
    app.include_router(demo_requests.router)
    app.include_router(comments.router)
    app.include_router(feedback.router)
    app.include_router(likes.router)
    app.include_router(admin.router)
    app.include_router(users.router)
    app.include_router(audit.router)
    app.include_router(media.router)
    app.include_router(notifications.router)
    app.include_router(portal_settings.router)
    app.include_router(integrations.router)

    app.add_api_websocket_route("/ws/notifications", websocket_notifications_endpoint)

    @app.get("/health", include_in_schema=False)
    async def health() -> dict:
        return {"status": "ok"}

    if settings.debug:
        @app.get("/debug/test-email", include_in_schema=False)
        async def debug_test_email() -> dict:
            from app.services.email_service import _send
            cfg = settings
            target = cfg.email_dev_override or cfg.smtp_user or "no-recipient-configured"
            await _send(
                target,
                "[Amplify DEBUG] Test email",
                "<h2>Test email from Amplify local dev</h2><p>If you see this, SMTP is working.</p>",
            )
            return {"status": "sent", "to": target, "smtp_host": cfg.smtp_host, "smtp_user": cfg.smtp_user}

    return app


app = create_app()
