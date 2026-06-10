"""
APScheduler-Jobs für automatisches CHPP-Polling.

  - Daily 06:00         Team/Players/Economy/Arena/Training/Staff
  - Di + Sa 23:00       MatchList + Details der jüngsten Spiele + LeagueDetails (cache)
  - Mo 07:00            transfersTeam + alltimeseriesteam
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from chpp.fetcher import (
    fetch_arena, fetch_economy, fetch_match_details, fetch_match_list,
    fetch_players, fetch_staff, fetch_team_details, fetch_training_info,
    fetch_transfers_team,
    fetch_youth_team_details, fetch_youth_players,
    fetch_youth_match_list, fetch_youth_training,
)
from database import session_scope
from models.match import Match

log = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _safe(name: str, fn, *args, **kwargs) -> None:
    """Wrapper: loggt Start/Ende, fängt Exceptions ab."""
    log.info("Job '%s' Start", name)
    try:
        result = fn(*args, **kwargs)
        log.info("Job '%s' Ende, result=%s", name, result)
    except Exception:
        log.exception("Job '%s' fehlgeschlagen", name)


def _daily_job() -> None:
    log.info("--- Daily-Job startet ---")
    _safe("teamdetails", fetch_team_details)
    _safe("players", fetch_players)
    _safe("economy", fetch_economy)
    _safe("arena", fetch_arena)
    _safe("traininginfo", fetch_training_info)
    _safe("stafflist", fetch_staff)
    # Youth: stiller skip wenn keine Jugendmannschaft angemeldet
    _safe("youthteamdetails", fetch_youth_team_details)
    _safe("youthplayerlist", fetch_youth_players)
    _safe("youthtraining", fetch_youth_training)
    log.info("--- Daily-Job fertig ---")


def _matchday_job() -> None:
    log.info("--- Matchday-Job startet ---")
    _safe("matchlist", fetch_match_list)
    _safe("youthmatches", fetch_youth_match_list)

    # Detail-Pull für die jüngsten 3 Spiele, die noch keine Ratings haben
    with session_scope() as db:
        recent = db.execute(
            select(Match)
            .order_by(Match.match_date.desc())
            .limit(10)
        ).scalars().all()
        targets = [m for m in recent if m.home_rating_mid is None and m.match_date and m.match_date < datetime.utcnow()][:3]

    for m in targets:
        _safe(f"matchdetails:{m.match_id}", fetch_match_details, m.match_id)

    log.info("--- Matchday-Job fertig ---")


def _weekly_job() -> None:
    log.info("--- Weekly-Job startet ---")
    _safe("transfersTeam", fetch_transfers_team)
    log.info("--- Weekly-Job fertig ---")


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    s = BackgroundScheduler(timezone="Europe/Berlin")
    s.add_job(_daily_job, CronTrigger(hour=6, minute=0), id="daily", replace_existing=True)
    s.add_job(_matchday_job, CronTrigger(day_of_week="tue,sat", hour=23, minute=0),
              id="matchday", replace_existing=True)
    s.add_job(_weekly_job, CronTrigger(day_of_week="mon", hour=7, minute=0),
              id="weekly", replace_existing=True)
    s.start()
    log.info("APScheduler gestartet, Jobs: %s", [j.id for j in s.get_jobs()])
    _scheduler = s
    return s


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        log.info("APScheduler gestoppt")
