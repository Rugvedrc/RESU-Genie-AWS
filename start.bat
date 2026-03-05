@echo off
echo ==========================================
echo   RESU-GENIE — Quick Start
echo ==========================================
echo.
echo Starting backend on http://localhost:5000
echo Starting frontend on http://localhost:3000
echo.
echo   DEMO_MODE=true (set in .env)
echo   No AWS keys required for demo.
echo.

REM Start backend (global Python, no venv)
start "RESU-GENIE Backend" cmd /k "cd /d %~dp0backend && python app.py"

timeout /t 3 /nobreak >nul

REM Start frontend
start "RESU-GENIE Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both servers starting...
echo Open http://localhost:3000 in your browser.
