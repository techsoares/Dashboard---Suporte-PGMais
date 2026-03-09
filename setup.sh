#!/bin/bash

# Script para setup completo do PGMais Dashboard localmente

set -e

echo "🚀 PGMais Dashboard - Setup Local"
echo "=================================="

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado"
    exit 1
fi

# Verificar Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado"
    exit 1
fi

echo -e "${BLUE}✓ Python e Node encontrados${NC}"

# Backend
echo -e "\n${BLUE}📦 Configurando Backend...${NC}"
cd backend

# Criar venv se não existir
if [ ! -d ".venv" ]; then
    echo "  - Criando venv..."
    python3 -m venv .venv
fi

# Ativar venv
echo "  - Ativando venv..."
source .venv/bin/activate

# Instalar dependências
echo "  - Instalando dependências..."
pip install -q -r requirements.txt

# Verificar .env
if [ ! -f ".env" ]; then
    echo "  - Criando .env a partir de .env.example..."
    cp .env.example .env
    echo "  ⚠️  IMPORTANTE: Edite backend/.env com suas credenciais Jira se necessário"
fi

cd ..

# Frontend
echo -e "\n${BLUE}📦 Configurando Frontend...${NC}"
cd frontend

# Instalar dependências
if [ ! -d "node_modules" ]; then
    echo "  - Instalando dependências (pode demorar)..."
    npm install -q
else
    echo "  - Dependências já instaladas"
fi

# Verificar .env
if [ ! -f ".env.local" ]; then
    echo "  - Criando .env.local..."
    echo "# Local development - deixe vazio para usar http://localhost:8000 automaticamente" > .env.local
fi

cd ..

echo -e "\n${GREEN}✓ Setup concluído!${NC}"
echo -e "\n${BLUE}🎯 Próximos passos:${NC}"
echo ""
echo "Terminal 1 - Backend:"
echo "  cd backend"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo ""
echo "Terminal 2 - Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo -e "${GREEN}Dashboard: http://localhost:5173${NC}"
echo -e "${GREEN}API Docs: http://localhost:8000/docs${NC}"
