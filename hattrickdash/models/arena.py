"""Stadion-Snapshots (Kapazität + Auslastung)."""
from datetime import date

from sqlalchemy import Date, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class ArenaSnapshot(Base):
    __tablename__ = "arena_snapshot"
    __table_args__ = (UniqueConstraint("team_id", "snapshot_date", name="uq_arena_snap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)

    arena_id: Mapped[int | None] = mapped_column(Integer)
    arena_name: Mapped[str] = mapped_column(String(120), default="")

    # Kapazität
    terraces_capacity: Mapped[int] = mapped_column(Integer, default=0)
    seating_capacity: Mapped[int] = mapped_column(Integer, default=0)
    seating_roof_capacity: Mapped[int] = mapped_column(Integer, default=0)
    vip_capacity: Mapped[int] = mapped_column(Integer, default=0)

    # Letzter Heimspieldurchschnitt (10 Spiele)
    avg_terraces: Mapped[int] = mapped_column(Integer, default=0)
    avg_seating: Mapped[int] = mapped_column(Integer, default=0)
    avg_seating_roof: Mapped[int] = mapped_column(Integer, default=0)
    avg_vip: Mapped[int] = mapped_column(Integer, default=0)

    last_income_capacity: Mapped[int] = mapped_column(Integer, default=0)   # bei voller Auslastung
    last_income_actual: Mapped[int] = mapped_column(Integer, default=0)     # tatsächlich
    expansion_in_progress: Mapped[bool] = mapped_column(Integer, default=0)
    expansion_finish_date: Mapped[date | None] = mapped_column(Date)
