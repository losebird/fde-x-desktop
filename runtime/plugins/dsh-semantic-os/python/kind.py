"""Hand-written kinds only. Rows do not enter the vocabulary."""

from __future__ import annotations

import re
from typing import Any


def _text(value: Any) -> str:
    return str(value or "").strip()


_RESOURCE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,63}$")
_TICKET_FIELD = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")


def accept_kind(args: dict[str, Any] | None) -> dict[str, Any]:
    args = dict(args or {})
    label = _text(args.get("label") or args.get("kind") or args.get("型"))
    ticket = _text(args.get("ticket") or args.get("单号") or args.get("number"))
    amount = _text(args.get("amount") or args.get("金额"))
    if ticket or amount:
        return {"ok": False, "error": "NOT_A_KIND"}
    if not label:
        return {"ok": False, "error": "NO_KIND"}
    if label in {"金额", "单号", "行"} or re.search(r"(单行|明细行)$", label):
        return {"ok": False, "error": "NOT_A_KIND"}
    fields = args.get("fields") if isinstance(args.get("fields"), list) else []
    for item in fields:
        if _text(item) in {"金额", "amount"}:
            return {"ok": False, "error": "NOT_A_KIND"}
    can = args.get("can") if isinstance(args.get("can"), list) else []
    return {
        "ok": True,
        "kind": label,
        "fields": [str(item).strip() for item in fields if str(item).strip()],
        "can": [str(item).strip() for item in can if str(item).strip()],
        **pack_kind_connector(args),
    }


def pack_kind_connector(args: dict[str, Any] | None) -> dict[str, Any]:
    """Keep connector extras (resource / ticketField / clues). Drop rows and junk."""
    args = args or {}
    resource = _text(args.get("resource") or args.get("collection"))
    ticket_field = _text(args.get("ticketField") or args.get("ticket_field"))
    if resource and not _RESOURCE.match(resource):
        resource = ""
    if ticket_field and not _TICKET_FIELD.match(ticket_field):
        ticket_field = ""
    clues = _pack_clues(args.get("clues"))
    packed: dict[str, Any] = {}
    if resource:
        packed["resource"] = resource
    if ticket_field:
        packed["ticketField"] = ticket_field
    if clues:
        packed["clues"] = clues
    relations = _pack_relations(args.get("relations"))
    if relations:
        packed["relations"] = relations
    version = _text(args.get("catalogVersion") or args.get("version"))
    if version:
        packed["catalogVersion"] = version[:32]
    return packed


def _pack_clues(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for row in raw[:64]:
        if not isinstance(row, dict):
            continue
        packed: dict[str, Any] = {}
        for key in ("say", "keys", "values", "dateBefore", "dateAfter"):
            items = row.get(key)
            if not isinstance(items, list):
                continue
            cleaned = [str(item).strip() for item in items[:32] if str(item).strip()]
            if cleaned:
                packed[key] = cleaned
        role = str(row.get("role") or "").strip()
        if role:
            packed["role"] = role[:32]
        if row.get("not") is True:
            packed["not"] = True
        if packed.get("say") or packed.get("keys") or packed.get("role"):
            out.append(packed)
    return out


def _pack_relations(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for row in raw[:32]:
        if not isinstance(row, dict):
            continue
        frm = _text(row.get("from") or row.get("fromKind") or row.get("parent"))
        to = _text(row.get("to") or row.get("toKind") or row.get("child"))
        field = _text(row.get("field") or row.get("fk"))
        if not frm or not to:
            continue
        packed = {"from": frm[:32], "to": to[:32]}
        if field and _TICKET_FIELD.match(field):
            packed["field"] = field
        out.append(packed)
    return out


def merge_kind_props(
    existing: dict[str, Any] | None,
    incoming: dict[str, Any] | None,
    replace_empty: bool = False,
) -> dict[str, Any]:
    """Patch extras onto an existing 型.

    Default: empty incoming lists do not wipe fields/can (batch upsert).
    replace_empty=True: present keys replace, including empty (human edit).
    """
    base = dict(existing or {})
    nxt = dict(incoming or {})
    changed: dict[str, Any] = {}
    for key in ("fields", "can"):
        if key not in nxt:
            continue
        value = nxt.get(key)
        if not isinstance(value, list):
            continue
        cleaned = [str(item).strip() for item in value if str(item).strip()]
        if not cleaned and not replace_empty:
            continue
        if cleaned != list(base.get(key) or []):
            changed[key] = cleaned
    for key in ("resource", "ticketField", "catalogVersion"):
        if key not in nxt:
            continue
        value = _text(nxt.get(key))
        if not value and not replace_empty:
            continue
        if value != _text(base.get(key)):
            changed[key] = value
    if "clues" in nxt:
        clues = nxt.get("clues")
        if isinstance(clues, list):
            packed = _pack_clues(clues)
            if packed or replace_empty:
                if packed != list(base.get("clues") or []):
                    changed["clues"] = packed
    if "relations" in nxt:
        relations = nxt.get("relations")
        if isinstance(relations, list):
            packed_rel = _pack_relations(relations)
            if packed_rel or replace_empty:
                if packed_rel != list(base.get("relations") or []):
                    changed["relations"] = packed_rel
    return changed


def kind_patch(
    existing: dict[str, Any] | None,
    incoming: dict[str, Any] | None,
    *,
    label: str = "",
    current_label: str = "",
    replace_empty: bool = False,
) -> dict[str, Any]:
    """Fields a human or tool may write onto one 型. Identity stays on id."""
    changed = merge_kind_props(existing, incoming, replace_empty=replace_empty)
    text = _text(label)
    if text and text != _text(current_label):
        changed["content"] = text
    return changed


_FIELD_ALIASES = {
    "单号": ("ticket", "单号", "number", "父单号"),
    "行号": ("行号", "line", "line_no", "lineNo", "item"),
    "状态": ("status", "状态", "state"),
    "系统": ("system", "系统"),
    "环境": ("environment", "env", "环境"),
    "型": ("kind", "type", "型"),
}


def should_shape(args: dict[str, Any] | None) -> bool:
    """Only a 业务引用 write is shaped. Chat entities are not."""
    args = args or {}
    keys = ("system", "environment", "ticket", "单号", "系统", "环境", "行号", "line", "lineNo")
    return any(_text(args.get(key)) for key in keys)


def _value_for(field: str, args: dict[str, Any]) -> str:
    keys = _FIELD_ALIASES.get(field, (field,))
    for key in keys:
        text = _text(args.get(key))
        if text:
            return text
    return ""


def check_shape(args: dict[str, Any] | None, vocab: list[Any] | None = None) -> dict[str, Any]:
    args = dict(args or {})
    kind = _text(args.get("kind") or args.get("type") or args.get("型"))
    if not kind or kind.lower() in {"entity", "document", "decision"}:
        return {"ok": True}
    wanted: list[str] = []
    for row in vocab or []:
        if not isinstance(row, dict):
            continue
        packed = accept_kind(row) if "ticket" in row or "amount" in row or "label" in row or "kind" in row else {
            "ok": True,
            "kind": _text(row.get("kind") or row.get("label")),
            "fields": [str(item).strip() for item in (row.get("fields") or []) if str(item).strip()],
        }
        if packed.get("ok") and packed.get("kind") == kind:
            wanted = list(packed.get("fields") or [])
            break
    if not wanted:
        return {"ok": True}
    for field in wanted:
        if not _value_for(field, args):
            return {"ok": False, "error": "MISSING_FIELD", "field": field, "kind": kind}
    return {"ok": True, "kind": kind}
