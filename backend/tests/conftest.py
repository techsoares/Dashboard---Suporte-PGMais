"""
Pytest Configuration — Fixtures e setup para testes.

Fornece:
- FastAPI test client
- Database fixtures
- Auth fixtures
- Jira mock fixtures
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app
from src.services import AuthService
from src.infrastructure import db_manager, cache


@pytest.fixture(scope="session")
def test_client():
    """Fornece TestClient para requisições HTTP."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_cache():
    """Limpa cache antes de cada teste."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def auth_service():
    """Fornece instância de AuthService para testes."""
    return AuthService()


@pytest.fixture
def test_user():
    """Usuário de teste."""
    return {
        "id": "test-user-123",
        "email": "test@pgmais.com",
        "display_name": "Test User",
        "role": "user",
        "bu": "Operacional"
    }


@pytest.fixture
def test_admin():
    """Usuário admin de teste."""
    return {
        "id": "test-admin-123",
        "email": "admin@pgmais.com",
        "display_name": "Test Admin",
        "role": "admin",
        "bu": "Gestao"
    }


@pytest.fixture
def test_token(auth_service, test_user):
    """Gera JWT token para testes."""
    return auth_service._create_access_token(
        user_id=test_user["id"],
        email=test_user["email"],
        role=test_user["role"]
    )


@pytest.fixture
def test_admin_token(auth_service, test_admin):
    """Gera JWT token admin para testes."""
    return auth_service._create_access_token(
        user_id=test_admin["id"],
        email=test_admin["email"],
        role=test_admin["role"]
    )


@pytest.fixture
def auth_headers(test_token):
    """Fornece headers com autenticação."""
    return {
        "Authorization": f"Bearer {test_token}",
        "Content-Type": "application/json"
    }


@pytest.fixture
def admin_headers(test_admin_token):
    """Fornece headers com autenticação admin."""
    return {
        "Authorization": f"Bearer {test_admin_token}",
        "Content-Type": "application/json"
    }


# Mock fixtures
@pytest.fixture
def mock_jira_client():
    """Mock do cliente Jira."""
    with patch("src.infrastructure.clients.jira.JiraClient") as mock:
        mock_instance = MagicMock()
        mock_instance.get_dashboard = MagicMock(return_value={
            "devs": [],
            "backlog": [],
            "done_issues": [],
            "kpis": {"total_sprint": 0}
        })
        mock.return_value = mock_instance
        yield mock_instance


@pytest.fixture
def mock_database():
    """Mock do banco de dados."""
    with patch("src.infrastructure.database.queries.get_user_by_email") as mock:
        mock.return_value = {
            "id": "test-user-123",
            "email": "test@pgmais.com",
            "display_name": "Test User",
            "role": "user",
            "is_active": True
        }
        yield mock


# Configuração de pytest
def pytest_configure(config):
    """Registra markers customizados."""
    config.addinivalue_line(
        "markers", "integration: marca testes de integração"
    )
    config.addinivalue_line(
        "markers", "unit: marca testes unitários"
    )
    config.addinivalue_line(
        "markers", "slow: marca testes lentos"
    )
