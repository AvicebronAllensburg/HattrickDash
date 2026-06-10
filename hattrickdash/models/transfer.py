"""Transfer-Records (Käufe + Verkäufe)."""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class Transfer(Base):
    __tablename__ = "transfer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transfer_id: Mapped[int | None] = mapped_column(Integer, index=True, unique=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    direction: Mapped[str] = mapped_column(String(10))                  # buy / sell

    player_id: Mapped[int] = mapped_column(Integer, index=True)
    player_name: Mapped[str] = mapped_column(String(120), default="")
    age_years: Mapped[int | None] = mapped_column(Integer)
    age_days: Mapped[int | None] = mapped_column(Integer)
    nationality_name: Mapped[str] = mapped_column(String(60), default="")

    tsi: Mapped[int | None] = mapped_column(Integer)
    price: Mapped[int | None] = mapped_column(Integer)                 # Endpreis
    currency: Mapped[str] = mapped_column(String(8), default="EUR")

    other_team_id: Mapped[int | None] = mapped_column(Integer)
    other_team_name: Mapped[str] = mapped_column(String(120), default="")
    own_team_id: Mapped[int | None] = mapped_column(Integer, index=True)

    # Skill-Snapshot beim Transfer (für Listen-Anzeige)
    skill_keeper: Mapped[int | None] = mapped_column(Integer)
    skill_defending: Mapped[int | None] = mapped_column(Integer)
    skill_playmaking: Mapped[int | None] = mapped_column(Integer)
    skill_winger: Mapped[int | None] = mapped_column(Integer)
    skill_passing: Mapped[int | None] = mapped_column(Integer)
    skill_scoring: Mapped[int | None] = mapped_column(Integer)
    skill_setpieces: Mapped[int | None] = mapped_column(Integer)
