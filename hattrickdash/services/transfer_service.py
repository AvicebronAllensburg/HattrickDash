"""Transfer-History + P&L + simples Scouting."""
from __future__ import annotations

from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

import config
from models.finance import FinanceSnapshot
from models.player import Player
from models.transfer import Transfer
from services.player_service import get_squad


def list_transfers(db: Session, team_id: int | None = None,
                   direction: str | None = None) -> list[dict]:
    tid = team_id or config.TEAM_ID
    q = select(Transfer).where(Transfer.own_team_id == tid)
    if direction in ("buy", "sell"):
        q = q.where(Transfer.direction == direction)
    q = q.order_by(Transfer.deadline.desc().nullslast())
    return [_to_dict(t) for t in db.execute(q).scalars().all()]


def list_former_players(db: Session, team_id: int | None = None) -> list[dict]:
    """
    Ehemalige Spieler ableiten:
    Spieler die im Team-Verlauf vorkamen, aber im JÜNGSTEN globalen Snapshot
    nicht mehr drin sind. Mit letztem TSI als Verkaufswert-Approximation.
    Wenn Transfer-Records vorliegen, dort echten Preis + Datum nutzen.
    """
    tid = team_id or config.TEAM_ID
    if not tid:
        return []

    latest = db.execute(
        select(func.max(Player.snapshot_date)).where(Player.team_id == tid)
    ).scalar_one_or_none()
    if latest is None:
        return []

    current_ids = {row[0] for row in db.execute(
        select(Player.player_id).where(
            Player.team_id == tid, Player.snapshot_date == latest,
        )
    ).all()}

    sub = (
        select(Player.player_id, func.max(Player.snapshot_date).label("md"))
        .where(Player.team_id == tid)
        .group_by(Player.player_id)
        .subquery()
    )
    rows = db.execute(
        select(Player)
        .join(sub, (Player.player_id == sub.c.player_id) & (Player.snapshot_date == sub.c.md))
        .order_by(Player.snapshot_date.desc())
    ).scalars().all()
    formers = [p for p in rows if p.player_id not in current_ids]

    sell_records = db.execute(
        select(Transfer).where(Transfer.own_team_id == tid, Transfer.direction == "sell")
    ).scalars().all()
    sell_by_pid = {r.player_id: r for r in sell_records}
    buy_records = db.execute(
        select(Transfer).where(Transfer.own_team_id == tid, Transfer.direction == "buy")
    ).scalars().all()
    buy_by_pid = {r.player_id: r for r in buy_records}

    out = []
    for p in formers:
        sell = sell_by_pid.get(p.player_id)
        buy = buy_by_pid.get(p.player_id)
        sale_price = sell.price if sell else None
        purchase_price = buy.price if buy else None
        pl = None
        if sale_price is not None and purchase_price is not None:
            pl = sale_price - purchase_price
        out.append({
            "player_id": p.player_id,
            "name": (p.nickname or f"{p.first_name} {p.last_name}").strip(),
            "position_code": p.position_code,
            "age_years": p.age_years,
            "nationality_name": p.nationality_name,
            "last_snapshot": p.snapshot_date.isoformat(),
            "last_tsi": p.tsi,
            "last_skills": {
                "form":       p.skill_form,
                "experience": p.skill_experience,
                "stamina":    p.skill_stamina,
                "scoring":    p.skill_scoring,
                "defending":  p.skill_defending,
                "playmaking": p.skill_playmaking,
                "keeper":     p.skill_keeper,
            },
            "sale_date": sell.deadline.isoformat() if sell and sell.deadline else None,
            "sale_price": sale_price,
            "sale_price_estimated": (p.tsi or 0) * 2 if sale_price is None else None,
            "purchase_date": buy.deadline.isoformat() if buy and buy.deadline else None,
            "purchase_price": purchase_price,
            "pl": pl,
        })
    return out


def _to_dict(t: Transfer) -> dict[str, Any]:
    return {
        "transfer_id": t.transfer_id,
        "deadline": t.deadline.isoformat() if t.deadline else None,
        "direction": t.direction,
        "player_id": t.player_id,
        "player_name": t.player_name,
        "age_years": t.age_years,
        "age_days": t.age_days,
        "nationality_name": t.nationality_name,
        "tsi": t.tsi,
        "price": t.price,
        "currency": t.currency,
        "other_team_id": t.other_team_id,
        "other_team_name": t.other_team_name,
        "skills": {
            "keeper": t.skill_keeper, "defending": t.skill_defending,
            "playmaking": t.skill_playmaking, "winger": t.skill_winger,
            "passing": t.skill_passing, "scoring": t.skill_scoring,
            "setpieces": t.skill_setpieces,
        },
    }


def transfer_pl_by_season(db: Session, team_id: int | None = None) -> list[dict]:
    """Aus den FinanceSnapshots: pro Saison Einnahmen/Ausgaben aus Transfers."""
    tid = team_id or config.TEAM_ID
    rows = db.execute(
        select(FinanceSnapshot).where(FinanceSnapshot.team_id == tid)
    ).scalars().all()
    by_season: dict[int, dict[str, int]] = defaultdict(lambda: {"in": 0, "out": 0})
    for r in rows:
        if r.season is None:
            continue
        by_season[r.season]["in"] += r.income_transfers_in or 0
        by_season[r.season]["out"] += r.costs_transfers_out or 0
    return [
        {"season": s, "income": v["in"], "costs": v["out"], "net": v["in"] - v["out"]}
        for s, v in sorted(by_season.items())
    ]


# =================================================================== Scout
def generate_scout_recommendations(db: Session, team_id: int | None = None) -> list[dict]:
    """
    Identifiziert die schwächsten Positionen im Kader und schlägt Profile vor.
    """
    tid = team_id or config.TEAM_ID
    squad = get_squad(db, tid)
    cash = _current_cash(db, tid)

    # Score pro Positionsbereich = Ø des relevanten Skills im Kader
    pos_groups = {
        "G": ("skill_keeper",),
        "DC": ("skill_defending",),
        "DW": ("skill_defending", "skill_winger"),
        "M": ("skill_playmaking", "skill_passing"),
        "W": ("skill_winger", "skill_passing"),
        "F": ("skill_scoring",),
    }
    out: list[dict] = []
    budget_max = int(cash * 0.30) if cash > 0 else 1_500_000

    for code, fields in pos_groups.items():
        ps = [p for p in squad if p["position_code"] == code]
        if not ps:
            avg = 0
        else:
            vals: list[float] = []
            for p in ps:
                for f in fields:
                    v = p["skills"].get(f)
                    if v is not None:
                        vals.append(v)
            avg = sum(vals) / len(vals) if vals else 0

        if avg < 7:  # Schwellwert: schwache Position
            out.append({
                "position": code,
                "current_avg_skill": round(avg, 2),
                "skill_requirement": _skill_text(fields, avg),
                "budget_min": int(budget_max * 0.3),
                "budget_max": budget_max,
                "tsi_range": _tsi_range_for_level(avg),
                "rationale": f"Ø-Skill {round(avg, 1)} unter Sollwert (≥7)",
            })

    return sorted(out, key=lambda r: r["current_avg_skill"])


def _skill_text(fields: tuple[str, ...], current_avg: float) -> str:
    target = max(8, round(current_avg + 2))
    pretty = " + ".join(f.replace("skill_", "") for f in fields)
    return f"{pretty} ≥ {target}, Alter < 24"


def _tsi_range_for_level(avg_skill: float) -> str:
    if avg_skill < 5:
        return "5000 – 20000"
    if avg_skill < 8:
        return "15000 – 60000"
    return "50000 – 200000"


def _current_cash(db: Session, team_id: int) -> int:
    row = db.execute(
        select(FinanceSnapshot)
        .where(FinanceSnapshot.team_id == team_id)
        .order_by(FinanceSnapshot.snapshot_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    return row.cash_balance if row else 0
