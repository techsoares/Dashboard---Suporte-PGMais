import fnmatch
import time
from typing import Any, Optional
from dataclasses import dataclass, field
from database import get_cache, set_cache, clear_expired_cache


@dataclass
class CacheEntry:
    data: Any
    timestamp: float = field(default_factory=time.time)


class MemoryCache:
    """
    Cache em memória com persistência em SQLite.
    TTL por chave com fallback para banco de dados.
    """

    def __init__(self, default_ttl: int = 300):
        self._store: dict[str, CacheEntry] = {}
        self.default_ttl = default_ttl
        clear_expired_cache()

    def get(self, key: str, ttl: Optional[int] = None) -> Optional[Any]:
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
        self._store[key] = CacheEntry(data=data)
        set_cache(key, data, ttl or self.default_ttl)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)

    def invalidate_pattern(self, pattern: str) -> None:
        keys_to_remove = [k for k in self._store.keys() if fnmatch.fnmatch(k, pattern)]
        for k in keys_to_remove:
            del self._store[k]

    def clear(self) -> None:
        self._store.clear()

    def age_seconds(self, key: str) -> Optional[float]:
        entry = self._store.get(key)
        if entry is None:
            return None
        return time.time() - entry.timestamp

    def ttl_remaining(self, key: str, ttl: Optional[int] = None) -> Optional[float]:
        age = self.age_seconds(key)
        if age is None:
            return None
        max_age = ttl if ttl is not None else self.default_ttl
        remaining = max_age - age
        return remaining if remaining > 0 else None


cache = MemoryCache(default_ttl=300)
