"""Mock data para desenvolvimento local."""

from models import (
    DashboardResponse, DevSummary, Assignee, Issue, IssueType, Status,
    Priority, Component, TimeInStatus, KpiSummary,
    ManagementData, WeekSummary, DevDelivery, DevWeekSummary, ProductDelivery, TypeBreakdown,
)
from datetime import datetime, timezone, timedelta, date

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


def get_mock_management(period_weeks: int = 4) -> ManagementData:
    """Dados mock para a visão de Gestão Executiva (desenvolvimento local)."""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())

    weeks = []
    for i in range(period_weeks - 1, -1, -1):
        w_start = start_of_week - timedelta(weeks=i)
        label = w_start.strftime("%d/%b")
        done = max(2, 8 - i * 2)
        weeks.append(WeekSummary(
            week_label=label,
            week_start=w_start.isoformat(),
            done_count=done,
            on_time=max(1, done - 1),
            late=1,
            avg_cycle_days=round(3.5 + i * 0.5, 1),
        ))

    devs = [
        DevDelivery(name="Aldinei Sampaio",     done_count=6, on_time=5, avg_cycle_days=3.2, avg_backlog_days=1.1, avg_waiting_days=0.5, avg_in_progress_days=1.6),
        DevDelivery(name="Anderson Wignieski",  done_count=5, on_time=4, avg_cycle_days=4.8, avg_backlog_days=2.0, avg_waiting_days=1.2, avg_in_progress_days=1.6),
        DevDelivery(name="Cleyton Kevin",       done_count=4, on_time=3, avg_cycle_days=5.1, avg_backlog_days=1.5, avg_waiting_days=0.8, avg_in_progress_days=2.8),
    ]

    by_dev_weekly = [
        DevWeekSummary(name=d.name, weekly_counts=[max(0, d.done_count // period_weeks + (1 if i % 2 == 0 else 0)) for i in range(period_weeks)])
        for d in devs
    ]

    done_issues_mock = [
        Issue(
            key=f"ON-3630{i}",
            summary=f"[MOCK] Entrega exemplo {i+1}",
            issue_type=IssueType(id="1", name="Tarefa"),
            status=Status(id="3", name="Done", category="done", category_name="Concluído"),
            priority=Priority(id="2", name="High"),
            assignee=Assignee(account_id=str(i % 3 + 1), display_name=devs[i % 3].name),
            components=[Component(id="1", name=["SMS", "Email", "RCS"][i % 3])],
            created=(today - timedelta(days=10 + i)).isoformat() + "T10:00:00Z",
            resolved_date=(today - timedelta(days=i)).isoformat() + "T15:00:00Z",
            due_date=(today - timedelta(days=i - 1)).isoformat(),
            time_in_status=TimeInStatus(backlog_ms=86400000, waiting_ms=43200000, in_progress_ms=172800000),
            is_overdue=False,
            jira_url=f"https://pgmais.atlassian.net/browse/ON-3630{i}",
            account="PGMais",
            product=["SMS", "Email", "RCS"][i % 3],
        )
        for i in range(min(period_weeks * 4, 12))
    ]

    total = len(done_issues_mock)
    return ManagementData(
        weeks=weeks,
        by_dev=devs,
        by_dev_weekly=by_dev_weekly,
        by_product=[
            ProductDelivery(product="SMS",   done_count=max(1, total // 3),     on_time=max(1, total // 3 - 1)),
            ProductDelivery(product="Email", done_count=max(1, total // 3),     on_time=max(1, total // 3 - 1)),
            ProductDelivery(product="RCS",   done_count=total - 2*(total // 3), on_time=total - 2*(total // 3)),
        ],
        by_type=[
            TypeBreakdown(type_name="Tarefa",   count=max(1, total // 2), on_time=max(1, total // 2 - 1)),
            TypeBreakdown(type_name="Bug",       count=max(1, total // 4), on_time=max(1, total // 4 - 1)),
            TypeBreakdown(type_name="Melhoria",  count=total - total // 2 - total // 4, on_time=total - total // 2 - total // 4),
        ],
        done_issues=done_issues_mock,
        total_done=total,
        sla_rate=83.0,
        avg_cycle_days=4.2,
        team_avg_backlog_days=1.5,
        team_avg_waiting_days=0.8,
        team_avg_in_progress_days=2.0,
        period_weeks=period_weeks,
        last_updated=datetime.now(timezone.utc).isoformat(),
    )
