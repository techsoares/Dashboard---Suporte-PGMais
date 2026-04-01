"""
PGMais Team Dashboard — FastAPI Application Entry Point.

Aplicação modularizada com Clean Architecture:
- src.core: Configuration, security, logging
- src.domain: Models, entities, exceptions
- src.infrastructure: Database, cache, external clients
- src.services: Business logic
- src.api: Routes and endpoints

Stack:
- FastAPI 0.115+
- SQLite (cache + persistence)
- Jira Cloud API v3
- JWT authentication
- Rate limiting
"""

import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Import core components
from src.core import (
    settings,
    logger,
    SECURITY_HEADERS,
    get_cors_origins,
    get_cors_regex,
)
from src.infrastructure import db_manager, cache
from src.api.v1 import auth, dashboard, priority, admin, health

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s"
)

logger = logging.getLogger("pgmais.main")

# ============================================================================
# FastAPI App Setup
# ============================================================================

app = FastAPI(
    title="PGMais Team Dashboard API",
    description="Proxy e cache da API do Jira Cloud para o TV Dashboard",
    version="2.0.0",  # Versão modularizada
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


# ============================================================================
# Middleware
# ============================================================================

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security Headers (middleware customizado)
@app.middleware("http")
async def add_security_headers(request, call_next):
    """Adiciona headers de segurança a todas as respostas."""
    response = await call_next(request)

    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value

    return response


# ============================================================================
# Event Handlers
# ============================================================================


@app.on_event("startup")
async def startup_event():
    """Inicializa componentes na startup."""
    logger.info("=" * 60)
    logger.info("PGMais Dashboard v2.0.0 — Starting up")
    logger.info(f"Environment: {settings.debug and 'DEBUG' or 'PRODUCTION'}")

    try:
        # Initialize database schema
        db_manager.init_schema()
        logger.info("✓ Database initialized")

        # Health check on Jira
        # TODO: Verificar conectividade com Jira
        logger.info("✓ Application startup complete")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        sys.exit(1)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup na shutdown."""
    logger.info("PGMais Dashboard — Shutting down")
    cache.clear()
    logger.info("Cache cleared")


# ============================================================================
# Routes Registration
# ============================================================================

# Auth routes
app.include_router(auth.router, prefix="", tags=["auth"])

# Dashboard routes
app.include_router(dashboard.router, prefix="", tags=["dashboard"])

# Priority routes
app.include_router(priority.router, prefix="", tags=["priority"])

# Admin routes
app.include_router(admin.router, prefix="", tags=["admin"])

# Health routes
app.include_router(health.router, prefix="", tags=["health"])


# ============================================================================
# Root Endpoints
# ============================================================================


@app.get("/", tags=["info"])
async def root():
    """Endpoint raiz da API."""
    return {
        "name": "PGMais Team Dashboard API",
        "version": "2.0.0",
        "status": "running",
        "docs": "/api/docs",
        "health": "/api/v1/health"
    }


@app.get("/version", tags=["info"])
async def version():
    """Retorna versão da aplicação."""
    return {
        "version": "2.0.0",
        "architecture": "Clean Architecture (modularized)",
        "core_modules": [
            "config",
            "security",
            "logging",
            "domain",
            "infrastructure",
            "services",
            "api"
        ]
    }


# ============================================================================
# Error Handlers
# ============================================================================


@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handler para 404 Not Found."""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Endpoint não encontrado",
            "path": str(request.url.path),
            "docs": "/api/docs"
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handler para 500 Internal Server Error."""
    logger.error(f"Internal error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Erro interno do servidor",
            "request_id": request.headers.get("x-request-id", "unknown")
        }
    )


# ============================================================================
# Main
# ============================================================================


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info"
    )
