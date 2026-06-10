"""
OAuth 1.0a Flow gegen Hattrick CHPP.

Ablauf:
  1. Consumer-Key / Consumer-Secret in HT registrieren
     (https://chpp.hattrick.org/Apps/User/EditApp.aspx)
  2. Diese in config.json (oder ENV) ablegen
  3. python -m chpp.auth ausführen → Browser öffnet sich
  4. PIN eingeben → Access-Token wird gespeichert
"""
from __future__ import annotations

import logging
import sys
import webbrowser
from urllib.parse import parse_qs

from requests_oauthlib import OAuth1Session

import config

log = logging.getLogger(__name__)


def _ensure_consumer() -> tuple[str, str]:
    """Holt Consumer-Key/Secret aus config oder fragt interaktiv ab."""
    if config.CONSUMER_KEY and config.CONSUMER_SECRET:
        return config.CONSUMER_KEY, config.CONSUMER_SECRET

    print("\n=== Hattrick CHPP – Consumer Credentials einrichten ===")
    print("Lege deine App an: https://chpp.hattrick.org/Apps/User/EditApp.aspx")
    ck = input("Consumer Key:    ").strip()
    cs = input("Consumer Secret: ").strip()
    if not ck or not cs:
        sys.exit("Abbruch: Keine Credentials angegeben.")
    config.save_consumer_credentials(ck, cs)
    return ck, cs


def run_oauth_flow() -> dict:
    """Vollständiger OAuth 1.0a Flow. Speichert Access-Tokens in config.json."""
    consumer_key, consumer_secret = _ensure_consumer()

    # 1) Request Token
    oauth = OAuth1Session(consumer_key, client_secret=consumer_secret, callback_uri="oob")
    fetch = oauth.fetch_request_token(config.CHPP_OAUTH_REQUEST_URL)
    request_token = fetch["oauth_token"]
    request_secret = fetch["oauth_token_secret"]
    log.info("Request-Token erhalten.")

    # 2) Browser öffnen
    auth_url = oauth.authorization_url(config.CHPP_OAUTH_AUTHORIZE_URL)
    print("\nÖffne folgenden Link, autorisiere die App und gib die PIN ein:")
    print(auth_url)
    try:
        webbrowser.open(auth_url, new=2)
    except Exception:  # noqa: BLE001
        pass
    pin = input("PIN: ").strip()
    if not pin:
        sys.exit("Abbruch: Keine PIN angegeben.")

    # 3) Access Token
    oauth = OAuth1Session(
        consumer_key,
        client_secret=consumer_secret,
        resource_owner_key=request_token,
        resource_owner_secret=request_secret,
        verifier=pin,
    )
    tokens = oauth.fetch_access_token(config.CHPP_OAUTH_ACCESS_URL)
    access_token = tokens["oauth_token"]
    access_secret = tokens["oauth_token_secret"]

    # 4) Team-ID via teamdetails ermitteln
    team_id = _detect_team_id(consumer_key, consumer_secret, access_token, access_secret)

    config.save_oauth_tokens(access_token, access_secret, team_id=team_id)
    log.info("OAuth abgeschlossen, Team-ID: %s", team_id)
    print(f"\n✓ Login erfolgreich. Team-ID: {team_id}")
    return {"access_token": access_token, "access_secret": access_secret, "team_id": team_id}


def _detect_team_id(ck: str, cs: str, at: str, ats: str) -> int | None:
    """Liest die OwnTeamID aus teamdetails."""
    from chpp.client import HattrickClient
    from chpp.parser import xml_to_dict

    client = HattrickClient(ck, cs, at, ats)
    try:
        xml = client.fetch("teamdetails")
        data = xml_to_dict(xml)
        # User-Daten enthält OwnTeam mit TeamID
        teams = data.get("Teams", {}).get("Team")
        if isinstance(teams, list):
            return int(teams[0]["TeamID"])
        if isinstance(teams, dict):
            return int(teams["TeamID"])
    except Exception as exc:  # noqa: BLE001
        log.warning("Team-ID konnte nicht ermittelt werden: %s", exc)
    return None


def make_session() -> OAuth1Session:
    """Liefert eine ready-to-use OAuth-Session aus den gespeicherten Tokens."""
    if not config.is_authenticated():
        raise RuntimeError("Nicht authentifiziert. Bitte erst `python -m chpp.auth` ausführen.")
    return OAuth1Session(
        config.CONSUMER_KEY,
        client_secret=config.CONSUMER_SECRET,
        resource_owner_key=config.ACCESS_TOKEN,
        resource_owner_secret=config.ACCESS_TOKEN_SECRET,
    )


if __name__ == "__main__":
    config.setup_logging()
    run_oauth_flow()
