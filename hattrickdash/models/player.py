"""
Player-Snapshot-Modell.
Eine Row pro (player_id, snapshot_date), damit man Skill-Verlauf darstellen kann.
"""
from datetime import date

from sqlalchemy import Boolean, Date, Float, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Player(Base):
    __tablename__ = "player"
    __table_args__ = (UniqueConstraint("player_id", "snapshot_date", name="uq_player_snap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)

    team_id: Mapped[int] = mapped_column(Integer, index=True)
    first_name: Mapped[str] = mapped_column(String(80), default="")
    last_name: Mapped[str] = mapped_column(String(80), default="")
    nickname: Mapped[str] = mapped_column(String(80), default="")
    age_years: Mapped[int | None] = mapped_column(Integer)
    age_days: Mapped[int | None] = mapped_column(Integer)
    nationality_id: Mapped[int | None] = mapped_column(Integer)
    nationality_name: Mapped[str] = mapped_column(String(60), default="")
    tsi: Mapped[int | None] = mapped_column(Integer)
    salary: Mapped[float | None] = mapped_column(Float)

    # Skill-Levels (0-20)
    skill_keeper: Mapped[int | None] = mapped_column(Integer)
    skill_defending: Mapped[int | None] = mapped_column(Integer)
    skill_playmaking: Mapped[int | None] = mapped_column(Integer)
    skill_winger: Mapped[int | None] = mapped_column(Integer)
    skill_passing: Mapped[int | None] = mapped_column(Integer)
    skill_scoring: Mapped[int | None] = mapped_column(Integer)
    skill_setpieces: Mapped[int | None] = mapped_column(Integer)
    skill_experience: Mapped[int | None] = mapped_column(Integer)
    skill_form: Mapped[int | None] = mapped_column(Integer)
    skill_stamina: Mapped[int | None] = mapped_column(Integer)
    skill_loyalty: Mapped[int | None] = mapped_column(Integer)
    motherclub_bonus: Mapped[bool] = mapped_column(Boolean, default=False)

    specialty: Mapped[int] = mapped_column(Integer, default=0)        # 0=keine
    specialty_name: Mapped[str] = mapped_column(String(40), default="")
    is_injured: Mapped[bool] = mapped_column(Boolean, default=False)
    injury_weeks: Mapped[int] = mapped_column(Integer, default=0)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    suspension_matches: Mapped[int] = mapped_column(Integer, default=0)
    yellow_cards: Mapped[int] = mapped_column(Integer, default=0)
    is_transfer_listed: Mapped[bool] = mapped_column(Boolean, default=False)
    is_national_player: Mapped[bool] = mapped_column(Boolean, default=False)

    position_code: Mapped[str] = mapped_column(String(4), default="")  # G/DC/DW/W/M/F
    role_in_team: Mapped[str] = mapped_column(String(40), default="")  # Trainer/Captain/SetPieces/...
    rating_stars: Mapped[float | None] = mapped_column(Float)          # Sterne aus letztem Match
