"""
Priority Routes — Endpoints de priorização (v1).

Endpoints:
- GET /api/v1/priority-requests — Lista requisições ativas
- POST /api/v1/priority-requests — Criar requisição
- DELETE /api/v1/priority-requests/{issue_key} — Resolver requisição
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.domain import InvalidInputException, InsufficientPermissionsException
from src.services import PriorityService
from src.api.deps import get_priority_service, get_current_user

logger = logging.getLogger("pgmais.api.priority")

router = APIRouter(prefix="/api/v1/priority-requests", tags=["priority"])


class PriorityRequestCreate(BaseModel):
    """Request body para criar requisição de priorização."""
    issue_key: str
    priority: str
    reason: str = ""


class PriorityRequestResponse(BaseModel):
    """Response de requisição de priorização."""
    issue_key: str
    priority: str
    reason: str
    created_by: str
    created_at: str


@router.get("", response_model=list[PriorityRequestResponse])
async def get_priority_requests(
    current_user: dict = Depends(get_current_user),
    priority_service: PriorityService = Depends(get_priority_service)
):
    """
    Lista todas as requisições de priorização ativas.

    Returns:
        Lista de PriorityRequestResponse
    """
    try:
        requests = await priority_service.get_all_requests()
        return requests

    except Exception as e:
        logger.error(f"Error getting priority requests: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar requisições"
        )


@router.post("", response_model=dict)
async def create_priority_request(
    request: PriorityRequestCreate,
    current_user: dict = Depends(get_current_user),
    priority_service: PriorityService = Depends(get_priority_service)
):
    """
    Cria nova requisição de priorização.

    Nota: Apenas usuários com role 'gestao' podem priorizar.

    Args:
        request: PriorityRequestCreate

    Returns:
        Status da criação
    """
    try:
        # Validar role
        user_bu = current_user.get("bu", "").lower()
        if user_bu != "gestao":
            raise InsufficientPermissionsException("priorização de issues")

        await priority_service.create_request(
            issue_key=request.issue_key,
            priority=request.priority,
            reason=request.reason,
            user_email=current_user.get("email")
        )

        logger.info(
            f"Priority request created: {request.issue_key} "
            f"by {current_user.get('email')}"
        )

        return {
            "status": "success",
            "message": f"Requisição de priorização criada para {request.issue_key}"
        }

    except InsufficientPermissionsException as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e.message)
        )
    except Exception as e:
        logger.error(f"Error creating priority request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar requisição"
        )


@router.delete("/{issue_key}")
async def resolve_priority_request(
    issue_key: str,
    current_user: dict = Depends(get_current_user),
    priority_service: PriorityService = Depends(get_priority_service)
):
    """
    Marca requisição de priorização como resolvida.

    Args:
        issue_key: Chave da issue (ex: ON-123)

    Returns:
        Status da operação
    """
    try:
        await priority_service.resolve_request(issue_key)

        logger.info(f"Priority request resolved: {issue_key}")

        return {
            "status": "success",
            "message": f"Requisição {issue_key} marcada como resolvida"
        }

    except Exception as e:
        logger.error(f"Error resolving priority request: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao resolver requisição"
        )
