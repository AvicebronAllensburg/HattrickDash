"""Aufstellungs-Routes – inkl. Hattrick-Submit (WRITE!)."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from chpp.fetcher import submit_match_order, predict_match_ratings
from database import db_dependency
from services import lineup_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lineup", tags=["lineup"])


@router.get("/formations")
def formations():
    return lineup_service.get_formations()


@router.get("/auto")
def auto(
    formation: str = "442",
    allow_injured: bool = False,
    allow_suspended: bool = False,
    db: Session = Depends(db_dependency),
):
    try:
        return lineup_service.auto_lineup(
            db, formation, allow_injured=allow_injured, allow_suspended=allow_suspended
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))


class SaveRequest(BaseModel):
    name: str
    lineup: dict


@router.post("/save")
def save(req: SaveRequest):
    return lineup_service.save_lineup(req.name, req.lineup)


@router.get("/saved")
def saved():
    return lineup_service.list_saved()


@router.get("/saved/{file_name}")
def saved_one(file_name: str):
    data = lineup_service.load_lineup(file_name)
    if data is None:
        raise HTTPException(404, "Aufstellung nicht gefunden")
    return data


class SubmitRequest(BaseModel):
    match_id: int
    lineup: dict
    captain_id: int | None = None
    setpieces_id: int | None = None
    tactic: str = "0"
    attitude: int = -1          # Spieleinstellung (-1 = nicht ändern)
    confirm: bool = False


def _match_type_and_source(db: Session, match_id: int) -> tuple[int, str]:
    """Match-Type aus der DB + sourceSystem-Ableitung.
    Convention: Match-Type >= 100 = Jugendspiel → sourceSystem=youth."""
    from models.match import Match
    m = db.get(Match, match_id)
    match_type = 1
    if m and m.match_type is not None:
        try:
            match_type = int(m.match_type)
        except (TypeError, ValueError):
            match_type = 1
    source_system = "youth" if match_type >= 100 else "hattrick"
    return match_type, source_system


@router.post("/predict")
def predict(req: SubmitRequest, db: Session = Depends(db_dependency)):
    """READ-Dry-Run: dasselbe lineup-JSON wie beim Submit an Hattrick schicken,
    aber mit actionType=predictratings. Validiert das Payload serverseitig OHNE
    die Aufstellung zu setzen und liefert die prognostizierten Ratings."""
    _, source_system = _match_type_and_source(db, req.match_id)
    try:
        payload = lineup_service.build_matchorder_json(
            req.lineup, captain_id=req.captain_id, setpieces_id=req.setpieces_id,
            tactic=req.tactic, attitude=req.attitude,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    try:
        ratings = predict_match_ratings(req.match_id, payload, source_system)
    except Exception as exc:
        log.exception("predictratings fehlgeschlagen")
        raise HTTPException(502, f"Hattrick lehnte ab: {exc}")
    return {"status": "ok", "match_id": req.match_id, "ratings": ratings}


@router.post("/submit")
def submit(req: SubmitRequest, db: Session = Depends(db_dependency)):
    """WRITE: Aufstellung an HT übermitteln. Nur mit confirm=True."""
    if not req.confirm:
        raise HTTPException(400, "confirm=True erforderlich (Sicherheits-Bestätigung).")
    match_type, source_system = _match_type_and_source(db, req.match_id)
    try:
        payload = lineup_service.build_matchorder_json(
            req.lineup, captain_id=req.captain_id, setpieces_id=req.setpieces_id,
            tactic=req.tactic, attitude=req.attitude,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    log.warning("Sende matchorder für Match %d (MatchType=%d, sourceSystem=%s)",
                req.match_id, match_type, source_system)
    try:
        response = submit_match_order(req.match_id, payload, source_system)
    except Exception as exc:
        log.exception("matchorder fehlgeschlagen")
        raise HTTPException(502, f"Hattrick lehnte ab: {exc}")
    return {"status": "ok", "match_id": req.match_id, "response": response}
