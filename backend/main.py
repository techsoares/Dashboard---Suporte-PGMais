"""
PGMais Team Dashboard — Backend
FastAPI proxy/cache para a API REST do Jira Cloud.

Endpoints:
  GET /api/health     → healthcheck
  GET /api/dashboard  → dados consolidados (cache 5min)
  POST /api/refresh   → invalida cache e força atualização
"""

import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, date, timedelta

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from cache import cache
from jira_client import fetch_active_issues, fetch_done_this_week, fetch_done_last_week, build_dashboard, fetch_done_last_n_weeks, build_management_data, fetch_all_jira_users
from models import DashboardResponse, KpiSummary, ManagementData
from mock_data import get_mock_dashboard, get_mock_management

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Refresh-Secret"],
)

class AIChatRequest(BaseModel):
    question: str
    context: str = ""


class BUCreate(BaseModel):
    name: str
    bu_type: str = "operacional"   # "operacional" | "gestao"

class BUUpdate(BaseModel):
    name: str
    members: list[str]
    bu_type: str = "operacional"

class AccountRankingUpdate(BaseModel):
    accounts: list[str]

class PriorityRequest(BaseModel):
    issue_key: str
    requester_name: str
    justification: str
    requester_bu: str = ""         # nome da BU do solicitante
    issue_summary: str = ""
    issue_type: str = ""
    account: str = ""


def _strip_markdown(text: str) -> str:
    """Limpa markdown pesado mas preserva bullet points e listas numeradas."""
    # Remove bold/italic: **texto** → texto, *texto* → texto
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'\*(.+?)\*',     r'\1', text, flags=re.DOTALL)
    # Remove headers: ## Título → Título
    text = re.sub(r'(?m)^#{1,6}\s+', '', text)
    # Remove underlines: _texto_ → texto
    text = re.sub(r'_(.+?)_', r'\1', text)
    # Remove blocos de código
    text = re.sub(r'```[\s\S]*?```', '', text)
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
# BU (Business Units) — storage em arquivo local
# ---------------------------------------------------------------------------

BUS_FILE = os.path.join(os.path.dirname(__file__), "bus.json")

def _load_bus() -> list[dict]:
    if os.path.exists(BUS_FILE):
        with open(BUS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def _save_bus(bus_list: list[dict]):
    with open(BUS_FILE, "w", encoding="utf-8") as f:
        json.dump(bus_list, f, ensure_ascii=False, indent=2)


@app.get("/api/jira/users", tags=["jira"], summary="Lista todos os usuários ativos do Jira")
async def list_jira_users():
    try:
        users = await fetch_all_jira_users()
        return users
    except Exception as e:
        logger.error("Erro ao buscar usuários do Jira: %s", e)
        raise HTTPException(status_code=502, detail="Não foi possível buscar usuários do Jira")


@app.get("/api/admin/bus", tags=["admin"], summary="Lista todas as BUs")
async def list_bus():
    return _load_bus()


@app.post("/api/admin/bus", tags=["admin"], status_code=201, summary="Cria nova BU")
async def create_bu(body: BUCreate):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nome da BU é obrigatório")
    bus = _load_bus()
    new_bu = {"id": str(uuid.uuid4()), "name": body.name.strip(), "members": [], "bu_type": body.bu_type}
    bus.append(new_bu)
    _save_bus(bus)
    return new_bu


@app.put("/api/admin/bus/{bu_id}", tags=["admin"], summary="Atualiza nome e membros de uma BU")
async def update_bu(bu_id: str, body: BUUpdate):
    bus = _load_bus()
    for i, b in enumerate(bus):
        if b["id"] == bu_id:
            bus[i] = {"id": bu_id, "name": body.name.strip(), "members": body.members, "bu_type": body.bu_type}
            _save_bus(bus)
            return bus[i]
    raise HTTPException(status_code=404, detail="BU não encontrada")


@app.delete("/api/admin/bus/{bu_id}", tags=["admin"], summary="Remove uma BU")
async def delete_bu(bu_id: str):
    bus = _load_bus()
    new_bus = [b for b in bus if b["id"] != bu_id]
    if len(new_bus) == len(bus):
        raise HTTPException(status_code=404, detail="BU não encontrada")
    _save_bus(new_bus)
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Account Ranking — ordenação manual de accounts por faturamento
# ---------------------------------------------------------------------------

RANKING_FILE = os.path.join(os.path.dirname(__file__), "account_ranking.json")

def _load_ranking() -> list[str]:
    if os.path.exists(RANKING_FILE):
        with open(RANKING_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def _save_ranking(ranking: list[str]):
    with open(RANKING_FILE, "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2)


@app.get("/api/admin/account-ranking", tags=["admin"], summary="Retorna ranking de accounts por faturamento")
async def get_account_ranking():
    return _load_ranking()


@app.put("/api/admin/account-ranking", tags=["admin"], summary="Atualiza ranking de accounts")
async def update_account_ranking(body: AccountRankingUpdate):
    _save_ranking(body.accounts)
    return {"status": "updated", "count": len(body.accounts)}


# ---------------------------------------------------------------------------
# Priority Requests — solicitações de prioridade com avaliação por IA
# ---------------------------------------------------------------------------

PRIORITY_FILE = os.path.join(os.path.dirname(__file__), "priority_requests.json")

def _load_priority_requests() -> list[dict]:
    if os.path.exists(PRIORITY_FILE):
        with open(PRIORITY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def _save_priority_requests(requests: list[dict]):
    with open(PRIORITY_FILE, "w", encoding="utf-8") as f:
        json.dump(requests, f, ensure_ascii=False, indent=2)


@app.get("/api/priority-requests", tags=["priority"], summary="Lista todas as solicitações de prioridade ativas")
async def get_priority_requests():
    return _load_priority_requests()


@app.post("/api/priority-requests", tags=["priority"], summary="Solicita prioridade para um chamado com avaliação por IA")
async def create_priority_request(body: PriorityRequest):
    """
    Recebe solicitação de prioridade, avalia com IA e atribui um boost ao score.
    Limita a 1 pedido por pessoa por issue.
    """
    import httpx
    from datetime import datetime

    requests = _load_priority_requests()

    # Check duplicate: same person + same issue
    for r in requests:
        if r["issue_key"] == body.issue_key and r["requester_name"].strip().lower() == body.requester_name.strip().lower():
            return {"error": "duplicate", "message": f"{body.requester_name} já solicitou prioridade para {body.issue_key}"}

    # Determine BU type of requester for boost multiplier
    bu_type = "operacional"
    if body.requester_bu:
        bus_list = _load_bus()
        for bu in bus_list:
            if bu["name"] == body.requester_bu:
                bu_type = bu.get("bu_type", "operacional")
                break

    # AI evaluation
    boost = 150  # default if AI fails
    ai_verdict = "Avaliação automática padrão."

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if api_key and body.justification.strip():
        prompt = (
            f"Você é um avaliador de urgência de chamados de suporte técnico. "
            f"Avalie a justificativa abaixo para priorizar um chamado e responda APENAS com um JSON: "
            f'{{"boost": <numero de 0 a 500>, "verdict": "<explicação curta em 1 frase>"}}\n\n'
            f"Critérios de avaliação:\n"
            f"- 400-500: Produção parada, perda financeira imediata, SLA crítico estourado\n"
            f"- 250-399: Impacto significativo em cliente grande, degradação grave\n"
            f"- 100-249: Impacto moderado, cliente insatisfeito mas operando\n"
            f"- 0-99: Baixa urgência, conveniência, sem impacto real\n\n"
            f"Chamado: {body.issue_key}\n"
            f"Título: {body.issue_summary}\n"
            f"Tipo: {body.issue_type}\n"
            f"Account: {body.account}\n"
            f"BU do solicitante: {body.requester_bu} (tipo: {bu_type})\n"
            f"Justificativa do solicitante: {body.justification}"
        )

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://pgmais-dashboard",
            "X-Title": "PGMais Dashboard",
        }
        payload = {
            "model": "anthropic/claude-sonnet-4.6",
            "max_tokens": 300,
            "messages": [
                {"role": "user", "content": prompt},
            ],
        }

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    json=payload,
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                answer = data["choices"][0]["message"]["content"]
                # Parse JSON from response
                import re
                json_match = re.search(r'\{[^}]+\}', answer)
                if json_match:
                    parsed = json.loads(json_match.group())
                    boost = max(0, min(500, int(parsed.get("boost", 150))))
                    ai_verdict = parsed.get("verdict", ai_verdict)
        except Exception as e:
            logger.warning("AI priority evaluation failed: %s", e)

    # Multiplicador por tipo de BU: gestão tem 1.5x de impacto
    if bu_type == "gestao":
        boost = min(750, int(boost * 1.5))

    request_entry = {
        "id": str(uuid.uuid4()),
        "issue_key": body.issue_key,
        "requester_name": body.requester_name.strip(),
        "justification": body.justification.strip(),
        "requester_bu": body.requester_bu,
        "bu_type": bu_type,
        "boost": boost,
        "ai_verdict": ai_verdict,
        "created_at": datetime.now().isoformat(),
    }

    requests.append(request_entry)
    _save_priority_requests(requests)

    return request_entry


@app.delete("/api/priority-requests/{request_id}", tags=["priority"], summary="Remove uma solicitação de prioridade")
async def delete_priority_request(request_id: str):
    requests = _load_priority_requests()
    requests = [r for r in requests if r["id"] != request_id]
    _save_priority_requests(requests)
    return {"status": "deleted"}


class DeprioritizeRequest(BaseModel):
    issue_key: str
    requester_name: str
    requester_bu: str


@app.post("/api/priority-requests/deprioritize", tags=["priority"], summary="Desprioriza um chamado (apenas BU gestão)")
async def deprioritize_issue(body: DeprioritizeRequest):
    """Remove todas as solicitações de prioridade de um chamado. Apenas BUs de tipo gestão podem fazer isso."""
    bus_list = _load_bus()
    bu_type = "operacional"
    for bu in bus_list:
        if bu["name"] == body.requester_bu:
            bu_type = bu.get("bu_type", "operacional")
            break

    if bu_type != "gestao":
        raise HTTPException(status_code=403, detail="Apenas BUs de gestão (Diretoria / C-Level) podem despriorizar chamados.")

    requests = _load_priority_requests()
    before = len(requests)
    requests = [r for r in requests if r["issue_key"] != body.issue_key]
    removed = before - len(requests)
    _save_priority_requests(requests)
    return {"status": "deprioritized", "issue_key": body.issue_key, "removed": removed}


@app.post(
    "/api/ai/classify-production",
    tags=["ai"],
    summary="Classifica quais issues afetam produção do cliente via IA",
)
async def classify_production(body: dict):
    """Recebe lista de issues e retorna quais afetam produção."""
    import httpx

    issues = body.get("issues", [])
    if not issues:
        return {"production_affected": []}

    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        # Sem IA, retorna vazio (graceful degradation)
        return {"production_affected": []}

    # Build issue summaries for classification
    lines = []
    for i in issues:
        lines.append(f"[{i['key']}] {i['summary']} (Tipo: {i.get('type', '-')}, Status: {i.get('status', '-')})")

    prompt = (
        "Analise a lista de chamados Jira abaixo. Para cada um, determine se está ATUALMENTE "
        "afetando a produção diária do cliente (sistema fora do ar, falha em envio de mensagens, "
        "erro em plataforma que impede operação, degradação de serviço ativo, etc).\n\n"
        "Retorne APENAS uma lista com as chaves dos chamados que afetam produção, uma por linha. "
        "Se nenhum afetar produção, responda 'NENHUM'. Sem explicações extras.\n\n"
        "Chamados:\n" + "\n".join(lines)
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://pgmais-dashboard",
        "X-Title": "PGMais Dashboard",
    }
    payload = {
        "model": "anthropic/claude-sonnet-4.6",
        "max_tokens": 500,
        "messages": [
            {"role": "system", "content": "Você é um analista de operações de TI. Classifique chamados que afetam produção do cliente."},
            {"role": "user", "content": prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            answer = data["choices"][0]["message"]["content"].strip()

            if "NENHUM" in answer.upper():
                return {"production_affected": []}

            # Extract issue keys from response
            import re as _re
            keys = _re.findall(r'[A-Z][A-Z0-9]+-\d+', answer)
            return {"production_affected": keys}
    except Exception as exc:
        logger.error("AI classify-production error: %s", exc)
        return {"production_affected": []}


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


_JIRA_KEY_RE = re.compile(r'^[A-Z][A-Z0-9]{0,9}-\d{1,6}$')

@app.get("/api/debug/fields", tags=["infra"], summary="Mostra fields brutos de uma issue para diagnóstico")
async def debug_fields(issue_key: str | None = None, x_refresh_secret: str | None = Header(default=None)):
    """Retorna os fields brutos de uma issue real do Jira para identificar custom fields.

    Requer X-Refresh-Secret. Quando REFRESH_SECRET não está configurado o endpoint
    permanece bloqueado para evitar expor dados do Jira sem autenticação.
    """
    # Sempre exige autenticação — sem secret configurada o endpoint fica fechado
    if not REFRESH_SECRET:
        raise HTTPException(
            status_code=403,
            detail="Endpoint de diagnóstico desativado. Configure REFRESH_SECRET no .env para habilitá-lo.",
        )
    if x_refresh_secret != REFRESH_SECRET:
        raise HTTPException(status_code=401, detail="Não autorizado")

    # Valida formato do issue_key para evitar path traversal e injeção de URL
    if issue_key is not None:
        if not _JIRA_KEY_RE.match(issue_key):
            raise HTTPException(status_code=400, detail="issue_key inválido — use o formato PROJ-123")

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
    """Retorna (from_date, to_date_exclusive, period_weeks) para cada período.

    O from_date é alinhado ao início do primeiro bucket semanal gerado por
    build_management_data (start_of_week - (period_weeks-1) semanas), garantindo
    que todas as issues buscadas caiam dentro de algum bucket e apareçam no drill.
    """
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())  # Segunda-feira
    if period == "today":
        return today, today + timedelta(days=1), 1
    elif period == "week":
        return start_of_week, None, 1
    elif period == "month":
        return start_of_week - timedelta(weeks=3), None, 4
    elif period == "quarter":
        return start_of_week - timedelta(weeks=12), None, 13
    elif period == "semester":
        return start_of_week - timedelta(weeks=25), None, 26
    else:
        return start_of_week - timedelta(weeks=3), None, 4


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
        logger.info("Credenciais Jira ausentes — usando dados mock de gestão para desenvolvimento")
        _, _, period_weeks = _period_date_range(period)
        return get_mock_management(period_weeks)

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
        # --- REGRA DE FORMATO ---
        "REGRA DE SAÍDA: use uma mistura natural de texto corrido e listas com bullet points (- item). "
        "Bullet points são permitidos e recomendados para listar jiras, responsáveis, números e ações. "
        "Parágrafos de texto corrido servem para análise, contexto e conclusões. "
        "NÃO use asteriscos para negrito (**), hashtags (#) para títulos, underline (_), "
        "blocos de código ou tags XML. Sem limite de tamanho — responda de forma completa e detalhada. "
        "Seja tão extenso quanto o necessário para cobrir todos os pontos relevantes.\n\n"

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
        "max_tokens": 4096,
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
