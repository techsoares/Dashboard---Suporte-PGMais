"""
PGMais Team Dashboard — Backend
FastAPI proxy/cache para a API REST do Jira Cloud.

Endpoints:
  GET /api/health     → healthcheck
  GET /api/dashboard  → dados consolidados (cache 5min)
  POST /api/refresh   → invalida cache e força atualização
"""

import logging
import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from cache import cache
from jira_client import fetch_active_issues, fetch_done_this_week, build_dashboard
from models import DashboardResponse

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("pgmais.dashboard")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="PGMais Team Dashboard API",
    description="Proxy e cache da API do Jira Cloud para o TV Dashboard",
    version="1.0.0",
)

# CORS — libera localhost em qualquer porta (Vite dev server, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite padrão
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_KEY = "dashboard_data"
CACHE_TTL = 300  # 5 minutos em segundos


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_env() -> list[str]:
    """Retorna lista de variáveis de ambiente ausentes."""
    missing = []
    for var in ("JIRA_EMAIL", "JIRA_TOKEN", "JIRA_BASE_URL"):
        if not os.getenv(var):
            missing.append(var)
    return missing


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["infra"])
async def health():
    """Healthcheck simples. Verifica se as credenciais Jira estão configuradas."""
    missing = _validate_env()
    status = "ok" if not missing else "degraded"
    return {
        "status": status,
        "missing_env": missing,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cache_age_seconds": cache.age_seconds(CACHE_KEY),
        "cache_ttl_remaining_seconds": cache.ttl_remaining(CACHE_KEY, CACHE_TTL),
    }


@app.get(
    "/api/dashboard",
    response_model=DashboardResponse,
    tags=["dashboard"],
    summary="Retorna dados consolidados do Jira (cache 5min)",
)
async def get_dashboard():
    missing = _validate_env()
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Variáveis de ambiente ausentes: {', '.join(missing)}",
        )

    # Tenta cache primeiro
    cached: DashboardResponse | None = cache.get(CACHE_KEY, ttl=CACHE_TTL)
    if cached is not None:
        logger.info("Cache HIT — retornando dados em cache")
        return cached

    # Cache miss → busca no Jira
    logger.info("Cache MISS — buscando dados no Jira...")
    try:
        active_issues, done_issues = await _fetch_all()
    except Exception as exc:
        logger.error("Erro ao buscar dados no Jira: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao comunicar com o Jira: {str(exc)}",
        )

    dashboard = build_dashboard(active_issues, done_issues)
    cache.set(CACHE_KEY, dashboard)
    logger.info(
        "Dashboard atualizado: %d devs, %d issues ativas, %d concluídas na semana",
        len(dashboard.devs),
        len(dashboard.backlog),
        dashboard.kpis.done_this_week,
    )
    return dashboard


@app.post(
    "/api/refresh",
    tags=["dashboard"],
    summary="Invalida o cache e força atualização imediata",
)
async def force_refresh():
    """Útil para invalidação manual via botão no frontend ou curl."""
    missing = _validate_env()
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Variáveis de ambiente ausentes: {', '.join(missing)}",
        )

    cache.invalidate(CACHE_KEY)
    logger.info("Cache invalidado manualmente — buscando dados no Jira...")

    try:
        active_issues, done_issues = await _fetch_all()
    except Exception as exc:
        logger.error("Erro ao buscar dados no Jira: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Erro ao comunicar com o Jira: {str(exc)}",
        )

    dashboard = build_dashboard(active_issues, done_issues)
    cache.set(CACHE_KEY, dashboard)
    return {"status": "refreshed", "last_updated": dashboard.last_updated}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_all():
    """Dispara as duas consultas ao Jira em paralelo."""
    import asyncio
    active_issues, done_issues = await asyncio.gather(
        fetch_active_issues(),
        fetch_done_this_week(),
    )
    return active_issues, done_issues


# ---------------------------------------------------------------------------
# Entrypoint (dev)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
