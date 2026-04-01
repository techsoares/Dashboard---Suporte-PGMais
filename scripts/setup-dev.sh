#!/bin/bash
#
# Development Setup Script
# Prepara o ambiente para desenvolvimento local
#
# Exemplos:
#   ./setup-dev.sh                      # Setup completo
#   ./setup-dev.sh --backend-only       # Apenas backend
#   ./setup-dev.sh --frontend-only      # Apenas frontend
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}>>> $1${NC}"
}

# Backend setup
setup_backend() {
    log_step "Configurando Backend..."

    cd "$PROJECT_ROOT/backend"

    # Criar venv se não existir
    if [ ! -d ".venv" ]; then
        log_info "Criando virtual environment..."
        python3 -m venv .venv
    fi

    # Ativar venv
    source .venv/bin/activate || . .venv/Scripts/activate

    # Instalar dependências
    log_info "Instalando dependências Python..."
    pip install --upgrade pip setuptools wheel
    pip install -r requirements.txt

    # Criar .env se não existir
    if [ ! -f ".env" ]; then
        log_warn ".env não encontrado. Copiando de .env.example..."
        cp .env.example .env
        log_warn "⚠️  EDITE .env com suas credenciais do Jira e secrets!"
    fi

    log_info "Backend setup ✅"
}

# Frontend setup
setup_frontend() {
    log_step "Configurando Frontend..."

    cd "$PROJECT_ROOT/frontend"

    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js não instalado. Instale via https://nodejs.org/"
        return 1
    fi

    log_info "Node.js versão: $(node --version)"

    # Instalar dependências
    log_info "Instalando dependências npm..."
    npm ci || npm install

    # Criar .env se não existir
    if [ ! -f ".env" ]; then
        log_warn ".env não encontrado. Copiando de .env.example..."
        cp .env.example .env || true
    fi

    log_info "Frontend setup ✅"
}

# Docker setup
setup_docker() {
    log_step "Preparando Docker..."

    if ! command -v docker &> /dev/null; then
        log_warn "Docker não instalado. Pule esta seção ou instale Docker Desktop."
        return 0
    fi

    log_info "Docker versão: $(docker --version)"

    # Criar secrets file para docker-compose
    if [ ! -f "$PROJECT_ROOT/secrets" ]; then
        mkdir -p "$PROJECT_ROOT/secrets"
        log_warn "Crie $PROJECT_ROOT/secrets/postgres_password.txt com a senha do PostgreSQL"
    fi

    log_info "Docker setup ✅"
}

# Main
main() {
    local backend=true
    local frontend=true
    local docker=true

    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --backend-only)
                frontend=false
                docker=false
                ;;
            --frontend-only)
                backend=false
                docker=false
                ;;
            --no-docker)
                docker=false
                ;;
            *)
                log_error "Argumento desconhecido: $1"
                exit 1
                ;;
        esac
        shift
    done

    log_info "====== PGMais Development Setup ======"
    log_info "Diretório raiz: $PROJECT_ROOT"

    [ "$backend" = true ] && setup_backend || true
    [ "$frontend" = true ] && setup_frontend || true
    [ "$docker" = true ] && setup_docker || true

    log_info ""
    log_info "====== Setup Completo! ======"
    log_info "Próximos passos:"
    log_info "  1. Edite backend/.env com suas credenciais"
    log_info "  2. Execute: cd backend && python main.py"
    log_info "  3. Em outra janela: cd frontend && npm run dev"
    log_info "  4. Acesse: http://localhost:5173"
}

main "$@"
