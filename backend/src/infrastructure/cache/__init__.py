"""
Módulo Cache — Cache em memória com persistência.

Fornece:
- MemoryCache: Cache em memória com fallback para SQLite
- cache: Instância global de MemoryCache (300s TTL)
- CacheEntry: Representa uma entrada no cache
"""

from .base import MemoryCache, CacheEntry, cache

__all__ = [
    "MemoryCache",
    "CacheEntry",
    "cache",
]
