"""Jugend-Modelle (v2).

Hattrick-Jugendsystem:
  - Jeder Manager hat 0-1 Jugendmannschaft (eigene Liga, eigener Trainer)
  - Jugendspieler haben 7 trainierbare Skills (kein Form/Stamina/Loyalty/
    Setpieces im klassischen Sinne — Setpieces ist Pflicht-Skill, der Rest
    wird über Training entwickelt)
  - Pro Skill: aktuell-gescouteter Wert + max-erreichbarer Wert
  - Spieler kann ab 17.0 Jahren in die A-Mannschaft befoerdert werden

Snapshot-Pattern wie bei Player: eine Row pro (player_id, snapshot_date),
damit man die Skill-Entwicklung ueber Zeit sehen kann.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class YouthTeam(Base):
    __tablename__ = "youth_team"

    youth_team_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    senior_team_id: Mapped[int | None] = mapped_column(Integer, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    short_name: Mapped[str] = mapped_column(String(60), default="")

    league_id: Mapped[int | None] = mapped_column(Integer)
    league_name: Mapped[str] = mapped_column(String(120), default="")
    league_level: Mapped[int | None] = mapped_column(Integer)

    coach_name: Mapped[str] = mapped_column(String(120), default="")
    coach_skill: Mapped[int | None] = mapped_column(Integer)        # Trainer-Wertung
    coach_skill_name: Mapped[str] = mapped_column(String(40), default="")

    scout_count: Mapped[int | None] = mapped_column(Integer)
    last_match_date: Mapped[datetime | None] = mapped_column(DateTime)
    next_match_date: Mapped[datetime | None] = mapped_column(DateTime)

    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class YouthPlayer(Base):
    """Jugendspieler-Snapshot. PK: (youth_player_id, snapshot_date)."""
    __tablename__ = "youth_player"
    __table_args__ = (UniqueConstraint("youth_player_id", "snapshot_date",
                                        name="uq_youth_player_snap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    youth_player_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    youth_team_id: Mapped[int] = mapped_column(Integer, index=True)

    first_name: Mapped[str] = mapped_column(String(80), default="")
    last_name: Mapped[str] = mapped_column(String(80), default="")
    nickname: Mapped[str] = mapped_column(String(80), default="")
    age_years: Mapped[int | None] = mapped_column(Integer)
    age_days: Mapped[int | None] = mapped_column(Integer)
    player_number: Mapped[int | None] = mapped_column(Integer)
    nationality_id: Mapped[int | None] = mapped_column(Integer)
    nationality_name: Mapped[str] = mapped_column(String(60), default="")

    specialty: Mapped[int] = mapped_column(Integer, default=0)
    specialty_name: Mapped[str] = mapped_column(String(40), default="")

    # 7 Jugend-Skills, jeweils current (gescoutet) + max (Potenzial nach Scout)
    # Wenn nicht gescoutet: current=None oder 0
    skill_keeper:    Mapped[int | None] = mapped_column(Integer)
    skill_defender:  Mapped[int | None] = mapped_column(Integer)
    skill_playmaker: Mapped[int | None] = mapped_column(Integer)
    skill_winger:    Mapped[int | None] = mapped_column(Integer)
    skill_passing:   Mapped[int | None] = mapped_column(Integer)
    skill_scorer:    Mapped[int | None] = mapped_column(Integer)
    skill_setpieces: Mapped[int | None] = mapped_column(Integer)

    # Maximum-Werte (gescoutetes Potenzial)
    max_keeper:    Mapped[int | None] = mapped_column(Integer)
    max_defender:  Mapped[int | None] = mapped_column(Integer)
    max_playmaker: Mapped[int | None] = mapped_column(Integer)
    max_winger:    Mapped[int | None] = mapped_column(Integer)
    max_passing:   Mapped[int | None] = mapped_column(Integer)
    max_scorer:    Mapped[int | None] = mapped_column(Integer)
    max_setpieces: Mapped[int | None] = mapped_column(Integer)

    # Wurde der Skill schon gescoutet? (max_* ohne scouting = None)
    scouted_keeper:    Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_defender:  Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_playmaker: Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_winger:    Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_passing:   Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_scorer:    Mapped[bool] = mapped_column(Boolean, default=False)
    scouted_setpieces: Mapped[bool] = mapped_column(Boolean, default=False)

    # Teammitgliedschaft / Status
    is_promoted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_in_squad: Mapped[bool] = mapped_column(Boolean, default=True)
    can_be_promoted: Mapped[bool] = mapped_column(Boolean, default=False)

    last_match_date: Mapped[datetime | None] = mapped_column(DateTime)
    last_match_minutes: Mapped[int | None] = mapped_column(Integer)
    last_match_id: Mapped[int | None] = mapped_column(Integer)


class YouthMatch(Base):
    """Jugendspiele-Eintrag (Liga + Freundschaft)."""
    __tablename__ = "youth_match"

    youth_match_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_date: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    match_type: Mapped[str] = mapped_column(String(20), default="LEAGUE")
    home_team_id: Mapped[int | None] = mapped_column(Integer)
    away_team_id: Mapped[int | None] = mapped_column(Integer)
    home_team_name: Mapped[str] = mapped_column(String(120), default="")
    away_team_name: Mapped[str] = mapped_column(String(120), default="")
    home_goals: Mapped[int | None] = mapped_column(Integer)
    away_goals: Mapped[int | None] = mapped_column(Integer)
    season: Mapped[int | None] = mapped_column(Integer)
    matchday: Mapped[int | None] = mapped_column(Integer)


class YouthTraining(Base):
    """Aktuelle Trainings-Einstellung der Jugendmannschaft (eine Row pro Woche)."""
    __tablename__ = "youth_training"
    __table_args__ = (UniqueConstraint("youth_team_id", "season", "week_number",
                                        name="uq_youth_train_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    youth_team_id: Mapped[int] = mapped_column(Integer, index=True)
    season: Mapped[int] = mapped_column(Integer)
    week_number: Mapped[int] = mapped_column(Integer)
    training_date: Mapped[date | None] = mapped_column(Date)
    training_type: Mapped[str] = mapped_column(String(40), default="")
    training_match_kind: Mapped[str] = mapped_column(String(40), default="")
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class YouthScoutReport(Base):
    """Per-Skill Scout-Berichte (manuell erfassbar oder aus CHPP-Skill-Werten
    mit ScoutCall>0 abgeleitet)."""
    __tablename__ = "youth_scout_report"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    youth_player_id: Mapped[int] = mapped_column(Integer, index=True)
    skill_name: Mapped[str] = mapped_column(String(20))     # 'scorer', 'keeper', ...
    scouted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    current_value: Mapped[int | None] = mapped_column(Integer)
    max_value: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(String(200), default="")
