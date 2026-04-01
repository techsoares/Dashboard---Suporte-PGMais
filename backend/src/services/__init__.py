"""
Módulo Services — Lógica de negócio centralizada.

Fornece:
- AuthService: Autenticação e gestão de sessão
- DashboardService: Agregação de dados do dashboard
- PriorityService: Gestão de prioridades
- AdminService: Gestão administrativ
- JiraService: Processamento de dados Jira
- AIService: Geração de insights
- HealthService: Health checks

Padrão: Injeção de dependência, métodos async.
"""

from .auth_service import AuthService
from .dashboard_service import DashboardService
from .priority_service import PriorityService
from .admin_service import AdminService
from .jira_service import JiraService
from .ai_service import AIService
from .health_service import HealthService

__all__ = [
    "AuthService",
    "DashboardService",
    "PriorityService",
    "AdminService",
    "JiraService",
    "AIService",
    "HealthService",
]
