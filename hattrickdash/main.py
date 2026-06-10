"""
HattrickDash – FastAPI Entry Point.
Start:  uvicorn main:app --reload --port 8765
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import config
from database import create_tables
from api import team, players, matches, lineup, transfers, finance, arena, training, admin, youth

config.setup_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    log.info("HattrickDash gestartet – Auth: %s, Team: %s",
             config.is_authenticated(), config.TEAM_ID)

    # Scheduler nur starten wenn authentifiziert
    if config.is_authenticated():
        try:
            from scheduler import start_scheduler, shutdown_scheduler
            start_scheduler()
            yield
            shutdown_scheduler()
            return
        except Exception:
            log.exception("Scheduler konnte nicht gestartet werden")

    yield


app = FastAPI(
    title="HattrickDash",
    version="0.1.0",
    description="Lokales Hattrick-Analyse- und Management-Tool",
    lifespan=lifespan,
)

# API-Router einbinden
for r in (team, players, matches, lineup, transfers, finance, arena, training, admin, youth):
    app.include_router(r.router)

# Static-Files (CSS/JS/Bilder)
app.mount("/static", StaticFiles(directory=str(config.STATIC_DIR)), name="static")


@app.get("/")
def index():
    """SPA-Shell."""
    return FileResponse(config.STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {
        "ok": True,
        "authenticated": config.is_authenticated(),
        "team_id": config.TEAM_ID,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.APP_HOST, port=config.APP_PORT, reload=False)
