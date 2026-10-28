"""Production ledger ports: 台账导出, backup, erase.

Erase is not 冲正. Backup is not the import-failure .bak.
"""

from __future__ import annotations

import os
from typing import Any


def _text(value: Any) -> str:
    return str(value or "").strip()


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    return _text(value).lower() in {"1", "true", "yes", "on"}


def _same_cwd(left: str, right: str) -> bool:
    a = _text(left)
    b = _text(right)
    if not a or not b:
        return False
    try:
        return os.path.realpath(a) == os.path.realpath(b)
    except OSError:
        return a == b


def resolve_backup_dest(cwd: str, dest: str) -> str:
    raw = _text(dest)
    if not raw:
        return ""
    if not os.path.isabs(raw):
        root = os.path.realpath(_text(cwd) or ".")
        raw = os.path.join(root, raw)
    try:
        return os.path.realpath(raw)
    except OSError:
        return raw


def _inside_cwd(cwd: str, dest: str) -> bool:
    root = os.path.realpath(_text(cwd) or ".")
    target = resolve_backup_dest(cwd, dest)
    if not target:
        return False
    try:
        common = os.path.commonpath([root, target])
    except ValueError:
        return False
    return common == root


def export_ledger(rows: list[Any] | None) -> dict[str, Any]:
    """Only decision boards. Not session text, not file bodies."""
    out = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("type") or "").lower() != "decision":
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else row
        nid = _text(row.get("id") or row.get("decision_id"))
        if not nid:
            continue
        out.append({
            "id": nid,
            "type": "decision",
            "status": _text(props.get("status") or props.get("board_status")),
            "outcome": _text(props.get("outcome")),
            "scenario": _text(props.get("scenario") or row.get("content")),
            "category": _text(props.get("category")),
            "receipt_id": _text(props.get("receipt_id") or props.get("receiptId")),
            "nod_kind": _text(props.get("nod_kind") or props.get("nodKind")),
            "trace_id": _text(props.get("trace_id") or props.get("traceId") or props.get("requestId")),
        })
    return {"ok": True, "kind": "台账", "decisions": out, "total": len(out)}


def may_backup(args: dict[str, Any] | None, cwd: str = "") -> dict[str, Any]:
    args = args or {}
    dest = _text(args.get("dest") or args.get("path") or args.get("output"))
    if not dest:
        return {"error": "NO_DEST"}
    if cwd and not _inside_cwd(cwd, dest):
        return {"error": "OUTSIDE_CWD"}
    return {"ok": True, "dest": resolve_backup_dest(cwd, dest) if cwd else dest}


def may_erase(args: dict[str, Any] | None) -> dict[str, Any]:
    args = args or {}
    kind = _text(args.get("kind") or args.get("what") or "pii")
    if kind in {"冲正", "作废", "撤销", "回滚"}:
        return {"error": "NOT_ERASE"}
    if not _truthy(args.get("confirm") or args.get("nodded") or args.get("点头")):
        return {"error": "NOT_NODDED"}
    if kind not in {"pii", "引用", "reference", "workspace", "entity"}:
        kind = "pii"
    return {"ok": True, "kind": kind}
