"""Trainerstab-Liste."""
from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class StaffMember(Base):
    __tablename__ = "staff_member"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)

    role: Mapped[str] = mapped_column(String(40))                   # GoalkeeperCoach, AssistantCoach, ...
    role_label: Mapped[str] = mapped_column(String(60), default="") # "Torwarttrainer", ...
    name: Mapped[str] = mapped_column(String(120), default="")
    skill_level: Mapped[int | None] = mapped_column(Integer)
    salary: Mapped[int | None] = mapped_column(Integer)
