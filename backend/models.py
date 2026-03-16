from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class TimeInStatus(BaseModel):
    backlog_ms: int = 0       # ms em Backlog / To Do / Refinamento
    waiting_ms: int = 0       # ms em Aguardando
    in_progress_ms: int = 0   # ms em Em andamento

    @property
    def backlog_hms(self) -> str:
        return _ms_to_hms(self.backlog_ms)

    @property
    def waiting_hms(self) -> str:
        return _ms_to_hms(self.waiting_ms)

    @property
    def in_progress_hms(self) -> str:
        return _ms_to_hms(self.in_progress_ms)

    @property
    def total_ms(self) -> int:
        return self.backlog_ms + self.waiting_ms + self.in_progress_ms

    model_config = {"from_attributes": True}


def _ms_to_hms(ms: int) -> str:
    total_seconds = ms // 1000
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


class Assignee(BaseModel):
    account_id: str
    display_name: str
    avatar_url: Optional[str] = None


class IssueType(BaseModel):
    id: str
    name: str          # Problema / Tarefa / Melhoria / Epic / etc.
    icon_url: Optional[str] = None


class Status(BaseModel):
    id: str
    name: str
    category: str      # "new" | "indeterminate" | "done"
    category_name: str # "A fazer" | "Em andamento" | "Concluído"


class Priority(BaseModel):
    id: str
    name: str          # Highest / High / Medium / Low / Lowest
    icon_url: Optional[str] = None


class Component(BaseModel):
    id: str
    name: str


class Issue(BaseModel):
    key: str
    summary: str
    issue_type: IssueType
    status: Status
    priority: Optional[Priority] = None
    assignee: Optional[Assignee] = None
    components: List[Component] = []
    activity_type: Optional[str] = None   # customfield_10460 — Implantação / Sustentação
    start_date: Optional[str] = None      # customfield_10015 — YYYY-MM-DD
    due_date: Optional[str] = None        # duedate — YYYY-MM-DD
    created: Optional[str] = None
    resolved_date: Optional[str] = None   # resolutiondate — quando foi concluída
    time_in_status: TimeInStatus = TimeInStatus()
    is_overdue: bool = False
    jira_url: str = ""
    account: Optional[str] = None         # Cliente/Account - customfield a definir
    product: Optional[str] = None         # Produto - pode usar component ou customfield


class DevSummary(BaseModel):
    assignee: Assignee
    active_issues: List[Issue] = []       # In Progress / To Do desta sprint
    issue_count: int = 0


class KpiSummary(BaseModel):
    total_sprint: int = 0
    in_progress: int = 0
    waiting: int = 0
    done_this_week: int = 0
    overdue: int = 0


class KpiDelta(BaseModel):
    """Variação em relação ao snapshot de 24h atrás (exceto done: semana anterior)."""
    total_sprint: int = 0
    in_progress: int = 0
    waiting: int = 0
    done_vs_last_week: int = 0   # done_this_week - done_last_week
    overdue: int = 0


class DashboardResponse(BaseModel):
    devs: List[DevSummary] = []
    backlog: List[Issue] = []             # Todas as issues ativas (para coluna direita)
    done_issues: List[Issue] = []         # Issues concluídas esta semana
    done_issues_historical: List[Issue] = []  # Issues concluídas no mês anterior (para IA)
    stale_issues: List[Issue] = []        # Issues > 30 dias em progresso
    kpis: KpiSummary = KpiSummary()
    kpi_delta: KpiDelta = KpiDelta()
    last_updated: str = ""
    jira_base_url: str = ""


# ---------------------------------------------------------------------------
# Management / Historical models
# ---------------------------------------------------------------------------

class WeekSummary(BaseModel):
    week_label: str          # "03/Mar", "10/Mar", etc.
    week_start: str          # ISO date YYYY-MM-DD
    done_count: int = 0
    on_time: int = 0         # entregues dentro do prazo
    late: int = 0            # entregues com atraso
    avg_cycle_days: float = 0.0


class DevDelivery(BaseModel):
    name: str
    done_count: int = 0
    on_time: int = 0
    avg_cycle_days: float = 0.0
    avg_backlog_days: float = 0.0      # tempo médio em backlog/fila
    avg_waiting_days: float = 0.0      # tempo médio aguardando
    avg_in_progress_days: float = 0.0  # tempo médio em desenvolvimento


class ProductDelivery(BaseModel):
    product: str
    done_count: int = 0
    on_time: int = 0


class TypeBreakdown(BaseModel):
    type_name: str
    count: int = 0
    on_time: int = 0


class DevWeekSummary(BaseModel):
    """Contagem de entregas por semana para um dev (alinhada com ManagementData.weeks)."""
    name: str
    weekly_counts: List[int] = []


class ManagementData(BaseModel):
    weeks: List[WeekSummary] = []
    by_dev: List[DevDelivery] = []
    by_dev_weekly: List[DevWeekSummary] = []
    by_product: List[ProductDelivery] = []
    by_type: List[TypeBreakdown] = []
    done_issues: List[Issue] = []        # Lista completa para drill-down
    total_done: int = 0
    sla_rate: float = 0.0        # % entregues dentro do prazo
    avg_cycle_days: float = 0.0  # dias médios criação→conclusão
    team_avg_backlog_days: float = 0.0
    team_avg_waiting_days: float = 0.0
    team_avg_in_progress_days: float = 0.0
    period_weeks: int = 8
    last_updated: str = ""
