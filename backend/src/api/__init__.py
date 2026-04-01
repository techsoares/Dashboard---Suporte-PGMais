"""
Módulo API — Rotas e endpoints da aplicação.

Fornece:
- v1: API versão 1 (rotas: auth, dashboard, priority, admin, health)
- deps: Injeção de dependências
"""

from . import v1
from . import deps

__all__ = ["v1", "deps"]
