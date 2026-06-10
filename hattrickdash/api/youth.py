"""Youth-Routes (v2)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import db_dependency
from services import youth_service

router = APIRouter(prefix="/api/youth", tags=["youth"])


@router.get("/team")
def team(db: Session = Depends(db_dependency)):
    return youth_service.get_youth_team(db) or {"empty": True}


@router.get("/squad")
def squad(db: Session = Depends(db_dependency)):
    return youth_service.get_squad(db)


@router.get("/matches")
def matches(limit: int = 30, db: Session = Depends(db_dependency)):
    return youth_service.get_matches(db, limit=limit)


@router.get("/training")
def training(limit: int = 50, db: Session = Depends(db_dependency)):
    return youth_service.get_training_history(db, limit=limit)


@router.get("/recommendations")
def recommendations(db: Session = Depends(db_dependency)):
    return youth_service.get_recommendations(db)
