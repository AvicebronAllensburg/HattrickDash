"""Encrypt a Consumer Secret with the project's obfuscation key.

Usage:
    python _encrypt_tool.py            # interactive (prompts for secret, hides input)
    python _encrypt_tool.py SECRET     # non-interactive (avoid in shell history!)

Reads the obfuscation key from _app_credentials._OBFUSCATION_KEY and
produces a base64-encoded AES-256-GCM ciphertext that you paste into
_app_credentials.ENCRYPTED_CONSUMER_SECRET.

This script is intended to be run by the maintainer locally when the
CHPP Consumer Secret is rotated at hattrick.org. It is committed to
the repo so anyone forking the project can encrypt their own secret
the same way.
"""
from __future__ import annotations

import base64
import getpass
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Local import — same folder as this script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _app_credentials import _OBFUSCATION_KEY  # noqa: E402


def encrypt(plaintext: str) -> str:
    """AES-256-GCM encrypt + base64-encode. Format: 12-byte nonce ||
    ciphertext || 16-byte auth tag (the AESGCM library appends the tag
    automatically)."""
    if not plaintext:
        raise ValueError("Plaintext is empty.")
    aead = AESGCM(_OBFUSCATION_KEY)
    nonce = os.urandom(12)
    ciphertext = aead.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("ascii")


def main() -> int:
    print("HattrickDash - Consumer-Secret Verschluesselung (AES-256-GCM)")
    print("=" * 60)

    if len(sys.argv) >= 2:
        secret = sys.argv[1]
        print("(Klartext aus Kommandozeile uebernommen - pass auf bash-history!)")
    else:
        secret = getpass.getpass("Consumer Secret eingeben (Eingabe versteckt): ")

    if not secret.strip():
        print("Abbruch: keine Eingabe.")
        return 1

    encrypted = encrypt(secret.strip())

    # Round-trip check, damit man nicht versehentlich kaputten String einbaut
    from _app_credentials import _OBFUSCATION_KEY as _key
    raw = base64.b64decode(encrypted)
    nonce, ct = raw[:12], raw[12:]
    decrypted = AESGCM(_key).decrypt(nonce, ct, None).decode("utf-8")
    assert decrypted == secret.strip(), "Round-trip failed (sollte nie passieren)"

    print()
    print("Verschluesselt - paste diesen String in _app_credentials.py:")
    print()
    print(f'ENCRYPTED_CONSUMER_SECRET = "{encrypted}"')
    print()
    print("Round-trip-Check: [OK] entschluesselt zurueck zum Original.")
    print(f"Laenge ciphertext: {len(encrypted)} Zeichen Base64.")
    print()
    print("Anschliessend Klartext-Secret aus Zwischenablage / Terminal-")
    print("History entfernen, falls moeglich.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
