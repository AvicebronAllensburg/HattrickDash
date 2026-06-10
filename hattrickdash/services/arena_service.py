"""Stadion-Auswertung + Arenasizer-Berechnung."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

import config
from models.arena import ArenaSnapshot
from models.team import FanSnapshot

# Hattrick-Optimal-Verteilung
OPTIMAL_RATIO = {
    "terraces": 0.60,
    "seating": 0.235,
    "seating_roof": 0.14,
    "vip": 0.025,
}

# Vereinfachte Einnahmen pro Sitzplatz/Heimspiel (HT-Werte ungefähr).
TICKET_PRICE = {
    "terraces": 9.5,
    "seating": 18.0,
    "seating_roof": 27.0,
    "vip": 60.0,
}

USAGE_FACTORS = {
    "low": 0.83,
    "mid": 1.10,
    "high": 1.39,
}


def get_latest(db: Session, team_id: int | None = None) -> dict:
    tid = team_id or config.TEAM_ID
    row = db.execute(
        select(ArenaSnapshot)
        .where(ArenaSnapshot.team_id == tid)
        .order_by(ArenaSnapshot.snapshot_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    if not row:
        return {}

    cap_total = (row.terraces_capacity + row.seating_capacity
                 + row.seating_roof_capacity + row.vip_capacity)
    avg_total = row.avg_terraces + row.avg_seating + row.avg_seating_roof + row.avg_vip

    def block(name, cap, avg):
        ratio = (cap / cap_total) if cap_total else 0
        usage = (avg / cap) if cap else 0
        income = round(avg * TICKET_PRICE.get(name, 0))
        return {
            "name": name,
            "capacity": cap,
            "ratio_pct": round(ratio * 100, 2),
            "optimal_pct": round(OPTIMAL_RATIO[name] * 100, 2),
            "attendance": avg,
            "usage_pct": round(usage * 100, 2),
            "income": income,
        }

    blocks = [
        block("terraces", row.terraces_capacity, row.avg_terraces),
        block("seating", row.seating_capacity, row.avg_seating),
        block("seating_roof", row.seating_roof_capacity, row.avg_seating_roof),
        block("vip", row.vip_capacity, row.avg_vip),
    ]
    income_total = sum(b["income"] for b in blocks)

    # Größen-Stufe in 5k-Schritten (für SVG-Auswahl im Frontend)
    size_step = 5000
    size_index = min(12, max(0, cap_total // size_step))

    return {
        "arena_id": row.arena_id,
        "arena_name": row.arena_name,
        "blocks": blocks,
        "capacity_total": cap_total,
        "attendance_total": avg_total,
        "usage_total_pct": round((avg_total / cap_total) * 100, 2) if cap_total else 0.0,
        "income_capacity": row.last_income_capacity,
        "income_actual": row.last_income_actual,
        "income_estimated": income_total,
        "size_index": size_index,         # 0..12 (entspricht 0-5k, 5-10k, ..., 60k+)
        "size_step": size_step,
    }


# ---------------------------------------------------------------- Arenasizer
def arenasizer(db: Session, target_total: int, team_id: int | None = None) -> dict:
    """
    Berechnet für eine Zielgröße eine optimale Verteilung + erwartete Einnahmen
    bei drei Auslastungsgraden (schlecht/mittel/hoch).
    """
    tid = team_id or config.TEAM_ID
    fan_row = db.execute(
        select(FanSnapshot)
        .where(FanSnapshot.team_id == tid)
        .order_by(FanSnapshot.snapshot_date.desc())
        .limit(1)
    ).scalar_one_or_none()
    fanclub = fan_row.fans if fan_row and fan_row.fans else 0

    distribution = {
        "terraces": int(target_total * OPTIMAL_RATIO["terraces"]),
        "seating": int(target_total * OPTIMAL_RATIO["seating"]),
        "seating_roof": int(target_total * OPTIMAL_RATIO["seating_roof"]),
        "vip": int(target_total * OPTIMAL_RATIO["vip"]),
    }
    # Rest zu Stehplätzen
    diff = target_total - sum(distribution.values())
    distribution["terraces"] += diff

    def income_at(usage_factor: float) -> tuple[int, int]:
        """Liefert (Zuschauer, Einnahmen) bei gegebenem Faktor (Fanclub × Faktor)."""
        attendance_total = int(fanclub * usage_factor) if fanclub else int(target_total * usage_factor / 1.5)
        # Nach OPTIMAL_RATIO verteilen, aber kappen an Kapazität
        revenue = 0
        for k, ratio in OPTIMAL_RATIO.items():
            seats = min(int(attendance_total * ratio), distribution[k])
            revenue += seats * TICKET_PRICE[k]
        return attendance_total, int(revenue)

    low_att, low_rev = income_at(USAGE_FACTORS["low"])
    mid_att, mid_rev = income_at(USAGE_FACTORS["mid"])
    high_att, high_rev = income_at(USAGE_FACTORS["high"])

    # Unterhaltskosten: vereinfachte Faustformel
    maintenance = round(0.65 * target_total + 0.20 * distribution["seating_roof"]
                        + 0.40 * distribution["vip"])

    return {
        "fanclub_size": fanclub,
        "target_total": target_total,
        "distribution": distribution,
        "scenarios": [
            {"label": "schlecht", "attendance": low_att, "revenue": low_rev},
            {"label": "mittel", "attendance": mid_att, "revenue": mid_rev},
            {"label": "hoch", "attendance": high_att, "revenue": high_rev},
        ],
        "maintenance_cost": maintenance,
    }
