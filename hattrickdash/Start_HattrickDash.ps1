#!/usr/bin/env pwsh
# Startet die HattrickDash-App (FastAPI auf Port 8765).
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (-not (Test-Path ".venv")) {
    Write-Host "Lege virtuelles Environment an..."
    python -m venv .venv
}

& .\.venv\Scripts\Activate.ps1

pip install -q -r requirements.txt

if (-not (Test-Path "config.json")) {
    Write-Warning "config.json fehlt - oeffne nach dem Start im Browser den [Admin]-Tab fuer die Einrichtung."
}

uvicorn main:app --host 0.0.0.0 --port 8765
