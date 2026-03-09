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
    Issue, TimeInStatus, DevSummary, KpiSummary, DashboardResponse,
    _ms_to_hms,
)

load_dotenv()

logger = logging.getLogger(__name__)

JIRA_BASE_URL: str = os.getenv("JIRA_BASE_URL", "https://pgmais.atlassian.net")
JIRA_EMAIL: str = os.getenv("JIRA_EMAIL", "")
JIRA_TOKEN: str = os.getenv("JIRA_TOKEN", "")
JIRA_PROJECT: str = os.getenv("JIRA_PROJECT", "ON")

API_BASE = f"{JIRA_BASE_URL}/rest/api/3"
SEARCH_URL = f"{API_BASE}/search/jql"

# --- Auth header ----------------------------------------------------------

def _auth_header() -> dict[str, str]:
    raw = f"{JIRA_EMAIL}:{JIRA_TOKEN}"
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


def _classify_status_by_name(name: str) -> str:
    lower = name.lower()
    if any(k in lower for k in _WAITING_KEYWORDS):
        return "waiting"
    if any(k in lower for k in {"em andamento", "in progress", "doing", "dev", "desenvolvimento", "análise", "analise"}):
        return "in_progress"
    return "backlog"


# --- Field parsers --------------------------------------------------------

def _parse_assignee(raw: Optional[dict]) -> Optional[Assignee]:
    if not raw:
        return None
    return Assignee(
        account_id=raw.get("accountId", ""),
        display_name=raw.get("displayName", "Não atribuído"),
        email=raw.get("emailAddress"),
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

    return Issue(
        key=key,
        summary=fields.get("summary", ""),
        issue_type=_parse_issue_type(fields.get("issuetype")),
        status=status,
        priority=_parse_priority(fields.get("priority")),
        assignee=assignee,
        components=_parse_components(fields.get("components") or []),
        activity_type=_parse_activity_type(fields.get("customfield_10460")),
        start_date=start_date,
        due_date=due_date,
        created=fields.get("created"),
        time_in_status=time_in_status,
        is_overdue=_is_overdue(due_date),
        jira_url=f"{JIRA_BASE_URL}/browse/{key}",
    )


# --- HTTP helpers ---------------------------------------------------------

async def _get(client: httpx.AsyncClient, url: str, params: dict = {}) -> dict:
    resp = await client.get(url, params=params, headers=_auth_header(), timeout=30)
    resp.raise_for_status()
    return resp.json()


async def _fetch_changelog(client: httpx.AsyncClient, key: str) -> list[dict]:
    """Busca o changelog de uma issue. Pagina até esgotar."""
    histories: list[dict] = []
    start_at = 0
    while True:
        data = await _get(
            client,
            f"{API_BASE}/issue/{key}/changelog",
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
    "customfield_10460,customfield_10015,duedate,issuetype,created"
)


async def fetch_active_issues() -> list[Issue]:
    """
    Busca issues In Progress + To Do da sprint atual + Backlog do projeto.
    Exclui sub-tarefas. Busca o changelog de cada issue separadamente
    (expand=changelog foi descontinuado no /search do Jira Cloud).
    """
    import asyncio

    jql = (
        f'statusCategory IN ("In Progress", "New") '
        f'AND issuetype NOT IN subTaskIssueTypes() '
        f'AND project = "{JIRA_PROJECT}" '
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

            data = await _get(client, SEARCH_URL, params=params)
            raw_issues: list[dict] = data.get("issues", [])
            raw_all.extend(raw_issues)

            next_page_token = data.get("nextPageToken")
            if not next_page_token or not raw_issues:
                break

        # 2. Busca changelogs em paralelo
        changelogs: list[list[dict]] = await asyncio.gather(
            *[_fetch_changelog(client, raw.get("key", "")) for raw in raw_all]
        )

    # 3. Constrói as issues com o changelog correspondente
    issues: list[Issue] = []
    for raw, histories in zip(raw_all, changelogs):
        key: str = raw.get("key", "")
        fields: dict = raw.get("fields", {})
        issues.append(_build_issue(fields, key, histories))

    return issues


async def fetch_done_this_week() -> list[Issue]:
    """Issues concluídas desde o início da semana atual."""
    jql = (
        f'statusCategory = Done '
        f'AND statusCategoryChangedDate >= startOfWeek() '
        f'AND project = "{JIRA_PROJECT}"'
    )
    issues: list[Issue] = []

    async with httpx.AsyncClient() as client:
        next_page_token: str | None = None

        while True:
            params: dict = {"jql": jql, "maxResults": 100, "fields": FIELDS}
            if next_page_token:
                params["nextPageToken"] = next_page_token

            data = await _get(client, SEARCH_URL, params=params)
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


def build_dashboard(
    active_issues: list[Issue],
    done_issues: list[Issue],
) -> DashboardResponse:
    # Agrupar por dev
    dev_map: dict[str, DevSummary] = {}

    for issue in active_issues:
        if issue.assignee:
            aid = issue.assignee.account_id
            if aid not in dev_map:
                dev_map[aid] = DevSummary(assignee=issue.assignee)
            dev_map[aid].active_issues.append(issue)
        # Issues sem atribuição também vão para o backlog geral

    # Atualizar contadores
    for dev in dev_map.values():
        dev.issue_count = len(dev.active_issues)
        dev.active_issues.sort(key=_sort_key)

    # Backlog geral: todas as issues ativas, ordenadas por prioridade
    backlog = sorted(active_issues, key=_sort_key)

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

    return DashboardResponse(
        devs=list(dev_map.values()),
        backlog=backlog,
        kpis=kpis,
        last_updated=datetime.now(timezone.utc).isoformat(),
        jira_base_url=JIRA_BASE_URL,
    )
