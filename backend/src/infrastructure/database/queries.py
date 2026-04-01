"""
Database Queries — Funções de acesso a dados.

Fornece:
- Cache (get, set, clear)
- BU management
- Priority requests
- Account ranking
- User management
"""

import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from src.infrastructure.database.base import db_manager
from src.core.config import settings

logger = logging.getLogger("pgmais.database.queries")


# ============================================================================
# Cache Operations
# ============================================================================


def get_cache(key: str) -> Optional[Any]:
    """
    Obtém valor do cache por chave.

    Args:
        key: Chave do cache

    Returns:
        Valor desserializado ou None se não existe/expirado
    """
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        'SELECT value, expires_at FROM cache WHERE key = ?',
        (key,)
    )
    result = cursor.fetchone()
    conn.close()

    if result:
        value, expires_at = result
        # Verifica expiração
        if expires_at is None or datetime.now().timestamp() < expires_at:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.error(f"Failed to decode cache value for key: {key}")
                return None

    return None


def set_cache(key: str, value: Any, ttl_minutes: Optional[int] = None) -> None:
    """
    Define valor no cache com TTL opcional.

    Args:
        key: Chave do cache
        value: Valor a armazenar (será serializado como JSON)
        ttl_minutes: TTL em minutos (padrão: settings.cache_ttl_minutes)
    """
    if ttl_minutes is None:
        ttl_minutes = settings.cache_ttl_minutes

    conn = db_manager.get_connection()
    cursor = conn.cursor()

    expires_at = None
    if ttl_minutes:
        expires_at = datetime.now().timestamp() + (ttl_minutes * 60)

    try:
        cursor.execute(
            '''INSERT OR REPLACE INTO cache (key, value, expires_at)
               VALUES (?, ?, ?)''',
            (key, json.dumps(value), expires_at)
        )
        conn.commit()
        logger.debug(f"Cache set: {key}")
    except Exception as e:
        logger.error(f"Failed to set cache {key}: {str(e)}")
    finally:
        conn.close()


def delete_cache(key: str) -> None:
    """Deleta cache por chave."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM cache WHERE key = ?', (key,))
    conn.commit()
    conn.close()

    logger.debug(f"Cache deleted: {key}")


def clear_all_cache() -> int:
    """Limpa todo o cache. Retorna quantidade de linhas deletadas."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM cache')
    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    logger.info(f"Cache cleared: {deleted} entries removed")
    return deleted


# ============================================================================
# BU Operations
# ============================================================================


def get_all_bus() -> List[Dict[str, Any]]:
    """Obtém todas as BUs."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT id, name, type, members FROM bus ORDER BY name')
    results = cursor.fetchall()
    conn.close()

    bus_list = []
    for row in results:
        members = []
        try:
            if row[3]:
                members = json.loads(row[3])
        except json.JSONDecodeError:
            pass

        bus_list.append({
            "id": row[0],
            "name": row[1],
            "type": row[2],
            "members": members,
        })

    return bus_list


def create_bu(name: str, bu_type: str = "Operacional", members: Optional[List[str]] = None) -> None:
    """Cria nova BU."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO bus (name, type, members) VALUES (?, ?, ?)',
            (name, bu_type, json.dumps(members or []))
        )
        conn.commit()
        logger.info(f"BU created: {name}")
    except Exception as e:
        logger.error(f"Failed to create BU {name}: {str(e)}")
    finally:
        conn.close()


def update_bu(name: str, bu_type: Optional[str] = None, members: Optional[List[str]] = None) -> None:
    """Atualiza BU."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    if bu_type and members:
        cursor.execute(
            'UPDATE bu SET type = ?, members = ? WHERE name = ?',
            (bu_type, json.dumps(members), name)
        )
    elif bu_type:
        cursor.execute('UPDATE bus SET type = ? WHERE name = ?', (bu_type, name))
    elif members:
        cursor.execute(
            'UPDATE bus SET members = ? WHERE name = ?',
            (json.dumps(members), name)
        )

    conn.commit()
    conn.close()
    logger.debug(f"BU updated: {name}")


def delete_bu(name: str) -> None:
    """Deleta BU."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM bus WHERE name = ?', (name,))
    conn.commit()
    conn.close()

    logger.info(f"BU deleted: {name}")


# ============================================================================
# Priority Requests
# ============================================================================


def get_all_priority_requests() -> List[Dict[str, Any]]:
    """Obtém todas as requisições de priorização ativas."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''SELECT issue_key, priority, reason, created_by, created_at
           FROM priority_requests
           WHERE resolved_at IS NULL
           ORDER BY created_at DESC'''
    )
    results = cursor.fetchall()
    conn.close()

    return [
        {
            "issue_key": row[0],
            "priority": row[1],
            "reason": row[2],
            "created_by": row[3],
            "created_at": row[4],
        }
        for row in results
    ]


def create_priority_request(
    issue_key: str,
    priority: str,
    reason: str = "",
    created_by: str = ""
) -> None:
    """Cria requisição de priorização."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            '''INSERT OR REPLACE INTO priority_requests
               (issue_key, priority, reason, created_by)
               VALUES (?, ?, ?, ?)''',
            (issue_key, priority, reason, created_by)
        )
        conn.commit()
        logger.info(f"Priority request created: {issue_key}")
    except Exception as e:
        logger.error(f"Failed to create priority request for {issue_key}: {str(e)}")
    finally:
        conn.close()


def resolve_priority_request(issue_key: str) -> None:
    """Marca requisição de priorização como resolvida."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        'UPDATE priority_requests SET resolved_at = ? WHERE issue_key = ?',
        (datetime.now().isoformat(), issue_key)
    )
    conn.commit()
    conn.close()

    logger.debug(f"Priority request resolved: {issue_key}")


def delete_priority_request(issue_key: str) -> None:
    """Deleta requisição de priorização."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('DELETE FROM priority_requests WHERE issue_key = ?', (issue_key,))
    conn.commit()
    conn.close()

    logger.debug(f"Priority request deleted: {issue_key}")


# ============================================================================
# Account Ranking
# ============================================================================


def get_account_ranking() -> List[Dict[str, Any]]:
    """Obtém ranking de contas."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT account, rank FROM account_ranking ORDER BY rank')
    results = cursor.fetchall()
    conn.close()

    return [{"account": row[0], "rank": row[1]} for row in results]


def set_account_ranking(rankings: List[Dict[str, Any]]) -> None:
    """Define ranking de contas (substitui completamente)."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    # Limpa ranking antigo
    cursor.execute('DELETE FROM account_ranking')

    # Insere novo ranking
    for ranking in rankings:
        cursor.execute(
            'INSERT INTO account_ranking (account, rank) VALUES (?, ?)',
            (ranking["account"], ranking["rank"])
        )

    conn.commit()
    conn.close()

    logger.info(f"Account ranking updated: {len(rankings)} entries")


# ============================================================================
# User Management
# ============================================================================


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Obtém usuário por email."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        '''SELECT id, email, display_name, role, bu, is_active, created_at, last_login
           FROM users WHERE email = ?''',
        (email,)
    )
    result = cursor.fetchone()
    conn.close()

    if result:
        return {
            "id": result[0],
            "email": result[1],
            "display_name": result[2],
            "role": result[3],
            "bu": result[4],
            "is_active": bool(result[5]),
            "created_at": result[6],
            "last_login": result[7],
        }

    return None


def get_all_users(active_only: bool = True) -> List[Dict[str, Any]]:
    """Obtém todos os usuários."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    query = 'SELECT id, email, display_name, role, bu, is_active, created_at, last_login FROM users'
    if active_only:
        query += ' WHERE is_active = 1'
    query += ' ORDER BY display_name'

    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "email": row[1],
            "display_name": row[2],
            "role": row[3],
            "bu": row[4],
            "is_active": bool(row[5]),
            "created_at": row[6],
            "last_login": row[7],
        }
        for row in results
    ]


def create_user(
    email: str,
    display_name: str,
    role: str = "user",
    bu: Optional[str] = None
) -> None:
    """Cria novo usuário."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            '''INSERT INTO users (email, display_name, role, bu, is_active)
               VALUES (?, ?, ?, ?, 1)''',
            (email, display_name, role, bu)
        )
        conn.commit()
        logger.info(f"User created: {email}")
    except Exception as e:
        logger.error(f"Failed to create user {email}: {str(e)}")
    finally:
        conn.close()


def update_user_last_login(email: str) -> None:
    """Atualiza último login do usuário."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        'UPDATE users SET last_login = ? WHERE email = ?',
        (datetime.now().isoformat(), email)
    )
    conn.commit()
    conn.close()


def update_user(email: str, **kwargs) -> None:
    """Atualiza dados de usuário."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    allowed_fields = {"display_name", "role", "bu", "is_active"}
    fields_to_update = {k: v for k, v in kwargs.items() if k in allowed_fields}

    if not fields_to_update:
        conn.close()
        return

    fields_to_update["updated_at"] = datetime.now().isoformat()

    set_clause = ", ".join([f"{k} = ?" for k in fields_to_update.keys()])
    query = f"UPDATE users SET {set_clause} WHERE email = ?"

    cursor.execute(query, list(fields_to_update.values()) + [email])
    conn.commit()
    conn.close()

    logger.debug(f"User updated: {email}")


def delete_user(email: str) -> None:
    """Marca usuário como inativo (soft delete)."""
    conn = db_manager.get_connection()
    cursor = conn.cursor()

    cursor.execute(
        'UPDATE users SET is_active = 0 WHERE email = ?',
        (email,)
    )
    conn.commit()
    conn.close()

    logger.info(f"User deactivated: {email}")
