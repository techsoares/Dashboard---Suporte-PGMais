"""
Entidades de Domínio — Representações de conceitos-chave do negócio.

Entidades são objetos que têm identidade única e podem ser
persistidos ou recuperados. Diferentes de Value Objects que
representam apenas valores.

Inclui:
- Dev (desenvolvedor com issues)
- IssueAggregate (issue com todos os dados associados)
- Team (time com devs e métricas)
"""

from typing import Optional, List
from datetime import datetime
from src.domain.models import (
    Issue, DevSummary, Assignee, KpiSummary, KpiDelta
)


class Dev:
    """Desenvolvedor do time."""

    def __init__(
        self,
        account_id: str,
        display_name: str,
        avatar_url: Optional[str] = None,
    ):
        self.account_id = account_id
        self.display_name = display_name
        self.avatar_url = avatar_url
        self.active_issues: List[Issue] = []

    def add_issue(self, issue: Issue) -> None:
        """Adiciona issue ativa ao desenvolvedor."""
        if not any(i.key == issue.key for i in self.active_issues):
            self.active_issues.append(issue)

    def issue_count(self) -> int:
        """Retorna quantidade de issues ativas."""
        return len(self.active_issues)

    def to_summary(self) -> DevSummary:
        """Converte para DevSummary (formato de resposta)."""
        return DevSummary(
            assignee=Assignee(
                account_id=self.account_id,
                display_name=self.display_name,
                avatar_url=self.avatar_url,
            ),
            active_issues=self.active_issues,
            issue_count=self.issue_count(),
        )


class IssueAggregate:
    """Agregação completa de uma issue com todos seus dados relacionados."""

    def __init__(self, issue: Issue):
        self.issue = issue
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def update_status(self, new_status: str) -> None:
        """Atualiza status da issue."""
        self.issue.status.name = new_status
        self.updated_at = datetime.now()

    def mark_overdue(self) -> None:
        """Marca issue como atrasada."""
        self.issue.is_overdue = True
        self.updated_at = datetime.now()

    def add_component(self, component_id: str, component_name: str) -> None:
        """Adiciona componente à issue."""
        from src.domain.models import Component
        component = Component(id=component_id, name=component_name)
        if not any(c.id == component_id for c in self.issue.components):
            self.issue.components.append(component)

    def get_age_days(self) -> float:
        """Retorna idade da issue em dias."""
        if self.issue.created:
            created = datetime.fromisoformat(
                self.issue.created.replace('Z', '+00:00')
            )
            return (datetime.now(created.tzinfo) - created).days
        return 0


class Team:
    """Time (agregação de devs e métricas)."""

    def __init__(self, name: str):
        self.name = name
        self.devs: dict[str, Dev] = {}
        self.issues: List[Issue] = []
        self.created_at = datetime.now()

    def add_dev(self, dev: Dev) -> None:
        """Adiciona desenvolvedor ao time."""
        self.devs[dev.account_id] = dev

    def add_issue(self, issue: Issue) -> None:
        """Adiciona issue ao time."""
        if not any(i.key == issue.key for i in self.issues):
            self.issues.append(issue)

        # Atribui a dev se tiver assignee
        if issue.assignee:
            dev = self.get_or_create_dev(issue.assignee)
            dev.add_issue(issue)

    def get_or_create_dev(self, assignee) -> Dev:
        """Obtém ou cria dev a partir de assignee."""
        if assignee.account_id not in self.devs:
            dev = Dev(
                account_id=assignee.account_id,
                display_name=assignee.display_name,
                avatar_url=assignee.avatar_url,
            )
            self.add_dev(dev)
        return self.devs[assignee.account_id]

    def total_issues(self) -> int:
        """Retorna quantidade total de issues do time."""
        return len(self.issues)

    def active_issues(self) -> List[Issue]:
        """Retorna apenas issues ativas."""
        return [
            i for i in self.issues
            if i.status.category != "done"
        ]

    def done_issues(self) -> List[Issue]:
        """Retorna apenas issues concluídas."""
        return [
            i for i in self.issues
            if i.status.category == "done"
        ]

    def overdue_issues(self) -> List[Issue]:
        """Retorna apenas issues atrasadas."""
        return [i for i in self.issues if i.is_overdue]

    def calculate_kpis(self) -> KpiSummary:
        """Calcula KPIs do time."""
        active = self.active_issues()
        return KpiSummary(
            total_sprint=len(active),
            in_progress=sum(
                1 for i in active
                if i.status.category == "indeterminate"
            ),
            waiting=sum(
                1 for i in active
                if i.status.name.lower() in ["aguardando", "awaiting"]
            ),
            done_this_week=len(self.done_issues()),
            overdue=len(self.overdue_issues()),
        )
