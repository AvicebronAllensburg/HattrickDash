"""Finanzauswertung für Charts."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models.finance import FinanceSnapshot
from models.player import Player
from services.player_service import get_squad

# Manueller Override für Bargeld + Rücklagen (HRF/HO liefern API-Cap-Wert,
# der nicht dem Hattrick-Web-UI entspricht). User kann hier echte Werte eintragen,
# die alle Imports überschreiben.
MANUAL_OVERRIDE_FILE = config.DATA_DIR / "finance_override.json"


def load_override() -> dict:
    if not MANUAL_OVERRIDE_FILE.exists():
        return {}
    try:
        return json.loads(MANUAL_OVERRIDE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_override(cash_balance: int | None, cash_reserves: int | None,
                  cash_next_week: int | None = None, note: str = "") -> dict:
    data = load_override()
    if cash_balance is not None:    data["cash_balance"] = int(cash_balance)
    if cash_reserves is not None:   data["cash_reserves"] = int(cash_reserves)
    if cash_next_week is not None:  data["cash_next_week"] = int(cash_next_week)
    if note:                        data["note"] = note
    data["updated_at"] = datetime.utcnow().isoformat()
    MANUAL_OVERRIDE_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return data


def clear_override() -> None:
    if MANUAL_OVERRIDE_FILE.exists():
        MANUAL_OVERRIDE_FILE.unlink()


def get_history(db: Session, team_id: int | None = None, days: int | None = None) -> list[dict]:
    """Finanzhistorie. Wenn days gesetzt: nur die letzten N Tage."""
    tid = team_id or config.TEAM_ID
    q = (
        select(FinanceSnapshot)
        .where(FinanceSnapshot.team_id == tid)
        .order_by(FinanceSnapshot.snapshot_date.asc())
    )
    if days and days > 0:
        cutoff = date.today() - timedelta(days=days)
        q = q.where(FinanceSnapshot.snapshot_date >= cutoff)
    rows = db.execute(q).scalars().all()
    return [_row_to_dict(r) for r in rows]


def get_latest(db: Session, team_id: int | None = None) -> dict | None:
    tid = team_id or config.TEAM_ID
    row = db.execute(
        select(FinanceSnapshot)
        .where(FinanceSnapshot.team_id == tid)
        .order_by(FinanceSnapshot.snapshot_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    return _row_to_dict(row) if row else None


def get_with_deltas(db: Session, team_id: int | None = None) -> dict:
    tid = team_id or config.TEAM_ID
    rows = db.execute(
        select(FinanceSnapshot)
        .where(FinanceSnapshot.team_id == tid)
        .order_by(FinanceSnapshot.snapshot_date.desc())
        .limit(2)
    ).scalars().all()
    cur, prev = (rows + [None, None])[:2]

    fields = (
        "income_supporters", "income_tickets", "income_sponsors",
        "income_interest", "income_other", "income_transfers_in", "income_total",
        "costs_arena", "costs_wages", "costs_interest",
        "costs_specialists", "costs_youth", "costs_other", "costs_total",
        "profit", "cash_balance", "cash_next_week",
    )
    deltas: dict[str, int | None] = {}
    for f in fields:
        if cur and prev:
            deltas[f] = (getattr(cur, f) or 0) - (getattr(prev, f) or 0)
        else:
            deltas[f] = None

    cur_dict = _row_to_dict(cur)
    # Override anwenden (sticky gegenüber HRF/HO/CHPP-Imports)
    ov = load_override()
    if ov:
        if "cash_balance" in ov:
            cur_dict["cash_balance"] = ov["cash_balance"]
        if "cash_reserves" in ov:
            cur_dict["cash_reserves"] = ov["cash_reserves"]
        if "cash_next_week" in ov:
            cur_dict["cash_next_week"] = ov["cash_next_week"]
        cur_dict["override_active"] = True
        cur_dict["override_note"] = ov.get("note", "")
        cur_dict["override_updated_at"] = ov.get("updated_at")
        # Total = Bargeld + Rücklagen (sofern beides gesetzt)
        c = cur_dict.get("cash_balance") or 0
        r2 = cur_dict.get("cash_reserves") or 0
        cur_dict["cash_total"] = c + r2
    else:
        cur_dict["override_active"] = False

    return {
        "current": cur_dict,
        "deltas": deltas,
    }


def get_salary_breakdown(db: Session, team_id: int | None = None) -> list[dict]:
    """Gehälter nach Positions-Code für Tortendiagramm."""
    squad = get_squad(db, team_id)
    by_pos: dict[str, float] = {}
    for p in squad:
        code = p["position_code"] or "?"
        by_pos[code] = by_pos.get(code, 0.0) + (p["salary"] or 0.0)
    return [{"position": k, "total": round(v, 2)} for k, v in by_pos.items() if v > 0]


def _row_to_dict(r: FinanceSnapshot | None) -> dict:
    if r is None:
        return {}
    return {
        "snapshot_date": r.snapshot_date.isoformat(),
        "season": r.season,
        "week_number": r.week_number,
        "income": {
            "supporters": r.income_supporters,
            "tickets": r.income_tickets,
            "sponsors": r.income_sponsors,
            "interest": r.income_interest,
            "transfers_in": r.income_transfers_in,
            "other": r.income_other,
            "total": r.income_total,
        },
        "costs": {
            "arena": r.costs_arena,
            "wages": r.costs_wages,
            "interest": r.costs_interest,
            "specialists": r.costs_specialists,
            "youth": r.costs_youth,
            "transfers_out": r.costs_transfers_out,
            "other": r.costs_other,
            "total": r.costs_total,
        },
        "profit": r.profit,
        "cash_balance": r.cash_balance,
        "cash_next_week": r.cash_next_week,
    }
