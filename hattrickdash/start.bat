@echo off
title HattrickDash
cd /d "%~dp0"
echo.
echo  HattrickDash starten...
echo  Erreichbar unter http://127.0.0.1:8765
echo  Zum Beenden: STRG+C druecken
echo.

:: venv pruefen, ggf. anlegen
if not exist ".venv\Scripts\python.exe" (
    echo  venv fehlt - bitte erst Setup.ps1 oder folgende Zeilen manuell ausfuehren:
    echo     python -m venv .venv
    echo     .\.venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

:: Alte Listener auf Port 8765 beenden
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":8765 .*LISTENING"') do (
    echo  Beende alten Prozess PID %%a...
    taskkill /PID %%a /F >nul 2>&1
)
:: ping statt timeout - funktioniert auch im Hidden-Mode
ping -n 3 127.0.0.1 >nul

:: Browser-Open bewusst NICHT - das KI-Dashboard oeffnet den Tab.
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8765
