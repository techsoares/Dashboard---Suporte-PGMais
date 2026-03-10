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
import re
from datetime import datetime, timezone, date, timedelta

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from cache import cache
from jira_client import fetch_active_issues, fetch_done_this_week, fetch_done_last_week, build_dashboard, fetch_done_last_n_weeks, build_management_data
from models import DashboardResponse, KpiSummary, ManagementData
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

# CORS com suporte para GitHub Codespaces tunnels e origens extras via env
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

_origin_parts = [
    r"https?://localhost.*",
    r"https?://127\.0\.0\.1.*",
    r"https://.*\.app\.github\.dev.*",   # HTTPS apenas para tunnels externos
]
if _extra_origins:
    _origin_parts.extend(re.escape(o) for o in _extra_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=f"({'|'.join(_origin_parts)})",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Refresh-Secret"],
)

class AIChatRequest(BaseModel):
    question: str
    context: str = ""


def _strip_markdown(text: str) -> str:
    """Remove símbolos markdown da resposta da IA para garantir texto limpo."""
    # Remove bold/italic: **texto** → texto, *texto* → texto
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\*(.+?)\*',     r'\1', text, flags=re.DOTALL)
    # Remove headers: ## Título → Título
    text = re.sub(r'(?m)^#{1,6}\s+', '', text)
    # Remove marcadores de lista: "* item", "+ item", "- item" no início da linha
    text = re.sub(r'(?m)^\s*[\*\+\-]\s+', '', text)
    # Remove listas numeradas: "1. item" → "item"
    text = re.sub(r'(?m)^\s*\d+\.\s+', '', text)
    # Remove underlines: _texto_ → texto
    text = re.sub(r'_(.+?)_', r'\1', text)
    # Colapsa linhas em branco excessivas
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


CACHE_KEY    = "dashboard_data"
SNAPSHOT_KEY = "kpi_snapshot"       # snapshot diário para delta
CACHE_TTL    = 300                  # 5 minutos
SNAPSHOT_TTL = 86400                # 24 horas
MGMT_TTL     = 3600                 # 1 hora para dados históricos
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
async def debug_fields(issue_key: str | None = None, x_refresh_secret: str | None = Header(default=None)):
    """Retorna os fields brutos de uma issue real do Jira para identificar custom fields."""
    if REFRESH_SECRET and x_refresh_secret != REFRESH_SECRET:
        raise HTTPException(status_code=401, detail="Não autorizado")
    import httpx, base64

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

    # Aplicar filtros em memória (backlog + done_issues)
    if account:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.account == account for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.account == account]
        dashboard.done_issues = [i for i in dashboard.done_issues if i.account == account]
    if product:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.product == product for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.product == product]
        dashboard.done_issues = [i for i in dashboard.done_issues if i.product == product]
    if assignee:
        dashboard.devs = [d for d in dashboard.devs if d.assignee and d.assignee.display_name == assignee]
        dashboard.backlog = [i for i in dashboard.backlog if i.assignee and i.assignee.display_name == assignee]
        dashboard.done_issues = [i for i in dashboard.done_issues if i.assignee and i.assignee.display_name == assignee]
    if issue_type:
        dashboard.devs = [d for d in dashboard.devs if d.active_issues and any(i.issue_type.name == issue_type for i in d.active_issues)]
        dashboard.backlog = [i for i in dashboard.backlog if i.issue_type.name == issue_type]
        dashboard.done_issues = [i for i in dashboard.done_issues if i.issue_type.name == issue_type]

    logger.info(
        "Dashboard retornado: %d devs, %d issues ativas, %d concluídas na semana",
        len(dashboard.devs),
        len(dashboard.backlog),
        dashboard.kpis.done_this_week,
    )
    return dashboard


def _period_date_range(period: str) -> tuple[date, date | None, int]:
    """Retorna (from_date, to_date_exclusive, period_weeks) para cada período."""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())  # Segunda-feira
    if period == "today":
        return today, today + timedelta(days=1), 1
    elif period == "week":
        return start_of_week, None, 1
    elif period == "month":
        return today - timedelta(weeks=4), None, 4
    elif period == "quarter":
        return today - timedelta(weeks=13), None, 13
    elif period == "semester":
        return today - timedelta(weeks=26), None, 26
    else:
        return today - timedelta(weeks=4), None, 4


@app.get(
    "/api/management",
    response_model=ManagementData,
    tags=["dashboard"],
    summary="Dados históricos de entrega para visão gerencial (cache 1h)",
)
async def get_management(period: str = "month"):
    if period not in ("today", "week", "month", "quarter", "semester"):
        period = "month"

    cache_key = f"mgmt_{period}"
    cached: ManagementData | None = cache.get(cache_key, ttl=MGMT_TTL)
    if cached is not None:
        logger.info("Management cache HIT — período: %s", period)
        return cached

    missing = _validate_env()
    if missing:
        raise HTTPException(status_code=503, detail="Credenciais Jira não configuradas")

    from_date, to_date, period_weeks = _period_date_range(period)
    logger.info("Management cache MISS — período %s (%s → %s)...", period, from_date, to_date or "hoje")
    try:
        done_issues = await fetch_done_last_n_weeks(from_date, to_date)
    except Exception as exc:
        logger.error("Erro ao buscar histórico do Jira: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com o Jira")

    mgmt = build_management_data(done_issues, period_weeks)
    cache.set(cache_key, mgmt)
    logger.info("Management: %d issues em '%s', SLA %.1f%%", mgmt.total_done, period, mgmt.sla_rate)
    return mgmt


@app.post(
    "/api/ai/chat",
    tags=["ai"],
    summary="Consulta a IA com contexto do Jira (powered by OpenRouter / Claude Sonnet 4.6)",
)
async def ai_chat(body: AIChatRequest):
    """
    Envia uma pergunta à IA com contexto dos dados do dashboard.
    Requer OPENROUTER_API_KEY no .env.

    Body: { "question": "sua pergunta aqui", "context": "dados extras opcionais" }
    """
    import httpx

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Campo 'question' é obrigatório")

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTER_API_KEY não configurada. Adicione sua chave OpenRouter no arquivo .env para usar a IA.",
        )

    extra_context = body.context
    # Prompt framework: CO-STAR + Dual-Persona (CEO estratégico / Dev operacional)
    system_prompt = (
        # --- REGRA DE FORMATO — declarada primeiro para máxima precedência ---
        "REGRA ABSOLUTA DE SAÍDA: sua resposta deve ser SOMENTE texto corrido em parágrafos. "
        "É terminantemente proibido usar asterisco (*), dois-asteriscos (**), hashtag (#), underline (_), "
        "hífen como marcador de lista, número seguido de ponto como lista, colchete duplo, "
        "tag XML, bloco de código ou qualquer outro símbolo de formatação markdown. "
        "Escreva exatamente como um consultor falando em voz alta — frases completas, sem listas, "
        "sem negrito, sem títulos. Máximo 3 parágrafos densos. "
        "Se sua resposta contiver qualquer marcação especial, ela estará errada.\n\n"

        # --- CONTEXTO ---
        "CONTEXTO: Você é o analista de inteligência operacional do dashboard PGMais. "
        "Tem acesso em tempo real a todos os dados do Jira: jiras, responsáveis, prioridades, "
        "status, produtos, accounts, datas de vencimento e flags de atraso. "
        "Os dados completos do backlog estão no contexto desta conversa — use-os.\n\n"

        # --- VISÃO DE NEGÓCIO ---
        "SAÚDE DO BACKLOG: Backlog grande é sinal de risco operacional e falta de capacity. "
        "Sempre que avaliar o estado do time ou do projeto, considere o volume total de jiras como "
        "indicador de saúde — quanto maior o backlog, pior a situação para o negócio. "
        "Avalie distribuição por dev, sobrecarga individual e capacidade real de entrega do time.\n\n"

        # --- OBJETIVO: DETECÇÃO DE PERSONA ---
        "OBJETIVO: Identificar automaticamente o tipo de pergunta e responder de forma adequada.\n\n"

        "PERSONA CEO / GESTÃO — ative quando a pergunta for sobre: estado geral, saúde do backlog, "
        "performance do time, riscos, SLA, tendências, comparativos ou impacto para o negócio. "
        "Resposta CEO: Parágrafo 1 — o que está acontecendo agora com dados concretos "
        "(nomes, chaves, números). Parágrafo 2 — o maior risco identificado e por que é risco para "
        "o negócio. Parágrafo 3 — recomendação de ação imediata e quem deve executar.\n\n"

        "PERSONA DEV / OPERACIONAL — ative quando a pergunta for sobre: próximo jira, o que priorizar, "
        "fila de atendimento, o que trabalhar, minha fila, chamados pendentes. "
        "Resposta DEV: aplique o critério de triage — 1º jiras ATRASADOS com prioridade Highest ou High. "
        "2º jiras Highest ou High com vencimento próximo. "
        "3º jiras que bloqueiam outros. 4º jiras High em andamento. "
        "Cite [ON-xxx] e o motivo exato. Seja direto e crítico.\n\n"

        "IDIOMA: português brasileiro. Nunca use a palavra 'issue' — use sempre 'jira' ou 'chamado'. "
        "OBRIGATÓRIO citar nomes reais, chaves [ON-xxx] e números — nunca generalizar."
    )
    if extra_context:
        system_prompt += f"\n\nDADOS DO DASHBOARD:\n{extra_context}"

    headers = {
        "Authorization":  f"Bearer {api_key}",
        "Content-Type":   "application/json",
        "HTTP-Referer":   "https://pgmais-dashboard",
        "X-Title":        "PGMais Dashboard",
    }
    payload = {
        "model":      "anthropic/claude-sonnet-4.6",
        "max_tokens": 900,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": question},
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        try:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="OPENROUTER_API_KEY inválida")
            resp.raise_for_status()
            data = resp.json()
            answer = _strip_markdown(data["choices"][0]["message"]["content"])
            return {"answer": answer, "model": data.get("model", "")}
        except httpx.HTTPStatusError as e:
            logger.error("OpenRouter API HTTP error: %s — %s", e.response.status_code, e.response.text)
            raise HTTPException(status_code=502, detail=f"Erro na API OpenRouter: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error("OpenRouter API request error: %s", e)
            raise HTTPException(status_code=502, detail="Erro de conexão com a API OpenRouter")


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

    # Invalidar todos os caches (dashboard + management — período e legado)
    cache.invalidate_pattern("dashboard_*")
    cache.invalidate_pattern("mgmt_*")
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
