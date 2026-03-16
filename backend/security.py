"""
Módulo de Segurança - Implementa boas práticas de segurança
- Validação de entrada
- Rate limiting
- Sanitização de dados
- CORS seguro
- Headers de segurança
"""

import re
import logging
from typing import Any
from functools import wraps
from datetime import datetime, timedelta, timezone
from collections import defaultdict

logger = logging.getLogger("pgmais.security")

# ============================================================================
# Rate Limiting - Previne abuso de API
# ============================================================================

class RateLimiter:
    """
    Implementa rate limiting em memória com limpeza automática.
    Limita requisições por IP/endpoint.
    """
    
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    def is_allowed(self, identifier: str) -> bool:
        """
        Verifica se requisição é permitida para o identificador.
        
        Args:
            identifier: IP ou user ID único
            
        Returns:
            True se permitido, False se excedeu limite
        """
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(seconds=self.window_seconds)
        
        # Remove requisições antigas
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier]
            if req_time > cutoff
        ]
        
        # Verifica limite
        if len(self.requests[identifier]) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return False
        
        # Registra nova requisição
        self.requests[identifier].append(now)
        return True


# Instâncias globais com limites mais restritivos
api_limiter = RateLimiter(max_requests=100, window_seconds=60)
auth_limiter = RateLimiter(max_requests=15, window_seconds=900)  # 15 tentativas em 15 min


# ============================================================================
# Validação de Entrada - Previne injeção e dados inválidos
# ============================================================================

class InputValidator:
    """
    Valida e sanitiza entrada de usuário.
    Previne injeção SQL, XSS e outros ataques.
    """
    
    # Padrões de validação
    JIRA_KEY_PATTERN = re.compile(r'^[A-Z][A-Z0-9]{0,9}-\d{1,6}$')
    # Email pattern melhorado para evitar casos edge
    EMAIL_PATTERN = re.compile(
        r'^[a-zA-Z0-9][a-zA-Z0-9._%+-]*[a-zA-Z0-9]@'
        r'[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$'
    )
    SAFE_STRING_PATTERN = re.compile(r'^[a-zA-Z0-9\s\-_.@()]+$')
    
    @staticmethod
    def validate_jira_key(key: str) -> bool:
        """
        Valida formato de chave Jira (ex: ON-123).
        
        Args:
            key: Chave a validar
            
        Returns:
            True se válida, False caso contrário
        """
        if not key or not isinstance(key, str):
            return False
        return bool(InputValidator.JIRA_KEY_PATTERN.match(key.strip()))
    
    @staticmethod
    def validate_email(email: str) -> bool:
        """
        Valida formato de email.
        
        Args:
            email: Email a validar
            
        Returns:
            True se válido, False caso contrário
        """
        if not email or not isinstance(email, str):
            return False
        return bool(InputValidator.EMAIL_PATTERN.match(email.strip()))
    
    @staticmethod
    def sanitize_string(value: str, max_length: int = 500) -> str:
        """
        Sanitiza string removendo caracteres perigosos.
        
        Args:
            value: String a sanitizar
            max_length: Comprimento máximo permitido
            
        Returns:
            String sanitizada
        """
        if not isinstance(value, str):
            return ""
        
        # Remove caracteres de controle
        value = ''.join(char for char in value if ord(char) >= 32 or char in '\n\t')
        
        # Limita comprimento
        value = value[:max_length]
        
        # Remove espaços extras
        value = ' '.join(value.split())
        
        return value.strip()
    
    @staticmethod
    def validate_list_param(items: list, max_items: int = 50) -> bool:
        """
        Valida lista de parâmetros.
        
        Args:
            items: Lista a validar
            max_items: Máximo de itens permitidos
            
        Returns:
            True se válida, False caso contrário
        """
        if not isinstance(items, list):
            return False
        if len(items) > max_items:
            logger.warning(f"List parameter exceeds max items: {len(items)} > {max_items}")
            return False
        return True


# ============================================================================
# Sanitização de Dados - Remove informações sensíveis
# ============================================================================

class DataSanitizer:
    """
    Remove informações sensíveis de dados antes de retornar ao cliente.
    """
    
    SENSITIVE_FIELDS = {
        'token', 'password', 'secret', 'api_key', 'credential',
        'auth', 'private_key', 'access_token', 'refresh_token'
    }
    
    @staticmethod
    def sanitize_dict(data: dict) -> dict:
        """
        Remove campos sensíveis de dicionário recursivamente.
        
        Args:
            data: Dicionário a sanitizar
            
        Returns:
            Dicionário sanitizado
        """
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        for key, value in data.items():
            # Verifica se é campo sensível
            if any(sensitive in key.lower() for sensitive in DataSanitizer.SENSITIVE_FIELDS):
                sanitized[key] = "***REDACTED***"
            elif isinstance(value, dict):
                sanitized[key] = DataSanitizer.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    DataSanitizer.sanitize_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                sanitized[key] = value
        
        return sanitized


# ============================================================================
# Headers de Segurança - Protege contra ataques comuns
# ============================================================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}


# ============================================================================
# Logging de Segurança - Registra eventos suspeitos
# ============================================================================

class SecurityLogger:
    """
    Registra eventos de segurança para auditoria.
    """
    
    @staticmethod
    def log_invalid_input(endpoint: str, reason: str, details: str = ""):
        """
        Registra tentativa de entrada inválida.
        
        Args:
            endpoint: Endpoint acessado
            reason: Motivo da rejeição
            details: Detalhes adicionais
        """
        logger.warning(
            f"Invalid input on {endpoint}: {reason}",
            extra={"details": details, "timestamp": datetime.now(timezone.utc).isoformat()}
        )
    
    @staticmethod
    def log_rate_limit_exceeded(identifier: str, endpoint: str):
        """
        Registra excesso de rate limit.
        
        Args:
            identifier: IP ou user ID
            endpoint: Endpoint acessado
        """
        logger.warning(
            f"Rate limit exceeded for {identifier} on {endpoint}",
            extra={"timestamp": datetime.now(timezone.utc).isoformat()}
        )
    
    @staticmethod
    def log_unauthorized_access(endpoint: str, reason: str):
        """
        Registra tentativa de acesso não autorizado.
        
        Args:
            endpoint: Endpoint acessado
            reason: Motivo da rejeição
        """
        logger.warning(
            f"Unauthorized access attempt on {endpoint}: {reason}",
            extra={"timestamp": datetime.now(timezone.utc).isoformat()}
        )


# ============================================================================
# Decoradores de Segurança - Aplicam validações automaticamente
# ============================================================================

def require_rate_limit(limiter=api_limiter):
    """
    Decorador que aplica rate limiting a uma função.
    
    Args:
        limiter: Instância de RateLimiter a usar
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extrai IP do request (simplificado)
            identifier = kwargs.get('client_ip', 'unknown')
            
            if not limiter.is_allowed(identifier):
                SecurityLogger.log_rate_limit_exceeded(identifier, func.__name__)
                from fastapi import HTTPException
                raise HTTPException(status_code=429, detail="Too many requests")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def validate_input(**validators):
    """
    Decorador que valida parâmetros de entrada.
    
    Args:
        **validators: Mapeamento de parâmetro -> função de validação
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for param, validator in validators.items():
                if param in kwargs:
                    if not validator(kwargs[param]):
                        SecurityLogger.log_invalid_input(
                            func.__name__,
                            f"Invalid {param}",
                            str(kwargs[param])
                        )
                        from fastapi import HTTPException
                        raise HTTPException(status_code=400, detail=f"Invalid {param}")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator
