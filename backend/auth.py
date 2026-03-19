"""
Autenticação com email/senha e Google OAuth2.
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
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

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


class GoogleLoginRequest(BaseModel):
    """Requisição de login via Google OAuth2."""
    credential: str  # ID Token retornado pelo Google Sign-In


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

# Google OAuth2
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()


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
# Jira User Matching
# ─────────────────────────────────────────────────────────────────────────────

def match_jira_display_name(email: str, google_name: str = "") -> Optional[str]:
    """Tenta dar match do usuário com um display_name do Jira.

    Estratégia:
    1. Match exato por email do Jira
    2. Match por nome normalizado (case-insensitive)
    3. Se não encontrar, retorna None
    """
    jira_users_file = os.path.join(os.path.dirname(__file__), ".jira_users_cache.json")
    if not os.path.exists(jira_users_file):
        return None
    try:
        with open(jira_users_file, "r", encoding="utf-8") as f:
            jira_users = json.loads(f.read().strip() or "[]")
    except Exception:
        return None

    # 1. Match por email
    for u in jira_users:
        if u.get("email", "").lower() == email:
            return u["display_name"]

    # 2. Match por nome (normalizado)
    if google_name:
        name_lower = google_name.strip().lower()
        for u in jira_users:
            if u.get("display_name", "").strip().lower() == name_lower:
                return u["display_name"]

    return None


def save_jira_users_cache(jira_users: list[dict]):
    """Salva cache dos usuários Jira para matching offline."""
    cache_file = os.path.join(os.path.dirname(__file__), ".jira_users_cache.json")
    try:
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(jira_users, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning("Erro ao salvar cache de Jira users: %s", e)


# ─────────────────────────────────────────────────────────────────────────────
# Session Tracking
# ─────────────────────────────────────────────────────────────────────────────

def record_login(email: str):
    """Registra timestamp de login e last_seen no users.json."""
    users = _load_users()
    if email in users:
        now = datetime.now(timezone.utc).isoformat()
        users[email]["last_login"] = now
        users[email]["last_seen"] = now
        _save_users(users)


def record_activity(email: str):
    """Atualiza last_seen do usuário (chamado em cada request autenticado)."""
    users = _load_users()
    if email in users:
        users[email]["last_seen"] = datetime.now(timezone.utc).isoformat()
        _save_users(users)


def get_online_users(threshold_minutes: int = 10) -> list[dict]:
    """Retorna usuários com atividade nos últimos N minutos."""
    users = _load_users()
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
    online = []
    for email, data in users.items():
        last_seen_str = data.get("last_seen")
        if not last_seen_str:
            continue
        try:
            last_seen = datetime.fromisoformat(last_seen_str)
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if last_seen >= cutoff:
                online.append({
                    "email": email,
                    "name": data.get("name", email),
                    "picture": data.get("picture", ""),
                    "bu_name": data.get("bu_name", ""),
                    "bu_type": data.get("bu_type", ""),
                    "roles": data.get("roles", []),
                    "auth_provider": data.get("auth_provider", "email"),
                    "last_login": data.get("last_login", ""),
                    "last_seen": last_seen_str,
                })
        except (ValueError, TypeError):
            continue
    # Ordenar por last_seen mais recente
    online.sort(key=lambda u: u["last_seen"], reverse=True)
    return online


def get_all_registered_users() -> list[dict]:
    """Retorna todos os usuários registrados no sistema."""
    users = _load_users()
    result = []
    for email, data in users.items():
        result.append({
            "email": email,
            "name": data.get("name", email),
            "picture": data.get("picture", ""),
            "bu_name": data.get("bu_name", ""),
            "bu_type": data.get("bu_type", ""),
            "roles": data.get("roles", []),
            "auth_provider": data.get("auth_provider", "email"),
            "last_login": data.get("last_login", ""),
            "last_seen": data.get("last_seen", ""),
        })
    result.sort(key=lambda u: u.get("last_seen", ""), reverse=True)
    return result


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
            # Auto-cadastro para domínios permitidos — tentar match com Jira
            fallback_name = email_lower.split('@')[0].replace('.', ' ').title()
            jira_name = match_jira_display_name(email_lower, fallback_name)
            name = jira_name or fallback_name
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
        
        record_login(email_lower)
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
# Google OAuth2 Login
# ─────────────────────────────────────────────────────────────────────────────

def verify_google_token(credential: str) -> dict:
    """Verifica e decodifica um ID Token do Google.

    Valida assinatura, audience (client_id), expiração e issuer.
    Retorna os dados do usuário: email, name, picture.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth não configurado. Defina GOOGLE_CLIENT_ID no .env")

    try:
        idinfo = google_id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )

        # Verificar issuer
        if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise ValueError("Issuer inválido")

        # Verificar que o email foi verificado pelo Google
        if not idinfo.get("email_verified", False):
            raise ValueError("Email não verificado pelo Google")

        return {
            "email": idinfo["email"].lower(),
            "name": idinfo.get("name", ""),
            "picture": idinfo.get("picture", ""),
        }
    except ValueError as e:
        logger.warning("Google token inválido: %s", str(e))
        raise HTTPException(status_code=401, detail="Token Google inválido ou expirado")


def authenticate_google_user(credential: str) -> UserProfile:
    """Autentica usuário via Google OAuth2.

    1. Verifica o ID Token do Google (assinatura, audience, expiração)
    2. Extrai email, nome e foto
    3. Valida domínio (@pgmais ou @ciclo)
    4. Cria ou vincula ao usuário existente em users.json
    5. Retorna UserProfile para geração do JWT
    """
    try:
        google_data = verify_google_token(credential)
        email_lower = google_data["email"]
        google_name = google_data["name"]
        google_picture = google_data["picture"]

        # Validar domínio
        if "@" not in email_lower:
            raise HTTPException(status_code=401, detail="Email inválido")
        email_domain = email_lower.rsplit("@", 1)[1]
        is_allowed_domain = any(email_domain == d or email_domain.endswith("." + d) for d in ALLOWED_DOMAINS)

        if not is_allowed_domain:
            logger.warning("Google login — domínio não permitido: %s", email_lower)
            raise HTTPException(status_code=401, detail="Apenas emails @pgmais ou @ciclo são permitidos")

        # Verificar se é admin
        is_admin = email_lower in [admin.lower() for admin in ADMIN_CREDENTIALS.keys()]

        # Buscar ou criar usuário
        user_bu = get_user_bu(email_lower)

        if not user_bu:
            # Auto-cadastro com dados do Google — tentar match com Jira
            fallback_name = google_name or email_lower.split('@')[0].replace('.', ' ').title()
            jira_name = match_jira_display_name(email_lower, fallback_name)
            user_bu = {
                "email": email_lower,
                "name": jira_name or fallback_name,
                "picture": google_picture,
                "bu_id": "default",
                "bu_name": "PGMais",
                "bu_type": "operacional",
                "roles": ["admin", "dev"] if is_admin else ["dev"],
                "permissions": ["read", "write", "admin", "manage_users"] if is_admin else ["read"],
                "auth_provider": "google",
            }
            users = _load_users()
            users[email_lower] = user_bu
            _save_users(users)
            logger.info("Novo usuário Google auto-cadastrado: %s (admin=%s)", email_lower, is_admin)
        else:
            # Atualizar dados do Google (nome e foto podem mudar)
            users = _load_users()
            if google_name:
                users[email_lower]["name"] = google_name
            if google_picture:
                users[email_lower]["picture"] = google_picture
            users[email_lower]["auth_provider"] = "google"
            _save_users(users)
            user_bu = users[email_lower]

        # Atualizar permissões se mudou para admin
        if is_admin and "admin" not in user_bu.get("roles", []):
            user_bu["roles"] = ["admin", "dev"]
            user_bu["permissions"] = ["read", "write", "admin", "manage_users"]
            users = _load_users()
            users[email_lower] = user_bu
            _save_users(users)
            logger.info("Usuário Google promovido a admin: %s", email_lower)

        # Sincronizar BU do bus.json
        try:
            bu_info = _get_user_bu_from_bus_file(user_bu.get("name", ""))
            if bu_info:
                user_bu["bu_id"] = bu_info["bu_id"]
                user_bu["bu_name"] = bu_info["bu_name"]
                user_bu["bu_type"] = bu_info["bu_type"]
                users = _load_users()
                users[email_lower] = user_bu
                _save_users(users)
        except Exception as e:
            logger.warning("Erro ao sincronizar BU para %s (Google): %s", email_lower, str(e))

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

        record_login(email_lower)
        logger.info("Login Google bem-sucedido: %s (admin=%s, bu_type=%s)", email_lower, is_admin, user.bu_type)
        return user

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Erro inesperado na autenticação Google: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Erro interno ao autenticar com Google.")


# ─────────────────────────────────────────────────────────────────────────────
# Dependency Injection
# ─────────────────────────────────────────────────────────────────────────────

# Throttle: grava last_seen no máximo 1x por minuto por usuário
_last_seen_cache: dict[str, datetime] = {}
_ACTIVITY_THROTTLE = timedelta(minutes=1)


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

    email = payload.get("email", "")
    # Atualizar last_seen com throttle para não sobrecarregar disco
    now = datetime.now(timezone.utc)
    last = _last_seen_cache.get(email)
    if not last or (now - last) >= _ACTIVITY_THROTTLE:
        _last_seen_cache[email] = now
        record_activity(email)

    return UserProfile(
        user_id=payload.get("sub"),
        email=email,
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
