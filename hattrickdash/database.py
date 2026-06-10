"""
SQLAlchemy Setup. Eine globale Engine + Session-Factory.
"""
import logging
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

import config

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Basis für alle ORM-Modelle."""


engine = create_engine(
    config.DB_URL,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False},  # FastAPI + APScheduler im selben Prozess
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def create_tables() -> None:
    """Legt alle Tabellen an (idempotent)."""
    # Models müssen importiert sein, damit Base.metadata sie kennt.
    from models import team, player, match, transfer, finance, arena, training, staff  # noqa: F401
    Base.metadata.create_all(bind=engine)
    log.info("Datenbank-Tabellen erstellt/überprüft: %s", config.DB_PATH)


def get_session() -> Session:
    """Liefert eine neue Session. Caller ist für close() verantwortlich."""
    return SessionLocal()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Context-Manager: commit/rollback automatisch."""
    s = SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        log.exception("DB-Session: Rollback wegen Fehler")
        raise
    finally:
        s.close()


# FastAPI-Dependency
def db_dependency() -> Iterator[Session]:
    """Verwendung: db: Session = Depends(db_dependency)"""
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()
