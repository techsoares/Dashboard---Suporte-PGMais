@echo off
title Reiniciando Dashboard PGMais...

echo Encerrando processos anteriores...

:: Encerra processos nas portas 8000 (backend) e 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: Encerra janelas CMD com título do dashboard (caso existam)
taskkill /FI "WINDOWTITLE eq Backend PGMais" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend PGMais" /F >nul 2>&1

:: Aguarda processos encerrarem
timeout /t 2 /nobreak >nul

echo Iniciando Backend...
start "Backend PGMais" cmd /c "cd /d %~dp0backend && .venv\Scripts\activate && python main.py & exit"

:: Aguarda backend subir
timeout /t 3 /nobreak >nul

echo Iniciando Frontend...
start "Frontend PGMais" cmd /c "cd /d %~dp0frontend && npm run dev & exit"

echo.
echo Dashboard reiniciado com sucesso!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
timeout /t 3 /nobreak >nul
exit
