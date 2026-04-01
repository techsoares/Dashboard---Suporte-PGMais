"""
Dashboard Service — Agregação e cálculo de dados do dashboard.

Responsabilidades:
- Buscar issues ativas do Jira
- Calcular KPIs
- Agrupar por desenvolvedor
- Aplicar filtros e ordenação
- Caching com invalidação
"""

import logging
from typing import Optional

logger = logging.getLogger("pgmais.dashboard_service")


class DashboardService:
    """Serviço de agregação do dashboard."""

    async def get_dashboard(self, use_cache: bool = True):
        """
        Obtém dados completos do dashboard.

        Args:
            use_cache: Usar cache se disponível

        Returns:
            DashboardResponse com devs, backlog, KPIs, etc
        """
        # TODO: Implementar
        # 1. Buscar issues ativas do Jira
        # 2. Agrupar por dev
        # 3. Calcular KPIs
        # 4. Retornar DashboardResponse
        raise NotImplementedError()

    async def force_refresh(self):
        """Force refresh dos dados (invalidar cache)."""
        # TODO: Invalidar cache e buscar dados novos
        raise NotImplementedError()

    async def get_stale_issues(self, days: int = 30):
        """Obtém issues em progresso há mais de X dias."""
        # TODO: Implementar
        raise NotImplementedError()
