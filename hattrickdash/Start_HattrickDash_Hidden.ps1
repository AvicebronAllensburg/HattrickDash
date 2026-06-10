#!/usr/bin/env pwsh
<#
    HattrickDash - Hidden-Start
    ----------------------------
    Startet den FastAPI-Server ohne sichtbares Konsolen-Fenster.
    Nutzt python.exe mit -WindowStyle Hidden, stdout/stderr -> Logfile.

    Logs landen in logs/app.log + logs/uvicorn.{out,err}.log.
    Stoppen mit Stop_HattrickDash.ps1 oder ueber die Admin-UI.
#>
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Warning "python.exe im venv fehlt - bitte zuerst .\Setup.ps1 ausfuehren."
    exit 1
}
if (-not (Test-Path "main.py")) {
    Write-Warning "main.py nicht gefunden - falsches Verzeichnis?"
    exit 1
}

# Logs-Verzeichnis sicherstellen
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }

# Falls schon einer laeuft: zuerst stoppen
$existing = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Bestehende Instanz auf Port 8765 wird gestoppt..." -ForegroundColor Yellow
    & "$PSScriptRoot\Stop_HattrickDash.ps1" | Out-Null
    Start-Sleep -Seconds 1
}

# python.exe (nicht pythonw, weil uvicorn echte stdout-Handles braucht)
# mit -WindowStyle Hidden. Konsole ist da, aber unsichtbar.
$argList = @(
    "-m", "uvicorn", "main:app",
    "--host", "0.0.0.0",
    "--port", "8765"
)

$stdoutLog = Join-Path $PSScriptRoot "logs\uvicorn.out.log"
$stderrLog = Join-Path $PSScriptRoot "logs\uvicorn.err.log"

$proc = Start-Process -FilePath $py `
    -ArgumentList $argList `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError  $stderrLog `
    -PassThru

if ($proc) {
    $proc.Id | Out-File -FilePath (Join-Path $PSScriptRoot ".server.pid") -Encoding ASCII -Force
    Write-Host "[OK] HattrickDash gestartet (hidden) - PID $($proc.Id)" -ForegroundColor Green
    Write-Host "  -> http://localhost:8765"
    Write-Host "  -> Stoppen mit: .\Stop_HattrickDash.ps1"
    Write-Host "  -> Logs:        logs\app.log + logs\uvicorn.{out,err}.log"
} else {
    Write-Host "[FEHLER] Start fehlgeschlagen" -ForegroundColor Red
    exit 1
}
