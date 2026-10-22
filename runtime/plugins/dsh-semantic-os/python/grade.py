"""Data grade: envelope body stays closed; personal facts do not land on the board."""

from __future__ import annotations

import re
from typing import Any

_PHONE = re.compile(r"(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)")
_ACCOUNT = re.compile(r"(?<!\d)\d{12,19}(?!\d)")
_AMOUNT = re.compile(r"(?:人民币|RMB|CNY|USD|￥|¥)?\s*\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d{2}\s*元|\d+\s*元")


def _text(value: Any) -> str:
    return str(value or "").strip()


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    return _text(value).lower() in {"1", "true", "yes", "on"}


_ENVELOPE_QUOTE = re.compile(r"【信封】|信封正文|金额未传|这封像请.+过")


def is_envelope(args: dict[str, Any] | None) -> bool:
    args = args or {}
    kind = _text(args.get("kind") or args.get("source") or args.get("type"))
    if kind in {"信封", "envelope", "lan_assist", "lan-assist"}:
        return True
    return bool(_ENVELOPE_QUOTE.search(_text(args.get("text"))))


def may_extract(args: dict[str, Any] | None) -> dict[str, Any]:
    args = dict(args or {})
    if is_envelope(args) and not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"ok": False, "error": "ENVELOPE_CLOSED"}
    return {"ok": True}


def scrub_text(value: Any) -> str:
    text = str(value or "")
    if not any(ch.isdigit() for ch in text):
        return text
    text = _PHONE.sub("［手机号］", text)
    text = _ACCOUNT.sub("［账号］", text)
    text = _AMOUNT.sub("［金额］", text)
    return text


def _scrub_map(row: dict[str, Any]) -> dict[str, Any]:
    out = {}
    for key, value in row.items():
        if isinstance(value, str):
            out[key] = scrub_text(value)
        elif isinstance(value, dict):
            out[key] = _scrub_map(value)
        else:
            out[key] = value
    return out


def scrub_hit(hit: Any) -> Any:
    if isinstance(hit, str):
        return scrub_text(hit)
    if isinstance(hit, dict):
        return _scrub_map(hit)
    return hit
