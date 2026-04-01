"""
Health Routes — Endpoints de health check (v1).

Endpoints:
- GET /api/v1/health — Health check básico (sem auth)
- GET /api/v1/health/full — Health check detalhado (com auth)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any

from src.services import HealthService
from src.api.deps import get_health_service, get_current_user

logger = logging.getLogger("pgmais.api.health")

router = APIRouter(prefix="/api/v1/health", tags=["health"])


@router.get("", response_model=Dict[str, Any])
async def health_check(
    health_service: HealthService = Depends(get_health_service)
):
    """
    Health check básico (sem autenticação).

    Verifica se a aplicação está respondendo.

    Returns:
        {"status": "ok"} ou erro 503
    """
    try:
        is_healthy = await health_service.check_database()

        if not is_healthy:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database unavailable"
            )

        return {
            "status": "ok",
            "service": "pgmais-dashboard"
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )


@router.get("/full", response_model=Dict[str, Any])
async def health_check_full(
    current_user: dict = Depends(get_current_user),
    health_service: HealthService = Depends(get_health_service)
):
    """
    Health check detalhado com informações de todos os componentes.

    Requer: Autenticado

    Returns:
        {
            "status": "ok" | "degraded",
            "components": {
                "database": bool,
                "jira": bool,
                "cache": bool
            }
        }
    """
    try:
        status_data = await health_service.get_health_status()

        # Determinar status geral
        all_ok = all(status_data.get("components", {}).values())
        overall_status = "ok" if all_ok else "degraded"

        return {
            "status": overall_status,
            "service": "pgmais-dashboard",
            "components": status_data.get("components", {}),
            "timestamp": status_data.get("timestamp", "")
        }

    except Exception as e:
        logger.error(f"Full health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )
