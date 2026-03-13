@echo off
title Reiniciando Dashboard...
echo.
echo ========================================
echo   REINICIANDO PGMAIS DASHBOARD
echo ========================================
echo.

echo [1/2] Parando processos...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Backend*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Frontend*" 2>nul
timeout /t 2 /nobreak >nul

echo [2/2] Iniciando novamente...
start "Backend - PGMais Dashboard" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && python main.py"
timeout /t 3 /nobreak >nul
start "Frontend - PGMais Dashboard" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   DASHBOARD REINICIADO!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Esta janela fechara em 3 segundos...
timeout /t 3 /nobreak >nul
exit
