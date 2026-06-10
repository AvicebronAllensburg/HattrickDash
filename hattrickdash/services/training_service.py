"""Trainings-Historie + Verteilungs-Statistik (öffentliche Version).

CHPP-Compliance: Skill-/Zustands-VERLÄUFE über Zeit (player_trends /
team_trends / stamina_trend) sind in der öffentlichen Version bewusst NICHT
enthalten — 'per-player skill progression history over time' ist Teil des
Hattrick-Supporter-Pakets und darf laut CHPP-Regeln nicht in freien Tools
repliziert werden. Hier wird nur die Trainings-TYP-Historie ausgewertet
(welcher Trainingstyp lief in welcher Woche) — das ist kein Skill-Verlauf.
"""
from __future__ import annotations

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models.training import TrainingWeek


def get_history(db: Session, team_id: int | None = None) -> list[dict]:
    tid = team_id or config.TEAM_ID
    rows = db.execute(
        select(TrainingWeek)
        .where(TrainingWeek.team_id == tid)
        .order_by(TrainingWeek.season.desc(), TrainingWeek.week_number.desc())
    ).scalars().all()
    return [
        {
            "season": r.season,
            "week_number": r.week_number,
            "training_date": r.training_date.isoformat(),
            "training_type": r.training_type,
            "training_type_id": r.training_type_id,
            "training_intensity": r.training_intensity,
            "stamina_share": r.stamina_share,
            "training_level": r.training_level,
        }
        for r in rows
    ]


def grouped_by_season(db: Session, team_id: int | None = None) -> list[dict]:
    """Für die UI klappbare Saison-Blöcke."""
    weeks = get_history(db, team_id)
    by_season: dict[int, list[dict]] = {}
    for w in weeks:
        by_season.setdefault(w["season"], []).append(w)
    out = []
    for season in sorted(by_season.keys(), reverse=True):
        out.append({"season": season, "weeks": by_season[season]})
    return out


def type_distribution(db: Session, team_id: int | None = None) -> list[dict]:
    """Tortendiagramm: Wie oft wurde welcher Typ trainiert?"""
    weeks = get_history(db, team_id)
    counter = Counter(w["training_type"] for w in weeks if w["training_type"])
    total = sum(counter.values()) or 1
    return [
        {"training_type": k, "count": v, "ratio_pct": round(v / total * 100, 1)}
        for k, v in counter.most_common()
    ]
