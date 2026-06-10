"""Matchanalyse + Gruppierung Liga / Saison / Heim / Auswärts."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models.match import Match


def next_opponent_summary(db: Session, team_id: int | None = None) -> dict[str, Any]:
    """
    Findet das nächste Spiel + liefert Head-to-Head-Statistik gegen den
    Gegner: Siege/Remis/Niederlagen, Tore, letzte 5 Ergebnisse.
    Funktioniert nur über die in der DB gespeicherten Matches (matchlist-Pull).
    """
    tid = team_id or config.TEAM_ID
    if not tid:
        return {"available": False, "reason": "Keine Team-ID konfiguriert."}
    now = datetime.utcnow()
    upcoming = db.execute(
        select(Match)
        .where(
            ((Match.home_team_id == tid) | (Match.away_team_id == tid))
            & (Match.match_date >= now)
        )
        .order_by(Match.match_date.asc())
        .limit(1)
    ).scalar_one_or_none()
    if not upcoming:
        return {"available": False, "reason": "Keine zukünftigen Spiele in der DB."}

    is_home = upcoming.home_team_id == tid
    opp_id = upcoming.away_team_id if is_home else upcoming.home_team_id
    opp_name = upcoming.away_team_name if is_home else upcoming.home_team_name

    # H2H gegen diesen Gegner
    h2h_rows = db.execute(
        select(Match)
        .where(
            ((Match.home_team_id == tid) & (Match.away_team_id == opp_id))
            | ((Match.home_team_id == opp_id) & (Match.away_team_id == tid))
        )
        .where(Match.home_goals.isnot(None))
        .order_by(Match.match_date.desc())
    ).scalars().all()

    wins = draws = losses = 0
    goals_for = goals_against = 0
    last_results: list[dict] = []
    for m in h2h_rows:
        own_home = m.home_team_id == tid
        own_g = m.home_goals if own_home else m.away_goals
        opp_g = m.away_goals if own_home else m.home_goals
        if own_g is None or opp_g is None:
            continue
        goals_for += own_g
        goals_against += opp_g
        if own_g > opp_g:    wins += 1
        elif own_g == opp_g: draws += 1
        else:                losses += 1
        if len(last_results) < 5:
            last_results.append({
                "date": m.match_date.isoformat() if m.match_date else None,
                "match_type": m.match_type,
                "is_home": own_home,
                "own_goals": own_g,
                "opp_goals": opp_g,
                "result": "W" if own_g > opp_g else ("D" if own_g == opp_g else "L"),
            })

    return {
        "available": True,
        "next_match": {
            "match_id": upcoming.match_id,
            "match_date": upcoming.match_date.isoformat() if upcoming.match_date else None,
            "match_type": upcoming.match_type,
            "is_home": is_home,
        },
        "opponent": {
            "team_id": opp_id,
            "team_name": opp_name,
        },
        "h2h": {
            "matches": wins + draws + losses,
            "wins": wins,
            "draws": draws,
            "losses": losses,
            "goals_for": goals_for,
            "goals_against": goals_against,
            "last_results": last_results,
        },
    }


def predict_opponent_lineup(
    db: Session,
    opponent_id: int,
    looking_at_home: bool,
    n_recent: int = 3,
    own_team_id: int | None = None,
) -> dict[str, Any]:
    """
    Schätzt Gegner-Aufstellung aus den letzten Spielen.
    looking_at_home: True = Gegner spielt bei UNS (Heim für UNS) → wir wollen seine Auswärtsspiele
                     False = wir spielen beim Gegner → wir wollen seine Heimspiele

    Heuristik:
      1. Suche die letzten N Matches des Gegners im passenden Modus (Heim/Auswärts)
      2. Aus MatchLineup-Records: Spieler die mehrfach starten = Stamm
      3. Pro Spieler: häufigste Rolle/Position über die N Spiele
      4. Output: 11 wahrscheinlichste Spieler + Position + Häufigkeit + Taktik-Verteilung
    """
    from models.match import MatchLineup
    from collections import Counter

    own_id = own_team_id or config.TEAM_ID

    # Wenn looking_at_home=True (Gegner spielt bei uns), wollen wir Gegner-Auswärtsspiele.
    # Match.home_team_id != opp_id  AND  Match.away_team_id == opp_id
    if looking_at_home:
        match_filter = Match.away_team_id == opponent_id
    else:
        match_filter = Match.home_team_id == opponent_id

    matches = db.execute(
        select(Match)
        .where(match_filter, Match.home_goals.isnot(None))
        .order_by(Match.match_date.desc())
        .limit(n_recent)
    ).scalars().all()

    if not matches:
        return {
            "available": False,
            "reason": (
                f"Keine {'Auswärts' if looking_at_home else 'Heim'}-Spiele des Gegners "
                f"(Team {opponent_id}) in der DB. Erst matchdetails+matchlineup pullen."
            ),
            "opponent_id": opponent_id,
            "looking_at": "auswärts" if looking_at_home else "heim",
            "needed_pulls": [m.match_id for m in db.execute(
                select(Match).where(match_filter).order_by(Match.match_date.desc()).limit(n_recent)
            ).scalars().all()],
        }

    # Lineups laden für diese Matches
    match_ids = [m.match_id for m in matches]
    lineups = db.execute(
        select(MatchLineup).where(
            MatchLineup.match_id.in_(match_ids),
            MatchLineup.team_id == opponent_id,
        )
    ).scalars().all()

    if not lineups:
        return {
            "available": False,
            "reason": (
                f"Match-Daten gefunden ({len(matches)} Spiele), aber keine Lineups gespeichert. "
                f"Bitte Admin → 'Gegner-Daten pullen' für matchlineup-Daten."
            ),
            "opponent_id": opponent_id,
            "looking_at": "auswärts" if looking_at_home else "heim",
            "matches_found": match_ids,
        }

    # Häufigkeit pro Spieler + Rolle
    by_player: dict[int, dict[str, Any]] = {}
    for lu in lineups:
        if lu.player_id not in by_player:
            by_player[lu.player_id] = {
                "player_id": lu.player_id,
                "appearances": 0,
                "roles": Counter(),
                "ratings": [],
                "positions": [],  # (x,y) Tupel
            }
        p = by_player[lu.player_id]
        p["appearances"] += 1
        if lu.role_name: p["roles"][lu.role_name] += 1
        if lu.player_rating: p["ratings"].append(lu.player_rating)
        if lu.position_x is not None and lu.position_y is not None:
            p["positions"].append((lu.position_x, lu.position_y))

    # Top 11 Spieler nach Häufigkeit
    ranked = sorted(by_player.values(), key=lambda p: -p["appearances"])[:11]
    predicted = []
    for p in ranked:
        most_common_role = p["roles"].most_common(1)[0][0] if p["roles"] else ""
        avg_rating = (sum(p["ratings"]) / len(p["ratings"])) if p["ratings"] else None
        avg_pos = None
        if p["positions"]:
            avg_x = sum(x for x, _ in p["positions"]) / len(p["positions"])
            avg_y = sum(y for _, y in p["positions"]) / len(p["positions"])
            avg_pos = {"x": round(avg_x, 1), "y": round(avg_y, 1)}
        predicted.append({
            "player_id": p["player_id"],
            "appearances": p["appearances"],
            "role": most_common_role,
            "avg_rating": round(avg_rating, 2) if avg_rating else None,
            "position": avg_pos,
        })

    # Spielernamen aus Player-Tabelle
    from models.player import Player
    pids = [p["player_id"] for p in predicted]
    if pids:
        rows = db.execute(
            select(Player).where(Player.player_id.in_(pids)).order_by(Player.snapshot_date.desc())
        ).scalars().all()
        names: dict[int, str] = {}
        for r in rows:
            if r.player_id not in names:
                names[r.player_id] = (r.nickname or f"{r.first_name} {r.last_name}").strip()
        for p in predicted:
            p["name"] = names.get(p["player_id"], f"#{p['player_id']}")

    # Taktik-Verteilung: aus matches[i].home_tactic / away_tactic
    tactics = Counter()
    for m in matches:
        t = m.home_tactic if m.home_team_id == opponent_id else m.away_tactic
        if t:
            tactics[t] += 1

    return {
        "available": True,
        "opponent_id": opponent_id,
        "looking_at": "auswärts" if looking_at_home else "heim",
        "matches_analyzed": [
            {
                "match_id": m.match_id,
                "match_date": m.match_date.isoformat() if m.match_date else None,
                "result": _format_result(m, opponent_id),
            }
            for m in matches
        ],
        "predicted_lineup": predicted,
        "tactic_distribution": [
            {"tactic": t, "count": c} for t, c in tactics.most_common()
        ],
    }


def _format_result(m: Match, opp_id: int) -> str:
    if m.home_goals is None or m.away_goals is None:
        return "?"
    own = m.home_goals if m.home_team_id == opp_id else m.away_goals
    other = m.away_goals if m.home_team_id == opp_id else m.home_goals
    return f"{own}:{other}"


def list_matches(
    db: Session,
    team_id: int | None = None,
    match_type: str | None = None,
    season: int | None = None,
) -> list[dict[str, Any]]:
    tid = team_id or config.TEAM_ID
    q = select(Match).where((Match.home_team_id == tid) | (Match.away_team_id == tid))
    if match_type:
        q = q.where(Match.match_type == match_type)
    if season is not None:
        q = q.where(Match.season == season)
    q = q.order_by(Match.match_date.desc())
    rows = db.execute(q).scalars().all()
    return [_match_to_dict(m, tid) for m in rows]


def _match_to_dict(m: Match, own_team: int) -> dict[str, Any]:
    is_home = m.home_team_id == own_team
    own_goals = m.home_goals if is_home else m.away_goals
    opp_goals = m.away_goals if is_home else m.home_goals
    result = None
    if own_goals is not None and opp_goals is not None:
        result = "W" if own_goals > opp_goals else ("D" if own_goals == opp_goals else "L")
    return {
        "match_id": m.match_id,
        "match_date": m.match_date.isoformat() if m.match_date else None,
        "match_type": m.match_type,
        "is_home": is_home,
        "home_team_id": m.home_team_id,
        "home_team_name": m.home_team_name,
        "away_team_id": m.away_team_id,
        "away_team_name": m.away_team_name,
        "home_goals": m.home_goals,
        "away_goals": m.away_goals,
        "result": result,
        "season": m.season,
        "matchday": m.matchday,
        "attendance": m.attendance,
        "ratings": {
            "home": _ratings(m, "home"),
            "away": _ratings(m, "away"),
        },
        "possession": {
            "home_total": m.home_possession_total,
            "home_1h": m.home_possession_1h,
            "home_2h": m.home_possession_2h,
            "away_1h": m.away_possession_1h,
            "away_2h": m.away_possession_2h,
        },
        "cards": {
            "home_yellow": m.home_yellow_cards,
            "home_red": m.home_red_cards,
            "away_yellow": m.away_yellow_cards,
            "away_red": m.away_red_cards,
        },
        "tactic": {
            "home": m.home_tactic, "home_skill": m.home_tactic_skill,
            "away": m.away_tactic, "away_skill": m.away_tactic_skill,
        },
    }


def _ratings(m: Match, side: str) -> dict[str, float | None]:
    return {
        "mid": getattr(m, f"{side}_rating_mid"),
        "def_left": getattr(m, f"{side}_rating_def_left"),
        "def_center": getattr(m, f"{side}_rating_def_center"),
        "def_right": getattr(m, f"{side}_rating_def_right"),
        "att_left": getattr(m, f"{side}_rating_att_left"),
        "att_center": getattr(m, f"{side}_rating_att_center"),
        "att_right": getattr(m, f"{side}_rating_att_right"),
        "keeper": getattr(m, f"{side}_rating_keeper"),
    }


# ============================================================ HatStats / Loddar
def calc_hatstats(mid: float, att_l: float, att_c: float, att_r: float,
                  def_l: float, def_c: float, def_r: float) -> float:
    att = (att_l + att_c + att_r) / 3
    df = (def_l + def_c + def_r) / 3
    return round((mid + att + df) * 3, 2)


def calc_loddar(mid: float, att_l: float, att_c: float, att_r: float,
                def_l: float, def_c: float, def_r: float) -> float:
    att = (att_l + att_c + att_r) / 3
    df = (def_l + def_c + def_r) / 3
    return round(mid + (att + df) / 2, 2)


# ============================================================ Statistik-Tabs
def stats_table(db: Session, team_id: int | None = None) -> dict[str, Any]:
    """Aggregiert Liga/Saison/Heim/Auswärts für die 3 Tabs auf der Spiele-Seite."""
    tid = team_id or config.TEAM_ID
    matches = list_matches(db, tid, match_type="LEAGUE")

    grouped: dict[int, dict[str, list[dict]]] = defaultdict(lambda: {"home": [], "away": []})
    for m in matches:
        if m["season"] is None:
            continue
        bucket = "home" if m["is_home"] else "away"
        grouped[m["season"]][bucket].append(m)

    seasons_out = []
    for season in sorted(grouped.keys(), reverse=True):
        season_block = {
            "season": season,
            "home": _aggregate(grouped[season]["home"], "home"),
            "away": _aggregate(grouped[season]["away"], "away"),
            "total": _aggregate(grouped[season]["home"] + grouped[season]["away"], "mixed"),
        }
        seasons_out.append(season_block)

    return {"seasons": seasons_out, "total": _aggregate(matches, "mixed")}


def _aggregate(matches: list[dict], side: str) -> dict[str, Any]:
    n = len(matches)
    if n == 0:
        return {"matches": 0}
    wins = sum(1 for m in matches if m["result"] == "W")
    draws = sum(1 for m in matches if m["result"] == "D")
    losses = sum(1 for m in matches if m["result"] == "L")

    def goals_for(m):
        return m["home_goals"] if m["is_home"] else m["away_goals"]

    def goals_against(m):
        return m["away_goals"] if m["is_home"] else m["home_goals"]

    gf = sum((goals_for(m) or 0) for m in matches)
    ga = sum((goals_against(m) or 0) for m in matches)

    yellow = sum((m["cards"]["home_yellow"] if m["is_home"] else m["cards"]["away_yellow"]) for m in matches)
    red = sum((m["cards"]["home_red"] if m["is_home"] else m["cards"]["away_red"]) for m in matches)

    # Ø Ratings
    rkeys = ("mid", "def_left", "def_center", "def_right", "att_left", "att_center", "att_right")
    rating_sums: dict[str, float] = {k: 0.0 for k in rkeys}
    rating_n: dict[str, int] = {k: 0 for k in rkeys}
    for m in matches:
        own = m["ratings"]["home"] if m["is_home"] else m["ratings"]["away"]
        for k in rkeys:
            v = own.get(k)
            if v is not None:
                rating_sums[k] += v
                rating_n[k] += 1
    avg_ratings = {k: round(rating_sums[k] / rating_n[k], 2) if rating_n[k] else None for k in rkeys}

    # Ballbesitz Ø
    poss_sum = poss_n = 0
    for m in matches:
        if m["is_home"]:
            v = m["possession"]["home_total"] or m["possession"]["home_1h"]
        else:
            v = None  # away_total existiert nicht – wir lassen es offen
        if v is not None:
            poss_sum += v
            poss_n += 1
    avg_possession = round(poss_sum / poss_n, 1) if poss_n else None

    return {
        "matches": n,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "goals_for": gf,
        "goals_against": ga,
        "goals_diff": gf - ga,
        "points": wins * 3 + draws,
        "yellow_cards": yellow,
        "red_cards": red,
        "avg_ratings": avg_ratings,
        "avg_possession": avg_possession,
    }
