"""
OpenRouter AI Client — Integração com OpenRouter API.

Fornece:
- LLM inference (Claude, GPT, etc)
- Token counting
- Model listing

Status: Placeholder para fase posterior.
"""

import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger("pgmais.openrouter")


class OpenRouterClient:
    """Client para OpenRouter API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        logger.info("OpenRouterClient initialized")

    async def generate_insights(self, context: Dict[str, Any], prompt: str) -> str:
        """Gera insights sobre issues usando IA."""
        # TODO: Implementar chamada para OpenRouter
        raise NotImplementedError()

    async def list_models(self) -> List[str]:
        """Lista modelos disponíveis."""
        # TODO: Implementar listagem de modelos
        raise NotImplementedError()
