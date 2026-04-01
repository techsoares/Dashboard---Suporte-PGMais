"""
Módulo Clients — Integrações com sistemas externos.

Fornece:
- JiraClient: Jira Cloud API
- GoogleOAuthClient: Google OAuth 2.0
- OpenRouterClient: OpenRouter AI API

Nota: Alguns clientes são wrappers sobre implementação legada (jira_client.py).
Refatoração completa será feita em fases posteriores.
"""

from .jira import JiraClient, jira_client_instance
from .google_oauth import GoogleOAuthClient
from .openrouter import OpenRouterClient

__all__ = [
    "JiraClient",
    "jira_client_instance",
    "GoogleOAuthClient",
    "OpenRouterClient",
]
