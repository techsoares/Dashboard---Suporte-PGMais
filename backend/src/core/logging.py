"""
Configuração centralizada de logging.

Fornece:
- Logger principal da aplicação
- Formatação padronizada
- Níveis de log configuráveis
"""

import logging
import sys
from typing import Optional


def setup_logging(
    name: str = "pgmais.dashboard",
    level: int = logging.INFO,
    format_string: Optional[str] = None,
) -> logging.Logger:
    """Configura e retorna um logger da aplicação.

    Args:
        name: Nome do logger (ex: "pgmais.dashboard")
        level: Nível de logging (INFO, DEBUG, WARNING, ERROR)
        format_string: Formato customizado (usa padrão se None)

    Returns:
        Logger configurado
    """
    if format_string is None:
        format_string = (
            "%(asctime)s [%(levelname)s] %(name)s — %(message)s"
        )

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Handler para console
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)

    # Formatter
    formatter = logging.Formatter(format_string)
    handler.setFormatter(formatter)

    # Adicionar handler se ainda não existe
    if not logger.handlers:
        logger.addHandler(handler)

    return logger


# Logger principal
logger = setup_logging()
