"""Wöchentliche Finanz-Snapshots."""
from datetime import date

from sqlalchemy import Date, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class FinanceSnapshot(Base):
    __tablename__ = "finance_snapshot"
    __table_args__ = (UniqueConstraint("team_id", "snapshot_date", name="uq_fin_snap"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    season: Mapped[int | None] = mapped_column(Integer, index=True)
    week_number: Mapped[int | None] = mapped_column(Integer)

    # Einnahmen
    income_supporters: Mapped[int] = mapped_column(Integer, default=0)
    income_tickets: Mapped[int] = mapped_column(Integer, default=0)
    income_sponsors: Mapped[int] = mapped_column(Integer, default=0)
    income_interest: Mapped[int] = mapped_column(Integer, default=0)
    income_transfers_in: Mapped[int] = mapped_column(Integer, default=0)
    income_other: Mapped[int] = mapped_column(Integer, default=0)
    income_total: Mapped[int] = mapped_column(Integer, default=0)

    # Ausgaben
    costs_arena: Mapped[int] = mapped_column(Integer, default=0)
    costs_wages: Mapped[int] = mapped_column(Integer, default=0)
    costs_interest: Mapped[int] = mapped_column(Integer, default=0)
    costs_specialists: Mapped[int] = mapped_column(Integer, default=0)
    costs_youth: Mapped[int] = mapped_column(Integer, default=0)
    costs_transfers_out: Mapped[int] = mapped_column(Integer, default=0)
    costs_other: Mapped[int] = mapped_column(Integer, default=0)
    costs_total: Mapped[int] = mapped_column(Integer, default=0)

    profit: Mapped[int] = mapped_column(Integer, default=0)
    cash_balance: Mapped[int] = mapped_column(Integer, default=0)
    cash_next_week: Mapped[int] = mapped_column(Integer, default=0)
