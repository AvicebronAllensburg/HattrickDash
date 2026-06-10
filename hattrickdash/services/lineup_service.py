"""
Aufstellungs-Service: lädt aktuelle Aufstellung, berechnet Loddar/HatStats,
generiert XML-Payload für matchorder.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models.match import MatchLineup
from services.match_service import calc_hatstats, calc_loddar
from services.player_service import get_squad


SAVED_LINEUPS_DIR = config.DATA_DIR / "lineups"
SAVED_LINEUPS_DIR.mkdir(exist_ok=True)


# Standard-Formationen mit Default-Positionen (x/y in 0-100)
FORMATIONS: dict[str, list[dict]] = {
    "442": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rb", "x": 80, "y": 25}, {"role": "rcb", "x": 60, "y": 22},
        {"role": "lcb", "x": 40, "y": 22}, {"role": "lb", "x": 20, "y": 25},
        {"role": "rim", "x": 70, "y": 50}, {"role": "rcm", "x": 55, "y": 50},
        {"role": "lcm", "x": 45, "y": 50}, {"role": "lim", "x": 30, "y": 50},
        {"role": "rcf", "x": 60, "y": 80}, {"role": "lcf", "x": 40, "y": 80},
    ],
    "352": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rcb", "x": 65, "y": 22}, {"role": "ccb", "x": 50, "y": 18},
        {"role": "lcb", "x": 35, "y": 22},
        {"role": "rwb", "x": 85, "y": 50}, {"role": "rim", "x": 60, "y": 50},
        {"role": "ccm", "x": 50, "y": 50}, {"role": "lim", "x": 40, "y": 50},
        {"role": "lwb", "x": 15, "y": 50},
        {"role": "rcf", "x": 60, "y": 80}, {"role": "lcf", "x": 40, "y": 80},
    ],
    "433": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rb", "x": 80, "y": 25}, {"role": "rcb", "x": 60, "y": 22},
        {"role": "lcb", "x": 40, "y": 22}, {"role": "lb", "x": 20, "y": 25},
        {"role": "rcm", "x": 65, "y": 50}, {"role": "ccm", "x": 50, "y": 50},
        {"role": "lcm", "x": 35, "y": 50},
        {"role": "rw", "x": 80, "y": 80}, {"role": "ccf", "x": 50, "y": 85},
        {"role": "lw", "x": 20, "y": 80},
    ],
    "451": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rb", "x": 80, "y": 25}, {"role": "rcb", "x": 60, "y": 22},
        {"role": "lcb", "x": 40, "y": 22}, {"role": "lb", "x": 20, "y": 25},
        {"role": "rim", "x": 75, "y": 50}, {"role": "rcm", "x": 60, "y": 50},
        {"role": "ccm", "x": 50, "y": 50}, {"role": "lcm", "x": 40, "y": 50},
        {"role": "lim", "x": 25, "y": 50},
        {"role": "ccf", "x": 50, "y": 85},
    ],
    "532": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rwb", "x": 85, "y": 22}, {"role": "rcb", "x": 65, "y": 18},
        {"role": "ccb", "x": 50, "y": 15}, {"role": "lcb", "x": 35, "y": 18},
        {"role": "lwb", "x": 15, "y": 22},
        {"role": "rim", "x": 65, "y": 50}, {"role": "ccm", "x": 50, "y": 50},
        {"role": "lim", "x": 35, "y": 50},
        {"role": "rcf", "x": 60, "y": 80}, {"role": "lcf", "x": 40, "y": 80},
    ],
    "343": [
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rcb", "x": 65, "y": 22}, {"role": "ccb", "x": 50, "y": 18},
        {"role": "lcb", "x": 35, "y": 22},
        {"role": "rim", "x": 75, "y": 50}, {"role": "rcm", "x": 55, "y": 50},
        {"role": "lcm", "x": 45, "y": 50}, {"role": "lim", "x": 25, "y": 50},
        {"role": "rcf", "x": 75, "y": 80}, {"role": "ccf", "x": 50, "y": 85},
        {"role": "lcf", "x": 25, "y": 80},
    ],
    "541": [
        # 5 Verteidiger - 4 Mittelfeld - 1 Sturm
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rwb", "x": 88, "y": 22}, {"role": "rcb", "x": 65, "y": 18},
        {"role": "ccb", "x": 50, "y": 15}, {"role": "lcb", "x": 35, "y": 18},
        {"role": "lwb", "x": 12, "y": 22},
        {"role": "rim", "x": 75, "y": 50}, {"role": "rcm", "x": 55, "y": 50},
        {"role": "lcm", "x": 45, "y": 50}, {"role": "lim", "x": 25, "y": 50},
        {"role": "ccf", "x": 50, "y": 85},
    ],
    "523": [
        # 5 Verteidiger - 2 Mittelfeld - 3 Sturm
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rwb", "x": 88, "y": 22}, {"role": "rcb", "x": 65, "y": 18},
        {"role": "ccb", "x": 50, "y": 15}, {"role": "lcb", "x": 35, "y": 18},
        {"role": "lwb", "x": 12, "y": 22},
        {"role": "rcm", "x": 60, "y": 50}, {"role": "lcm", "x": 40, "y": 50},
        {"role": "rcf", "x": 75, "y": 80}, {"role": "ccf", "x": 50, "y": 85},
        {"role": "lcf", "x": 25, "y": 80},
    ],
    "253": [
        # 2 Verteidiger - 5 Mittelfeld - 3 Sturm (offensiv)
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rcb", "x": 60, "y": 22}, {"role": "lcb", "x": 40, "y": 22},
        {"role": "rim", "x": 80, "y": 50}, {"role": "rcm", "x": 60, "y": 50},
        {"role": "ccm", "x": 50, "y": 50}, {"role": "lcm", "x": 40, "y": 50},
        {"role": "lim", "x": 20, "y": 50},
        {"role": "rcf", "x": 70, "y": 80}, {"role": "ccf", "x": 50, "y": 85},
        {"role": "lcf", "x": 30, "y": 80},
    ],
    "550": [
        # 5 Verteidiger - 5 Mittelfeld - 0 Sturm (defensiv-extrem, "Bus parken")
        {"role": "keeper", "x": 50, "y": 5},
        {"role": "rwb", "x": 88, "y": 22}, {"role": "rcb", "x": 65, "y": 18},
        {"role": "ccb", "x": 50, "y": 15}, {"role": "lcb", "x": 35, "y": 18},
        {"role": "lwb", "x": 12, "y": 22},
        {"role": "rim", "x": 80, "y": 60}, {"role": "rcm", "x": 60, "y": 65},
        {"role": "ccm", "x": 50, "y": 70}, {"role": "lcm", "x": 40, "y": 65},
        {"role": "lim", "x": 20, "y": 60},
    ],
}


def get_formations() -> list[str]:
    return list(FORMATIONS.keys())


# ----------------------------------------------------------- Auto-Aufstellung
def auto_lineup(db: Session, formation: str, team_id: int | None = None,
                allow_injured: bool = False, allow_suspended: bool = False) -> dict:
    """
    Wählt für jede Position der Formation den besten verfügbaren Spieler
    (höchstes positionsspezifisches Skill).
    """
    tid = team_id or config.TEAM_ID
    if formation not in FORMATIONS:
        raise ValueError(f"Unbekannte Formation: {formation}")
    squad = get_squad(db, tid)

    # Filter
    candidates = [
        p for p in squad
        if (allow_injured or not p["is_injured"])
        and (allow_suspended or not p["is_suspended"])
    ]

    used: set[int] = set()
    placements: list[dict] = []

    for slot in FORMATIONS[formation]:
        skill_field = _slot_to_skill(slot["role"])
        best = None
        best_score = -1
        for p in candidates:
            if p["player_id"] in used:
                continue
            score = (p["skills"].get(skill_field) or 0)
            # Kondition leicht gewichten
            score += (p["skills"].get("skill_stamina") or 0) * 0.1
            if score > best_score:
                best_score = score
                best = p
        if best:
            used.add(best["player_id"])
            placements.append({
                "role": slot["role"],
                "x": slot["x"],
                "y": slot["y"],
                "player": best,
                "rating_estimate": _estimate_position_rating(best, slot["role"]),
            })

    bench = [p for p in candidates if p["player_id"] not in used][:7]
    return {
        "formation": formation,
        "lineup": placements,
        "bench": bench,
        "team_rating": _team_rating(placements),
    }


def _slot_to_skill(role: str) -> str:
    if role == "keeper":
        return "skill_keeper"
    if "cb" in role or "wb" in role or role.startswith("rb") or role.startswith("lb"):
        return "skill_defending"
    if "im" in role or "cm" in role:
        return "skill_playmaking"
    if role in ("rw", "lw"):
        return "skill_winger"
    if "cf" in role or role == "ccf":
        return "skill_scoring"
    return "skill_passing"


def _estimate_position_rating(p: dict, role: str) -> float:
    """Vereinfachte Einzelnoten-Schätzung."""
    primary = p["skills"].get(_slot_to_skill(role)) or 0
    form = p["skills"].get("skill_form") or 0
    stamina = p["skills"].get("skill_stamina") or 0
    return round(primary * 0.7 + form * 0.2 + stamina * 0.1, 2)


def _team_rating(placements: list[dict]) -> dict[str, float]:
    def avg(roles_substr):
        vals = [p["rating_estimate"] for p in placements
                if any(s in p["role"] for s in roles_substr)]
        return round(sum(vals) / len(vals), 2) if vals else 0.0

    mid = avg(("im", "cm"))
    att = avg(("cf", "rw", "lw"))
    df = avg(("cb", "wb", "rb", "lb"))
    return {
        "midfield": mid,
        "attack": att,
        "defense": df,
        "hatstats": calc_hatstats(mid, att, att, att, df, df, df),
        "loddar": calc_loddar(mid, att, att, att, df, df, df),
    }


# ------------------------------------------------------ Save / Load (lokal)
def save_lineup(name: str, lineup: dict) -> dict:
    safe = "".join(c for c in name if c.isalnum() or c in "-_") or "lineup"
    path = SAVED_LINEUPS_DIR / f"{safe}.json"
    payload = {"name": name, "saved_at": datetime.utcnow().isoformat(), "lineup": lineup}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"path": str(path), "name": name}


def list_saved() -> list[dict]:
    out = []
    for p in sorted(SAVED_LINEUPS_DIR.glob("*.json")):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
            out.append({"name": data.get("name", p.stem), "saved_at": data.get("saved_at"), "file": p.name})
        except Exception:
            continue
    return out


def load_lineup(file_name: str) -> dict | None:
    p = SAVED_LINEUPS_DIR / file_name
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


# ---------------------------------------------- matchorder JSON (CHPP)
# Hattrick CHPP setmatchorder erwartet den lineup-Form-Parameter als
# JSON-String (NICHT XML). Format nach Hattrick Organizer (HO!):
#   {"positions":[14x {"id","behaviour"}], "bench":[14x], "kickers":[11x],
#    "captain":int, "setPieces":int, "settings":{...}, "substitutions":[]}
# positions-Slots haben KEINE RoleID — die Position ergibt sich aus dem
# Array-Index (Reihenfolge fix):
#    0 Torwart
#    1 RV  2 IV-rechts  3 IV-mitte  4 IV-links  5 LV
#    6 Flügel-rechts  7 IM-rechts  8 IM-mitte  9 IM-links  10 Flügel-links
#   11 Stürmer-rechts  12 Stürmer-mitte  13 Stürmer-links
# Welche positions-Indizes eine Linie je nach Spielerzahl belegt (rechts→links):
_DEF_PATTERN = {0: [], 1: [3], 2: [2, 4], 3: [2, 3, 4],
                4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5]}
_MID_PATTERN = {0: [], 1: [8], 2: [7, 9], 3: [7, 8, 9],
                4: [6, 7, 9, 10], 5: [6, 7, 8, 9, 10]}
_FWD_PATTERN = {0: [], 1: [12], 2: [11, 13], 3: [11, 12, 13]}
_LINE_LABEL = {"def": "Abwehr", "mid": "Mittelfeld", "fwd": "Sturm"}
# Bank-Slot-Index im 14er-bench-Array je Positions-Code
_BENCH_CODE_TO_IDX = {"GK": 0, "DC": 1, "DW": 2, "MF": 3, "S": 4, "W": 5, "EX": 6}


def _line_of(slot: dict) -> str:
    """Linien-Zuordnung über die Pitch-y-Koordinate der Formation."""
    if slot.get("role") == "keeper":
        return "gk"
    y = slot.get("y") if slot.get("y") is not None else 50
    if y < 35:
        return "def"
    if y < 75:
        return "mid"
    return "fwd"


def build_matchorder_json(lineup: dict, *,
                          tactic: str = "0", captain_id: int | None = None,
                          setpieces_id: int | None = None,
                          include_bench: bool = True,
                          attitude: int = -1) -> str:
    """
    Baut den lineup-JSON-String für CHPP matchorders
    (actionType=setmatchorder / predictratings).

    Wirft ValueError bei unvollständiger/ungültiger Aufstellung — Hattrick
    quittiert kaputte Payloads sonst nur mit CHPP-Fehler 10.
    """
    slots = [s for s in lineup.get("lineup", [])
             if s.get("player") and s["player"].get("player_id")]
    if len(slots) != 11:
        raise ValueError(f"Startelf hat {len(slots)} statt 11 Spieler.")
    if not captain_id:
        raise ValueError("Kapitän nicht gesetzt.")
    if not setpieces_id:
        raise ValueError("Standardschütze nicht gesetzt.")

    lines: dict[str, list[dict]] = {"gk": [], "def": [], "mid": [], "fwd": []}
    for s in slots:
        lines[_line_of(s)].append(s)
    if len(lines["gk"]) != 1:
        raise ValueError(f"{len(lines['gk'])} Torhüter aufgestellt — genau 1 nötig.")

    positions = [{"id": 0, "behaviour": 0} for _ in range(14)]
    positions[0] = {"id": int(lines["gk"][0]["player"]["player_id"]), "behaviour": 0}

    for key, pattern in (("def", _DEF_PATTERN), ("mid", _MID_PATTERN),
                         ("fwd", _FWD_PATTERN)):
        group = sorted(lines[key], key=lambda s: -(s.get("x") or 50))
        if len(group) not in pattern:
            raise ValueError(
                f"{len(group)} Spieler in der Linie {_LINE_LABEL[key]} — "
                f"maximal {max(pattern)} erlaubt."
            )
        for slot, idx in zip(group, pattern[len(group)]):
            positions[idx] = {"id": int(slot["player"]["player_id"]), "behaviour": 0}

    starting_ids = [p["id"] for p in positions if p["id"]]
    if captain_id not in starting_ids:
        raise ValueError("Kapitän ist nicht in der Startelf.")
    if setpieces_id not in starting_ids:
        raise ValueError("Standardschütze ist nicht in der Startelf.")

    # Bank: 14 Slots (7 + 7 Backup), leere als id=0
    bench = [{"id": 0, "behaviour": 0} for _ in range(14)]
    if include_bench:
        used_idx: set[int] = set()
        for p_data in lineup.get("bench", [])[:7]:
            code = p_data.get("bench_role_code")
            if not code:
                pc = (p_data.get("position_code") or "").upper()
                code = ({"G": "GK", "DC": "DC", "DW": "DW", "M": "MF",
                         "W": "W", "F": "S"}.get(pc, "EX"))
            idx = _BENCH_CODE_TO_IDX.get(code, 6)
            if idx in used_idx:
                idx = next((i for i in range(7) if i not in used_idx), None)
                if idx is None:
                    break
            used_idx.add(idx)
            bench[idx] = {"id": int(p_data["player_id"]), "behaviour": 0}

    # Elfmeterschützen: alle 11 Starter, Standardschütze zuerst
    kicker_ids = [setpieces_id] + [pid for pid in starting_ids if pid != setpieces_id]
    kickers = [{"id": pid, "behaviour": 0} for pid in kicker_ids]

    payload = {
        "positions": positions,
        "bench": bench,
        "kickers": kickers,
        "captain": int(captain_id),
        "setPieces": int(setpieces_id),
        "settings": {
            "tactic": int(tactic),
            "speechLevel": int(attitude),   # -1 = nicht ändern
            "coachModifier": 0,
            "newLineup": "",
        },
        "substitutions": [],
    }
    return json.dumps(payload, separators=(",", ":"))
