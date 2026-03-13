"""
Módulo de Cache - Gerencia cache em memória com persistência em SQLite

Implementa:
- Cache em memória com TTL por chave
- Persistência em SQLite para recuperação após restart
- Fallback automático: memória → banco de dados
- Limpeza automática de cache expirado
"""

import fnmatch
import time
from typing import Any, Optional
from dataclasses import dataclass, field
from database import get_cache, set_cache, clear_expired_cache


@dataclass
class CacheEntry:
    """
    Representa uma entrada no cache.
    
    Attributes:
        data: Dados armazenados
        timestamp: Momento do armazenamento (para cálculo de TTL)
    """
    data: Any
    timestamp: float = field(default_factory=time.time)


class MemoryCache:
    """
    Cache em memória com persistência em SQLite.
    
    Implementa:
    - TTL por chave
    - Fallback para banco de dados
    - Limpeza automática de expirados
    - Thread-safe para asyncio
    """

    def __init__(self, default_ttl: int = 300):
        """
        Inicializa cache.
        
        Args:
            default_ttl: TTL padrão em segundos (300 = 5 min)
        """
        self._store: dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        clear_expired_cache()

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
                return entry.data
            del self._store[key]
        
        # Fallback para banco de dados
        db_value = get_cache(key)
        if db_value is not None:
            self._store[key] = CacheEntry(data=db_value)
            return db_value
        
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
            ttl: TTL customizado (usa default se None)
        """
        self._store[key] = CacheEntry(data=data)
        set_cache(key, data, ttl or self.default_ttl)

    def invalidate(self, key: str) -> None:
        """
        Remove entrada do cache.
        
        Args:
            key: Chave a remover
        """
        self._store.pop(key, None)

    def invalidate_pattern(self, pattern: str) -> None:
        """
        Remove entradas que correspondem ao padrão glob.
        
        Exemplos:
        - 'dashboard_*' remove todas as chaves começando com 'dashboard_'
        - 'mgmt_*' remove todas as chaves de management
        
        Args:
            pattern: Padrão glob (ex: 'mgmt_*')
        """
        keys_to_remove = [k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_remove:
            del self._store[k]

    def clear(self) -> None:
        """
        Limpa todo o cache em memória.
        """
        self._store.clear()

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

# Instância global do cache
# Usada por toda a aplicação para armazenar dados com TTL
cache = MemoryCache(default_ttl=300)  # 5 minutos
