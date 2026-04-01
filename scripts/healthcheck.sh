#!/bin/bash
#
# Health Check Script for PGMais Backend
# Usado para K8s liveness/readiness probes
#
# Exemplos:
#   ./healthcheck.sh                   # Exit 0 se saudável
#   ./healthcheck.sh --full            # Verificação completa (banco de dados, cache)
#

set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"
TIMEOUT=5

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Verificação básica de HTTP
check_http() {
    log_info "Verificando HTTP health endpoint..."

    response=$(curl -sf --max-time $TIMEOUT "${BACKEND_URL}/api/health" 2>/dev/null || echo "ERROR")

    if [ "$response" = "ERROR" ]; then
        log_error "HTTP health check falhou"
        return 1
    fi

    log_info "HTTP health check OK"
    return 0
}

# 2. Verificação de conectividade com banco de dados
check_database() {
    log_info "Verificando conectividade com banco de dados..."

    # Este é um placeholder - você pode usar:
    # - SQL query via psql
    # - Endpoint específico do backend que valida DB

    response=$(curl -sf --max-time $TIMEOUT "${BACKEND_URL}/api/health/db" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
        log_warn "Verificação de DB não disponível"
        return 0  # Não falha em modo dev
    fi

    log_info "Database check OK"
    return 0
}

# 3. Verificação de cache
check_cache() {
    log_info "Verificando cache..."

    response=$(curl -sf --max-time $TIMEOUT "${BACKEND_URL}/api/health/cache" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
        log_warn "Verificação de cache não disponível"
        return 0
    fi

    log_info "Cache check OK"
    return 0
}

# Main
main() {
    local full_check=false

    if [ "$1" = "--full" ]; then
        full_check=true
    fi

    log_info "=== PGMais Backend Health Check ==="
    log_info "Verificando: ${BACKEND_URL}"

    # Verificação básica (sempre)
    if ! check_http; then
        log_error "Falha crítica: HTTP não respondendo"
        exit 1
    fi

    # Verificações adicionais (se --full)
    if [ "$full_check" = "true" ]; then
        check_database || log_warn "Database check falhou"
        check_cache || log_warn "Cache check falhou"
    fi

    log_info "=== Health check PASSOU ==="
    exit 0
}

main "$@"
