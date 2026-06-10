"""
Team-Stammdaten + Fan-Snapshots.
Team selbst ist eine einzige Row pro Team-ID, Trainereigenschaften werden überschrieben.
Die History (Fans, Stimmung, ...) liegt in FanSnapshot.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Team(Base):
    __tablename__ = "team"

    team_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    short_name: Mapped[str] = mapped_column(String(40), default="")
    league_id: Mapped[int | None] = mapped_column(Integer)
    league_name: Mapped[str] = mapped_column(String(80), default="")
    league_level: Mapped[int | None] = mapped_column(Integer)
    country_id: Mapped[int | None] = mapped_column(Integer)
    country_name: Mapped[str] = mapped_column(String(80), default="")
    arena_id: Mapped[int | None] = mapped_column(Integer)
    arena_name: Mapped[str] = mapped_column(String(120), default="")
    coach_name: Mapped[str] = mapped_column(String(120), default="")
    coach_skill: Mapped[int | None] = mapped_column(Integer)         # Können
    coach_leadership: Mapped[int | None] = mapped_column(Integer)    # Führungsqualitäten
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    snapshots: Mapped[list["FanSnapshot"]] = relationship(
        back_populates="team", cascade="all, delete-orphan"
    )


class FanSnapshot(Base):
    """Wöchentlicher Snapshot von Stimmungs-/Fan-Werten."""
    __tablename__ = "fan_snapshot"
    __table_args__ = (UniqueConstraint("team_id", "snapshot_date", name="uq_fansnap_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("team.team_id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)

    fans: Mapped[int | None] = mapped_column(Integer)
    fan_mood: Mapped[int | None] = mapped_column(Integer)             # 0–8 Skala
    team_spirit: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[int | None] = mapped_column(Integer)
    sponsors: Mapped[int | None] = mapped_column(Integer)
    youth_squad_level: Mapped[int | None] = mapped_column(Integer)
    training_intensity: Mapped[int | None] = mapped_column(Integer)
    stamina_share: Mapped[int | None] = mapped_column(Integer)
    training_type: Mapped[str] = mapped_column(String(40), default="")

    team: Mapped[Team] = relationship(back_populates="snapshots")
