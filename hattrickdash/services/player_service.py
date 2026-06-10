"""Spielerentwicklung, Skill-History, aktuelle Kaderdaten."""
from __future__ import annotations

from typing import Any

from sqlalchemy import select, func
from sqlalchemy.orm import Session

import config
from models.player import Player

_SKILL_FIELDS = [
    "skill_keeper", "skill_defending", "skill_playmaking", "skill_winger",
    "skill_passing", "skill_scoring", "skill_setpieces",
    "skill_form", "skill_experience", "skill_stamina", "skill_loyalty",
]


def get_squad(db: Session, team_id: int | None = None) -> list[dict[str, Any]]:
    """
    Liefert den AKTUELLEN Kader: alle Spieler mit Snapshot vom jüngsten globalen
    Datum für dieses Team. Spieler die früher mal im Kader waren, aber im
    letzten Snapshot nicht mehr -> raus.
    """
    tid = team_id or config.TEAM_ID
    if not tid:
        return []

    latest = db.execute(
        select(func.max(Player.snapshot_date)).where(Player.team_id == tid)
    ).scalar_one_or_none()
    if latest is None:
        return []

    rows = db.execute(
        select(Player)
        .where(Player.team_id == tid, Player.snapshot_date == latest)
        .order_by(Player.position_code, Player.last_name)
    ).scalars().all()

    return [_player_to_dict(p) for p in rows]


def _player_to_dict(p: Player) -> dict[str, Any]:
    return {
        "player_id": p.player_id,
        "snapshot_date": p.snapshot_date.isoformat(),
        "name": (p.nickname or f"{p.first_name} {p.last_name}").strip(),
        "first_name": p.first_name,
        "last_name": p.last_name,
        "age_years": p.age_years,
        "age_days": p.age_days,
        "nationality_id": p.nationality_id,
        "nationality_name": p.nationality_name,
        "tsi": p.tsi,
        "salary": p.salary,
        "skills": {f: getattr(p, f) for f in _SKILL_FIELDS},
        "specialty": p.specialty,
        "specialty_name": p.specialty_name,
        "is_injured": p.is_injured,
        "injury_weeks": p.injury_weeks,
        "is_suspended": p.is_suspended,
        "suspension_matches": p.suspension_matches,
        "yellow_cards": p.yellow_cards,
        "is_transfer_listed": p.is_transfer_listed,
        "is_national_player": p.is_national_player,
        "position_code": p.position_code,
        "rating_stars": p.rating_stars,
    }


def get_player_history(db: Session, player_id: int) -> list[dict[str, Any]]:
    """Spieler-Skill-Verlauf — in der oeffentlichen Version DEAKTIVIERT.

    Hattrick CHPP-Compliance: 'player progression history' ist Teil des
    Hattrick-Supporter-Pakets. CHPP-Apps duerfen das nicht replizieren.
    Diese Funktion liefert deshalb in der Public-Branch nur den juengsten
    Snapshot zurueck (kein Verlauf).
    """
    row = db.execute(
        select(Player)
        .where(Player.player_id == player_id)
        .order_by(Player.snapshot_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    return [_player_to_dict(row)] if row else []


# ============================================================ Verletzungsrechner
# Hattrick-Heilungsformel (vereinfacht, aus der Hattrick-Community):
#   Heilungstage ≈ Wochen × 7 / Heilungsfaktor
#   Faktor abhängig von Anzahl Ärzte und Trainerwert (Skill).
#   Ohne Live-Daten wird ein Standard-Faktor 1.0 verwendet.
def calculate_injury(age: int, weeks_injured: int, doctors: int = 1, healing_speed: float = 1.0) -> dict[str, Any]:
    """
    Gibt Schätzung der Heilungszeit zurück.
    age = Alter in Jahren, weeks_injured = X Wochen
    """
    base_days = weeks_injured * 7
    age_factor = 1.0 + max(0, (age - 25)) * 0.02     # ältere Spieler heilen langsamer
    doctor_factor = 1.0 - min(0.4, doctors * 0.1)    # je mehr Ärzte, desto schneller
    days = base_days * age_factor * doctor_factor / max(healing_speed, 0.1)
    return {
        "age": age,
        "weeks_injured": weeks_injured,
        "doctors": doctors,
        "estimated_days": round(days, 1),
        "note": "Schätzung. Echter Wert hängt von HT-Engine + Glück ab.",
    }
