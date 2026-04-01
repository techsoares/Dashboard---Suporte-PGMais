"""
Jira Client — Integração com Jira Cloud API.

Fornece interface async para:
- Busca de issues
- Cálculo de métricas
- Processamento de histórico

Delegação: Esta módulo é um wrapper/facade que encapsula a lógica
do jira_client.py do backend. A refatoração completa da integração
Jira será feita em uma próxima fase (Phase 4b).

Nota: Importações circulares evitadas ao manter jira_client.py no backend/
e importá-lo aqui.
"""

import logging
from typing import Optional

logger = logging.getLogger("pgmais.jira_client")


class JiraClient:
    """
    Client wrapper para Jira Cloud.

    Responsabilidades:
    - Autenticação Basic Auth (email + API token)
    - Queries JQL assincronas
    - Processamento de changelog para time_in_status
    - Cálculo de métricas (KPIs, SLA)

    Implementação:
    - Delegação ao backend/jira_client.py (legacy)
    - TODO: Refatoração completa em Phase 4b
    """

    def __init__(self):
        """Inicializa cliente Jira."""
        # Lazy import para evitar dependências circulares
        # during initial bootstrap
        self._client = None
        logger.info("JiraClient initialized (wrapper mode)")

    @property
    def client(self):
        """Lazy load do cliente legado."""
        if self._client is None:
            # Import aqui para evitar circular dependency
            # durante a migração
            import sys
            import os
            sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

            try:
                import jira_client
                self._client = jira_client
            except ImportError as e:
                logger.error(f"Failed to import legacy jira_client: {e}")
                raise

        return self._client

    async def get_dashboard(self):
        """Obtém dados do dashboard (issues ativas + KPIs)."""
        return await self.client.get_dashboard()

    async def get_management_data(self, weeks: int = 8):
        """Obtém dados históricos de gestão."""
        return await self.client.get_management_data(weeks=weeks)

    async def get_issues_by_status(self, status: str):
        """Obtém issues por status."""
        return await self.client.get_issues_by_status(status)

    async def search(self, jql: str):
        """Executa busca JQL."""
        return await self.client.search(jql)

    def get_config(self):
        """Obtém configuração do Jira (base_url, project, etc)."""
        return self.client._get_jira_config()


# Instância global do Jira client
jira_client_instance = JiraClient()
