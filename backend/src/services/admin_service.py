"""
Admin Service — Gestão de configurações administrativas.

Responsabilidades:
- Gestão de BUs (criar, atualizar, deletar)
- Gestão de usuários (criar, atualizar, deletar)
- Ranking de contas
- Acesso restrito a admins
"""

import logging

logger = logging.getLogger("pgmais.admin_service")


class AdminService:
    """Serviço administrativo."""

    # BU Management
    async def get_all_bus(self):
        """Obtém todas as BUs."""
        # TODO: Implementar
        raise NotImplementedError()

    async def create_bu(self, name: str, bu_type: str):
        """Cria nova BU."""
        # TODO: Implementar
        raise NotImplementedError()

    async def update_bu(self, name: str, **kwargs):
        """Atualiza BU."""
        # TODO: Implementar
        raise NotImplementedError()

    async def delete_bu(self, name: str):
        """Deleta BU."""
        # TODO: Implementar
        raise NotImplementedError()

    # User Management
    async def get_all_users(self):
        """Obtém todos os usuários."""
        # TODO: Implementar
        raise NotImplementedError()

    async def create_user(self, email: str, display_name: str, role: str, bu: str = None):
        """Cria novo usuário."""
        # TODO: Implementar
        raise NotImplementedError()

    async def update_user(self, email: str, **kwargs):
        """Atualiza usuário."""
        # TODO: Implementar
        raise NotImplementedError()

    async def delete_user(self, email: str):
        """Deleta (desativa) usuário."""
        # TODO: Implementar
        raise NotImplementedError()

    # Account Ranking
    async def get_account_ranking(self):
        """Obtém ranking de contas."""
        # TODO: Implementar
        raise NotImplementedError()

    async def update_account_ranking(self, rankings: list):
        """Atualiza ranking de contas."""
        # TODO: Implementar
        raise NotImplementedError()
