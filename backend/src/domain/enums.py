"""
Enumerações de Domínio — Define constantes e tipos de enumeração.

Inclui:
- Roles (usuário, admin)
- Tipos de negócio (BU)
- Categorias de status
- Tipos de atividade
"""

from enum import Enum


class Role(str, Enum):
    """Papéis de usuário."""
    USER = "user"
    ADMIN = "admin"


class BUType(str, Enum):
    """Tipos de Unidade de Negócio."""
    OPERACIONAL = "Operacional"
    GESTAO = "Gestao"


class StatusCategory(str, Enum):
    """Categorias de status (padrão Jira)."""
    NEW = "new"                # A fazer / To Do
    INDETERMINATE = "indeterminate"  # Em andamento / In Progress
    DONE = "done"              # Concluído / Done


class ActivityType(str, Enum):
    """Tipos de atividade/customfield."""
    IMPLANTACAO = "Implantação"
    SUSTENTACAO = "Sustentação"


class IssueTypeValue(str, Enum):
    """Tipos de issue comuns."""
    PROBLEMA = "Problema"
    TAREFA = "Tarefa"
    MELHORIA = "Melhoria"
    EPIC = "Epic"
    SUBTASK = "Subtask"


class PriorityLevel(str, Enum):
    """Níveis de prioridade (padrão Jira)."""
    LOWEST = "Lowest"
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    HIGHEST = "Highest"


class TokenType(str, Enum):
    """Tipos de token de autenticação."""
    BEARER = "bearer"
    BASIC = "basic"
