"""Sight write policy: one nodded look per attachment page.

A miss is 未看见. An un-nodded file is not a sight.
"""

from __future__ import annotations

from typing import Any


def _text(value: Any) -> str:
    return str(value or "").strip()


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    return _text(value).lower() in {"1", "true", "yes", "on"}


def sight_id(args: dict[str, Any] | None) -> str:
    args = args or {}
    attachment = _text(args.get("attachment_id") or args.get("attachmentId") or args.get("id"))
    page = _text(args.get("page") or args.get("页码") or "1") or "1"
    if not attachment:
        return ""
    return f"eyes:{attachment}:{page}"


def resolve_sight(args: dict[str, Any] | None, existing: list[Any] | None = None) -> dict[str, Any]:
    args = dict(args or {})
    sid = sight_id(args)
    if not sid:
        return {"error": "INCOMPLETE_SIGHT"}
    if not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"error": "NOT_NODDED"}
    for row in existing or []:
        if isinstance(row, dict) and _text(row.get("id")) == sid:
            return {"error": "ALREADY_SEEN", "id": sid}
    body = _text(args.get("text"))
    return {
        "id": sid,
        "source": "eyes",
        "status": "看见" if body else "未看见",
        "attachment_id": _text(args.get("attachment_id") or args.get("attachmentId") or args.get("id")),
        "page": _text(args.get("page") or args.get("页码") or "1") or "1",
        "text": body,
    }


def may_read_file_body(args: dict[str, Any] | None) -> bool:
    """Workspace file bodies need a nod or an explicit path list."""
    args = args or {}
    if _truthy(args.get("nodded") or args.get("pointed") or args.get("点头") or args.get("read_content")):
        return True
    paths = args.get("paths")
    if isinstance(paths, list) and any(str(item or "").strip() for item in paths):
        return True
    return False
