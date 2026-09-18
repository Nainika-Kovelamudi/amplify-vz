"""
app/main.py
-----------
FastAPI application entry point for the Amplify Platform API.
"""

from __future__ import annotations

import json
import logging
import logging.config
import sys
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


def _configure_logging() -> None:
    class _JsonFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            log_record: dict[str, Any] = {
                "timestamp": self.formatTime(record, self.datefmt),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info:
                log_record["exc_info"] = self.formatException(record.exc_info)
            if hasattr(record, "request_id"):
                log_record["request_id"] = record.request_id
            return json.dumps(log_record)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)
    for noisy in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


_configure_logging()
logger = logging.getLogger(__name__)

from app.config import get_settings
settings = get_settings()

from app.db.base import Base, get_engine
engine = get_engine()

from app.routers.auth import router as auth_router
from app.routers.catalog import router as catalog_router
from app.routers.submissions import router as submissions_router
from app.routers.admin import router as admin_router
from app.routers.clone_requests import router as clone_requests_router
from app.routers.demo_requests import router as demo_requests_router
from app.routers.users import router as users_router
from app.routers.audit import router as audit_router
from app.routers.media import router as media_router
from app.routers.notifications import router as notifications_router
from app.websocket.manager import ConnectionManager

ws_manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Amplify API starting up…")

    try:
        from app.config import load_secrets
        await load_secrets(settings)
        logger.info("Azure Key Vault secrets loaded.")
    except Exception as exc:
        logger.warning("Could not load Key Vault secrets: %s", exc)

    logger.info("Amplify API started. debug=%s", settings.debug)
    yield

    logger.info("Amplify API shutting down…")
    try:
        await engine.dispose()
        logger.info("DB connections closed.")
    except Exception as exc:
        logger.error("Error closing DB connections: %s", exc)
    logger.info("Amplify API shutdown complete.")


def create_app() -> FastAPI:
    _app = FastAPI(
        title="Amplify API",
        description="InfoVision Amplify Platform API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        openapi_url="/openapi.json" if settings.debug else None,
    )

    _app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    _app.add_middleware(_RequestIdMiddleware)

    _app.include_router(auth_router, prefix="")
    _app.include_router(catalog_router, prefix="")
    _app.include_router(submissions_router, prefix="/submissions")
    _app.include_router(admin_router, prefix="/admin")
    _app.include_router(clone_requests_router, prefix="")
    _app.include_router(demo_requests_router, prefix="")
    _app.include_router(users_router, prefix="/admin/users")
    _app.include_router(audit_router, prefix="/admin/audit")
    _app.include_router(media_router, prefix="/media")
    _app.include_router(notifications_router, prefix="/notifications")

    @_app.websocket("/ws/notifications")
    async def websocket_notifications(websocket: WebSocket) -> None:
        await ws_manager.handle_connection(websocket)

    @_app.get("/health", tags=["System"], summary="Health check")
    async def health_check() -> dict[str, str]:
        return {"status": "ok", "version": "1.0.0"}

    @_app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [
            {"field": ".".join(str(loc) for loc in err["loc"]), "message": err["msg"], "type": err["type"]}
            for err in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errors})

    @_app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @_app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id: str = getattr(request.state, "request_id", "unknown")
        logger.exception("Unhandled exception request_id=%s: %s", request_id, exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred.", "request_id": request_id},
        )

    return _app


class _RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


app = create_app()
