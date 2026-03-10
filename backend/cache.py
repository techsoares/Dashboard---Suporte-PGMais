import fnmatch
import time
from typing import Any, Optional
from dataclasses import dataclass, field


@dataclass
class CacheEntry:
    data: Any
    timestamp: float = field(default_factory=time.time)


class MemoryCache:
    """
    Cache simples em memória com TTL por chave.
    Thread-safe para uso com asyncio (single-thread).
    """

    def __init__(self, default_ttl: int = 300):
        self._store: dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl  # segundos

    def get(self, key: str, ttl: Optional[int] = None) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        max_age = ttl if ttl is not None else self.default_ttl
        if time.time() - entry.timestamp > max_age:
            del self._store[key]
            return None
        return entry.data

    def set(self, key: str, data: Any) -> None:
        self._store[key] = CacheEntry(data=data)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def invalidate_pattern(self, pattern: str) -> None:
        """Remove chaves que correspondam ao padrão glob (ex: 'mgmt_*') ou o contenham."""
        keys_to_remove = [k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_remove:
            del self._store[k]

    def clear(self) -> None:
        self._store.clear()

    def age_seconds(self, key: str) -> Optional[float]:
        """Retorna há quantos segundos a entrada foi armazenada, ou None."""
        entry = self._store.get(key)
        if entry is None:
            return None
        return time.time() - entry.timestamp

    def ttl_remaining(self, key: str, ttl: Optional[int] = None) -> Optional[float]:
        """Retorna quantos segundos faltam para expirar, ou None se ausente/expirado."""
        age = self.age_seconds(key)
        if age is None:
            return None
        max_age = ttl if ttl is not None else self.default_ttl
        remaining = max_age - age
        return remaining if remaining > 0 else None


# Instância global usada pelo app
cache = MemoryCache(default_ttl=300)  # 5 minutos
