"""Transfer-Routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import db_dependency
from services import transfer_service

router = APIRouter(prefix="/api/transfers", tags=["transfers"])


@router.get("")
def list_(direction: str | None = None, db: Session = Depends(db_dependency)):
    return transfer_service.list_transfers(db, direction=direction)


@router.get("/pl-by-season")
def pl_by_season(db: Session = Depends(db_dependency)):
    return transfer_service.transfer_pl_by_season(db)


@router.get("/scout")
def scout(db: Session = Depends(db_dependency)):
    return transfer_service.generate_scout_recommendations(db)


@router.get("/former-players")
def former_players(db: Session = Depends(db_dependency)):
    """Ehemalige Spieler des Teams (verkauft/abgegangen)."""
    return transfer_service.list_former_players(db)
