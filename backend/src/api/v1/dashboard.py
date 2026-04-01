"""
Dashboard Routes — Endpoints do dashboard (v1).

Endpoints:
- GET /api/v1/dashboard — Dados principais do dashboard
- POST /api/v1/refresh — Force refresh (recalcular dados)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status

from src.domain import DashboardResponse
from src.services import DashboardService
from src.api.deps import get_dashboard_service, get_current_user

logger = logging.getLogger("pgmais.api.dashboard")

router = APIRouter(prefix="/api/v1", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    use_cache: bool = True,
    current_user: dict = Depends(get_current_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service)
):
    """
    Obtém dados principais do dashboard.

    Query Parameters:
        use_cache: Usar cache se disponível (default: True)

    Returns:
        DashboardResponse com devs, backlog, KPIs, etc
    """
    try:
        logger.info(f"Dashboard request from user: {current_user.get('email')}")

        dashboard_data = await dashboard_service.get_dashboard(use_cache=use_cache)

        return dashboard_data

    except Exception as e:
        logger.error(f"Error getting dashboard: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao carregar dashboard"
        )


@router.post("/refresh")
async def refresh_dashboard(
    current_user: dict = Depends(get_current_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service)
):
    """
    Force refresh dos dados do dashboard (invalidar cache).

    Retorna status da atualização.
    """
    try:
        logger.info(f"Dashboard refresh from user: {current_user.get('email')}")

        await dashboard_service.force_refresh()

        return {
            "status": "success",
            "message": "Dashboard atualizado com sucesso"
        }

    except Exception as e:
        logger.error(f"Error refreshing dashboard: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar dashboard"
        )
