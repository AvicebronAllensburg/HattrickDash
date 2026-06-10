#!/usr/bin/env pwsh
<#
    HattrickDash - Restart
    -----------------------
    Wird typischerweise von der Admin-API aufgerufen
    (mit -ServerPid des aktuellen Prozesses).

    HINWEIS: Wir verwenden $ServerPid, nicht $Pid - $PID ist eine
    reservierte Auto-Variable in PowerShell und darf nicht als
    Parameter-Name benutzt werden.

    Manuell:
        .\Restart_HattrickDash.ps1
#>
param(
    [int]$ServerPid = 0,
    [int]$WaitSeconds = 2
)

$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path $PSScriptRoot

# Eigene Logfile, damit man bei Hidden-Restarts nachvollziehen kann was passiert
$logFile = Join-Path $PSScriptRoot "logs\restart.log"
if (-not (Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" | Out-Null }
function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    $line | Out-File -FilePath $logFile -Append -Encoding UTF8
}

Log "=== Restart angestossen (ServerPid=$ServerPid) ==="
Start-Sleep -Seconds $WaitSeconds

# Schritt 1: Caller-PID gezielt killen
if ($ServerPid -gt 0) {
    Log "Stoppe Caller-PID $ServerPid"
    Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue
}

# Schritt 2: Alle Listener auf 8765 weg-raeumen
$conn = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    foreach ($c in $conn) {
        Log "Stoppe Port-Listener PID $($c.OwningProcess)"
        Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

# Schritt 3: Verwaiste python-Prozesse aus diesem Ordner killen
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match [regex]::Escape($PSScriptRoot) -and $_.CommandLine -match "main:app" } |
    ForEach-Object {
        Log "Cleanup PID $($_.ProcessId)"
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Start-Sleep -Seconds 1

# Schritt 4: Frischen Server hochfahren
Log "Starte neuen Server (Hidden)"
$startScript = Join-Path $PSScriptRoot "Start_HattrickDash_Hidden.ps1"
if (Test-Path $startScript) {
    & $startScript 2>&1 | ForEach-Object { Log $_ }
    Log "=== Restart fertig ==="
} else {
    Log "FEHLER: $startScript nicht gefunden"
}
