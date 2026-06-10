"""
Match + MatchEvent + MatchLineup.
match_type: LEAGUE / CUP / FRIENDLY / QUALIFICATION / TOURNAMENT
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Match(Base):
    __tablename__ = "match"

    match_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    match_type: Mapped[str] = mapped_column(String(20), default="LEAGUE")

    home_team_id: Mapped[int] = mapped_column(Integer, index=True)
    home_team_name: Mapped[str] = mapped_column(String(120), default="")
    away_team_id: Mapped[int] = mapped_column(Integer, index=True)
    away_team_name: Mapped[str] = mapped_column(String(120), default="")
    home_goals: Mapped[int | None] = mapped_column(Integer)
    away_goals: Mapped[int | None] = mapped_column(Integer)

    # Ratings (Heim)
    home_rating_mid: Mapped[float | None] = mapped_column(Float)
    home_rating_def_left: Mapped[float | None] = mapped_column(Float)
    home_rating_def_center: Mapped[float | None] = mapped_column(Float)
    home_rating_def_right: Mapped[float | None] = mapped_column(Float)
    home_rating_att_left: Mapped[float | None] = mapped_column(Float)
    home_rating_att_center: Mapped[float | None] = mapped_column(Float)
    home_rating_att_right: Mapped[float | None] = mapped_column(Float)
    home_rating_keeper: Mapped[float | None] = mapped_column(Float)
    home_rating_indirect_setpieces_def: Mapped[float | None] = mapped_column(Float)
    home_rating_indirect_setpieces_att: Mapped[float | None] = mapped_column(Float)

    # Ratings (Auswärts)
    away_rating_mid: Mapped[float | None] = mapped_column(Float)
    away_rating_def_left: Mapped[float | None] = mapped_column(Float)
    away_rating_def_center: Mapped[float | None] = mapped_column(Float)
    away_rating_def_right: Mapped[float | None] = mapped_column(Float)
    away_rating_att_left: Mapped[float | None] = mapped_column(Float)
    away_rating_att_center: Mapped[float | None] = mapped_column(Float)
    away_rating_att_right: Mapped[float | None] = mapped_column(Float)
    away_rating_keeper: Mapped[float | None] = mapped_column(Float)
    away_rating_indirect_setpieces_def: Mapped[float | None] = mapped_column(Float)
    away_rating_indirect_setpieces_att: Mapped[float | None] = mapped_column(Float)

    # Ballbesitz
    home_possession_total: Mapped[int | None] = mapped_column(Integer)
    home_possession_1h: Mapped[int | None] = mapped_column(Integer)
    home_possession_2h: Mapped[int | None] = mapped_column(Integer)
    away_possession_total: Mapped[int | None] = mapped_column(Integer)
    away_possession_1h: Mapped[int | None] = mapped_column(Integer)
    away_possession_2h: Mapped[int | None] = mapped_column(Integer)

    home_yellow_cards: Mapped[int] = mapped_column(Integer, default=0)
    home_red_cards: Mapped[int] = mapped_column(Integer, default=0)
    away_yellow_cards: Mapped[int] = mapped_column(Integer, default=0)
    away_red_cards: Mapped[int] = mapped_column(Integer, default=0)

    weather: Mapped[str] = mapped_column(String(40), default="")
    attendance: Mapped[int | None] = mapped_column(Integer)
    season: Mapped[int | None] = mapped_column(Integer, index=True)
    matchday: Mapped[int | None] = mapped_column(Integer)

    home_tactic: Mapped[str] = mapped_column(String(40), default="")
    home_tactic_skill: Mapped[int | None] = mapped_column(Integer)
    away_tactic: Mapped[str] = mapped_column(String(40), default="")
    away_tactic_skill: Mapped[int | None] = mapped_column(Integer)

    # Chancen-Statistiken (für Angriffs-/Verteidigungs-Tabs)
    home_chances_left: Mapped[int | None] = mapped_column(Integer)
    home_chances_center: Mapped[int | None] = mapped_column(Integer)
    home_chances_right: Mapped[int | None] = mapped_column(Integer)
    home_chances_setpieces: Mapped[int | None] = mapped_column(Integer)
    home_chances_special: Mapped[int | None] = mapped_column(Integer)
    away_chances_left: Mapped[int | None] = mapped_column(Integer)
    away_chances_center: Mapped[int | None] = mapped_column(Integer)
    away_chances_right: Mapped[int | None] = mapped_column(Integer)
    away_chances_setpieces: Mapped[int | None] = mapped_column(Integer)
    away_chances_special: Mapped[int | None] = mapped_column(Integer)

    events: Mapped[list["MatchEvent"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )
    lineup: Mapped[list["MatchLineup"]] = relationship(
        back_populates="match", cascade="all, delete-orphan"
    )


class MatchEvent(Base):
    __tablename__ = "match_event"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("match.match_id"), index=True)
    minute: Mapped[int | None] = mapped_column(Integer)
    event_type_id: Mapped[int | None] = mapped_column(Integer)
    event_text: Mapped[str] = mapped_column(String, default="")
    subject_team_id: Mapped[int | None] = mapped_column(Integer)
    subject_player_id: Mapped[int | None] = mapped_column(Integer)
    object_player_id: Mapped[int | None] = mapped_column(Integer)

    match: Mapped[Match] = relationship(back_populates="events")


class MatchLineup(Base):
    __tablename__ = "match_lineup"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    match_id: Mapped[int] = mapped_column(Integer, ForeignKey("match.match_id"), index=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    player_id: Mapped[int] = mapped_column(Integer, index=True)
    role_id: Mapped[int | None] = mapped_column(Integer)
    role_name: Mapped[str] = mapped_column(String(40), default="")
    position_x: Mapped[float | None] = mapped_column(Float)        # 0-100
    position_y: Mapped[float | None] = mapped_column(Float)        # 0-100
    player_rating: Mapped[float | None] = mapped_column(Float)     # End-Note (z.B. 6.22)
    player_rating_end_of_match: Mapped[float | None] = mapped_column(Float)
    is_captain: Mapped[bool] = mapped_column(Integer, default=0)
    is_setpieces: Mapped[bool] = mapped_column(Integer, default=0)

    match: Mapped[Match] = relationship(back_populates="lineup")
