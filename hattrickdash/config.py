"""
Zentrale Konfiguration für HattrickDash.
OAuth-Credentials werden in config.json gespeichert (nicht im Code).
"""
import json
import logging
import os
from pathlib import Path

# Basis-Pfade
BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"
STATIC_DIR = BASE_DIR / "static"
CONFIG_FILE = BASE_DIR / "config.json"

DATA_DIR.mkdir(exist_ok=True)
LOG_DIR.mkdir(exist_ok=True)

# Datenbank
DB_PATH = DATA_DIR / "hattrickdash.db"
DB_URL = f"sqlite:///{DB_PATH}"

# CHPP API
CHPP_BASE_URL = "https://chpp.hattrick.org/chppxml.ashx"
CHPP_OAUTH_REQUEST_URL = "https://chpp.hattrick.org/oauth/request_token.ashx"
CHPP_OAUTH_AUTHORIZE_URL = "https://chpp.hattrick.org/oauth/authorize.aspx"
CHPP_OAUTH_ACCESS_URL = "https://chpp.hattrick.org/oauth/access_token.ashx"

# Rate-Limiting (CHPP erlaubt max. 12 Requests/Minute)
CHPP_REQUEST_DELAY_SEC = 5.0          # Pause zwischen Calls
CHPP_RETRY_BACKOFF = [5, 10, 20, 40]  # Sekunden bei 429

# Currency-Faktor: Hattrick speichert Geld in "Hattrick-Einheiten",
# die für Deutschland (Land 3) im Faktor 10 zu Euro stehen.
# d.h.: HRF cash=150163188 -> 15.016.318 €
# Andere Länder haben andere Faktoren (USA ~115, ...). Wir machen es
# konfigurierbar; default 10 für deutsche Vereine.
CURRENCY_FACTOR = 10

# Server — Port + Host koennen per Env-Var ueberschrieben werden
# (HATTRICK_APP_HOST / HATTRICK_APP_PORT). Praktisch wenn man mehrere
# Instanzen parallel testet (z.B. Public-Test auf 8766 neben Local auf 8765).
APP_HOST = os.environ.get("HATTRICK_APP_HOST", "0.0.0.0")
APP_PORT = int(os.environ.get("HATTRICK_APP_PORT", "8765"))

# Hattrick Team-ID - kann nach OAuth automatisch ermittelt werden
DEFAULT_TEAM_ID: int | None = None


def _load_config() -> dict:
    """Liest config.json oder gibt leeres Dict zurück."""
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            logging.getLogger(__name__).warning("config.json kaputt: %s", exc)
            return {}
    return {}


def _save_config(data: dict) -> None:
    """Schreibt config.json sicher."""
    CONFIG_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# Laufzeit-Konfiguration aus config.json
_cfg = _load_config()


def _bundled_consumer_key() -> str:
    """Liefert den im Repo gebundelten CHPP Consumer Key (als plain text
    erlaubt, identifiziert die App). Faellt bei fehlendem Modul auf '' zurueck.
    """
    try:
        import _app_credentials
        ck = getattr(_app_credentials, "CONSUMER_KEY", "") or ""
        if ck.startswith("REPLACE_ME"):
            return ""
        return ck
    except Exception:
        return ""


def _bundled_consumer_secret() -> str:
    """Liefert den (entschluesselten) Consumer Secret aus _app_credentials.py.
    Bei Decryption-Fehler oder Placeholder-Wert: ''. Wird zur Laufzeit
    aufgerufen, der Klartext landet nicht im Klartext im Code."""
    try:
        import _app_credentials
        if not _app_credentials.is_configured():
            return ""
        return _app_credentials.get_consumer_secret() or ""
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "Bundled CHPP Consumer Secret konnte nicht entschluesselt werden: %s",
            exc,
        )
        return ""


# Reihenfolge: Env-Var (HATTRICK_CONSUMER_KEY/-SECRET, fuer Forks/Override) >
# config.json (User-eigene App, falls eingetragen) > gebundelte App-Credentials
# aus _app_credentials.py.
CONSUMER_KEY: str = (os.environ.get("HATTRICK_CONSUMER_KEY")
                     or _cfg.get("consumer_key")
                     or _bundled_consumer_key())
CONSUMER_SECRET: str = (os.environ.get("HATTRICK_CONSUMER_SECRET")
                        or _cfg.get("consumer_secret")
                        or _bundled_consumer_secret())
ACCESS_TOKEN: str = _cfg.get("access_token", "")
ACCESS_TOKEN_SECRET: str = _cfg.get("access_token_secret", "")
TEAM_ID: int | None = _cfg.get("team_id", DEFAULT_TEAM_ID)


def save_oauth_tokens(access_token: str, access_token_secret: str, team_id: int | None = None) -> None:
    """Persistiert OAuth-Tokens nach erfolgreichem Login."""
    data = _load_config()
    data["consumer_key"] = CONSUMER_KEY
    data["consumer_secret"] = CONSUMER_SECRET
    data["access_token"] = access_token
    data["access_token_secret"] = access_token_secret
    if team_id is not None:
        data["team_id"] = team_id
    _save_config(data)

    # Module-Variablen für laufende Session aktualisieren
    global ACCESS_TOKEN, ACCESS_TOKEN_SECRET, TEAM_ID
    ACCESS_TOKEN = access_token
    ACCESS_TOKEN_SECRET = access_token_secret
    if team_id is not None:
        TEAM_ID = team_id


def save_consumer_credentials(consumer_key: str, consumer_secret: str) -> None:
    """Speichert Consumer-Credentials, die der User in HT registriert hat."""
    data = _load_config()
    data["consumer_key"] = consumer_key
    data["consumer_secret"] = consumer_secret
    _save_config(data)
    global CONSUMER_KEY, CONSUMER_SECRET
    CONSUMER_KEY = consumer_key
    CONSUMER_SECRET = consumer_secret


def is_authenticated() -> bool:
    """True wenn OAuth-Login fertig ist."""
    return bool(ACCESS_TOKEN and ACCESS_TOKEN_SECRET and CONSUMER_KEY and CONSUMER_SECRET)


# Logging-Konfiguration
def setup_logging() -> None:
    """Initialisiert Datei- und Konsolen-Logging."""
    log_file = LOG_DIR / "app.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
