"""
Auth Routes — Endpoints de autenticação (v1).

Endpoints:
- POST /api/v1/auth/login — Login com email/senha
- POST /api/v1/auth/refresh — Atualizar token
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from src.domain import (
    LoginRequest,
    TokenResponse,
    RefreshTokenRequest,
    InvalidCredentialsException,
    InvalidTokenException,
)
from src.core.security import auth_limiter, SecurityLogger
from src.services import AuthService
from src.api.deps import get_auth_service

logger = logging.getLogger("pgmais.api.auth")

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Login do usuário com email e senha.

    Returns:
        TokenResponse com access_token e token_type
    """
    # Rate limit: 15 tentativas por 15 minutos
    if not auth_limiter.is_allowed(f"login_{request.email}"):
        SecurityLogger.log_rate_limit_exceeded(request.email, "/auth/login")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Tente novamente em 15 minutos."
        )

    try:
        access_token, refresh_token = await auth_service.authenticate_user(
            request.email,
            request.password
        )

        logger.info(f"User login successful: {request.email}")

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=8 * 3600  # 8 horas em segundos
        )

    except InvalidCredentialsException:
        SecurityLogger.log_invalid_input(
            "/auth/login",
            "Invalid credentials",
            f"email={request.email}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha inválidos"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Atualiza access token usando refresh token.

    Returns:
        TokenResponse com novo access_token
    """
    try:
        new_access_token = auth_service.refresh_access_token(request.refresh_token)

        logger.info("Token refreshed successfully")

        return TokenResponse(
            access_token=new_access_token,
            token_type="bearer",
            expires_in=8 * 3600
        )

    except InvalidTokenException:
        SecurityLogger.log_invalid_input(
            "/auth/refresh",
            "Invalid refresh token",
            ""
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido ou expirado"
        )
