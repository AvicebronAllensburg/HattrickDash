#!/usr/bin/env pwsh
<#
    Stoppt alle HattrickDash-Instanzen.
    Sucht nach Prozessen, die Port 8765 belegen, und beendet sie.
#>
$ErrorActionPreference = "SilentlyContinue"
$port = 8765

Write-Host "Suche Prozesse auf Port $port..." -ForegroundColor Cyan

$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) {
        $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Beende: PID=$($proc.Id) Name=$($proc.ProcessName)" -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }
} else {
    Write-Host "  Keine Listener auf Port $port - nichts zu tun." -ForegroundColor Green
}

# Cleanup verwaister python-Prozesse aus diesem Ordner.
# NUR ueber den Projektpfad matchen — "main:app" allein trifft JEDES andere
# FastAPI-Tool (auch KI_Watchdog auf 8779) und killt es per Force (stiller Tod).
$projectPath = $PSScriptRoot
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" |
    Where-Object { $_.CommandLine -match [regex]::Escape($projectPath) } |
    ForEach-Object {
        Write-Host "  Cleanup: PID=$($_.ProcessId) ($($_.Name))" -ForegroundColor Yellow
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Start-Sleep -Milliseconds 500
$still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "[FEHLER] Port $port immer noch belegt!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "[OK] HattrickDash gestoppt." -ForegroundColor Green
}
