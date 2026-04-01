"""
Jira Service — Processamento e transformação de dados do Jira.

Responsabilidades:
- Enriquecimento de issues (account, product mapping)
- Cálculo de métricas de ciclo
- Processamento de SLA
- Segmentação por tipo/componente
"""

import logging

logger = logging.getLogger("pgmais.jira_service")


class JiraService:
    """Serviço de processamento de dados Jira."""

    async def get_active_issues(self):
        """Obtém issues ativas do sprint atual."""
        # TODO: Implementar
        raise NotImplementedError()

    async def get_done_this_week(self):
        """Obtém issues concluídas esta semana."""
        # TODO: Implementar
        raise NotImplementedError()

    async def enrich_issue(self, issue):
        """Enriquece issue com dados adicionais."""
        # TODO: Mapear account, product, calcular aging
        raise NotImplementedError()

    async def calculate_cycle_time(self, issue):
        """Calcula tempo de ciclo da issue."""
        # TODO: Usar changelog para calcular
        raise NotImplementedError()
