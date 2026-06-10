"""
HTTP-Client gegen CHPP. Rate-Limiting + Retry-Backoff inklusive.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

import requests
from requests_oauthlib import OAuth1Session

import config

log = logging.getLogger(__name__)


class HattrickClient:
    """OAuth-Client mit Rate-Limit (5s zwischen Calls) + Retry."""

    _last_call_ts: float = 0.0
    _lock = threading.Lock()

    def __init__(
        self,
        consumer_key: str | None = None,
        consumer_secret: str | None = None,
        access_token: str | None = None,
        access_secret: str | None = None,
    ) -> None:
        self.consumer_key = consumer_key or config.CONSUMER_KEY
        self.consumer_secret = consumer_secret or config.CONSUMER_SECRET
        self.access_token = access_token or config.ACCESS_TOKEN
        self.access_secret = access_secret or config.ACCESS_TOKEN_SECRET
        if not all([self.consumer_key, self.consumer_secret, self.access_token, self.access_secret]):
            raise RuntimeError("CHPP nicht konfiguriert – OAuth-Login fehlt.")
        self._session = OAuth1Session(
            self.consumer_key,
            client_secret=self.consumer_secret,
            resource_owner_key=self.access_token,
            resource_owner_secret=self.access_secret,
        )

    # ------------------------------------------------------------ rate limit
    @classmethod
    def _respect_rate_limit(cls) -> None:
        """Stellt sicher, dass mindestens CHPP_REQUEST_DELAY_SEC zwischen Calls liegt."""
        with cls._lock:
            elapsed = time.monotonic() - cls._last_call_ts
            wait = config.CHPP_REQUEST_DELAY_SEC - elapsed
            if wait > 0:
                time.sleep(wait)
            cls._last_call_ts = time.monotonic()

    # ---------------------------------------------------------------- fetch
    def fetch(self, endpoint: str, **params: Any) -> bytes:
        """
        Ruft einen CHPP-Endpoint auf und gibt rohes XML zurück.
        Wirft bei 4xx/5xx requests.HTTPError nach Retry-Versuchen.
        """
        params = {"file": endpoint, **{k: v for k, v in params.items() if v is not None}}
        attempts = len(config.CHPP_RETRY_BACKOFF) + 1

        for attempt in range(attempts):
            self._respect_rate_limit()
            log.debug("CHPP GET %s params=%s (attempt %d)", endpoint, params, attempt + 1)
            try:
                resp = self._session.get(config.CHPP_BASE_URL, params=params, timeout=30)
            except requests.RequestException as exc:
                if attempt >= attempts - 1:
                    raise
                wait = config.CHPP_RETRY_BACKOFF[attempt]
                log.warning("Netzwerk-Fehler (%s), retry in %ds", exc, wait)
                time.sleep(wait)
                continue

            if resp.status_code == 429 or 500 <= resp.status_code < 600:
                if attempt >= attempts - 1:
                    resp.raise_for_status()
                wait = config.CHPP_RETRY_BACKOFF[attempt]
                log.warning("HTTP %s von CHPP, retry in %ds", resp.status_code, wait)
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.content

        raise RuntimeError(f"CHPP fetch fehlgeschlagen nach {attempts} Versuchen: {endpoint}")

    # ----------------------------------------------------------------- post
    def post(self, endpoint: str, data: dict[str, str], **params: Any) -> bytes:
        """
        POST an einen CHPP-Endpoint. Query-Parameter (file/actionType/...) gehören
        in die URL, nur die Payload (z.B. lineup-JSON) in den Form-Body.
        chppxml.ashx liest file/actionType NUR aus der Query — landen sie im Body,
        antwortet der Server mit einer HTML-Fehlerseite.
        """
        params = {"file": endpoint, **{k: v for k, v in params.items() if v is not None}}
        self._respect_rate_limit()
        log.debug("CHPP POST %s params=%s", endpoint, params)
        resp = self._session.post(
            config.CHPP_BASE_URL, params=params, data=data, timeout=30)
        resp.raise_for_status()
        return resp.content
