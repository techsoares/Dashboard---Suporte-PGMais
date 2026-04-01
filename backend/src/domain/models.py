"""
Modelos de Domínio — Schemas Pydantic para request/response.

Define estruturas de dados para:
- Autenticação (LoginRequest, TokenResponse)
- Issues e componentes (Issue, IssueType, Status, Priority, Assignee)
- Dashboard (DashboardResponse, KPI, DevSummary)
- Gestão (ManagementData, DevDelivery, WeekSummary)
- Admin (BU, AccountRanking, User)
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ============================================================================
# Autenticação
# ============================================================================


class LoginRequest(BaseModel):
    """Dados de login."""
    email: EmailStr
    password: str = Field(..., min_length=6)


class TokenResponse(BaseModel):
    """Resposta com token de acesso."""
    access_token: str
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class RefreshTokenRequest(BaseModel):
    """Requisição de atualização de token."""
    refresh_token: str


# ============================================================================
# Componentes de Issue
# ============================================================================


class TimeInStatus(BaseModel):
    """Tempo gasto em cada status."""
    backlog_ms: int = 0       # ms em Backlog / To Do / Refinamento
    waiting_ms: int = 0       # ms em Aguardando
    in_progress_ms: int = 0   # ms em Em andamento

    @property
    def backlog_hms(self) -> str:
        """Converte backlog_ms para formato HH:MM:SS."""
        return self._ms_to_hms(self.backlog_ms)

    @property
    def waiting_hms(self) -> str:
        """Converte waiting_ms para formato HH:MM:SS."""
        return self._ms_to_hms(self.waiting_ms)

    @property
    def in_progress_hms(self) -> str:
        """Converte in_progress_ms para formato HH:MM:SS."""
        return self._ms_to_hms(self.in_progress_ms)

    @property
    def total_ms(self) -> int:
        """Total em milissegundos."""
        return self.backlog_ms + self.waiting_ms + self.in_progress_ms

    @staticmethod
    def _ms_to_hms(ms: int) -> str:
        """Converte milissegundos para HH:MM:SS."""
        total_seconds = ms // 1000
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        return f"{h:02d}:{m:02d}:{s:02d}"

    model_config = {"from_attributes": True}


class Assignee(BaseModel):
    """Responsável (desenvolvedor)."""
    account_id: str
    display_name: str
    avatar_url: Optional[str] = None


class IssueType(BaseModel):
    """Tipo de issue (Problema, Tarefa, Melhoria, Epic, etc)."""
    id: str
    name: str
    icon_url: Optional[str] = None


class Status(BaseModel):
    """Status da issue (To Do, Em Andamento, Concluído, etc)."""
    id: str
    name: str
    category: str              # "new" | "indeterminate" | "done"
    category_name: str         # "A fazer" | "Em andamento" | "Concluído"


class Priority(BaseModel):
    """Prioridade (Highest, High, Medium, Low, Lowest)."""
    id: str
    name: str
    icon_url: Optional[str] = None


class Component(BaseModel):
    """Componente/Produto de uma issue."""
    id: str
    name: str


# ============================================================================
# Issue
# ============================================================================


class Issue(BaseModel):
    """Representa uma issue do Jira."""
    key: str
    summary: str
    issue_type: IssueType
    status: Status
    priority: Optional[Priority] = None
    assignee: Optional[Assignee] = None
    components: List[Component] = []
    activity_type: Optional[str] = None     # customfield_10460 — Implantação/Sustentação
    start_date: Optional[str] = None        # customfield_10015 — YYYY-MM-DD
    due_date: Optional[str] = None          # duedate — YYYY-MM-DD
    created: Optional[str] = None
    resolved_date: Optional[str] = None     # resolutiondate — quando foi concluída
    time_in_status: TimeInStatus = TimeInStatus()
    is_overdue: bool = False
    jira_url: str = ""
    account: Optional[str] = None           # Cliente/Account
    product: Optional[str] = None           # Produto (pode usar component ou customfield)


# ============================================================================
# Dashboard
# ============================================================================


class DevSummary(BaseModel):
    """Resumo de um desenvolvedor no dashboard."""
    assignee: Assignee
    active_issues: List[Issue] = []         # In Progress / To Do
    issue_count: int = 0


class KpiSummary(BaseModel):
    """KPIs do sprint."""
    total_sprint: int = 0
    in_progress: int = 0
    waiting: int = 0
    done_this_week: int = 0
    overdue: int = 0


class KpiDelta(BaseModel):
    """Variação de KPIs em relação ao snapshot de 24h atrás."""
    total_sprint: int = 0
    in_progress: int = 0
    waiting: int = 0
    done_vs_last_week: int = 0             # done_this_week - done_last_week
    overdue: int = 0


class DashboardResponse(BaseModel):
    """Resposta principal do dashboard."""
    devs: List[DevSummary] = []
    backlog: List[Issue] = []              # Todas as issues ativas
    done_issues: List[Issue] = []          # Concluídas esta semana
    done_issues_historical: List[Issue] = [] # Concluídas no mês anterior (para IA)
    stale_issues: List[Issue] = []         # > 30 dias em progresso
    kpis: KpiSummary = KpiSummary()
    kpi_delta: KpiDelta = KpiDelta()
    last_updated: str = ""
    jira_base_url: str = ""


# ============================================================================
# Management (histórico)
# ============================================================================


class WeekSummary(BaseModel):
    """Resumo semanal de entrega."""
    week_label: str                        # "03/Mar", "10/Mar"
    week_start: str                        # ISO date YYYY-MM-DD
    done_count: int = 0
    on_time: int = 0                       # entregues dentro do prazo
    late: int = 0                          # entregues com atraso
    avg_cycle_days: float = 0.0


class DevDelivery(BaseModel):
    """Métricas de entrega de um desenvolvedor."""
    name: str
    done_count: int = 0
    on_time: int = 0
    avg_cycle_days: float = 0.0
    avg_backlog_days: float = 0.0          # tempo médio em backlog
    avg_waiting_days: float = 0.0          # tempo médio aguardando
    avg_in_progress_days: float = 0.0      # tempo médio em desenvolvimento


class ProductDelivery(BaseModel):
    """Métricas de entrega de um produto."""
    product: str
    done_count: int = 0
    on_time: int = 0


class TypeBreakdown(BaseModel):
    """Breakdown por tipo de issue."""
    type_name: str
    count: int = 0
    on_time: int = 0


class DevWeekSummary(BaseModel):
    """Contagem de entregas por semana (alinhada com ManagementData.weeks)."""
    name: str
    weekly_counts: List[int] = []


class ManagementData(BaseModel):
    """Dados históricos de gestão."""
    weeks: List[WeekSummary] = []
    by_dev: List[DevDelivery] = []
    by_dev_weekly: List[DevWeekSummary] = []
    by_product: List[ProductDelivery] = []
    by_type: List[TypeBreakdown] = []
    done_issues: List[Issue] = []          # Lista completa para drill-down
    total_done: int = 0
    sla_rate: float = 0.0                  # % entregues dentro do prazo
    avg_cycle_days: float = 0.0            # dias médios criação→conclusão
    team_avg_backlog_days: float = 0.0
    team_avg_waiting_days: float = 0.0
    team_avg_in_progress_days: float = 0.0
    period_weeks: int = 8
    last_updated: str = ""


# ============================================================================
# Admin
# ============================================================================


class BU(BaseModel):
    """Unidade de Negócio (Business Unit)."""
    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    type: str                              # "Operacional" ou "Gestao"


class AccountRanking(BaseModel):
    """Ranking de contas/clientes."""
    account: str = Field(..., min_length=1)
    rank: int = Field(..., gt=0)


class User(BaseModel):
    """Usuário do sistema."""
    id: Optional[str] = None
    email: EmailStr
    display_name: str = Field(..., min_length=1)
    role: str                              # "user" ou "admin"
    bu: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class UserCreate(BaseModel):
    """Dados para criar novo usuário."""
    email: EmailStr
    display_name: str = Field(..., min_length=1)
    role: str = "user"
    bu: Optional[str] = None


class UserUpdate(BaseModel):
    """Dados para atualizar usuário."""
    display_name: Optional[str] = None
    role: Optional[str] = None
    bu: Optional[str] = None
    is_active: Optional[bool] = None
