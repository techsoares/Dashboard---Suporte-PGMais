"""Mock data para desenvolvimento local."""

from models import (
    DashboardResponse, DevSummary, Assignee, Issue, IssueType, Status,
    Priority, Component, TimeInStatus, KpiSummary
)
from datetime import datetime, timezone, timedelta

def get_mock_dashboard() -> DashboardResponse:
    """Retorna dados mock para desenvolvimento local."""

    # Criar devs
    devs = [
        DevSummary(
            assignee=Assignee(
                account_id="1",
                display_name="Aldinei Sampaio",
                avatar_url="https://via.placeholder.com/48"
            ),
            issue_count=3
        ),
        DevSummary(
            assignee=Assignee(
                account_id="2",
                display_name="Anderson Wignieski",
                avatar_url="https://via.placeholder.com/48"
            ),
            issue_count=4
        ),
        DevSummary(
            assignee=Assignee(
                account_id="3",
                display_name="Cleyton Kevin de Lima",
                avatar_url="https://via.placeholder.com/48"
            ),
            issue_count=2
        ),
    ]

    # Criar issues
    issues = [
        Issue(
            key="ON-36328",
            summary="MIDWAY | Interrupção no Processamento JPP",
            issue_type=IssueType(id="1", name="Bug", icon_url=""),
            status=Status(id="1", name="Em Andamento", category="indeterminate", category_name="Em andamento"),
            priority=Priority(id="1", name="Highest", icon_url=""),
            assignee=Assignee(account_id="1", display_name="Aldinei Sampaio", avatar_url=""),
            components=[Component(id="1", name="MIDWAY")],
            activity_type="Sustentação",
            start_date="2026-03-01",
            due_date="2026-03-12",
            created="2026-02-20T10:00:00Z",
            time_in_status=TimeInStatus(backlog_ms=86400000, waiting_ms=0, in_progress_ms=172800000),
            is_overdue=False,
            jira_url="https://pgmais.atlassian.net/browse/ON-36328",
            account="PGMais",
            product="MIDWAY"
        ),
        Issue(
            key="ON-36382",
            summary="RETURN | Gerar Analítico e Sintético de Email ...",
            issue_type=IssueType(id="2", name="Tarefa", icon_url=""),
            status=Status(id="2", name="Aguardando", category="indeterminate", category_name="Em andamento"),
            priority=Priority(id="2", name="High", icon_url=""),
            assignee=Assignee(account_id="2", display_name="Anderson Wignieski", avatar_url=""),
            components=[Component(id="2", name="RETURN")],
            activity_type="Implantação",
            start_date="2026-02-25",
            due_date="2026-03-15",
            created="2026-02-20T10:00:00Z",
            time_in_status=TimeInStatus(backlog_ms=0, waiting_ms=259200000, in_progress_ms=0),
            is_overdue=False,
            jira_url="https://pgmais.atlassian.net/browse/ON-36382",
            account="PGMais",
            product="RETURN"
        ),
        Issue(
            key="ON-36464",
            summary="Status AGUARDANDO - Email Tríbanco",
            issue_type=IssueType(id="2", name="Backup", icon_url=""),
            status=Status(id="3", name="Backlog", category="new", category_name="A fazer"),
            priority=Priority(id="3", name="Medium", icon_url=""),
            assignee=Assignee(account_id="3", display_name="Cleyton Kevin de Lima", avatar_url=""),
            components=[Component(id="3", name="EMAIL")],
            activity_type="Sustentação",
            start_date="2026-03-05",
            due_date="2026-03-18",
            created="2026-03-01T10:00:00Z",
            time_in_status=TimeInStatus(backlog_ms=86400000, waiting_ms=0, in_progress_ms=0),
            is_overdue=False,
            jira_url="https://pgmais.atlassian.net/browse/ON-36464",
            account="Tríbanco",
            product="EMAIL"
        ),
        Issue(
            key="ON-36328",
            summary="One - Sustentação - front legado - Perfil do usuário",
            issue_type=IssueType(id="1", name="Bug", icon_url=""),
            status=Status(id="1", name="Em Andamento", category="indeterminate", category_name="Em andamento"),
            priority=Priority(id="1", name="Highest", icon_url=""),
            assignee=None,
            components=[Component(id="4", name="One")],
            activity_type="Sustentação",
            start_date="2026-03-02",
            due_date="2026-03-09",
            created="2026-02-28T10:00:00Z",
            time_in_status=TimeInStatus(backlog_ms=0, waiting_ms=0, in_progress_ms=172800000),
            is_overdue=True,
            jira_url="https://pgmais.atlassian.net/browse/ON-36328",
            account="PGMais",
            product="One"
        ),
        Issue(
            key="ON-36392",
            summary="PORTO SEGURO CONSÓRCIO | ENVIOS TRAVADOS",
            issue_type=IssueType(id="2", name="Tarefa", icon_url=""),
            status=Status(id="3", name="Backlog", category="new", category_name="A fazer"),
            priority=Priority(id="2", name="High", icon_url=""),
            assignee=None,
            components=[Component(id="5", name="CONSÓRCIO")],
            activity_type="Sustentação",
            start_date="2026-03-01",
            due_date="2026-03-20",
            created="2026-02-25T10:00:00Z",
            time_in_status=TimeInStatus(backlog_ms=259200000, waiting_ms=0, in_progress_ms=0),
            is_overdue=False,
            jira_url="https://pgmais.atlassian.net/browse/ON-36392",
            account="Porto Seguro",
            product="CONSÓRCIO"
        ),
    ]

    # Adicionar issues aos devs
    devs[0].active_issues = [issues[0]]
    devs[1].active_issues = [issues[1], issues[2]]
    devs[2].active_issues = [issues[3]]

    return DashboardResponse(
        devs=devs,
        backlog=issues,
        kpis=KpiSummary(
            total_sprint=len(issues),
            in_progress=2,
            waiting=1,
            done_this_week=8,
            overdue=1,
        ),
        last_updated=datetime.now(timezone.utc).isoformat(),
        jira_base_url="https://pgmais.atlassian.net",
    )
