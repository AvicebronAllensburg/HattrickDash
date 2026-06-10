#!/usr/bin/env pwsh
<#
    HattrickDash - Setup-Skript
    ----------------------------
    Idempotent: kann beliebig oft ausgefuehrt werden.

    Was es tut:
      1. Prueft Python (>= 3.11) und schlaegt Installation vor, falls nicht da
      2. Legt virtuelles Environment .venv/ an
      3. Aktualisiert pip
      4. Installiert alle Pakete aus requirements.txt
      5. Erstellt data/ und logs/ falls fehlt
      6. Prueft den OAuth-Status und gibt die naechsten Schritte aus
#>
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Write-Section($text) {
    Write-Host ""
    Write-Host "== $text ==" -ForegroundColor Cyan
}

function Write-OK($text)   { Write-Host "  [OK] $text" -ForegroundColor Green }
function Write-Warn($text) { Write-Host "  [!]  $text" -ForegroundColor Yellow }
function Write-Err($text)  { Write-Host "  [X]  $text" -ForegroundColor Red }

# ---------------------------------------------------------- 1) Python pruefen
Write-Section "Python pruefen"

$pythonCmd = $null
foreach ($candidate in @("python", "python3", "py")) {
    try {
        $version = & $candidate --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $candidate
            Write-OK "$candidate gefunden: $version"
            break
        }
    } catch { continue }
}

if (-not $pythonCmd) {
    Write-Err "Python ist nicht installiert oder nicht im PATH."
    Write-Host ""
    Write-Host "Installation per Windows Package Manager (winget):"
    Write-Host "    winget install Python.Python.3.12"
    Write-Host ""
    Write-Host "Oder ueber https://www.python.org/downloads/ herunterladen."
    Write-Host "Wichtig: bei der Installation 'Add Python to PATH' aktivieren."
    exit 1
}

# Mindestversion 3.11 pruefen
$verCheck = & $pythonCmd -c "import sys; print(1 if sys.version_info >= (3,11) else 0)"
if ($verCheck.Trim() -ne "1") {
    $verStr = & $pythonCmd -c "import sys; print('.'.join(map(str, sys.version_info[:3])))"
    Write-Err "Python $verStr gefunden - HattrickDash benoetigt mindestens 3.11."
    exit 1
}
Write-OK "Python-Version ist ausreichend"

# ---------------------------------------------------------- 2) venv anlegen
Write-Section "Virtuelles Environment"

if (Test-Path ".venv") {
    Write-OK ".venv existiert bereits"
} else {
    & $pythonCmd -m venv .venv
    if ($LASTEXITCODE -ne 0) { Write-Err "venv-Erstellung fehlgeschlagen"; exit 1 }
    Write-OK ".venv angelegt"
}

# Activation-Script ausfuehren
$activate = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $activate)) {
    Write-Err "Activate-Script fehlt: $activate"
    exit 1
}
& $activate

$pyExe = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

# ---------------------------------------------------------- 3) pip aktualisieren
Write-Section "pip aktualisieren"
& $pyExe -m pip install --upgrade pip --quiet --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { Write-Warn "pip-Update fehlgeschlagen, fahre fort" } else { Write-OK "pip aktualisiert" }

# ---------------------------------------------------------- 4) Dependencies
Write-Section "Dependencies installieren"

if (-not (Test-Path "requirements.txt")) {
    Write-Err "requirements.txt fehlt"
    exit 1
}

& $pyExe -m pip install -r requirements.txt --disable-pip-version-check
if ($LASTEXITCODE -ne 0) {
    Write-Err "pip install fehlgeschlagen"
    exit 1
}
Write-OK "Alle Pakete installiert"

# ---------------------------------------------------------- 5) Verzeichnisse
Write-Section "Daten- und Log-Verzeichnisse"
foreach ($dir in @("data", "logs", "data/lineups")) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-OK "$dir/ angelegt"
    } else {
        Write-OK "$dir/ existiert"
    }
}

# ---------------------------------------------------------- 6) Selbst-Test
Write-Section "Selbst-Test (Imports)"
$testCmd = "import sys, fastapi, sqlalchemy, apscheduler, lxml, requests_oauthlib, pydantic; print('imports ok')"
$result = & $pyExe -c $testCmd 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-OK "Alle Imports erfolgreich"
} else {
    Write-Err "Import-Fehler: $result"
    exit 1
}

# ---------------------------------------------------------- 7) OAuth-Status
Write-Section "OAuth-Status"
$authed = $false
if (Test-Path "config.json") {
    try {
        $cfg = Get-Content "config.json" -Raw | ConvertFrom-Json
        if ($cfg.access_token -and $cfg.access_token_secret) {
            $authed = $true
            $teamId = if ($cfg.team_id) { $cfg.team_id } else { "unbekannt" }
            Write-OK "OAuth bereits eingerichtet (Team-ID: $teamId)"
        }
    } catch {
        Write-Warn "config.json vorhanden, aber nicht lesbar"
    }
}

if (-not $authed) {
    Write-Warn "Kein OAuth-Token vorhanden - siehe naechste Schritte"
}

# ---------------------------------------------------------- 8) Naechste Schritte
Write-Section "Setup abgeschlossen"

Write-Host ""
if ($authed) {
    Write-Host "Du kannst die App jetzt direkt starten:" -ForegroundColor Green
    Write-Host ""
    Write-Host "    .\Start_HattrickDash.ps1            (sichtbares Konsolenfenster)" -ForegroundColor White
    Write-Host "    .\Start_HattrickDash_Hidden.ps1     (im Hintergrund, kein Fenster)" -ForegroundColor White
    Write-Host ""
    Write-Host "  -> Browser auf http://localhost:8765"
} else {
    Write-Host "Naechste Schritte (alles in der Browser-UI):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1) Server starten:"
    Write-Host "     .\Start_HattrickDash.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "  2) Browser oeffnen: http://localhost:8765"
    Write-Host ""
    Write-Host "  3) Im Top-Menue auf '[Admin]' klicken"
    Write-Host "     - Consumer-Key + Secret eintragen"
    Write-Host "     - OAuth-Login durchfuehren"
    Write-Host "     - Daten-Pull starten (Full-Init)"
    Write-Host ""
    Write-Host "  CHPP-App registrieren (kostenlos):"
    Write-Host "     https://chpp.hattrick.org/Apps/User/EditApp.aspx"
}

Write-Host ""
