"""
Priority Service — Gestão de requisições de priorização.

Responsabilidades:
- Criar/atualizar requisições de priorização
- Validar permissões (apenas Gestao pode priorizar)
- Resolver/arquivar requisições
"""

import logging

logger = logging.getLogger("pgmais.priority_service")


class PriorityService:
    """Serviço de priorização de issues."""

    async def get_all_requests(self):
        """Obtém todas as requisições ativas."""
        # TODO: Implementar
        raise NotImplementedError()

    async def create_request(self, issue_key: str, priority: str, reason: str, user_email: str):
        """Cria nova requisição de priorização."""
        # TODO: Validar permissões (user.role == "Gestao")
        # TODO: Salvar em DB
        raise NotImplementedError()

    async def resolve_request(self, issue_key: str):
        """Marca requisição como resolvida."""
        # TODO: Implementar
        raise NotImplementedError()
