"""
Admin Routes — Endpoints administrativos (v1).

Endpoints:
- GET /api/v1/admin/bus — Lista BUs
- POST /api/v1/admin/bus — Criar BU
- PUT /api/v1/admin/bus/{name} — Atualizar BU
- DELETE /api/v1/admin/bus/{name} — Deletar BU
- GET /api/v1/admin/users — Lista usuários
- POST /api/v1/admin/users — Criar usuário
- GET /api/v1/admin/account-ranking — Ranking de contas
- PUT /api/v1/admin/account-ranking — Atualizar ranking
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from src.domain import User, UserCreate
from src.services import AdminService
from src.api.deps import get_admin_service, get_admin_user

logger = logging.getLogger("pgmais.api.admin")

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# BU Models
class BUResponse(BaseModel):
    id: str
    name: str
    type: str
    members: list[str] = []


class BUCreate(BaseModel):
    name: str
    type: str = "Operacional"


# Account Ranking Models
class AccountRankingItem(BaseModel):
    account: str
    rank: int


# Users endpoints
@router.get("/users", response_model=list[User])
async def get_users(
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Lista todos os usuários do sistema.

    Requer: Admin

    Returns:
        Lista de User
    """
    try:
        users = await admin_service.get_all_users()
        return users

    except Exception as e:
        logger.error(f"Error getting users: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar usuários"
        )


@router.post("/users", response_model=dict)
async def create_user(
    user: UserCreate,
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Cria novo usuário no sistema.

    Requer: Admin

    Args:
        user: UserCreate com email, display_name, role, bu

    Returns:
        Status da criação
    """
    try:
        await admin_service.create_user(
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            bu=user.bu
        )

        logger.info(f"User created: {user.email} by {admin_user.get('email')}")

        return {
            "status": "success",
            "message": f"Usuário {user.email} criado com sucesso"
        }

    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar usuário"
        )


# BU endpoints
@router.get("/bus", response_model=list[BUResponse])
async def get_bus(
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Lista todas as Business Units.

    Requer: Admin

    Returns:
        Lista de BU
    """
    try:
        bus = await admin_service.get_all_bus()
        return bus

    except Exception as e:
        logger.error(f"Error getting BUs: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao listar BUs"
        )


@router.post("/bus", response_model=dict)
async def create_bu(
    bu: BUCreate,
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Cria nova Business Unit.

    Requer: Admin

    Args:
        bu: BUCreate com name e type

    Returns:
        Status da criação
    """
    try:
        await admin_service.create_bu(name=bu.name, bu_type=bu.type)

        logger.info(f"BU created: {bu.name} by {admin_user.get('email')}")

        return {
            "status": "success",
            "message": f"BU {bu.name} criada com sucesso"
        }

    except Exception as e:
        logger.error(f"Error creating BU: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao criar BU"
        )


# Account Ranking endpoints
@router.get("/account-ranking", response_model=list[AccountRankingItem])
async def get_account_ranking(
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Obtém ranking de contas.

    Requer: Admin

    Returns:
        Lista de AccountRankingItem
    """
    try:
        ranking = await admin_service.get_account_ranking()
        return ranking

    except Exception as e:
        logger.error(f"Error getting account ranking: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao obter ranking"
        )


@router.put("/account-ranking", response_model=dict)
async def update_account_ranking(
    rankings: list[AccountRankingItem],
    admin_user: dict = Depends(get_admin_user),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Atualiza ranking de contas.

    Requer: Admin

    Args:
        rankings: Lista de AccountRankingItem

    Returns:
        Status da atualização
    """
    try:
        await admin_service.update_account_ranking(
            [{"account": r.account, "rank": r.rank} for r in rankings]
        )

        logger.info(f"Account ranking updated by {admin_user.get('email')}")

        return {
            "status": "success",
            "message": "Ranking de contas atualizado com sucesso"
        }

    except Exception as e:
        logger.error(f"Error updating account ranking: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao atualizar ranking"
        )
