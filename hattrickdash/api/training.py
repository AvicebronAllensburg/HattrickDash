"""Training-Routes (öffentliche Version).

CHPP-Compliance: nur Trainings-TYP-Historie + Verteilung. Skill-/Zustands-
Verläufe über Zeit (Player-/Team-Trends, Kondition über Zeit) sind als
Hattrick-Supporter-Feature NICHT Teil der öffentlichen Version.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import db_dependency
from services import training_service

router = APIRouter(prefix="/api/training", tags=["training"])


@router.get("")
def grouped(db: Session = Depends(db_dependency)):
    return training_service.grouped_by_season(db)


@router.get("/distribution")
def distribution(db: Session = Depends(db_dependency)):
    return training_service.type_distribution(db)
