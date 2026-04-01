"""
Módulo Infrastructure — Acesso a dados e integrações externas.

Camada que encapsula:
- Banco de dados (SQLite, queries)
- Cache (em memória com persistência)
- Clientes externos (Jira, Google, OpenRouter)

Padrão: Injeção de dependência para testabilidade.
"""

# Database
from .database import (
    DatabaseManager,
    db_manager,
    DB_PATH,
)

# Cache
from .cache import (
    MemoryCache,
    CacheEntry,
    cache,
)

# Clients
from .clients import (
    JiraClient,
    jira_client_instance,
    GoogleOAuthClient,
    OpenRouterClient,
)

__all__ = [
    # Database
    "DatabaseManager",
    "db_manager",
    "DB_PATH",
    # Cache
    "MemoryCache",
    "CacheEntry",
    "cache",
    # Clients
    "JiraClient",
    "jira_client_instance",
    "GoogleOAuthClient",
    "OpenRouterClient",
]
