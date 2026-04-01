"""
API v1 — Rotas da API versão 1.

Inclui:
- auth: Autenticação e gestão de token
- dashboard: Dashboard principal
- priority: Gestão de prioridades
- admin: Operações administrativas
- health: Health checks
"""

from . import auth, dashboard, priority, admin, health

__all__ = ["auth", "dashboard", "priority", "admin", "health"]
