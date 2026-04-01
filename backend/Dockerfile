# =============================================================================
# Stage 1: Builder
# Compila dependências em ambiente de build (com ferramentas de compilação)
# =============================================================================
FROM python:3.11-slim-bullseye AS builder

WORKDIR /build

COPY requirements.txt .

# Instalar dependências em diretório /build/.local (para copiar depois)
RUN pip install --user --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Runtime (Distroless)
# Imagem final: sem shell, sem pacotes de sistema, apenas o mínimo necessário
# Executa como usuário non-root (UID 65532 no distroless)
# =============================================================================
FROM gcr.io/distroless/python3-debian12:nonroot

# Metadados
LABEL maintainer="PGMais Team <team@pgmais.dev>"
LABEL description="PGMais Backend - Production-hardened FastAPI application"
LABEL version="1.0"

WORKDIR /app

# Copiar dependências instaladas do builder
COPY --from=builder /root/.local /root/.local

# Copiar código da aplicação (com ownership correto para nonroot)
COPY --chown=65532:65532 . /app

# Definir PATH para incluir pip packages do usuário
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random

# Expor porta
EXPOSE 8000

# Distroless já roda como nonroot por padrão
# USER nonroot  # Comentado pois distroless:nonroot já aplica isso

# Health check para K8s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/usr/bin/python3", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health').read()"]

# Executar aplicação
ENTRYPOINT ["/root/.local/bin/python"]
CMD ["main.py"]

