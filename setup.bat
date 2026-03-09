@echo off
REM Script para setup completo do PGMais Dashboard localmente (Windows)

setlocal enabledelayedexpansion

echo.
echo 🚀 PGMais Dashboard - Setup Local (Windows)
echo ============================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado
    echo    Instale em: https://www.python.org/downloads/
    exit /b 1
)

REM Verificar Node
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado
    echo    Instale em: https://nodejs.org/
    exit /b 1
)

echo ✓ Python e Node encontrados
echo.

REM Backend
echo 📦 Configurando Backend...
cd backend

REM Criar venv se não existir
if not exist ".venv" (
    echo   - Criando venv...
    python -m venv .venv
)

REM Ativar venv
echo   - Ativando venv...
call .venv\Scripts\activate.bat

REM Instalar dependências
echo   - Instalando dependências...
pip install -q -r requirements.txt

REM Verificar .env
if not exist ".env" (
    echo   - Criando .env a partir de .env.example...
    copy .env.example .env >nul
    echo   ⚠️  IMPORTANTE: Edite backend\.env com suas credenciais Jira se necessário
)

cd ..

REM Frontend
echo.
echo 📦 Configurando Frontend...
cd frontend

REM Instalar dependências
if not exist "node_modules" (
    echo   - Instalando dependências ^(pode demorar^)...
    call npm install -q
) else (
    echo   - Dependências já instaladas
)

REM Verificar .env.local
if not exist ".env.local" (
    echo   - Criando .env.local...
    (
        echo # Local development - deixe vazio para usar http://localhost:8000 automaticamente
    ) > .env.local
)

cd ..

echo.
echo ✓ Setup concluído!
echo.
echo 🎯 Próximos passos:
echo.
echo Terminal 1 - Backend:
echo   cd backend
echo   .venv\Scripts\activate.bat
echo   python main.py
echo.
echo Terminal 2 - Frontend:
echo   cd frontend
echo   npm run dev
echo.
echo 🌐 Dashboard: http://localhost:5173
echo 📚 API Docs: http://localhost:8000/docs
echo.
pause
