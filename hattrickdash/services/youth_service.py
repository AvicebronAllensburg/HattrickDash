"""Youth-Service: Kader, Spiele, Training, Förder-Empfehlungen.

Förderungs-Logik:
  Hattrick erlaubt Promotion ab 17.0 Jahre. Ein Spieler ist „förder-reif"
  wenn:
    - Alter >= 17.0 Jahre
    - mindestens ein Skill voll-trainiert (current >= max - 1)
    - ODER: alle relevanten Skills haben Potenzial (max) bekannt UND
      Position ist gut bewertbar (z.B. Stürmer mit max_scorer >= 6)

Empfehlungs-Score (0-100):
  - 0-30  : Spieler noch zu jung oder zu schwach (nicht fördern)
  - 30-60 : Brauchbar, aber abwarten ob noch Skills entdeckt werden
  - 60-85 : Förder-Kandidat, Skills größtenteils gescoutet, gutes Potenzial
  - 85+   : Sofort fördern (alt genug + voll trainiert + starke Skills)
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from models.youth import (
    YouthMatch,
    YouthPlayer,
    YouthScoutReport,
    YouthTeam,
    YouthTraining,
)

# Skill-Schluessel die wir bewerten
_SKILLS = ["keeper", "defender", "playmaker", "winger", "passing",
           "scorer", "setpieces"]


def _latest_player_snapshots(db: Session, youth_team_id: int | None = None) -> list[YouthPlayer]:
    """Liefert pro youth_player_id den juengsten Snapshot."""
    sub = (
        select(YouthPlayer.youth_player_id,
               func.max(YouthPlayer.snapshot_date).label("mxd"))
        .group_by(YouthPlayer.youth_player_id)
        .subquery()
    )
    q = (
        select(YouthPlayer)
        .join(sub,
              (YouthPlayer.youth_player_id == sub.c.youth_player_id)
              & (YouthPlayer.snapshot_date == sub.c.mxd))
        .order_by(YouthPlayer.last_name)
    )
    if youth_team_id is not None:
        q = q.where(YouthPlayer.youth_team_id == youth_team_id)
    return list(db.execute(q).scalars().all())


def _player_to_dict(p: YouthPlayer) -> dict[str, Any]:
    """Serialisiert einen YouthPlayer in ein API-friendly dict."""
    skills = {}
    for s in _SKILLS:
        skills[s] = {
            "current":  getattr(p, f"skill_{s}"),
            "max":      getattr(p, f"max_{s}"),
            "scouted":  getattr(p, f"scouted_{s}"),
        }
    age_str = ""
    if p.age_years is not None:
        age_str = f"{p.age_years}"
        if p.age_days is not None:
            age_str += f"/{p.age_days}"
    return {
        "youth_player_id": p.youth_player_id,
        "name": (p.nickname or f"{p.first_name} {p.last_name}").strip(),
        "first_name": p.first_name,
        "last_name":  p.last_name,
        "age_years":  p.age_years,
        "age_days":   p.age_days,
        "age_str":    age_str,
        "player_number": p.player_number,
        "nationality_id":   p.nationality_id,
        "nationality_name": p.nationality_name,
        "specialty":      p.specialty,
        "specialty_name": p.specialty_name,
        "skills": skills,
        "is_promoted":     p.is_promoted,
        "is_in_squad":     p.is_in_squad,
        "can_be_promoted": p.can_be_promoted,
        "snapshot_date":   p.snapshot_date.isoformat() if p.snapshot_date else None,
        "last_match_date": p.last_match_date.isoformat() if p.last_match_date else None,
        "last_match_minutes": p.last_match_minutes,
    }


def get_youth_team(db: Session) -> dict | None:
    yt = db.execute(select(YouthTeam).order_by(desc(YouthTeam.last_updated))).scalars().first()
    if not yt:
        return None
    return {
        "youth_team_id":  yt.youth_team_id,
        "senior_team_id": yt.senior_team_id,
        "name":           yt.name,
        "short_name":     yt.short_name,
        "league_id":      yt.league_id,
        "league_name":    yt.league_name,
        "league_level":   yt.league_level,
        "coach_name":     yt.coach_name,
        "coach_skill":    yt.coach_skill,
        "coach_skill_name": yt.coach_skill_name,
        "scout_count":    yt.scout_count,
        "last_match_date": yt.last_match_date.isoformat() if yt.last_match_date else None,
        "next_match_date": yt.next_match_date.isoformat() if yt.next_match_date else None,
    }


def get_squad(db: Session) -> dict:
    yt = db.execute(select(YouthTeam)).scalars().first()
    ytid = yt.youth_team_id if yt else None
    players = _latest_player_snapshots(db, ytid)
    return {
        "youth_team": get_youth_team(db),
        "players": [_player_to_dict(p) for p in players],
    }


def get_matches(db: Session, limit: int = 30) -> dict:
    rows = list(
        db.execute(
            select(YouthMatch).order_by(desc(YouthMatch.match_date)).limit(limit)
        ).scalars().all()
    )
    return {
        "matches": [
            {
                "youth_match_id": m.youth_match_id,
                "match_date":  m.match_date.isoformat() if m.match_date else None,
                "match_type":  m.match_type,
                "home_team_name": m.home_team_name,
                "away_team_name": m.away_team_name,
                "home_goals":  m.home_goals,
                "away_goals":  m.away_goals,
                "season":      m.season,
                "matchday":    m.matchday,
            }
            for m in rows
        ]
    }


def get_training_history(db: Session, limit: int = 50) -> dict:
    rows = list(
        db.execute(
            select(YouthTraining)
            .order_by(desc(YouthTraining.season), desc(YouthTraining.week_number))
            .limit(limit)
        ).scalars().all()
    )
    return {
        "training": [
            {
                "season":      t.season,
                "week_number": t.week_number,
                "training_date": t.training_date.isoformat() if t.training_date else None,
                "training_type": t.training_type,
                "training_match_kind": t.training_match_kind,
            }
            for t in rows
        ]
    }


# ---------------- Förder-Empfehlungen ---------------------------------

def _recommend_for_player(p: YouthPlayer) -> dict[str, Any]:
    """Bewertet einen einzelnen Jugendspieler und gibt Score + Begründung.

    Score-Heuristik:
      - +30 Basis wenn Alter >= 17 (förderfähig)
      - +5 pro voll trainiertem Skill (current == max)
      - +10 wenn Star-Skill (max >= 8) UND voll trainiert
      - +5 wenn alle Skills gescoutet (volles Bild)
      - -20 wenn Alter < 17 (zu jung, kann nicht gefördert werden)
      - -10 wenn kein Skill mit max >= 5 → schwacher Spieler
    """
    age_y = p.age_years or 0
    age_d = p.age_days or 0
    age_total = age_y + age_d / 112.0   # Hattrick-Jahre haben 112 Tage

    score = 0
    reasons: list[str] = []
    fully_trained_count = 0
    star_skill_max = 0
    scouted_count = 0
    has_strong_potential = False

    for s in _SKILLS:
        cur = getattr(p, f"skill_{s}") or 0
        mx  = getattr(p, f"max_{s}") or 0
        sc  = getattr(p, f"scouted_{s}")
        if sc and mx > 0:
            scouted_count += 1
        if mx >= 5:
            has_strong_potential = True
        if mx > star_skill_max:
            star_skill_max = mx
        if cur > 0 and mx > 0 and cur >= mx - 1:
            fully_trained_count += 1
            if mx >= 8:
                score += 15
                reasons.append(f"⭐ {s} fast voll trainiert (max {mx})")
            else:
                score += 5
                reasons.append(f"✓ {s} fast voll trainiert (max {mx})")

    if age_total >= 17.0:
        score += 30
        reasons.append(f"Alter {age_y}/{age_d} förderfähig")
    elif age_total >= 16.5:
        score += 10
        reasons.append(f"Alter {age_y}/{age_d} bald förderfähig")
    else:
        score -= 20
        reasons.append(f"Alter {age_y}/{age_d} noch zu jung")

    if scouted_count >= len(_SKILLS):
        score += 5
        reasons.append("Vollständig gescoutet")
    elif scouted_count <= 2:
        score -= 10
        reasons.append(f"Nur {scouted_count} Skills gescoutet — Potenzial unklar")

    if not has_strong_potential and scouted_count >= 5:
        score -= 15
        reasons.append("Schwaches Potenzial (kein Skill mit max ≥ 5)")

    score = max(0, min(100, score))

    if score >= 85:
        verdict = "promote_now"
        emoji = "🟢"
        text = "Sofort fördern"
    elif score >= 60:
        verdict = "candidate"
        emoji = "🟡"
        text = "Förder-Kandidat"
    elif score >= 30:
        verdict = "watch"
        emoji = "⚪"
        text = "Beobachten"
    else:
        verdict = "no"
        emoji = "🔴"
        text = "Nicht fördern"

    # Beste Position empfehlen aus den Skills
    skill_max_map = {s: getattr(p, f"max_{s}") or 0 for s in _SKILLS}
    best_pos = max(skill_max_map, key=skill_max_map.get) if skill_max_map else "-"

    return {
        "youth_player_id": p.youth_player_id,
        "name": (p.nickname or f"{p.first_name} {p.last_name}").strip(),
        "age_str": f"{age_y}/{age_d}",
        "score": score,
        "verdict": verdict,
        "emoji": emoji,
        "verdict_text": text,
        "fully_trained_count": fully_trained_count,
        "scouted_count": scouted_count,
        "star_skill_max": star_skill_max,
        "best_position_skill": best_pos,
        "reasons": reasons,
    }


def get_recommendations(db: Session) -> dict:
    yt = db.execute(select(YouthTeam)).scalars().first()
    ytid = yt.youth_team_id if yt else None
    players = _latest_player_snapshots(db, ytid)
    recs = [_recommend_for_player(p) for p in players]
    recs.sort(key=lambda r: -r["score"])
    return {
        "count":           len(recs),
        "promote_now":     [r for r in recs if r["verdict"] == "promote_now"],
        "candidates":      [r for r in recs if r["verdict"] == "candidate"],
        "watch":           [r for r in recs if r["verdict"] == "watch"],
        "no":              [r for r in recs if r["verdict"] == "no"],
        "all":             recs,
    }
