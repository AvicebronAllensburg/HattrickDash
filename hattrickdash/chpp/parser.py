"""
XML → Dict Konverter.

Verwendet lxml.
- Wiederholte Tags werden zu Listen
- Text-Inhalte werden zu Strings (Caller castet)
- Attribute kommen mit Prefix '@'
"""
from __future__ import annotations

from typing import Any

from lxml import etree


def xml_to_dict(xml_bytes: bytes | str) -> dict:
    """Parsed CHPP-XML zu einem verschachtelten Dict."""
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")
    root = etree.fromstring(xml_bytes)
    return _element_to_dict(root)


def _element_to_dict(elem: etree._Element) -> Any:
    """Rekursiv: Element → dict / str / dict-Liste."""
    children = list(elem)
    result: dict[str, Any] = {}

    # Attribute
    for k, v in elem.attrib.items():
        result[f"@{k}"] = v

    if not children:
        text = (elem.text or "").strip()
        if not result:
            return text
        if text:
            result["#text"] = text
        return result

    for child in children:
        tag = etree.QName(child).localname
        value = _element_to_dict(child)
        if tag in result:
            existing = result[tag]
            if isinstance(existing, list):
                existing.append(value)
            else:
                result[tag] = [existing, value]
        else:
            result[tag] = value
    return result


# ---------------------------------------------------------------- Helpers

def as_int(value: Any, default: int | None = None) -> int | None:
    """Robust int-Cast, '' → default."""
    if value in (None, "", "None"):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float | None = None) -> float | None:
    if value in (None, "", "None"):
        return default
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def as_bool(value: Any) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes"}


def as_text(value: Any, default: str = "") -> str:
    if value in (None, "", "None"):
        return default
    if isinstance(value, dict):
        return str(value.get("#text", default))
    return str(value)


def ensure_list(value: Any) -> list:
    """Garantiert Liste – egal ob Dict oder schon Liste."""
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]
