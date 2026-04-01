"""
Integration Tests — Auth Endpoints

Testa endpoints de autenticação via FastAPI TestClient.
"""

import pytest
from unittest.mock import patch


@pytest.mark.integration
class TestAuthEndpoints:
    """Testes para endpoints de autenticação."""

    def test_health_check_no_auth(self, test_client):
        """Testa health check sem autenticação."""
        response = test_client.get("/api/v1/health")

        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    def test_login_success(self, test_client, mock_database):
        """Testa login bem-sucedido."""
        with patch("src.infrastructure.database.queries.get_user_by_email") as mock_user:
            mock_user.return_value = {
                "id": "user-123",
                "email": "test@pgmais.com",
                "display_name": "Test User",
                "role": "user",
                "is_active": True
            }

            response = test_client.post(
                "/api/v1/auth/login",
                json={
                    "email": "test@pgmais.com",
                    "password": "test-password-123"
                }
            )

            assert response.status_code == 200
            data = response.json()
            assert "access_token" in data
            assert data["token_type"] == "bearer"

    def test_login_invalid_credentials(self, test_client):
        """Testa login com credenciais inválidas."""
        with patch("src.infrastructure.database.queries.get_user_by_email") as mock_user:
            mock_user.return_value = None

            response = test_client.post(
                "/api/v1/auth/login",
                json={
                    "email": "nonexistent@pgmais.com",
                    "password": "wrong-password"
                }
            )

            assert response.status_code == 401
            assert "inválido" in response.json()["detail"].lower()

    def test_dashboard_requires_auth(self, test_client):
        """Testa que dashboard requer autenticação."""
        response = test_client.get("/api/v1/dashboard")

        assert response.status_code == 401
        assert "authorization" in response.json()["detail"].lower()

    def test_dashboard_with_auth(self, test_client, auth_headers):
        """Testa dashboard com autenticação válida."""
        with patch("src.services.dashboard_service.DashboardService.get_dashboard") as mock_service:
            mock_service.return_value = {
                "devs": [],
                "backlog": [],
                "done_issues": [],
                "done_issues_historical": [],
                "stale_issues": [],
                "kpis": {
                    "total_sprint": 0,
                    "in_progress": 0,
                    "waiting": 0,
                    "done_this_week": 0,
                    "overdue": 0
                },
                "kpi_delta": {
                    "total_sprint": 0,
                    "in_progress": 0,
                    "waiting": 0,
                    "done_vs_last_week": 0,
                    "overdue": 0
                },
                "last_updated": "2026-04-01T00:00:00Z",
                "jira_base_url": "https://pgmais.atlassian.net"
            }

            response = test_client.get(
                "/api/v1/dashboard",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert "devs" in data
            assert "backlog" in data
            assert "kpis" in data

    def test_health_full_requires_auth(self, test_client):
        """Testa que health/full requer autenticação."""
        response = test_client.get("/api/v1/health/full")

        assert response.status_code == 401

    def test_health_full_with_auth(self, test_client, auth_headers):
        """Testa health/full com autenticação."""
        with patch("src.services.health_service.HealthService.get_health_status") as mock_health:
            mock_health.return_value = {
                "components": {
                    "database": True,
                    "jira": True,
                    "cache": True
                },
                "timestamp": "2026-04-01T00:00:00Z"
            }

            response = test_client.get(
                "/api/v1/health/full",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data["status"] in ["ok", "degraded"]
            assert "components" in data

    def test_admin_endpoint_requires_admin_role(self, test_client, auth_headers):
        """Testa que endpoints admin requerem role admin."""
        response = test_client.get(
            "/api/v1/admin/users",
            headers=auth_headers
        )

        # User regular não deve ter acesso
        assert response.status_code == 403

    def test_admin_endpoint_with_admin_role(self, test_client, admin_headers):
        """Testa acesso a endpoints admin com role admin."""
        with patch("src.services.admin_service.AdminService.get_all_users") as mock_service:
            mock_service.return_value = []

            response = test_client.get(
                "/api/v1/admin/users",
                headers=admin_headers
            )

            assert response.status_code == 200
