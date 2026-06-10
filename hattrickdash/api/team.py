"""Team-Routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import config
from database import db_dependency
from services import team_service

router = APIRouter(prefix="/api/team", tags=["team"])


@router.get("/overview")
def overview(db: Session = Depends(db_dependency)):
    data = team_service.get_team_overview(db)
    if not data:
        raise HTTPException(404, "Keine Team-Daten – bitte erst fetcher --full-init laufen lassen.")
    return data


@router.get("/staff")
def staff(db: Session = Depends(db_dependency)):
    return team_service.get_staff(db)


@router.get("/league-table")
def league_table(league_id: int | None = None):
    try:
        return team_service.get_league_table(league_id)
    except RuntimeError as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Liga-Tabelle nicht abrufbar: {exc}")


@router.get("/status")
def status():
    return {
        "authenticated": config.is_authenticated(),
        "team_id": config.TEAM_ID,
    }
