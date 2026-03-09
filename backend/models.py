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
    email: Optional[str] = None
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
    time_in_status: TimeInStatus = TimeInStatus()
    is_overdue: bool = False
    jira_url: str = ""


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


class DashboardResponse(BaseModel):
    devs: List[DevSummary] = []
    backlog: List[Issue] = []             # Todas as issues (para coluna direita)
    kpis: KpiSummary = KpiSummary()
    last_updated: str = ""
    jira_base_url: str = ""
