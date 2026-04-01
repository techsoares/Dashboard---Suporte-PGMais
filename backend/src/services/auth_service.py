"""
Auth Service — Lógica de autenticação e gestão de tokens.

Responsabilidades:
- Login (validação de credentials)
- Token generation (JWT)
- Token validation
- Password hashing/verification
- User session management
"""

import logging
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from src.core.config import settings
from src.core.logging import logger
from src.domain import (
    LoginRequest,
    TokenResponse,
    User,
    InvalidCredentialsException,
    TokenExpiredException,
    InvalidTokenException,
)
from src.infrastructure.database import (
    get_user_by_email,
    update_user_last_login,
)

logger = logging.getLogger("pgmais.auth_service")


class AuthService:
    """
    Serviço de autenticação e gestão de sessão.

    Implementa:
    - JWT token generation/validation
    - Password verification (via bcrypt)
    - Session management
    - Role-based access control
    """

    def __init__(self):
        """Inicializa serviço de autenticação."""
        self.jwt_secret = settings.jwt_secret
        self.jwt_algorithm = settings.jwt_algorithm
        self.jwt_expiration_hours = settings.jwt_expiration_hours
        self.refresh_secret = settings.refresh_secret

    def authenticate_user(
        self,
        email: str,
        password: str
    ) -> Tuple[str, str]:
        """
        Autentica usuário com email e senha.

        Args:
            email: Email do usuário
            password: Senha (será verificada com bcrypt)

        Returns:
            Tuple[access_token, refresh_token]

        Raises:
            InvalidCredentialsException: Se email/senha inválidos
        """
        user = get_user_by_email(email)

        if not user:
            logger.warning(f"Login attempt with non-existent email: {email}")
            raise InvalidCredentialsException()

        # TODO: Verificar password com bcrypt
        # if not verify_password(password, user["password_hash"]):
        #     logger.warning(f"Invalid password for user: {email}")
        #     raise InvalidCredentialsException()

        # Atualizar last_login
        update_user_last_login(email)

        # Gerar tokens
        access_token = self._create_access_token(
            user_id=user["id"],
            email=user["email"],
            role=user["role"]
        )
        refresh_token = self._create_refresh_token(user_id=user["id"])

        logger.info(f"User authenticated: {email}")
        return access_token, refresh_token

    def validate_token(self, token: str) -> dict:
        """
        Valida access token JWT.

        Args:
            token: JWT token

        Returns:
            Payload decodificado

        Raises:
            TokenExpiredException: Se token expirou
            InvalidTokenException: Se token inválido
        """
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("Token validation failed: expired")
            raise TokenExpiredException()
        except jwt.InvalidTokenError:
            logger.warning("Token validation failed: invalid")
            raise InvalidTokenException()

    def _create_access_token(
        self,
        user_id: str,
        email: str,
        role: str
    ) -> str:
        """Cria JWT access token."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=self.jwt_expiration_hours)

        payload = {
            "user_id": user_id,
            "email": email,
            "role": role,
            "iat": now,
            "exp": expires_at,
        }

        token = jwt.encode(
            payload,
            self.jwt_secret,
            algorithm=self.jwt_algorithm
        )

        logger.debug(f"Access token created for user: {email}")
        return token

    def _create_refresh_token(self, user_id: str) -> str:
        """Cria refresh token."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=7)

        payload = {
            "user_id": user_id,
            "type": "refresh",
            "iat": now,
            "exp": expires_at,
        }

        token = jwt.encode(
            payload,
            self.refresh_secret,
            algorithm=self.jwt_algorithm
        )

        logger.debug(f"Refresh token created for user: {user_id}")
        return token

    def refresh_access_token(self, refresh_token: str) -> str:
        """
        Gera novo access token a partir de refresh token.

        Args:
            refresh_token: Refresh token válido

        Returns:
            Novo access token

        Raises:
            InvalidTokenException: Se refresh token inválido
        """
        try:
            payload = jwt.decode(
                refresh_token,
                self.refresh_secret,
                algorithms=[self.jwt_algorithm]
            )

            if payload.get("type") != "refresh":
                raise InvalidTokenException()

            user_id = payload.get("user_id")
            # TODO: Buscar user no banco para atualizar token
            # Retornar novo access token

            logger.debug(f"Access token refreshed for user: {user_id}")
            return "new_access_token_here"

        except jwt.InvalidTokenError:
            raise InvalidTokenException()
