"""
API Dependencies — Injeção de dependências para rotas.

Fornece:
- get_current_user: Extrai user de JWT token
- rate_limit: Verifica rate limiting
- Services: Instâncias de serviços injetáveis
"""

import logging
from typing import Optional
from fastapi import Depends, HTTPException, status, Header

from src.core.security import api_limiter, auth_limiter
from src.domain import InvalidTokenException, UnauthorizedException
from src.services import (
    AuthService,
    DashboardService,
    PriorityService,
    AdminService,
    JiraService,
    AIService,
    HealthService,
)

logger = logging.getLogger("pgmais.api.deps")


# Services
def get_auth_service() -> AuthService:
    """Retorna instância de AuthService."""
    return AuthService()


def get_dashboard_service() -> DashboardService:
    """Retorna instância de DashboardService."""
    return DashboardService()


def get_priority_service() -> PriorityService:
    """Retorna instância de PriorityService."""
    return PriorityService()


def get_admin_service() -> AdminService:
    """Retorna instância de AdminService."""
    return AdminService()


def get_jira_service() -> JiraService:
    """Retorna instância de JiraService."""
    return JiraService()


def get_ai_service() -> AIService:
    """Retorna instância de AIService."""
    return AIService()


def get_health_service() -> HealthService:
    """Retorna instância de HealthService."""
    return HealthService()


# Auth
async def get_current_user(
    authorization: Optional[str] = Header(None),
    auth_service: AuthService = Depends(get_auth_service)
) -> dict:
    """
    Extrai e valida user do JWT token.

    Args:
        authorization: Header Authorization (Bearer {token})
        auth_service: Instância de AuthService

    Returns:
        User payload

    Raises:
        HTTPException: Se token inválido/expirado
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header"
        )

    try:
        scheme, token = authorization.split(" ")
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authorization scheme")

        payload = auth_service.validate_token(token)
        return payload

    except (InvalidTokenException, Exception) as e:
        logger.warning(f"Token validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_admin_user(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verifica se user é admin.

    Args:
        current_user: User autenticado

    Returns:
        User payload

    Raises:
        HTTPException: Se user não for admin
    """
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
