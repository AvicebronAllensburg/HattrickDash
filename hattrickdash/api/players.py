"""Spieler-Routes."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import db_dependency
from services import player_service

router = APIRouter(prefix="/api/players", tags=["players"])


@router.get("")
def squad(db: Session = Depends(db_dependency)):
    return player_service.get_squad(db)


# Endpoint /{player_id}/history ist in der oeffentlichen Version DEAKTIVIERT.
# CHPP-Compliance: 'player progression history' ist Teil des Hattrick-
# Supporter-Pakets und darf von CHPP-Apps nicht repliziert werden.
# Im 'local'-Branch ist die Funktion vollstaendig vorhanden.


class InjuryRequest(BaseModel):
    age: int
    weeks_injured: int
    doctors: int = 1
    healing_speed: float = 1.0


@router.post("/injury-calc")
def injury_calc(req: InjuryRequest):
    return player_service.calculate_injury(
        req.age, req.weeks_injured, req.doctors, req.healing_speed
    )
