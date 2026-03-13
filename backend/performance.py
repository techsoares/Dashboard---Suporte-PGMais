"""
Módulo de Performance - Otimiza navegação e reduz gargalos
- Lazy loading de dados
- Paginação eficiente
- Compressão de resposta
- Prefetching inteligente
- Cache estratégico
"""

import logging
from typing import Any, List, Optional, Dict
from dataclasses import dataclass
from functools import lru_cache

logger = logging.getLogger("pgmais.performance")

# ============================================================================
# Paginação - Reduz tamanho de resposta
# ============================================================================

@dataclass
class PaginationParams:
    """
    Parâmetros de paginação para requisições.
    
    Attributes:
        page: Número da página (começa em 1)
        page_size: Itens por página (máximo 100)
        sort_by: Campo para ordenação
        sort_order: 'asc' ou 'desc'
    """
    page: int = 1
    page_size: int = 20
    sort_by: str = "created_at"
    sort_order: str = "desc"
    
    def __post_init__(self):
        """Valida e normaliza parâmetros."""
        # Garante valores válidos
        self.page = max(1, self.page)
        self.page_size = min(100, max(1, self.page_size))
        self.sort_order = "asc" if self.sort_order.lower() == "asc" else "desc"
    
    @property
    def offset(self) -> int:
        """Calcula offset para query."""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """Retorna limite de itens."""
        return self.page_size


@dataclass
class PaginatedResponse:
    """
    Resposta paginada padrão.
    
    Attributes:
        items: Lista de itens
        total: Total de itens disponíveis
        page: Página atual
        page_size: Itens por página
        total_pages: Total de páginas
    """
    items: List[Any]
    total: int
    page: int
    page_size: int
    
    @property
    def total_pages(self) -> int:
        """Calcula total de páginas."""
        return (self.total + self.page_size - 1) // self.page_size
    
    @property
    def has_next(self) -> bool:
        """Verifica se há próxima página."""
        return self.page < self.total_pages
    
    @property
    def has_previous(self) -> bool:
        """Verifica se há página anterior."""
        return self.page > 1


def paginate(items: List[Any], params: PaginationParams) -> PaginatedResponse:
    """
    Pagina lista de itens.
    
    Args:
        items: Lista completa de itens
        params: Parâmetros de paginação
        
    Returns:
        Resposta paginada
    """
    total = len(items)
    start = params.offset
    end = start + params.page_size
    
    paginated_items = items[start:end]
    
    return PaginatedResponse(
        items=paginated_items,
        total=total,
        page=params.page,
        page_size=params.page_size
    )


# ============================================================================
# Lazy Loading - Carrega dados sob demanda
# ============================================================================

class LazyLoader:
    """
    Carrega dados sob demanda para melhorar performance inicial.
    """
    
    def __init__(self):
        """Inicializa cache de dados lazy-loaded."""
        self._cache: Dict[str, Any] = {}
        self._loading: Dict[str, bool] = {}
    
    async def load(self, key: str, loader_func, *args, **kwargs) -> Any:
        """
        Carrega dados sob demanda com cache.
        
        Args:
            key: Chave única para cache
            loader_func: Função assíncrona que carrega dados
            *args: Argumentos para loader_func
            **kwargs: Argumentos nomeados para loader_func
            
        Returns:
            Dados carregados
        """
        # Retorna do cache se disponível
        if key in self._cache:
            logger.debug(f"Lazy load cache HIT for {key}")
            return self._cache[key]
        
        # Evita carregamento duplicado
        if self._loading.get(key, False):
            logger.debug(f"Lazy load already in progress for {key}")
            # Aguarda carregamento anterior
            while self._loading.get(key, False):
                await asyncio.sleep(0.1)
            return self._cache.get(key)
        
        # Marca como carregando
        self._loading[key] = True
        
        try:
            logger.debug(f"Lazy load starting for {key}")
            data = await loader_func(*args, **kwargs)
            self._cache[key] = data
            return data
        finally:
            self._loading[key] = False
    
    def invalidate(self, key: str):
        """
        Invalida cache para uma chave.
        
        Args:
            key: Chave a invalidar
        """
        self._cache.pop(key, None)
        logger.debug(f"Lazy load cache invalidated for {key}")
    
    def clear(self):
        """Limpa todo o cache."""
        self._cache.clear()
        logger.info("Lazy load cache cleared")


# ============================================================================
# Prefetching - Carrega dados antecipadamente
# ============================================================================

class PrefetchStrategy:
    """
    Define estratégia de prefetching para dados relacionados.
    """
    
    def __init__(self):
        """Inicializa estratégia."""
        self.prefetch_queue: List[tuple] = []
    
    def add_prefetch(self, key: str, loader_func, *args, **kwargs):
        """
        Adiciona item à fila de prefetch.
        
        Args:
            key: Chave única
            loader_func: Função que carrega dados
            *args: Argumentos
            **kwargs: Argumentos nomeados
        """
        self.prefetch_queue.append((key, loader_func, args, kwargs))
        logger.debug(f"Added prefetch for {key}")
    
    async def execute_prefetch(self, lazy_loader: LazyLoader):
        """
        Executa prefetch de todos os itens na fila.
        
        Args:
            lazy_loader: Instância de LazyLoader
        """
        logger.info(f"Starting prefetch of {len(self.prefetch_queue)} items")
        
        for key, loader_func, args, kwargs in self.prefetch_queue:
            try:
                await lazy_loader.load(key, loader_func, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Prefetch failed for {key}: {e}")
        
        self.prefetch_queue.clear()


# ============================================================================
# Compressão de Resposta - Reduz tamanho de dados
# ============================================================================

class ResponseCompressor:
    """
    Comprime respostas para reduzir banda.
    """
    
    @staticmethod
    def should_compress(data: Any, min_size: int = 1024) -> bool:
        """
        Determina se dados devem ser comprimidos.
        
        Args:
            data: Dados a comprimir
            min_size: Tamanho mínimo em bytes
            
        Returns:
            True se deve comprimir
        """
        import json
        try:
            size = len(json.dumps(data).encode('utf-8'))
            return size > min_size
        except:
            return False
    
    @staticmethod
    def compress_response(data: Any) -> bytes:
        """
        Comprime dados com gzip.
        
        Args:
            data: Dados a comprimir
            
        Returns:
            Dados comprimidos
        """
        import gzip
        import json
        
        json_data = json.dumps(data).encode('utf-8')
        compressed = gzip.compress(json_data, compresslevel=6)
        
        logger.debug(f"Compressed {len(json_data)} bytes to {len(compressed)} bytes")
        return compressed


# ============================================================================
# Query Optimization - Otimiza queries ao banco
# ============================================================================

class QueryOptimizer:
    """
    Otimiza queries ao banco de dados.
    """
    
    @staticmethod
    @lru_cache(maxsize=128)
    def build_select_fields(fields: tuple) -> str:
        """
        Constrói SELECT otimizado com apenas campos necessários.
        
        Args:
            fields: Tupla de campos a selecionar
            
        Returns:
            String SELECT otimizada
        """
        return ", ".join(fields)
    
    @staticmethod
    def build_where_clause(filters: Dict[str, Any]) -> tuple:
        """
        Constrói WHERE clause otimizada.
        
        Args:
            filters: Dicionário de filtros
            
        Returns:
            Tupla (where_clause, params)
        """
        conditions = []
        params = []
        
        for key, value in filters.items():
            if value is not None:
                conditions.append(f"{key} = ?")
                params.append(value)
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        return where_clause, params


# ============================================================================
# Monitoramento de Performance - Rastreia métricas
# ============================================================================

class PerformanceMonitor:
    """
    Monitora e registra métricas de performance.
    """
    
    def __init__(self):
        """Inicializa monitor."""
        self.metrics: Dict[str, List[float]] = {}
    
    def record_metric(self, name: str, value: float):
        """
        Registra métrica de performance.
        
        Args:
            name: Nome da métrica
            value: Valor (geralmente em ms)
        """
        if name not in self.metrics:
            self.metrics[name] = []
        
        self.metrics[name].append(value)
        
        # Mantém apenas últimas 1000 medições
        if len(self.metrics[name]) > 1000:
            self.metrics[name] = self.metrics[name][-1000:]
    
    def get_average(self, name: str) -> Optional[float]:
        """
        Retorna média de métrica.
        
        Args:
            name: Nome da métrica
            
        Returns:
            Média ou None se não existe
        """
        if name not in self.metrics or not self.metrics[name]:
            return None
        
        return sum(self.metrics[name]) / len(self.metrics[name])
    
    def get_stats(self, name: str) -> Optional[Dict[str, float]]:
        """
        Retorna estatísticas completas de métrica.
        
        Args:
            name: Nome da métrica
            
        Returns:
            Dicionário com min, max, avg ou None
        """
        if name not in self.metrics or not self.metrics[name]:
            return None
        
        values = self.metrics[name]
        return {
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "count": len(values)
        }


# Instâncias globais
lazy_loader = LazyLoader()
prefetch_strategy = PrefetchStrategy()
performance_monitor = PerformanceMonitor()
