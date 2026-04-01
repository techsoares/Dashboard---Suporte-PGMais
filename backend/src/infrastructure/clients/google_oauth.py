"""
Google OAuth Client — Integração com Google OAuth 2.0.

Fornece:
- Token validation
- User info retrieval
- Callback handling

Status: Placeholder para fase posterior.
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("pgmais.google_oauth")


class GoogleOAuthClient:
    """Client para Google OAuth 2.0."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
        logger.info("GoogleOAuthClient initialized")

    async def validate_token(self, id_token: str) -> Optional[Dict[str, Any]]:
        """Valida ID token do Google."""
        # TODO: Implementar validação de token via Google API
        raise NotImplementedError()

    async def get_user_info(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Obtém informações do usuário."""
        # TODO: Implementar busca de user info
        raise NotImplementedError()
