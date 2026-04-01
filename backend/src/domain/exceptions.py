"""
Exceções de Domínio — Erros específicos da lógica de negócio.

Define hierarquia de exceções customizadas para tratamento
semanticamente adequado de erros da aplicação.
"""


class DomainException(Exception):
    """Classe base para todas as exceções de domínio."""

    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(self.message)


# ============================================================================
# Autenticação
# ============================================================================


class AuthenticationException(DomainException):
    """Erro geral de autenticação."""

    def __init__(self, message: str = "Autenticação falhou"):
        super().__init__(message, "AUTHENTICATION_ERROR")


class InvalidCredentialsException(AuthenticationException):
    """Email ou senha inválidos."""

    def __init__(self):
        super().__init__(
            "Email ou senha inválidos",
            "INVALID_CREDENTIALS"
        )


class TokenExpiredException(AuthenticationException):
    """Token expirou."""

    def __init__(self):
        super().__init__("Token expirou", "TOKEN_EXPIRED")


class InvalidTokenException(AuthenticationException):
    """Token inválido ou mal formatado."""

    def __init__(self):
        super().__init__("Token inválido", "INVALID_TOKEN")


class UnauthorizedException(AuthenticationException):
    """Usuário não autorizado para esta ação."""

    def __init__(self, message: str = "Não autorizado"):
        super().__init__(message, "UNAUTHORIZED")


# ============================================================================
# Recurso
# ============================================================================


class ResourceException(DomainException):
    """Erro geral relacionado a recursos."""

    def __init__(self, message: str, code: str = "RESOURCE_ERROR"):
        super().__init__(message, code)


class ResourceNotFoundException(ResourceException):
    """Recurso não encontrado."""

    def __init__(self, resource_type: str, identifier: str):
        super().__init__(
            f"{resource_type} '{identifier}' não encontrado",
            "RESOURCE_NOT_FOUND"
        )


class ResourceAlreadyExistsException(ResourceException):
    """Recurso já existe."""

    def __init__(self, resource_type: str, identifier: str):
        super().__init__(
            f"{resource_type} '{identifier}' já existe",
            "RESOURCE_ALREADY_EXISTS"
        )


# ============================================================================
# Validação
# ============================================================================


class ValidationException(DomainException):
    """Erro de validação de dados."""

    def __init__(self, message: str, code: str = "VALIDATION_ERROR"):
        super().__init__(message, code)


class InvalidInputException(ValidationException):
    """Entrada de usuário inválida."""

    def __init__(self, field: str, reason: str):
        super().__init__(
            f"Campo '{field}' inválido: {reason}",
            "INVALID_INPUT"
        )


class RateLimitException(ValidationException):
    """Rate limit excedido."""

    def __init__(self, retry_after: int = 60):
        super().__init__(
            f"Muitas requisições. Tente novamente em {retry_after}s",
            "RATE_LIMIT_EXCEEDED"
        )


# ============================================================================
# Integração
# ============================================================================


class IntegrationException(DomainException):
    """Erro de integração com sistemas externos."""

    def __init__(self, service: str, message: str):
        super().__init__(
            f"Erro na integração com {service}: {message}",
            "INTEGRATION_ERROR"
        )


class JiraException(IntegrationException):
    """Erro na integração com Jira."""

    def __init__(self, message: str):
        super().__init__("Jira", message)


class CacheException(IntegrationException):
    """Erro no cache."""

    def __init__(self, message: str):
        super().__init__("Cache", message)


class DatabaseException(IntegrationException):
    """Erro no banco de dados."""

    def __init__(self, message: str):
        super().__init__("Database", message)


# ============================================================================
# Negócio
# ============================================================================


class BusinessRuleException(DomainException):
    """Violação de regra de negócio."""

    def __init__(self, rule: str):
        super().__init__(
            f"Violação de regra de negócio: {rule}",
            "BUSINESS_RULE_VIOLATION"
        )


class InsufficientPermissionsException(BusinessRuleException):
    """Usuário não tem permissão para esta ação."""

    def __init__(self, action: str):
        super().__init__(f"Permissão insuficiente para {action}")
