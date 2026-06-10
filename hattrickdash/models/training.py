"""Wöchentliche Trainings-Records."""
from datetime import date

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TrainingWeek(Base):
    __tablename__ = "training_week"
    __table_args__ = (UniqueConstraint("team_id", "season", "week_number", name="uq_train_week"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    season: Mapped[int] = mapped_column(Integer, index=True)
    week_number: Mapped[int] = mapped_column(Integer)
    training_date: Mapped[date] = mapped_column(Date)

    training_type: Mapped[str] = mapped_column(String(40), default="")    # "Torwarttraining", "Standards", ...
    training_type_id: Mapped[int | None] = mapped_column(Integer)
    training_intensity: Mapped[int] = mapped_column(Integer, default=0)   # 0-100
    stamina_share: Mapped[int] = mapped_column(Integer, default=0)        # 0-100
    training_level: Mapped[int | None] = mapped_column(Integer)
