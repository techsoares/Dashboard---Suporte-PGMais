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

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from cache import cache
from jira_client import fetch_active_issues, fetch_done_this_week, fetch_done_last_week, build_dashboard
from models import DashboardResponse, KpiSummary
from mock_data import get_mock_dashboard

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

# CORS com suporte para GitHub Codespaces tunnels
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"(https?://localhost.*|https?://127\.0\.0\.1.*|https://.*\.app\.github\.dev.*|http://.*\.app\.github\.dev.*)",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Refresh-Secret"],
)

CACHE_KEY    = "dashboard_data"
SNAPSHOT_KEY = "kpi_snapshot"       # snapshot diário para delta
CACHE_TTL    = 300                  # 5 minutos
SNAPSHOT_TTL = 86400                # 24 horas
REFRESH_SECRET = os.getenv("REFRESH_SECRET", "")


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


def _build_and_cache(active_issues, done_issues, done_last_week) -> DashboardResponse:
    """Constrói o dashboard, calcula delta e atualiza caches."""
    prev_kpis: KpiSummary | None = cache.get(SNAPSHOT_KEY, ttl=SNAPSHOT_TTL)
    dashboard = build_dashboard(
        active_issues,
        done_issues,
        done_last_week_count=len(done_last_week),
        prev_kpis=prev_kpis,
    )
    cache.set(CACHE_KEY, dashboard)

    # Cria o snapshot diário na primeira vez; expira sozinho após 24h
    if prev_kpis is None:
        cache.set(SNAPSHOT_KEY, dashboard.kpis)

    logger.info(
        "Dashboard atualizado: %d devs, %d issues ativas, %d concluídas, %d paralisadas",
        len(dashboard.devs),
        len(dashboard.backlog),
        dashboard.kpis.done_this_week,
        len(dashboard.stale_issues),
    )
    return dashboard


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["infra"])
async def health():
    """Healthcheck simples."""
    missing = _validate_env()
    status = "ok" if not missing else "degraded"
    return {
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cache_age_seconds": cache.age_seconds(CACHE_KEY),
        "cache_ttl_remaining_seconds": cache.ttl_remaining(CACHE_KEY, CACHE_TTL),
    }


@app.get("/api/debug/fields", tags=["infra"], summary="Mostra fields brutos de uma issue para diagnóstico")
async def debug_fields(issue_key: str | None = None):
    """Retorna os fields brutos de uma issue real do Jira para identificar custom fields."""
    import httpx, base64, os

    email = os.getenv("JIRA_EMAIL", "")
    token = os.getenv("JIRA_TOKEN", "")
    base_url = os.getenv("JIRA_BASE_URL", "https://pgmais.atlassian.net")
    project = os.getenv("JIRA_PROJECT", "ON")

    if not email or not token:
        raise HTTPException(status_code=503, detail="Credenciais Jira não configuradas")

    encoded = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers = {"Authorization": f"Basic {encoded}", "Accept": "application/json"}

    async with httpx.AsyncClient() as client:
        if issue_key:
            # Busca issue específica com todos os fields
            resp = await client.get(f"{base_url}/rest/api/3/issue/{issue_key}", headers=headers, timeout=15)
            resp.raise_for_status()
            data = resp.json()
            fields = data.get("fields", {})
        else:
            # Busca a primeira issue do projeto
            resp = await client.get(
                f"{base_url}/rest/api/3/search/jql",
                params={"jql": f'project = "{project}" ORDER BY created DESC', "maxResults": 1, "fields": "*all"},
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            issues = resp.json().get("issues", [])
            if not issues:
                return {"error": "Nenhuma issue encontrada"}
            fields = issues[0].get("fields", {})
            issue_key = issues[0].get("key")

    # Filtra apenas fields não nulos para facilitar leitura
    non_null = {k: v for k, v in fields.items() if v is not None}
    # Separa custom fields dos campos padrão
    custom = {k: v for k, v in non_null.items() if k.startswith("customfield_")}
    standard = {k: v for k, v in non_null.items() if not k.startswith("customfield_")}

    return {
        "issue_key": issue_key,
        "standard_fields": {k: standard[k] for k in ["summary", "status", "assignee", "components", "issuetype", "priority"] if k in standard},
        "custom_fields_with_values": custom,
        "all_field_keys": list(non_null.keys()),
    }


@app.get(
    "/api/dashboard",
    response_model=DashboardResponse,
    tags=["dashboard"],
    summary="Retorna dados consolidados do Jira (cache 5min)",
)
async def get_dashboard(
    account: str | None = None,
    product: str | None = None,
    assignee: str | None = None,
    issue_type: str | None = None,
):
    missing = _validate_env()

    # Se não houver credenciais, usar dados mock para desenvolvimento
    if missing:
        logger.info("Credenciais Jira ausentes — usando dados mock para desenvolvimento")
        dashboard = get_mock_dashboard()
    else:
        cached: DashboardResponse | None = cache.get(CACHE_KEY, ttl=CACHE_TTL)
        if cached is not None:
            logger.info("Cache HIT — retornando dados em cache")
            dashboard = cached
        else:
            logger.info("Cache MISS — buscando dados no Jira...")
            try:
                active_issues, done_issues, done_last_week = await _fetch_all()
            except Exception as exc:
                logger.error("Erro ao buscar dados no Jira: %s", exc, exc_info=True)
                raise HTTPException(status_code=502, detail="Erro ao comunicar com o Jira")
            dashboard = _build_and_cache(active_issues, done_issues, done_last_week)

    # Aplicar filtros em memória
    if account:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.account == account for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.account == account]
    if product:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.product == product for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.product == product]
    if assignee:
        dashboard.devs = [d for d in dashboard.devs if d.assignee and d.assignee.display_name == assignee]
        dashboard.backlog = [i for i in dashboard.backlog if i.assignee and i.assignee.display_name == assignee]
    if issue_type:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.issue_type.name == issue_type for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.issue_type.name == issue_type]

    logger.info(
        "Dashboard retornado: %d devs, %d issues ativas, %d concluídas na semana",
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
async def force_refresh(x_refresh_secret: str | None = Header(default=None)):
    """Requer header X-Refresh-Secret quando REFRESH_SECRET estiver configurado."""
    if REFRESH_SECRET and x_refresh_secret != REFRESH_SECRET:
        raise HTTPException(status_code=401, detail="Não autorizado")

    missing = _validate_env()
    if missing:
        raise HTTPException(status_code=503, detail="Serviço indisponível")

    # Invalidar todos os caches de dashboard
    cache.invalidate_pattern("dashboard_*")
    logger.info("Cache invalidado manualmente — buscando dados no Jira...")

    try:
        active_issues, done_issues, done_last_week = await _fetch_all()
    except Exception as exc:
        logger.error("Erro ao buscar dados no Jira: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com o Jira")

    dashboard = _build_and_cache(active_issues, done_issues, done_last_week)
    return {"status": "refreshed", "last_updated": dashboard.last_updated}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_all():
    """Dispara as três consultas ao Jira em paralelo."""
    import asyncio
    active_issues, done_issues, done_last_week = await asyncio.gather(
        fetch_active_issues(),
        fetch_done_this_week(),
        fetch_done_last_week(),
    )
    return active_issues, done_issues, done_last_week


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
