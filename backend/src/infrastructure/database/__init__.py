"""
Módulo Database — Acesso a dados persistentes.

Exporta:
- db_manager: Gerenciador de conexões SQLite
- DB_PATH: Caminho do arquivo do banco
- Funções de query para cache, BU, priority requests, account ranking, users
"""

from .base import DatabaseManager, db_manager, DB_PATH

from .queries import (
    # Cache
    get_cache,
    set_cache,
    delete_cache,
    clear_all_cache,
    # BU
    get_all_bus,
    create_bu,
    update_bu,
    delete_bu,
    # Priority Requests
    get_all_priority_requests,
    create_priority_request,
    resolve_priority_request,
    delete_priority_request,
    # Account Ranking
    get_account_ranking,
    set_account_ranking,
    # Users
    get_user_by_email,
    get_all_users,
    create_user,
    update_user_last_login,
    update_user,
    delete_user,
)

__all__ = [
    # Base
    "DatabaseManager",
    "db_manager",
    "DB_PATH",
    # Cache
    "get_cache",
    "set_cache",
    "delete_cache",
    "clear_all_cache",
    # BU
    "get_all_bus",
    "create_bu",
    "update_bu",
    "delete_bu",
    # Priority Requests
    "get_all_priority_requests",
    "create_priority_request",
    "resolve_priority_request",
    "delete_priority_request",
    # Account Ranking
    "get_account_ranking",
    "set_account_ranking",
    # Users
    "get_user_by_email",
    "get_all_users",
    "create_user",
    "update_user_last_login",
    "update_user",
    "delete_user",
]
