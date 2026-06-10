"""Stadion-Routes."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import db_dependency
from services import arena_service

router = APIRouter(prefix="/api/arena", tags=["arena"])


@router.get("/latest")
def latest(db: Session = Depends(db_dependency)):
    return arena_service.get_latest(db)


@router.get("/sizer")
def sizer(target_total: int = Query(..., gt=1000, le=200000),
          db: Session = Depends(db_dependency)):
    return arena_service.arenasizer(db, target_total)
