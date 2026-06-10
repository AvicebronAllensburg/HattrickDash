"""Finanz-Routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import db_dependency
from services import finance_service

router = APIRouter(prefix="/api/finance", tags=["finance"])


@router.get("/latest")
def latest(db: Session = Depends(db_dependency)):
    return finance_service.get_with_deltas(db)


@router.get("/history")
def history(days: int | None = None, db: Session = Depends(db_dependency)):
    return finance_service.get_history(db, days=days)


@router.get("/salary-breakdown")
def salary_breakdown(db: Session = Depends(db_dependency)):
    return finance_service.get_salary_breakdown(db)


# ---------- Manueller Override für Bargeld + Rücklagen ----------
from pydantic import BaseModel


class OverrideRequest(BaseModel):
    cash_balance: int | None = None
    cash_reserves: int | None = None
    cash_next_week: int | None = None
    note: str = ""


@router.get("/override")
def get_override():
    """Aktuellen manuellen Override anzeigen (oder leer)."""
    return finance_service.load_override()


@router.post("/override")
def post_override(req: OverrideRequest):
    """Bargeld + Rücklagen manuell setzen (überschreibt alle Imports)."""
    return finance_service.save_override(
        cash_balance=req.cash_balance,
        cash_reserves=req.cash_reserves,
        cash_next_week=req.cash_next_week,
        note=req.note,
    )


@router.delete("/override")
def delete_override():
    """Override aufheben - Imports liefern wieder die Roh-Werte."""
    finance_service.clear_override()
    return {"status": "ok", "message": "Override aufgehoben"}
