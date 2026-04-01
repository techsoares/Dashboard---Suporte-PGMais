"""
Database Base — Setup e gerenciamento de conexão com SQLite.

Fornece:
- Inicialização do banco de dados
- Pool de conexões
- Utilities de transação
"""

import sqlite3
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

from src.core.config import settings

logger = logging.getLogger("pgmais.database")

# Determina caminho do banco de dados
DB_PATH = Path(settings.database_url.replace("sqlite:///./", "./"))


class DatabaseManager:
    """Gerenciador de conexões SQLite."""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        logger.info(f"Database initialized at {self.db_path}")

    def get_connection(self) -> sqlite3.Connection:
        """Obtém conexão com banco de dados."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self) -> None:
        """Cria tabelas do banco de dados."""
        conn = self.get_connection()
        cursor = conn.cursor()

        # Tabela de cache
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS cache (
                id INTEGER PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                expires_at REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabela de BUs (Business Units)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bus (
                id INTEGER PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                type TEXT DEFAULT 'Operacional',
                members TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabela de priority requests
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS priority_requests (
                id INTEGER PRIMARY KEY,
                issue_key TEXT UNIQUE NOT NULL,
                priority TEXT NOT NULL,
                reason TEXT,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP
            )
        ''')

        # Tabela de account ranking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS account_ranking (
                id INTEGER PRIMARY KEY,
                account TEXT UNIQUE NOT NULL,
                rank INTEGER NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Tabela de users (para gestão de acesso)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                bu TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        ''')

        # Criar índices
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at)'
        )
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_priority_requests_issue_key '
            'ON priority_requests(issue_key)'
        )
        cursor.execute(
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)'
        )

        conn.commit()
        conn.close()
        logger.info("Database schema initialized")

    def clear_expired_cache(self) -> int:
        """Remove cache expirado. Retorna quantidade de linhas deletadas."""
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute(
            '''DELETE FROM cache
               WHERE expires_at IS NOT NULL AND expires_at < ?''',
            (datetime.now().timestamp(),)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()

        if deleted > 0:
            logger.info(f"Cleared {deleted} expired cache entries")

        return deleted

    def health_check(self) -> bool:
        """Verifica se banco está acessível."""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return False


# Instância global do gerenciador
db_manager = DatabaseManager()
