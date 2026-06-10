"""
Admin-API: CHPP-Konfiguration, OAuth-Wizard, manuelle Pulls,
Logs, Scheduler-Status, Server-Steuerung.

Sicherheit: Alle Endpoints sind nur über localhost (127.0.0.1) erreichbar.
"""
from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from requests_oauthlib import OAuth1Session
from sqlalchemy import select

import config
from chpp import fetcher

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

# In-Memory-Speicher für OAuth-Wizard zwischen Start- und Finish-Aufruf
_oauth_state: dict = {}


# =================================================================== Status
@router.get("/status")
def status() -> dict:
    """Liefert kompletten Health-Snapshot für die Admin-UI."""
    has_consumer = bool(config.CONSUMER_KEY and config.CONSUMER_SECRET)
    db_size = config.DB_PATH.stat().st_size if config.DB_PATH.exists() else 0
    log_size = (config.LOG_DIR / "app.log").stat().st_size if (config.LOG_DIR / "app.log").exists() else 0

    return {
        "authenticated": config.is_authenticated(),
        "has_consumer": has_consumer,
        "consumer_key_masked": _mask(config.CONSUMER_KEY),
        "team_id": config.TEAM_ID,
        "config_file": str(config.CONFIG_FILE),
        "db_path": str(config.DB_PATH),
        "db_size_bytes": db_size,
        "log_size_bytes": log_size,
        "static_dir": str(config.STATIC_DIR),
        "host": config.APP_HOST,
        "port": config.APP_PORT,
        "pid": os.getpid(),
        "scheduler_running": _scheduler_running(),
        "now": datetime.now().isoformat(),
    }


def _mask(s: str) -> str:
    if not s:
        return ""
    if len(s) <= 8:
        return "*" * len(s)
    return s[:4] + "*" * (len(s) - 8) + s[-4:]


def _scheduler_running() -> bool:
    try:
        from scheduler import _scheduler
        return _scheduler is not None and _scheduler.running
    except Exception:
        return False


# ============================================================ Consumer Save
class ConsumerRequest(BaseModel):
    consumer_key: str
    consumer_secret: str


@router.post("/consumer")
def save_consumer(req: ConsumerRequest) -> dict:
    """Speichert Consumer-Key + -Secret in config.json."""
    if not req.consumer_key.strip() or not req.consumer_secret.strip():
        raise HTTPException(400, "Consumer Key / Secret darf nicht leer sein.")
    config.save_consumer_credentials(req.consumer_key.strip(), req.consumer_secret.strip())
    log.info("Consumer-Credentials aktualisiert")
    return {"status": "ok", "consumer_key_masked": _mask(config.CONSUMER_KEY)}


# ============================================================ OAuth-Wizard
@router.post("/oauth/start")
def oauth_start() -> dict:
    """Phase 1: Request-Token holen, Auth-URL liefern."""
    if not config.CONSUMER_KEY or not config.CONSUMER_SECRET:
        raise HTTPException(400, "Bitte zuerst Consumer-Key + -Secret speichern.")
    try:
        oauth = OAuth1Session(
            config.CONSUMER_KEY,
            client_secret=config.CONSUMER_SECRET,
            callback_uri="oob",
        )
        fetched = oauth.fetch_request_token(config.CHPP_OAUTH_REQUEST_URL)
        request_token = fetched["oauth_token"]
        request_secret = fetched["oauth_token_secret"]
        auth_url = oauth.authorization_url(config.CHPP_OAUTH_AUTHORIZE_URL)

        _oauth_state["request_token"] = request_token
        _oauth_state["request_secret"] = request_secret
        _oauth_state["started_at"] = time.time()

        return {"status": "ok", "auth_url": auth_url}
    except Exception as exc:
        log.exception("oauth/start fehlgeschlagen")
        raise HTTPException(502, f"Hattrick lehnte Request-Token ab: {exc}")


class PinRequest(BaseModel):
    pin: str


@router.post("/oauth/finish")
def oauth_finish(req: PinRequest) -> dict:
    """Phase 2: PIN → Access-Token holen, speichern, Team-ID ermitteln."""
    pin = req.pin.strip()
    if not pin:
        raise HTTPException(400, "PIN fehlt.")
    if "request_token" not in _oauth_state:
        raise HTTPException(400, "Erst /oauth/start aufrufen.")

    try:
        oauth = OAuth1Session(
            config.CONSUMER_KEY,
            client_secret=config.CONSUMER_SECRET,
            resource_owner_key=_oauth_state["request_token"],
            resource_owner_secret=_oauth_state["request_secret"],
            verifier=pin,
        )
        tokens = oauth.fetch_access_token(config.CHPP_OAUTH_ACCESS_URL)
        access_token = tokens["oauth_token"]
        access_secret = tokens["oauth_token_secret"]

        # Team-ID via teamdetails
        from chpp.auth import _detect_team_id
        team_id = _detect_team_id(config.CONSUMER_KEY, config.CONSUMER_SECRET, access_token, access_secret)
        config.save_oauth_tokens(access_token, access_secret, team_id=team_id)
        _oauth_state.clear()
        log.info("OAuth-Wizard abgeschlossen, Team-ID %s", team_id)
        return {"status": "ok", "team_id": team_id, "needs_restart": True}
    except Exception as exc:
        log.exception("oauth/finish fehlgeschlagen")
        raise HTTPException(502, f"Hattrick lehnte PIN ab: {exc}")


@router.post("/oauth/clear")
def oauth_clear() -> dict:
    """Löscht gespeicherte Access-Tokens (Consumer bleibt erhalten)."""
    cfg = {}
    if config.CONFIG_FILE.exists():
        cfg = json.loads(config.CONFIG_FILE.read_text(encoding="utf-8"))
    cfg.pop("access_token", None)
    cfg.pop("access_token_secret", None)
    # team_id bleibt erhalten: stabiler Identifier des Hattrick-Accounts,
    # aendert sich beim Re-Login nicht. Falls _detect_team_id nach dem
    # naechsten OAuth-Refresh kurz failt (z. B. erste Sekunden nach
    # Token-Issue), waere die ID sonst weg trotz bekannter Information.
    config.CONFIG_FILE.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    config.ACCESS_TOKEN = ""
    config.ACCESS_TOKEN_SECRET = ""
    log.info("OAuth-Tokens gelöscht")
    return {"status": "ok", "needs_restart": True}


# ================================================================ Manual Pulls
_FETCH_FUNCTIONS = {
    "team": fetcher.fetch_team_details,
    "players": fetcher.fetch_players,
    "economy": fetcher.fetch_economy,
    "arena": fetcher.fetch_arena,
    "training": fetcher.fetch_training_info,
    "staff": fetcher.fetch_staff,
    "matchlist": fetcher.fetch_match_list,
    "transfers": fetcher.fetch_transfers_team,
}


@router.post("/fetch/{endpoint}")
def fetch_one(endpoint: str) -> dict:
    """Pullt einen einzelnen Endpoint aus CHPP."""
    if not config.is_authenticated():
        raise HTTPException(401, "Nicht authentifiziert.")
    fn = _FETCH_FUNCTIONS.get(endpoint)
    if not fn:
        raise HTTPException(400, f"Unbekannter Endpoint: {endpoint}. Verfügbar: {list(_FETCH_FUNCTIONS)}")
    try:
        result = fn()
        return {"status": "ok", "endpoint": endpoint, "result": result}
    except Exception as exc:
        log.exception("Fetch %s fehlgeschlagen", endpoint)
        raise HTTPException(502, f"{endpoint} fehlgeschlagen: {exc}")


@router.post("/fetch/match/{match_id}")
def fetch_match(match_id: int) -> dict:
    if not config.is_authenticated():
        raise HTTPException(401, "Nicht authentifiziert.")
    try:
        result = fetcher.fetch_match_details(match_id)
        return {"status": "ok", "match_id": match_id, "result": result}
    except Exception as exc:
        log.exception("matchdetails %s fehlgeschlagen", match_id)
        raise HTTPException(502, f"matchdetails fehlgeschlagen: {exc}")


@router.post("/fetch/opponent-history/{opponent_id}")
def fetch_opponent(opponent_id: int, n_recent: int = 5) -> dict:
    """
    Pullt matchlist + matchdetails + matchlineup für einen Gegner-Team.
    Wird von der Aufstellungs-Seite genutzt, um Gegner-Lineups zu schätzen.
    """
    if not config.is_authenticated():
        raise HTTPException(401, "Nicht authentifiziert.")
    try:
        result = fetcher.fetch_opponent_history(opponent_id, n_recent=n_recent)
        return {"status": "ok", **result}
    except Exception as exc:
        log.exception("Gegner-History %s fehlgeschlagen", opponent_id)
        raise HTTPException(502, f"Gegner-History-Pull fehlgeschlagen: {exc}")


@router.post("/full-init")
def full_init() -> dict:
    """Kompletter Initial-Pull aller verfügbaren Endpoints (kann ~1 Minute dauern)."""
    if not config.is_authenticated():
        raise HTTPException(401, "Nicht authentifiziert.")
    try:
        fetcher.full_init()
        return {"status": "ok", "message": "Full-Init abgeschlossen."}
    except Exception as exc:
        log.exception("full-init fehlgeschlagen")
        raise HTTPException(502, f"Full-Init fehlgeschlagen: {exc}")


# ================================================================== Logs
@router.get("/logs")
def tail_logs(lines: int = 200) -> dict:
    """Gibt die letzten N Zeilen aus logs/app.log zurück."""
    log_file = config.LOG_DIR / "app.log"
    if not log_file.exists():
        return {"lines": [], "file": str(log_file)}
    try:
        with log_file.open("r", encoding="utf-8", errors="replace") as f:
            content = f.readlines()
        tail = content[-max(1, min(lines, 5000)):]
        return {"lines": [l.rstrip("\n") for l in tail], "file": str(log_file), "total_lines": len(content)}
    except Exception as exc:
        raise HTTPException(500, f"Log-Lesen fehlgeschlagen: {exc}")


# ================================================================ Scheduler
@router.get("/scheduler")
def scheduler_info() -> dict:
    try:
        from scheduler import _scheduler
        if _scheduler is None or not _scheduler.running:
            return {"running": False, "jobs": []}
        jobs = []
        for j in _scheduler.get_jobs():
            jobs.append({
                "id": j.id,
                "next_run": j.next_run_time.isoformat() if j.next_run_time else None,
                "trigger": str(j.trigger),
            })
        return {"running": True, "jobs": jobs}
    except Exception as exc:
        return {"running": False, "error": str(exc)}


@router.post("/scheduler/run/{job_id}")
def scheduler_run(job_id: str) -> dict:
    """Führt einen Scheduler-Job sofort aus (blockiert nicht)."""
    try:
        from scheduler import _scheduler
        if _scheduler is None:
            raise HTTPException(503, "Scheduler nicht aktiv.")
        job = _scheduler.get_job(job_id)
        if not job:
            raise HTTPException(404, f"Unbekannter Job: {job_id}")
        # Job-Funktion in Thread ausführen, damit der HTTP-Call nicht blockt
        threading.Thread(target=job.func, daemon=True).start()
        return {"status": "started", "job_id": job_id}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, str(exc))


# =========================================================== Server-Steuerung
@router.post("/shutdown")
def shutdown() -> dict:
    """Stoppt den Server (process exit)."""
    log.warning("Shutdown via Admin-API angefordert")
    threading.Timer(1.0, _exit_process, args=[0]).start()
    return {"status": "shutting_down"}


@router.post("/restart")
def restart() -> dict:
    """
    Triggert einen Neustart über externes Restart-Skript.
    Spawnt eine Detached-PowerShell, die nach kurzer Wartezeit
    den aktuellen Prozess killt und einen neuen startet.
    """
    base = Path(config.BASE_DIR)
    restart_ps1 = base / "Restart_HattrickDash.ps1"
    if not restart_ps1.exists():
        raise HTTPException(503, f"Restart-Skript fehlt: {restart_ps1}")

    log.warning("Restart via Admin-API angefordert (PID %d)", os.getpid())

    # Windows: cmd-Shell mit `start /B` startet PS detached vom uvicorn-Parent.
    # Der Trick mit shell=True ist wichtig, damit cmd den start-Befehl richtig parst.
    if sys.platform == "win32":
        cmd_line = (
            f'start "" /B powershell.exe -NoProfile -ExecutionPolicy Bypass '
            f'-WindowStyle Hidden '
            f'-File "{restart_ps1}" '
            f'-ServerPid {os.getpid()}'
        )
        try:
            subprocess.Popen(
                cmd_line,
                shell=True,
                cwd=str(base),
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.CREATE_NO_WINDOW,
            )
        except Exception as exc:
            log.exception("Restart-Skript konnte nicht gestartet werden")
            raise HTTPException(500, f"Konnte Restart-Skript nicht starten: {exc}")
    else:
        try:
            subprocess.Popen(
                ["pwsh", "-File", str(restart_ps1), "-ServerPid", str(os.getpid())],
                cwd=str(base),
                start_new_session=True,
            )
        except Exception as exc:
            log.exception("Restart-Skript konnte nicht gestartet werden")
            raise HTTPException(500, f"Konnte Restart-Skript nicht starten: {exc}")

    return {"status": "restarting", "message": "Server wird in wenigen Sekunden neu gestartet."}


def _exit_process(code: int) -> None:
    """Sauberer Prozess-Exit."""
    log.info("Process exit code=%d", code)
    try:
        os.kill(os.getpid(), signal.SIGTERM)
    except Exception:
        os._exit(code)


# ============================================================ Finanz-Migration
@router.post("/repair/finance-currency")
def repair_finance_currency(factor: int = 10) -> dict:
    """
    Einmalige Migration: alle FinanceSnapshot-Werte durch <factor> teilen.
    Korrigiert den Hattrick-Currency-Faktor (HU=10x Euro für Deutschland).
    Idempotent ist das NICHT - nur einmal aufrufen!
    """
    from sqlalchemy import update
    from database import session_scope
    from models.finance import FinanceSnapshot

    if factor <= 0:
        raise HTTPException(400, "factor muss > 0 sein")
    fields = ['income_supporters', 'income_tickets', 'income_sponsors',
              'income_interest', 'income_transfers_in', 'income_other',
              'income_total', 'costs_arena', 'costs_wages', 'costs_interest',
              'costs_specialists', 'costs_youth', 'costs_transfers_out',
              'costs_other', 'costs_total', 'profit', 'cash_balance', 'cash_next_week']
    with session_scope() as db:
        rows = db.execute(select(FinanceSnapshot)).scalars().all()
        for r in rows:
            for f in fields:
                v = getattr(r, f, None)
                if v is not None:
                    setattr(r, f, int(v / factor))
    log.warning("Finance-Currency-Migration: %d Snapshots durch %d geteilt", len(rows), factor)
    return {"status": "ok", "snapshots_updated": len(rows), "factor": factor}



# =================================================================== Reset
@router.post("/reset-db")
def reset_db() -> dict:
    """Löscht und re-erstellt die SQLite-DB. Vorsicht!"""
    if config.DB_PATH.exists():
        try:
            config.DB_PATH.unlink()
        except Exception as exc:
            raise HTTPException(500, f"DB löschen fehlgeschlagen: {exc}")
    from database import create_tables
    create_tables()
    log.warning("DB zurückgesetzt")
    return {"status": "ok", "message": "DB neu angelegt – ein Full-Init ist nötig."}
