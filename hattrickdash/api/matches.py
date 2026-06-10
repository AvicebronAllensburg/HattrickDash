"""Spiele-Routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import db_dependency
from services import match_service

router = APIRouter(prefix="/api/matches", tags=["matches"])


@router.get("")
def list_matches(
    match_type: str | None = None,
    season: int | None = None,
    db: Session = Depends(db_dependency),
):
    return match_service.list_matches(db, match_type=match_type, season=season)


@router.get("/stats")
def stats(db: Session = Depends(db_dependency)):
    return match_service.stats_table(db)


@router.get("/next-opponent")
def next_opponent(db: Session = Depends(db_dependency)):
    """Nächster Gegner + H2H-Statistik."""
    return match_service.next_opponent_summary(db)


@router.get("/predict-opponent-lineup")
def predict_opponent_lineup(
    opponent_id: int | None = None,
    n_recent: int = 3,
    db: Session = Depends(db_dependency),
):
    """
    Schätzt Aufstellung des nächsten Gegners aus historischen MatchLineup-Records.
    Wenn opponent_id leer ist: nutzt das nächste Spiel.
    """
    if opponent_id is None:
        info = match_service.next_opponent_summary(db)
        if not info.get("available"):
            return {"available": False, "reason": info.get("reason", "Kein nächstes Spiel")}
        opponent_id = info["opponent"]["team_id"]
        looking_at_home = info["next_match"]["is_home"]
    else:
        # Default: betrachten Auswärts-Aufstellungen des Gegners (Annahme: Gegner spielt bei uns)
        looking_at_home = True
    return match_service.predict_opponent_lineup(
        db, opponent_id=opponent_id,
        looking_at_home=looking_at_home,
        n_recent=n_recent,
    )
