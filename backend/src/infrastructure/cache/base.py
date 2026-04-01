"""
Cache Base — Gerencia cache em memória com persistência em SQLite.

Implementa:
- Cache em memória com TTL por chave
- Persistência em SQLite para recuperação após restart
- Fallback automático: memória → banco de dados
- Padrão glob para invalidação
"""

import fnmatch
import time
import logging
from typing import Any, Optional
from dataclasses import dataclass, field

from src.infrastructure.database.queries import (
    get_cache as db_get_cache,
    set_cache as db_set_cache,
)

logger = logging.getLogger("pgmais.cache")


@dataclass
class CacheEntry:
    """Representa uma entrada no cache."""
    data: Any
    timestamp: float = field(default_factory=time.time)


class MemoryCache:
    """
    Cache em memória com persistência em SQLite.

    Implementa:
    - TTL por chave
    - Fallback para banco de dados
    - Limpeza automática de expirados
    - Padrão glob para invalidação
    """

    def __init__(self, default_ttl: int = 300):
        """
        Inicializa cache.

        Args:
            default_ttl: TTL padrão em segundos (300 = 5 min)
        """
        self._store: dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        logger.info(f"MemoryCache initialized with default_ttl={default_ttl}s")

    def get(self, key: str, ttl: Optional[int] = None) -> Optional[Any]:
        """
        Obtém valor do cache com fallback para banco de dados.

        Ordem de busca:
        1. Cache em memória (rápido)
        2. Banco de dados SQLite (persistência)
        3. None (não encontrado)

        Args:
            key: Chave do cache
            ttl: TTL customizado (usa default se None)

        Returns:
            Valor em cache ou None
        """
        # Tenta memória primeiro
        entry = self._store.get(key)
        if entry is not None:
            max_age = ttl if ttl is not None else self.default_ttl
            if time.time() - entry.timestamp <= max_age:
                logger.debug(f"Cache hit (memory): {key}")
                return entry.data

            # Expirado em memória
            del self._store[key]

        # Fallback para banco de dados
        try:
            db_value = db_get_cache(key)
            if db_value is not None:
                self._store[key] = CacheEntry(data=db_value)
                logger.debug(f"Cache hit (database): {key}")
                return db_value
        except Exception as e:
            logger.error(f"Database cache lookup failed for {key}: {str(e)}")

        logger.debug(f"Cache miss: {key}")
        return None

    def set(self, key: str, data: Any, ttl: Optional[int] = None) -> None:
        """
        Define valor no cache com persistência.

        Armazena em:
        1. Cache em memória (acesso rápido)
        2. Banco de dados SQLite (recuperação após restart)

        Args:
            key: Chave do cache
            data: Dados a armazenar
            ttl: TTL customizado em segundos (usa default se None)
        """
        ttl_seconds = ttl if ttl is not None else self.default_ttl
        ttl_minutes = ttl_seconds // 60

        # Memória
        self._store[key] = CacheEntry(data=data)

        # Banco de dados
        try:
            db_set_cache(key, data, ttl_minutes)
            logger.debug(f"Cache set: {key} (TTL: {ttl_minutes}min)")
        except Exception as e:
            logger.error(f"Failed to set cache in database for {key}: {str(e)}")

    def invalidate(self, key: str) -> None:
        """
        Remove entrada do cache.

        Args:
            key: Chave a remover
        """
        self._store.pop(key, None)
        logger.debug(f"Cache invalidated: {key}")

    def invalidate_pattern(self, pattern: str) -> int:
        """
        Remove entradas que correspondem ao padrão glob.

        Exemplos:
        - 'dashboard_*' remove todas as chaves começando com 'dashboard_'
        - 'mgmt_*' remove todas as chaves de management

        Args:
            pattern: Padrão glob (ex: 'dashboard_*')

        Returns:
            Quantidade de chaves removidas
        """
        keys_to_remove = [
            k for k in self._store.keys()
            if fnmatch.fnmatch(k, pattern)
        ]
        for k in keys_to_remove:
            del self._store[k]

        logger.debug(f"Cache invalidated pattern {pattern}: {len(keys_to_remove)} entries")
        return len(keys_to_remove)

    def clear(self) -> int:
        """
        Limpa todo o cache em memória.

        Returns:
            Quantidade de entradas removidas
        """
        count = len(self._store)
        self._store.clear()
        logger.info(f"Cache cleared: {count} entries removed")
        return count

    def age_seconds(self, key: str) -> Optional[float]:
        """
        Retorna idade da entrada em cache.

        Args:
            key: Chave a verificar

        Returns:
            Segundos desde armazenamento ou None
        """
        entry = self._store.get(key)
        if entry is None:
            return None
        return time.time() - entry.timestamp

    def ttl_remaining(self, key: str, ttl: Optional[int] = None) -> Optional[float]:
        """
        Retorna tempo restante antes de expirar.

        Args:
            key: Chave a verificar
            ttl: TTL customizado (usa default se None)

        Returns:
            Segundos restantes ou None se expirado/não existe
        """
        age = self.age_seconds(key)
        if age is None:
            return None

        max_age = ttl if ttl is not None else self.default_ttl
        remaining = max_age - age
        return remaining if remaining > 0 else None

    def stats(self) -> dict[str, Any]:
        """Retorna estatísticas do cache."""
        return {
            "size": len(self._store),
            "default_ttl": self.default_ttl,
            "keys": list(self._store.keys()),
        }


# Instância global do cache
# Usada por toda a aplicação para armazenar dados com TTL
# Dashboard: 5 min (300s)
# Historical: 1h (3600s)
cache = MemoryCache(default_ttl=300)
