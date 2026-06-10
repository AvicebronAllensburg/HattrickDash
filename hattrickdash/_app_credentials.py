"""HattrickDash CHPP Application Credentials — obfuscation layer.

The CHPP Consumer Key identifies *the application* (HattrickDash) to
Hattrick. It is allowed (and expected) to be present in the source code:

    "The consumer key should be included in all OAuth requests to
     identify your product."  — Hattrick CHPP rules

The Consumer Secret, however, must per Hattrick rules not appear as
plain text in source code. Following the established pattern of the
HattrickOrganizer ecosystem, we therefore store the secret as an
encrypted blob and decrypt it at runtime. The encryption uses
AES-256-GCM (authenticated encryption) — industry-standard symmetric
crypto. The obfuscation key sits in the same file, so this is technical
obfuscation rather than cryptographic protection against a determined
adversary; that's both unavoidable for any locally-run tool, and the
same model that all major community CHPP tools use.

To rotate / replace the encrypted secret, run:
    python _encrypt_tool.py
and paste the resulting base64 string into ENCRYPTED_CONSUMER_SECRET
below. Do NOT commit the plaintext secret anywhere.
"""
from __future__ import annotations

import base64
import logging

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1) The CONSUMER KEY can stay as plain text per Hattrick rules.
#    "The consumer key should be included in all OAuth requests
#     to identify your product."
# ---------------------------------------------------------------------------
CONSUMER_KEY: str = "FolMnFuBnq2r8ew9JxNIya"


# ---------------------------------------------------------------------------
# 2) The CONSUMER SECRET is stored AES-256-GCM-encrypted.
#    Format of ENCRYPTED_CONSUMER_SECRET (base64-decoded):
#       [12 bytes nonce][N bytes ciphertext + 16 bytes auth tag]
#    Run _encrypt_tool.py to produce a new value when rotating the secret.
# ---------------------------------------------------------------------------
ENCRYPTED_CONSUMER_SECRET: str = "DQVEDqEx+EUVR3wxZZIS0wXDYDlomx7R6OTbfVtUaKfU24DdT/ZoWS0nEQWpScv+OVULFCWGS9qWGxBboKmll+w+6AiVZTc="


# ---------------------------------------------------------------------------
# 3) Obfuscation key (32 bytes = AES-256). Rotate alongside the encrypted
#    secret if you ever rebuild this file from scratch. Generated once with
#    AESGCM.generate_key(bit_length=256).hex(). This is not a "real" secret —
#    it sits next to the data it decrypts. See module docstring.
# ---------------------------------------------------------------------------
_OBFUSCATION_KEY_HEX = "dbff5de31a825395c6023f54e1c381bb3651fb63e7c33bd8ddc78448c2805b0a"
_OBFUSCATION_KEY = bytes.fromhex(_OBFUSCATION_KEY_HEX)


def _looks_like_placeholder(s: str) -> bool:
    return (not s) or s.startswith("REPLACE_ME")


def get_consumer_secret() -> str:
    """Returns the decrypted Consumer Secret. Raises RuntimeError if the
    encrypted blob is still the placeholder (i.e. nobody has run
    _encrypt_tool.py to fill it in yet)."""
    if _looks_like_placeholder(ENCRYPTED_CONSUMER_SECRET):
        raise RuntimeError(
            "ENCRYPTED_CONSUMER_SECRET in _app_credentials.py is still a "
            "placeholder. Run `python _encrypt_tool.py` to encrypt your "
            "Consumer Secret and paste the resulting base64 string into "
            "_app_credentials.py."
        )
    try:
        blob = base64.b64decode(ENCRYPTED_CONSUMER_SECRET, validate=True)
    except Exception as exc:
        raise RuntimeError(
            f"ENCRYPTED_CONSUMER_SECRET is not valid base64: {exc}"
        ) from exc
    if len(blob) < 12 + 16:
        raise RuntimeError(
            "ENCRYPTED_CONSUMER_SECRET too short (expected 12-byte nonce + "
            "ciphertext + 16-byte auth tag)."
        )
    nonce, ciphertext = blob[:12], blob[12:]
    aead = AESGCM(_OBFUSCATION_KEY)
    try:
        return aead.decrypt(nonce, ciphertext, None).decode("utf-8")
    except Exception as exc:
        raise RuntimeError(
            f"AES-GCM decryption failed: {exc}. The encrypted blob and the "
            f"obfuscation key may be out of sync — re-encrypt the secret "
            f"with the current obfuscation key via `python _encrypt_tool.py`."
        ) from exc


def is_configured() -> bool:
    """True if both Consumer Key and (encrypted) Consumer Secret are set
    to non-placeholder values. Used by config.py to decide whether the app
    can do OAuth out of the box."""
    return (not _looks_like_placeholder(CONSUMER_KEY)
            and not _looks_like_placeholder(ENCRYPTED_CONSUMER_SECRET))
