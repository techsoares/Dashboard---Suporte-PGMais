"""
Jira Cloud REST API v3 client.
Autenticação: Basic Auth (email + API token).
Todos os métodos são assíncronos (httpx.AsyncClient).
"""

import os
import base64
import logging
from datetime import datetime, timezone, date
from typing import Any, Optional
from collections import defaultdict

import httpx
from dotenv import load_dotenv

from models import (
    Assignee, IssueType, Status, Priority, Component,
    Issue, TimeInStatus, DevSummary, KpiSummary, KpiDelta, DashboardResponse,
    WeekSummary, DevDelivery, DevWeekSummary, ProductDelivery, TypeBreakdown, ManagementData,
    _ms_to_hms,
)

load_dotenv()

logger = logging.getLogger(__name__)

JIRA_BASE_URL: str = os.getenv("JIRA_BASE_URL", "https://pgmais.atlassian.net")
JIRA_EMAIL: str = os.getenv("JIRA_EMAIL", "")
JIRA_TOKEN: str = os.getenv("JIRA_TOKEN", "")
JIRA_PROJECT: str = os.getenv("JIRA_PROJECT", "ON")


def _get_jira_config() -> tuple[str, str, str, str]:
    """Lê configuração do Jira em runtime para suportar reload sem reiniciar."""
    return (
        os.getenv("JIRA_BASE_URL", JIRA_BASE_URL),
        os.getenv("JIRA_EMAIL", JIRA_EMAIL),
        os.getenv("JIRA_TOKEN", JIRA_TOKEN),
        os.getenv("JIRA_PROJECT", JIRA_PROJECT),
    )


API_BASE = f"{JIRA_BASE_URL}/rest/api/3"
SEARCH_URL = f"{API_BASE}/search/jql"

# --- Auth header ----------------------------------------------------------

def _auth_header() -> dict[str, str]:
    email = os.getenv("JIRA_EMAIL", JIRA_EMAIL)
    token = os.getenv("JIRA_TOKEN", JIRA_TOKEN)
    raw = f"{email}:{token}"
    encoded = base64.b64encode(raw.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


# --- Status category helpers ----------------------------------------------

_BACKLOG_CATEGORIES = {"new"}          # To Do / Refinamento / Backlog
_WAITING_KEYWORDS = {"aguard", "wait", "blocked", "bloqueado", "waiting"}
_PROGRESS_CATEGORY = {"indeterminate"} # Em andamento


def _classify_status(status_name: str, category_key: str) -> str:
    """Retorna 'backlog' | 'waiting' | 'in_progress' | 'done'."""
    lower = status_name.lower()
    if any(k in lower for k in _WAITING_KEYWORDS):
        return "waiting"
    if category_key in _BACKLOG_CATEGORIES:
        return "backlog"
    if category_key in _PROGRESS_CATEGORY:
        return "in_progress"
    if category_key == "done":
        return "done"
    return "backlog"


# --- Changelog parser -----------------------------------------------------

def _calculate_time_in_status(changelog_histories: list[dict]) -> TimeInStatus:
    """
    Itera o changelog do Jira e calcula o tempo total gasto em cada
    grupo de status: backlog | waiting | in_progress.

    Estratégia:
      - Ordena os históricos por created (ASC).
      - Para cada transição de status, calcula o delta de tempo entre
        este evento e o próximo.
      - O último status ainda está ativo → usa datetime.now(UTC) como fim.
    """
    # Filtrar apenas itens que mudaram o campo "status"
    transitions: list[tuple[datetime, str, str]] = []  # (when, status_name, category_key)

    for history in changelog_histories:
        when_str: str = history.get("created", "")
        try:
            when = datetime.fromisoformat(when_str.replace("Z", "+00:00"))
        except ValueError:
            continue

        for item in history.get("items", []):
            if item.get("field") == "status":
                to_str: str = item.get("toString", "")
                # O Jira não retorna a categoria diretamente no changelog;
                # usamos heurística pelo nome.
                transitions.append((when, to_str, ""))

    if not transitions:
        return TimeInStatus()

    transitions.sort(key=lambda x: x[0])
    now = datetime.now(timezone.utc)

    backlog_ms = waiting_ms = in_progress_ms = 0

    for i, (when, status_name, _) in enumerate(transitions):
        end = transitions[i + 1][0] if i + 1 < len(transitions) else now
        delta_ms = int((end - when).total_seconds() * 1000)
        if delta_ms < 0:
            continue

        group = _classify_status_by_name(status_name)
        if group == "backlog":
            backlog_ms += delta_ms
        elif group == "waiting":
            waiting_ms += delta_ms
        elif group == "in_progress":
            in_progress_ms += delta_ms

    return TimeInStatus(
        backlog_ms=backlog_ms,
        waiting_ms=waiting_ms,
        in_progress_ms=in_progress_ms,
    )


_DONE_KEYWORDS = {"done", "concluído", "concluída", "concluido", "concluida", "fechado", "closed", "resolved", "resolvido", "resolvida", "cancelado", "cancelled", "canceled"}

def _classify_status_by_name(name: str) -> str:
    lower = name.lower()
    if any(k in lower for k in _WAITING_KEYWORDS):
        return "waiting"
    if any(k in lower for k in {"em andamento", "in progress", "doing", "dev", "desenvolvimento", "análise", "analise"}):
        return "in_progress"
    if any(k in lower for k in _DONE_KEYWORDS):
        return "done"
    return "backlog"


# --- Field parsers --------------------------------------------------------

def _parse_assignee(raw: Optional[dict]) -> Optional[Assignee]:
    if not raw:
        return None
    return Assignee(
        account_id=raw.get("accountId", ""),
        display_name=raw.get("displayName", "Não atribuído"),
        avatar_url=(raw.get("avatarUrls") or {}).get("48x48"),
    )


def _parse_issue_type(raw: Optional[dict]) -> IssueType:
    if not raw:
        return IssueType(id="", name="Tarefa")
    return IssueType(
        id=raw.get("id", ""),
        name=raw.get("name", "Tarefa"),
        icon_url=raw.get("iconUrl"),
    )


def _parse_status(raw: Optional[dict]) -> Status:
    if not raw:
        return Status(id="", name="Desconhecido", category="new", category_name="A fazer")
    cat = raw.get("statusCategory") or {}
    return Status(
        id=raw.get("id", ""),
        name=raw.get("name", ""),
        category=cat.get("key", "new"),
        category_name=cat.get("name", "A fazer"),
    )


def _parse_priority(raw: Optional[dict]) -> Optional[Priority]:
    if not raw:
        return None
    return Priority(
        id=raw.get("id", ""),
        name=raw.get("name", "Medium"),
        icon_url=raw.get("iconUrl"),
    )


def _parse_components(raw: list[dict]) -> list[Component]:
    return [Component(id=c.get("id", ""), name=c.get("name", "")) for c in raw]


def _is_overdue(due_date_str: Optional[str]) -> bool:
    if not due_date_str:
        return False
    try:
        due = date.fromisoformat(due_date_str)
        return due < date.today()
    except ValueError:
        return False


def _parse_activity_type(raw: Any) -> Optional[str]:
    """customfield_10460 pode ser string ou dict com 'value'."""
    if raw is None:
        return None
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        return raw.get("value") or raw.get("name")
    return str(raw)


def _build_issue(fields: dict, key: str, changelog_histories: list[dict]) -> Issue:
    assignee = _parse_assignee(fields.get("assignee"))
    status = _parse_status(fields.get("status"))
    due_date: Optional[str] = fields.get("duedate")

    # Start date: customfield_10015 pode ser string ISO ou None
    start_date_raw = fields.get("customfield_10015")
    start_date: Optional[str] = start_date_raw if isinstance(start_date_raw, str) else None

    time_in_status = _calculate_time_in_status(changelog_histories)

    # Account: customfield_10113 → dict com chave "value"
    account_raw = fields.get("customfield_10113")
    account: Optional[str] = account_raw.get("value") if isinstance(account_raw, dict) else (account_raw if isinstance(account_raw, str) else None)

    # Product: primeiro component ou None
    components = _parse_components(fields.get("components") or [])
    product: Optional[str] = components[0].name if components else None
    logger.debug("Issue %s | components raw: %r → product: %r", key, fields.get("components"), product)

    # resolved_date: prefere statuscategorychangedate para consistência com a query JQL
    # (que filtra por statusCategoryChangedDate). resolutiondate pode ser muito mais antiga
    # e causaria issues fora de qualquer bucket semanal no build_management_data.
    resolved_date_raw = fields.get("statuscategorychangedate") or fields.get("resolutiondate")
    resolved_date: Optional[str] = resolved_date_raw if isinstance(resolved_date_raw, str) else None

    base_url, _, _, _ = _get_jira_config()
    return Issue(
        key=key,
        summary=fields.get("summary", ""),
        issue_type=_parse_issue_type(fields.get("issuetype")),
        status=status,
        priority=_parse_priority(fields.get("priority")),
        assignee=assignee,
        components=components,
        activity_type=_parse_activity_type(fields.get("customfield_10460")),
        start_date=start_date,
        due_date=due_date,
        created=fields.get("created"),
        resolved_date=resolved_date,
        time_in_status=time_in_status,
        is_overdue=_is_overdue(due_date),
        jira_url=f"{base_url}/browse/{key}",
        account=account,
        product=product,
    )


# --- HTTP helpers ---------------------------------------------------------

async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict:
    resp = await client.get(url, params=params or {}, headers=_auth_header(), timeout=30)
    resp.raise_for_status()
    return resp.json()


async def _fetch_changelog(client: httpx.AsyncClient, key: str) -> list[dict]:
    """Busca o changelog de uma issue. Pagina até esgotar."""
    base_url, _, _, _ = _get_jira_config()
    api_base = f"{base_url}/rest/api/3"
    histories: list[dict] = []
    start_at = 0
    while True:
        data = await _get(
            client,
            f"{api_base}/issue/{key}/changelog",
            params={"startAt": start_at, "maxResults": 100},
        )
        values: list[dict] = data.get("values", [])
        histories.extend(values)
        if data.get("isLast", True) or not values:
            break
        start_at += len(values)
    return histories


# --- Public API -----------------------------------------------------------

FIELDS = (
    "summary,status,assignee,priority,components,"
    "customfield_10460,customfield_10015,customfield_10113,duedate,issuetype,created,"
    "resolutiondate,statuscategorychangedate"
)


async def fetch_active_issues() -> list[Issue]:
    """
    Busca issues In Progress + To Do da sprint atual + Backlog do projeto.
    Exclui sub-tarefas. Busca o changelog de cada issue separadamente
    (expand=changelog foi descontinuado no /search do Jira Cloud).
    """
    import asyncio

    base_url, _, _, project = _get_jira_config()
    search_url = f"{base_url}/rest/api/3/search/jql"

    jql = (
        f'statusCategory IN ("In Progress", "New") '
        f'AND issuetype NOT IN subTaskIssueTypes() '
        f'AND project = "{project}" '
        f'ORDER BY assignee, status DESC'
    )
    raw_all: list[dict] = []

    async with httpx.AsyncClient() as client:
        next_page_token: str | None = None

        # 1. Busca as issues (sem changelog) — usa nextPageToken (novo /search/jql)
        while True:
            params: dict = {"jql": jql, "maxResults": 100, "fields": FIELDS}
            if next_page_token:
                params["nextPageToken"] = next_page_token

            data = await _get(client, search_url, params=params)
            raw_issues: list[dict] = data.get("issues", [])
            raw_all.extend(raw_issues)

            next_page_token = data.get("nextPageToken")
            if not next_page_token or not raw_issues:
                break

        # 2. Busca changelogs em paralelo — falhas individuais não derrubam o endpoint
        results = await asyncio.gather(
            *[_fetch_changelog(client, raw.get("key", "")) for raw in raw_all],
            return_exceptions=True,
        )

    cl_errors = sum(1 for r in results if isinstance(r, Exception))
    if cl_errors:
        logger.warning("fetch_active_issues: %d/%d changelogs falharam", cl_errors, len(raw_all))

    # 3. Constrói as issues com o changelog correspondente
    issues: list[Issue] = []
    for raw, result in zip(raw_all, results):
        key: str = raw.get("key", "")
        fields: dict = raw.get("fields", {})
        histories: list[dict] = result if not isinstance(result, Exception) else []
        issues.append(_build_issue(fields, key, histories))

    return issues


async def fetch_done_this_week() -> list[Issue]:
    """Issues concluídas desde o início da semana atual."""
    base_url, _, _, project = _get_jira_config()
    search_url = f"{base_url}/rest/api/3/search/jql"

    jql = (
        f'statusCategory = Done '
        f'AND statusCategoryChangedDate >= startOfWeek() '
        f'AND project = "{project}"'
    )
    issues: list[Issue] = []

    async with httpx.AsyncClient() as client:
        next_page_token: str | None = None

        while True:
            params: dict = {"jql": jql, "maxResults": 100, "fields": FIELDS}
            if next_page_token:
                params["nextPageToken"] = next_page_token

            data = await _get(client, search_url, params=params)
            raw_issues: list[dict] = data.get("issues", [])
            for raw in raw_issues:
                key: str = raw.get("key", "")
                fields: dict = raw.get("fields", {})
                issues.append(_build_issue(fields, key, []))

            next_page_token = data.get("nextPageToken")
            if not next_page_token or not raw_issues:
                break

    return issues


async def fetch_done_last_week() -> list[Issue]:
    """Issues concluídas na semana anterior (para comparação de delta)."""
    base_url, _, _, project = _get_jira_config()
    search_url = f"{base_url}/rest/api/3/search/jql"

    jql = (
        f'statusCategory = Done '
        f'AND statusCategoryChangedDate >= startOfWeek("-1w") '
        f'AND statusCategoryChangedDate < startOfWeek() '
        f'AND project = "{project}"'
    )
    issues: list[Issue] = []

    async with httpx.AsyncClient() as client:
        next_page_token: str | None = None

        while True:
            params: dict = {"jql": jql, "maxResults": 100, "fields": FIELDS}
            if next_page_token:
                params["nextPageToken"] = next_page_token

            data = await _get(client, search_url, params=params)
            raw_issues: list[dict] = data.get("issues", [])
            for raw in raw_issues:
                key: str = raw.get("key", "")
                fields: dict = raw.get("fields", {})
                issues.append(_build_issue(fields, key, []))

            next_page_token = data.get("nextPageToken")
            if not next_page_token or not raw_issues:
                break

    return issues


# --- Dashboard consolidation ----------------------------------------------

_PRIORITY_ORDER = {
    "highest": 0, "blocker": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "lowest": 4,
}

_TYPE_ORDER = {
    "problema": 0, "bug": 0,
    "melhoria": 1, "improvement": 1,
    "tarefa": 2, "task": 2,
    "história": 3, "story": 3,
    "epic": 4,
}


def _sort_key(issue: Issue) -> tuple:
    type_order = _TYPE_ORDER.get(issue.issue_type.name.lower(), 5)
    overdue = 0 if issue.is_overdue else 1
    due = issue.due_date or "9999-99-99"
    prio = _PRIORITY_ORDER.get((issue.priority.name.lower() if issue.priority else ""), 2)
    return (overdue, type_order, due, prio)


_STALE_MS = 30 * 24 * 3600 * 1000  # 30 dias em ms


def build_dashboard(
    active_issues: list[Issue],
    done_issues: list[Issue],
    done_issues_historical: list[Issue] = None,
    done_last_week_count: int = 0,
    prev_kpis: KpiSummary | None = None,
) -> DashboardResponse:
    # Agrupar por dev
    dev_map: dict[str, DevSummary] = {}

    for issue in active_issues:
        if issue.assignee:
            aid = issue.assignee.account_id
            if aid not in dev_map:
                dev_map[aid] = DevSummary(assignee=issue.assignee)
            dev_map[aid].active_issues.append(issue)

    # Atualizar contadores
    for dev in dev_map.values():
        dev.issue_count = len(dev.active_issues)
        dev.active_issues.sort(key=_sort_key)

    # Backlog geral: todas as issues ativas, ordenadas por prioridade
    backlog = sorted(active_issues, key=_sort_key)

    # Issues paralisadas: > 30 dias em progresso
    stale_issues = [
        i for i in active_issues
        if i.time_in_status.in_progress_ms >= _STALE_MS
    ]

    # KPIs
    in_progress_count = sum(
        1 for i in active_issues if i.status.category == "indeterminate"
    )
    waiting_count = sum(
        1 for i in active_issues
        if any(k in i.status.name.lower() for k in _WAITING_KEYWORDS)
    )
    overdue_count = sum(1 for i in active_issues if i.is_overdue)

    kpis = KpiSummary(
        total_sprint=len(active_issues),
        in_progress=in_progress_count,
        waiting=waiting_count,
        done_this_week=len(done_issues),
        overdue=overdue_count,
    )

    # Delta: compara com snapshot de 24h (exceto done: semana anterior)
    if prev_kpis is not None:
        delta = KpiDelta(
            total_sprint=kpis.total_sprint - prev_kpis.total_sprint,
            in_progress=kpis.in_progress - prev_kpis.in_progress,
            waiting=kpis.waiting - prev_kpis.waiting,
            done_vs_last_week=kpis.done_this_week - done_last_week_count,
            overdue=kpis.overdue - prev_kpis.overdue,
        )
    else:
        delta = KpiDelta(done_vs_last_week=kpis.done_this_week - done_last_week_count)

    return DashboardResponse(
        devs=list(dev_map.values()),
        backlog=backlog,
        done_issues=done_issues,
        done_issues_historical=done_issues_historical or [],
        stale_issues=stale_issues,
        kpis=kpis,
        kpi_delta=delta,
        last_updated=datetime.now(timezone.utc).isoformat(),
        jira_base_url=JIRA_BASE_URL,
    )


# ---------------------------------------------------------------------------
# Management / Historical data
# ---------------------------------------------------------------------------

async def fetch_done_last_n_weeks(from_date: date, to_date: date | None = None) -> list[Issue]:
    """Busca todas as issues concluídas no período [from_date, to_date), com changelog.

    Changelogs são buscados em paralelo (semáforo=6 para evitar throttle do Jira).
    Falhas individuais de changelog são toleradas — a issue é incluída com
    time_in_status zerado em vez de derrubar todo o endpoint.
    """
    import asyncio

    base_url, _, _, project = _get_jira_config()
    search_url = f"{base_url}/rest/api/3/search/jql"

    jql_date = f'statusCategoryChangedDate >= "{from_date.isoformat()}"'
    if to_date:
        jql_date += f' AND statusCategoryChangedDate < "{to_date.isoformat()}"'

    jql = (
        f'statusCategory = Done '
        f'AND {jql_date} '
        f'AND project = "{project}" '
        f'ORDER BY statusCategoryChangedDate DESC'
    )
    raw_all: list[dict] = []

    # Semáforo conservador (6) para não ultrapassar o rate-limit do Jira Cloud
    semaphore = asyncio.Semaphore(6)

    async def fetch_cl_limited(client: httpx.AsyncClient, key: str) -> list[dict]:
        async with semaphore:
            return await _fetch_changelog(client, key)

    async with httpx.AsyncClient() as client:
        next_page_token: str | None = None
        while True:
            params: dict = {"jql": jql, "maxResults": 100, "fields": FIELDS}
            if next_page_token:
                params["nextPageToken"] = next_page_token
            data = await _get(client, search_url, params=params)
            raw_issues: list[dict] = data.get("issues", [])
            raw_all.extend(raw_issues)
            next_page_token = data.get("nextPageToken")
            if not next_page_token or not raw_issues:
                break

        logger.info("fetch_done_last_n_weeks: %d issues encontradas, buscando changelogs...", len(raw_all))

        # return_exceptions=True garante que uma falha de changelog não derruba tudo
        results = await asyncio.gather(
            *[fetch_cl_limited(client, raw.get("key", "")) for raw in raw_all],
            return_exceptions=True,
        )

    cl_errors = sum(1 for r in results if isinstance(r, Exception))
    if cl_errors:
        logger.warning(
            "fetch_done_last_n_weeks: %d/%d changelogs falharam (rate limit ou erro) — "
            "time_in_status zerado para essas issues",
            cl_errors, len(raw_all),
        )

    issues: list[Issue] = []
    for raw, result in zip(raw_all, results):
        key: str = raw.get("key", "")
        fields: dict = raw.get("fields", {})
        histories: list[dict] = result if not isinstance(result, Exception) else []
        issues.append(_build_issue(fields, key, histories))

    logger.info("fetch_done_last_n_weeks: %d issues montadas (%d sem changelog)", len(issues), cl_errors)
    return issues


def _was_on_time(issue: Issue) -> bool:
    """Retorna True se a issue foi concluída dentro do prazo."""
    if not issue.due_date:
        return True  # sem prazo definido = sem violação
    try:
        due = date.fromisoformat(issue.due_date)
        if issue.resolved_date:
            resolved = date.fromisoformat(issue.resolved_date[:10])
            return resolved <= due
        return True
    except (ValueError, TypeError):
        return True


def _cycle_days(issue: Issue) -> float | None:
    """Dias entre criação e resolução."""
    if not issue.created or not issue.resolved_date:
        return None
    try:
        created = datetime.fromisoformat(issue.created.replace("Z", "+00:00"))
        resolved = datetime.fromisoformat(issue.resolved_date.replace("Z", "+00:00"))
        return max(0.0, (resolved - created).total_seconds() / 86400)
    except (ValueError, TypeError):
        return None


def build_management_data(done_issues: list[Issue], period_weeks: int) -> ManagementData:
    """Consolida issues concluídas em métricas de gestão por período."""
    from datetime import timedelta

    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())

    # Semanas do mais antigo ao mais recente
    weeks: list[WeekSummary] = []
    for i in range(period_weeks - 1, -1, -1):
        w_start = start_of_week - timedelta(weeks=i)
        w_end   = w_start + timedelta(days=7)
        label   = w_start.strftime("%d/%b")

        w_issues = [
            iss for iss in done_issues
            if iss.resolved_date
            and w_start <= date.fromisoformat(iss.resolved_date[:10]) < w_end
        ]

        on_time  = sum(1 for i in w_issues if _was_on_time(i))
        cycles   = [c for iss in w_issues if (c := _cycle_days(iss)) is not None]
        avg_cycle = round(sum(cycles) / len(cycles), 1) if cycles else 0.0

        weeks.append(WeekSummary(
            week_label=label,
            week_start=w_start.isoformat(),
            done_count=len(w_issues),
            on_time=on_time,
            late=len(w_issues) - on_time,
            avg_cycle_days=avg_cycle,
        ))

    def _ms_to_days(ms: int) -> float:
        return round(ms / (1000 * 3600 * 24), 1)

    # Por dev
    dev_map: dict[str, dict] = {}
    for iss in done_issues:
        name = iss.assignee.display_name if iss.assignee else "Não atribuído"
        if name not in dev_map:
            dev_map[name] = {
                "done": 0, "on_time": 0, "cycles": [],
                "backlog_ms": [], "waiting_ms": [], "progress_ms": [],
            }
        dev_map[name]["done"] += 1
        if _was_on_time(iss):
            dev_map[name]["on_time"] += 1
        c = _cycle_days(iss)
        if c is not None:
            dev_map[name]["cycles"].append(c)
        t = iss.time_in_status
        if t.backlog_ms > 0:
            dev_map[name]["backlog_ms"].append(t.backlog_ms)
        if t.waiting_ms > 0:
            dev_map[name]["waiting_ms"].append(t.waiting_ms)
        if t.in_progress_ms > 0:
            dev_map[name]["progress_ms"].append(t.in_progress_ms)

    def _avg_days(lst: list[int]) -> float:
        return _ms_to_days(int(sum(lst) / len(lst))) if lst else 0.0

    by_dev = sorted([
        DevDelivery(
            name=name,
            done_count=v["done"],
            on_time=v["on_time"],
            avg_cycle_days=round(sum(v["cycles"]) / len(v["cycles"]), 1) if v["cycles"] else 0.0,
            avg_backlog_days=_avg_days(v["backlog_ms"]),
            avg_waiting_days=_avg_days(v["waiting_ms"]),
            avg_in_progress_days=_avg_days(v["progress_ms"]),
        )
        for name, v in dev_map.items()
        if name != "Não atribuído"
    ], key=lambda x: -x.done_count)

    # Por dev por semana (para gráfico de linhas)
    week_starts_list = [date.fromisoformat(w.week_start) for w in weeks]
    dev_week_raw: dict[str, list[int]] = {}
    for iss in done_issues:
        if not iss.resolved_date or not iss.assignee:
            continue
        name = iss.assignee.display_name
        if name == "Não atribuído":
            continue
        resolved = date.fromisoformat(iss.resolved_date[:10])
        for idx, w_start in enumerate(week_starts_list):
            if w_start <= resolved < w_start + timedelta(days=7):
                if name not in dev_week_raw:
                    dev_week_raw[name] = [0] * period_weeks
                dev_week_raw[name][idx] += 1
                break

    # Mantém a mesma ordem de by_dev para consistência de cores
    by_dev_weekly = [
        DevWeekSummary(name=d.name, weekly_counts=dev_week_raw.get(d.name, [0] * period_weeks))
        for d in by_dev
    ]

    # Por produto
    prod_map: dict[str, dict] = {}
    for iss in done_issues:
        prod = iss.product or "Sem produto"
        if prod not in prod_map:
            prod_map[prod] = {"done": 0, "on_time": 0}
        prod_map[prod]["done"] += 1
        if _was_on_time(iss):
            prod_map[prod]["on_time"] += 1

    by_product = sorted([
        ProductDelivery(product=p, done_count=v["done"], on_time=v["on_time"])
        for p, v in prod_map.items()
    ], key=lambda x: -x.done_count)

    # Por tipo de issue
    type_map: dict[str, dict] = {}
    for iss in done_issues:
        tname = iss.issue_type.name or "Tarefa"
        if tname not in type_map:
            type_map[tname] = {"count": 0, "on_time": 0}
        type_map[tname]["count"] += 1
        if _was_on_time(iss):
            type_map[tname]["on_time"] += 1

    by_type = sorted([
        TypeBreakdown(type_name=t, count=v["count"], on_time=v["on_time"])
        for t, v in type_map.items()
    ], key=lambda x: -x.count)

    # Totais e médias do time
    total = len(done_issues)
    on_time_total = sum(1 for i in done_issues if _was_on_time(i))
    all_cycles = [c for iss in done_issues if (c := _cycle_days(iss)) is not None]

    all_backlog_ms = [iss.time_in_status.backlog_ms for iss in done_issues if iss.time_in_status.backlog_ms > 0]
    all_waiting_ms = [iss.time_in_status.waiting_ms for iss in done_issues if iss.time_in_status.waiting_ms > 0]
    all_progress_ms = [iss.time_in_status.in_progress_ms for iss in done_issues if iss.time_in_status.in_progress_ms > 0]

    # Ordena por data de resolução desc para drill-down
    done_sorted = sorted(
        done_issues,
        key=lambda i: i.resolved_date or "",
        reverse=True,
    )

    return ManagementData(
        weeks=weeks,
        by_dev=by_dev,
        by_dev_weekly=by_dev_weekly,
        by_product=by_product,
        by_type=by_type,
        done_issues=done_sorted,
        total_done=total,
        sla_rate=round(on_time_total / total * 100, 1) if total > 0 else 0.0,
        avg_cycle_days=round(sum(all_cycles) / len(all_cycles), 1) if all_cycles else 0.0,
        team_avg_backlog_days=_avg_days(all_backlog_ms),
        team_avg_waiting_days=_avg_days(all_waiting_ms),
        team_avg_in_progress_days=_avg_days(all_progress_ms),
        period_weeks=period_weeks,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Fetch all active Jira users (for admin BU management)
# ---------------------------------------------------------------------------

async def fetch_all_jira_users() -> list[dict]:
    """
    Busca todos os usuários ativos do Jira Cloud usando o endpoint /users/search.
    Retorna lista de {account_id, display_name, avatar_url, email}.
    """
    base_url, _, _, _ = _get_jira_config()
    api_base = f"{base_url}/rest/api/3"
    users: list[dict] = []
    start_at = 0
    max_results = 200

    async with httpx.AsyncClient() as client:
        while True:
            params = {"startAt": start_at, "maxResults": max_results}
            resp = await client.get(
                f"{api_base}/users/search",
                params=params,
                headers=_auth_header(),
            )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break

            for u in batch:
                # Skip inactive users, app users, and system accounts
                if not u.get("active", False):
                    continue
                if u.get("accountType") != "atlassian":
                    continue
                users.append({
                    "account_id": u.get("accountId", ""),
                    "display_name": u.get("displayName", ""),
                    "avatar_url": (u.get("avatarUrls") or {}).get("48x48", ""),
                    "email": u.get("emailAddress", ""),
                })

            if len(batch) < max_results:
                break
            start_at += max_results

    users.sort(key=lambda u: u["display_name"].lower())
    return users
