"""
Configurações centralizadas da aplicação.

Gerencia:
- Variáveis de ambiente
- Configurações Jira
- Configurações JWT
- Configurações CORS
"""

import os
import re
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações da aplicação via variáveis de ambiente."""

    # App
    app_title: str = "PGMais Team Dashboard API"
    app_description: str = "Proxy e cache da API do Jira Cloud para o TV Dashboard"
    app_version: str = "1.0.0"
    debug: bool = False

    # Jira Cloud
    jira_email: str
    jira_token: str
    jira_base_url: str = "https://pgmais.atlassian.net"
    jira_project: str = "ON"

    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 8
    refresh_secret: str

    # Admin
    admin_email: str = ""
    admin_password_hash: str = ""

    # CORS
    allowed_origins: str = ""

    # OpenRouter (IA)
    openrouter_api_key: str = ""

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""

    # Database
    database_url: str = "sqlite:///./pgmais.db"
    database_echo: bool = False

    # Cache
    cache_ttl_minutes: int = 5
    cache_history_ttl_hours: int = 1

    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window_minutes: int = 1
    auth_limit_requests: int = 15
    auth_limit_window_minutes: int = 15

    class Config:
        env_file = ".env"
        case_sensitive = False


# Instância global
settings = Settings()


def get_cors_origins() -> List[str]:
    """Retorna lista de origens CORS permitidas.

    Suporta:
    - localhost (HTTP/HTTPS)
    - 127.0.0.1 (HTTP/HTTPS)
    - GitHub Codespaces tunnels
    - Origens customizadas via ALLOWED_ORIGINS env var
    """
    extra_origins = [
        o.strip()
        for o in settings.allowed_origins.split(",")
        if o.strip()
    ]

    return [
        "http://localhost",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "https://localhost",
        "https://127.0.0.1",
        *extra_origins,
    ]


def get_cors_regex() -> str:
    """Retorna regex para validação de origens CORS.

    Aceita padrões como:
    - http://localhost:*
    - https://*.app.github.dev (GitHub Codespaces)
    """
    origin_parts = [
        r"https?://localhost(:\d+)?$",
        r"https?://127\.0\.0\.1(:\d+)?$",
        r"https://[a-zA-Z0-9\-]+\.app\.github\.dev$",
    ]

    extra_origins = [
        o.strip()
        for o in settings.allowed_origins.split(",")
        if o.strip()
    ]

    if extra_origins:
        origin_parts.extend(re.escape(o) for o in extra_origins)

    return f"({'|'.join(origin_parts)})"
