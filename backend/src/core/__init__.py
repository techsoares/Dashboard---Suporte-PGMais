"""
Módulo Core — Configuração centralizada da aplicação.

Exporta:
- settings: Configurações via env vars
- logger: Logger principal
- get_cors_origins: Lista de origens CORS
- get_cors_regex: Regex para validação CORS
- RateLimiter: Rate limiting em memória
- InputValidator: Validação de entrada
- DataSanitizer: Sanitização de dados
- SecurityLogger: Logging de segurança
- SECURITY_HEADERS: Headers de segurança HTTP
- api_limiter: Instância global de rate limiter (geral)
- auth_limiter: Instância global de rate limiter (autenticação)
- require_rate_limit: Decorador de rate limiting
- validate_input: Decorador de validação de entrada
"""

from .config import Settings, settings, get_cors_origins, get_cors_regex
from .logging import logger, setup_logging
from .security import (
    RateLimiter,
    InputValidator,
    DataSanitizer,
    SecurityLogger,
    SECURITY_HEADERS,
    api_limiter,
    auth_limiter,
    require_rate_limit,
    validate_input,
)

__all__ = [
    # Config
    "Settings",
    "settings",
    "get_cors_origins",
    "get_cors_regex",
    # Logging
    "logger",
    "setup_logging",
    # Security
    "RateLimiter",
    "InputValidator",
    "DataSanitizer",
    "SecurityLogger",
    "SECURITY_HEADERS",
    "api_limiter",
    "auth_limiter",
    "require_rate_limit",
    "validate_input",
]
