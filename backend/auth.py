"""
Autenticação com email/senha.
Credenciais de admin gerenciadas via .env (ADMIN_EMAIL / ADMIN_PASSWORD_HASH).
"""

import os
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import HTTPException, Header
from pydantic import BaseModel

logger = logging.getLogger("pgmais.auth")

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET não configurado. Adicione JWT_SECRET no arquivo .env")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))

# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    """Perfil do usuário autenticado."""
    user_id: str
    email: str
    name: str
    bu_id: Optional[str] = None
    bu_name: Optional[str] = None
    bu_type: Optional[str] = None
    roles: list[str] = []
    permissions: list[str] = []


class LoginRequest(BaseModel):
    """Requisição de login."""
    email: str
    password: str = ""  # Senha opcional


class LoginResponse(BaseModel):
    """Resposta de login."""
    access_token: str
    token_type: str = "Bearer"
    user: UserProfile


# ─────────────────────────────────────────────────────────────────────────────
# Configuração de Admins
# ─────────────────────────────────────────────────────────────────────────────

# Credenciais de admin carregadas do .env — nunca hardcode aqui
_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
_ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "").strip()

ADMIN_CREDENTIALS: dict[str, str] = {}
if _ADMIN_EMAIL and _ADMIN_PASSWORD_HASH:
    ADMIN_CREDENTIALS[_ADMIN_EMAIL] = _ADMIN_PASSWORD_HASH

ALLOWED_DOMAINS = ["pgmais.com.br", "ciclo.com.br", "pgmais", "ciclo"]


def get_admin_credentials() -> dict:
    """Retorna dicionário de credenciais de admin."""
    return ADMIN_CREDENTIALS


def add_admin(email: str, password: str):
    """Adiciona um novo admin com senha hasheada."""
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    ADMIN_CREDENTIALS[email.lower()] = hashed
    logger.info("Novo admin adicionado: %s", email.lower())


def remove_admin(email: str):
    """Remove um admin."""
    if email.lower() in ADMIN_CREDENTIALS:
        del ADMIN_CREDENTIALS[email.lower()]
        logger.info("Admin removido: %s", email.lower())

# ─────────────────────────────────────────────────────────────────────────────
# JWT Helpers
# ─────────────────────────────────────────────────────────────────────────────

def create_jwt_token(user: UserProfile) -> str:
    """Cria um JWT com dados do usuário."""
    payload = {
        "sub": user.user_id,
        "email": user.email,
        "name": user.name,
        "bu_id": user.bu_id,
        "bu_name": user.bu_name,
        "bu_type": user.bu_type,
        "roles": user.roles,
        "permissions": user.permissions,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt_token(token: str) -> dict:
    """Decodifica e valida um JWT."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ─────────────────────────────────────────────────────────────────────────────
# User-BU Mapping (Local Storage)
# ─────────────────────────────────────────────────────────────────────────────

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")


def _load_users() -> dict:
    """Carrega mapeamento de usuários → BUs."""
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return {}
                return json.loads(content)
        except json.JSONDecodeError as e:
            logger.error("Erro ao parsear users.json: %s", e)
            return {}
        except Exception as e:
            logger.error("Erro ao carregar users.json: %s", e)
            return {}
    return {}


def _save_users(users: dict):
    """Salva mapeamento de usuários → BUs."""
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def get_user_bu(email: str) -> Optional[dict]:
    """Retorna BU e permissões do usuário pelo email."""
    users = _load_users()
    return users.get(email.lower())


def set_user_bu(email: str, bu_id: str, bu_name: str, bu_type: str, roles: list[str]):
    """Associa um usuário a uma BU."""
    users = _load_users()
    existing = users.get(email.lower(), {})
    users[email.lower()] = {
        **existing,
        "email": email,
        "name": existing.get("name", email.split('@')[0].title() if '@' in email else email),
        "bu_id": bu_id,
        "bu_name": bu_name,
        "bu_type": bu_type,
        "roles": roles,
        "permissions": _roles_to_permissions(roles),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_users(users)


def _roles_to_permissions(roles: list[str]) -> list[str]:
    """Converte roles em permissões."""
    perms = ["read"]
    if "dev" in roles or "manager" in roles:
        perms.append("write")
    if "admin" in roles or "gestao" in roles:
        perms.extend(["admin", "manage_users"])
    return perms


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

def authenticate_user(email: str, password: str = "") -> UserProfile:
    """Autentica usuário com email e senha.
    
    - Admins: Requerem senha obrigatória
    - Usuários normais: Login sem senha para domínios permitidos
    """
    try:
        email_lower = email.strip().lower()
        
        # Verificar se é domínio permitido (@pgmais ou @ciclo) — extração estrita do domínio
        if "@" not in email_lower:
            raise HTTPException(status_code=401, detail="Email inválido")
        email_domain = email_lower.rsplit("@", 1)[1]
        is_allowed_domain = any(email_domain == d or email_domain.endswith("." + d) for d in ALLOWED_DOMAINS)
        
        if not is_allowed_domain:
            logger.warning("Domínio não permitido: %s", email_lower)
            raise HTTPException(status_code=401, detail="Apenas emails @pgmais ou @ciclo são permitidos")
        
        # Verificar se é admin
        is_admin = email_lower in [admin.lower() for admin in ADMIN_CREDENTIALS.keys()]
        
        # ADMIN: Requer senha obrigatória
        if is_admin:
            if not password:
                logger.warning("Admin tentou login sem senha: %s", email_lower)
                raise HTTPException(status_code=401, detail="Senha obrigatória para administradores")
            
            correct_password_hash = ADMIN_CREDENTIALS.get(email_lower)
            if not correct_password_hash or not bcrypt.checkpw(password.encode(), correct_password_hash.encode()):
                logger.warning("Senha incorreta para admin: %s", email_lower)
                raise HTTPException(status_code=401, detail="Email ou senha incorretos")
            
            logger.info("Admin autenticado com sucesso: %s", email_lower)
        
        # Buscar ou criar usuário
        user_bu = get_user_bu(email_lower)
        
        if not user_bu:
            # Auto-cadastro para domínios permitidos
            name = email_lower.split('@')[0].replace('.', ' ').title()
            user_bu = {
                "email": email_lower,
                "name": name,
                "bu_id": "default",
                "bu_name": "PGMais",
                "bu_type": "operacional",
                "roles": ["admin", "dev"] if is_admin else ["dev"],
                "permissions": ["read", "write", "admin", "manage_users"] if is_admin else ["read"],
            }
            # Salvar novo usuário
            users = _load_users()
            users[email_lower] = user_bu
            _save_users(users)
            logger.info("Novo usuário auto-cadastrado: %s (admin=%s)", email_lower, is_admin)
        
        # Atualizar permissões se mudou para admin
        if is_admin and "admin" not in user_bu.get("roles", []):
            user_bu["roles"] = ["admin", "dev"]
            user_bu["permissions"] = ["read", "write", "admin", "manage_users"]
            users = _load_users()
            users[email_lower] = user_bu
            _save_users(users)
            logger.info("Usuário promovido a admin: %s", email_lower)
        
        # SEMPRE sincronizar BU do bus.json (com tratamento de erro)
        try:
            bu_info = _get_user_bu_from_bus_file(user_bu.get("name", ""))
            if bu_info:
                user_bu["bu_id"] = bu_info["bu_id"]
                user_bu["bu_name"] = bu_info["bu_name"]
                user_bu["bu_type"] = bu_info["bu_type"]
                # Atualizar no arquivo users.json
                users = _load_users()
                users[email_lower] = user_bu
                _save_users(users)
                logger.info("BU sincronizada para %s: %s (%s)", email_lower, bu_info["bu_name"], bu_info["bu_type"])
        except Exception as e:
            logger.warning("Erro ao sincronizar BU para %s: %s", email_lower, str(e))
            # Continua mesmo se BU não for encontrada
        
        user = UserProfile(
            user_id=email_lower,
            email=email_lower,
            name=user_bu.get("name", email_lower),
            bu_id=user_bu.get("bu_id"),
            bu_name=user_bu.get("bu_name"),
            bu_type=user_bu.get("bu_type", "operacional"),
            roles=user_bu.get("roles", ["dev"]),
            permissions=user_bu.get("permissions", ["read"]),
        )
        
        logger.info("Login bem-sucedido: %s (admin=%s, bu_type=%s)", email_lower, is_admin, user.bu_type)
        return user
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro inesperado na autenticação: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao autenticar. Contate o administrador.")


def _get_user_bu_from_bus_file(user_name: str) -> Optional[dict]:
    """Busca a BU do usuário no arquivo bus.json pelo nome."""
    if not user_name:
        logger.warning("_get_user_bu_from_bus_file: user_name vazio")
        return None
    
    bus_file = os.path.join(os.path.dirname(__file__), "bus.json")
    if not os.path.exists(bus_file):
        logger.warning("_get_user_bu_from_bus_file: bus.json não encontrado")
        return None
    
    try:
        with open(bus_file, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if not content:
                logger.warning("bus.json está vazio")
                return None
            bus_list = json.loads(content)
        
        logger.info("Buscando BU para usuário: '%s'", user_name)
        
        for bu in bus_list:
            members = bu.get("members", [])
            logger.debug("Verificando BU '%s' com %d membros", bu.get("name"), len(members))
            
            # Busca exata e case-insensitive
            for member in members:
                if member.strip().lower() == user_name.strip().lower():
                    logger.info("BU encontrada para '%s': %s (%s)", user_name, bu["name"], bu.get("bu_type"))
                    return {
                        "bu_id": bu["id"],
                        "bu_name": bu["name"],
                        "bu_type": bu.get("bu_type", "operacional")
                    }
        
        logger.warning("Nenhuma BU encontrada para usuário: '%s'", user_name)
    except Exception as e:
        logger.error("Erro ao buscar BU do usuário: %s", e)
    
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Dependency Injection
# ─────────────────────────────────────────────────────────────────────────────

async def get_current_user(authorization: str | None = Header(None)) -> UserProfile:
    """Extrai e valida o usuário do header Authorization."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Scheme inválido")
    except ValueError:
        raise HTTPException(status_code=401, detail="Formato de Authorization inválido")
    
    payload = decode_jwt_token(token)
    
    return UserProfile(
        user_id=payload.get("sub"),
        email=payload.get("email"),
        name=payload.get("name"),
        bu_id=payload.get("bu_id"),
        bu_name=payload.get("bu_name"),
        bu_type=payload.get("bu_type"),
        roles=payload.get("roles", []),
        permissions=payload.get("permissions", []),
    )


def require_permission(permission: str):
    """Decorator para verificar permissão."""
    async def dependency(authorization: str | None = Header(None)) -> UserProfile:
        user = await get_current_user(authorization)
        if permission not in user.permissions:
            raise HTTPException(status_code=403, detail=f"Permissão '{permission}' necessária")
        return user
    return dependency


def require_role(role: str):
    """Decorator para verificar role."""
    async def dependency(authorization: str | None = Header(None)) -> UserProfile:
        user = await get_current_user(authorization)
        if role not in user.roles:
            raise HTTPException(status_code=403, detail=f"Role '{role}' necessária")
        return user
    return dependency
