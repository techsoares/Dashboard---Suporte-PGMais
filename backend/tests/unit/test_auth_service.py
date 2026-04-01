"""
Unit Tests — Auth Service

Testa lógica de autenticação isoladamente.
"""

import pytest
from datetime import datetime, timedelta, timezone

from src.services.auth_service import AuthService
from src.domain import InvalidCredentialsException, InvalidTokenException


@pytest.mark.unit
class TestAuthService:
    """Testes para AuthService."""

    def test_create_access_token(self, auth_service):
        """Testa criação de access token."""
        token = auth_service._create_access_token(
            user_id="test-123",
            email="test@pgmais.com",
            role="user"
        )

        assert isinstance(token, str)
        assert len(token) > 0

        # Validar token
        payload = auth_service.validate_token(token)
        assert payload["user_id"] == "test-123"
        assert payload["email"] == "test@pgmais.com"
        assert payload["role"] == "user"

    def test_create_refresh_token(self, auth_service):
        """Testa criação de refresh token."""
        token = auth_service._create_refresh_token(user_id="test-123")

        assert isinstance(token, str)
        assert len(token) > 0

    def test_validate_token_success(self, auth_service, test_token):
        """Testa validação de token válido."""
        payload = auth_service.validate_token(test_token)

        assert payload is not None
        assert "user_id" in payload
        assert "email" in payload
        assert "role" in payload

    def test_validate_token_invalid(self, auth_service):
        """Testa validação de token inválido."""
        with pytest.raises(InvalidTokenException):
            auth_service.validate_token("invalid.token.here")

    def test_validate_token_malformed(self, auth_service):
        """Testa validação de token mal formatado."""
        with pytest.raises(InvalidTokenException):
            auth_service.validate_token("not-a-jwt")

    @pytest.mark.slow
    def test_token_expiration(self, auth_service):
        """Testa expiração de token."""
        # Criar token com expiração imediata
        import jwt
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        expired_time = now - timedelta(hours=1)

        payload = {
            "user_id": "test",
            "email": "test@pgmais.com",
            "role": "user",
            "iat": now,
            "exp": expired_time
        }

        expired_token = jwt.encode(
            payload,
            auth_service.jwt_secret,
            algorithm=auth_service.jwt_algorithm
        )

        # Verificar que token expirado é rejeitado
        from src.domain import TokenExpiredException
        with pytest.raises(TokenExpiredException):
            auth_service.validate_token(expired_token)
