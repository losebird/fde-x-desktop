"""Business reference identity: 系统 · 环境 · 型 · 单号.

A reference is a pointed-at ticket, not an ERP row.
"""

from __future__ import annotations

from typing import Any


def _text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def resolve_reference(args: dict[str, Any] | None) -> dict[str, Any]:
    args = dict(args or {})
    system = _text(args.get("system") or args.get("系统"))
    environment = _text(args.get("environment") or args.get("env") or args.get("环境"))
    kind = _text(args.get("kind") or args.get("type") or args.get("型"))
    ticket = _text(args.get("ticket") or args.get("单号") or args.get("number"))
    line = _text(args.get("行号") or args.get("line") or args.get("line_no") or args.get("lineNo"))
    if line:
        ticket = f"{ticket}:{line}" if ticket else line
    if not system or not environment or not kind or not ticket:
        return {"error": "INCOMPLETE_REFERENCE"}
    rid = f"ref:{system}:{environment}:{kind}:{ticket}"
    return {
        "id": rid,
        "system": system,
        "environment": environment,
        "kind": kind,
        "ticket": ticket,
    }


def hold_reference(args: dict[str, Any] | None) -> dict[str, Any]:
    args = dict(args or {})
    person = _text(args.get("person") or args.get("holder"))
    target = _text(args.get("reference_id") or args.get("target"))
    if not person or not target:
        return {"error": "INCOMPLETE_HOLD"}
    return {"edge": "holds", "source": person, "target": target}


def leave_person(args: dict[str, Any] | None, holdings: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    args = dict(args or {})
    person = _text(args.get("person") or args.get("id"))
    dropped = 0
    voided: list[str] = []
    for row in holdings or []:
        if not isinstance(row, dict):
            continue
        if _text(row.get("source")) != person:
            continue
        if _text(row.get("edge")) != "holds":
            continue
        target = _text(row.get("target"))
        if not target:
            continue
        dropped += 1
        if target not in voided:
            voided.append(target)
    return {"dropped": dropped, "voided": voided, "deleted": False}
