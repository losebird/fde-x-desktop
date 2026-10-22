"""Board write policy: 起草 / 已生效 / 已冲正 / 作废.

Does not talk to the graph. Callers pass a dict of record_decision args.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def _id_list(value: Any) -> list[str]:
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if isinstance(value, list):
        out = []
        for item in value:
            text = str(item or "").strip()
            if text and text not in out:
                out.append(text)
        return out
    return []


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}


def is_auto_extract(args: dict[str, Any] | None) -> bool:
    args = args or {}
    meta = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    if _truthy(meta.get("auto")) or _truthy(args.get("auto")):
        return True
    source = str(meta.get("source") or args.get("source") or "")
    return source == "session_ingest"


def _receipt_id(args: dict[str, Any]) -> str:
    meta = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    for key in ("receipt_id", "receiptId", "receipt"):
        text = str(args.get(key) or meta.get(key) or "").strip()
        if text:
            return text
    return ""


def _same_cwd(left: str, right: str) -> bool:
    a = str(left or "").strip()
    b = str(right or "").strip()
    if not a or not b:
        return True
    try:
        return os.path.realpath(a) == os.path.realpath(b)
    except OSError:
        return a == b


NOD_KINDS = ("会签同意", "本机工具", "业务过账")


def nod_kind_of(args: dict[str, Any] | None) -> str:
    args = args or {}
    meta = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    kind = str(args.get("nod_kind") or args.get("nodKind") or meta.get("nod_kind") or meta.get("nodKind") or "").strip()
    if kind in NOD_KINDS:
        return kind
    return ""


def _trace_id(args: dict[str, Any]) -> str:
    meta = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    for key in ("trace_id", "traceId", "requestId", "request_id"):
        text = str(args.get(key) or meta.get(key) or "").strip()
        if text:
            return text
    return ""


def _existing_live_id(existing: list[Any] | None, trace: str, receipt: str = "") -> str:
    for row in existing or []:
        if not isinstance(row, dict):
            continue
        status = str(row.get("status") or row.get("board_status") or "").strip()
        if status != "已生效":
            continue
        nid = str(row.get("id") or row.get("decision_id") or "")
        other_trace = str(row.get("trace_id") or row.get("traceId") or row.get("requestId") or "").strip()
        if trace and other_trace == trace:
            return nid
        other_receipt = str(row.get("receipt_id") or row.get("receiptId") or row.get("receipt") or "").strip()
        if receipt and other_receipt == receipt:
            return nid
    return ""


def resolve_board(args: dict[str, Any] | None, cwd: str = "", existing: list[Any] | None = None) -> dict[str, Any]:
    """Decide the board status for one record_decision call."""
    args = dict(args or {})
    meta = args.get("metadata") if isinstance(args.get("metadata"), dict) else {}
    tenant = str(
        args.get("tenant_cwd")
        or args.get("tenantCwd")
        or meta.get("tenant_cwd")
        or meta.get("tenantCwd")
        or ""
    ).strip()
    if tenant and cwd and not _same_cwd(tenant, cwd):
        return {"error": "TENANT_MISMATCH"}
    wanted = str(args.get("status") or args.get("board_status") or "").strip()
    nod = nod_kind_of(args)
    if is_auto_extract(args):
        return {"status": "起草", **({"nod_kind": nod} if nod else {})}
    if wanted == "已生效":
        if nod != "业务过账":
            return {"error": "NOD_NOT_POSTING"}
        because = _id_list(args.get("because") or args.get("evidence") or args.get("supports"))
        leads = _id_list(args.get("leads_to") or args.get("consequences") or args.get("causes"))
        receipt = _receipt_id(args)
        if not because:
            return {"error": "NO_BECAUSE"}
        if not leads:
            return {"error": "NO_LEADS_TO"}
        if not receipt:
            return {"error": "NO_RECEIPT"}
        trace = _trace_id(args)
        live = _existing_live_id(existing, trace, receipt)
        if live:
            return {"error": "DUPLICATE_LIVE", "decision_id": live}
        packed = {"status": "已生效", "receipt_id": receipt}
        if nod:
            packed["nod_kind"] = nod
        if trace:
            packed["trace_id"] = trace
        return packed
    if wanted in {"起草", "已冲正", "作废"}:
        return {"status": wanted}
    return {"status": "起草"}


def board_status_of(node: Any) -> str:
    props = {}
    if isinstance(node, dict):
        raw = node.get("properties")
        props = raw if isinstance(raw, dict) else node
    return str(props.get("status") or props.get("board_status") or "").strip()


def is_precedent(node: Any) -> bool:
    """Only 已生效 boards count as last-time-we-decided-this."""
    return board_status_of(node) == "已生效"


def resolve_memory_nod(args: dict[str, Any] | None) -> dict[str, Any]:
    """Promote a 记忆卡片. Needs a nod. Never becomes 已生效."""
    args = dict(args or {})
    nid = str(args.get("id") or args.get("card") or "").strip()
    if not nid:
        return {"error": "NO_PATH"}
    if not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"error": "NO_NOD"}
    wanted = str(args.get("status") or args.get("board_status") or "").strip()
    if wanted == "已生效":
        return {"error": "NOT_A_BOARD"}
    from_when = str(args.get("valid_from") or args.get("from") or "").strip()
    return {"id": nid, "status": "已入档", "valid_from": from_when}


def resolve_memory_retire(args: dict[str, Any] | None) -> dict[str, Any]:
    """Stop using a 记忆卡片. Needs a nod. Body stays. Not 冲正."""
    args = dict(args or {})
    nid = str(args.get("id") or args.get("card") or "").strip()
    extras = _id_list(args.get("ids"))
    if not nid:
        nid = extras[0] if extras else ""
    if not nid:
        return {"error": "NO_PATH"}
    if not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"error": "NO_NOD"}
    if str(args.get("status") or "") == "已生效":
        return {"error": "NOT_A_BOARD"}
    return {"id": nid, "status": "已停用"}


def resolve_memory_source(args: dict[str, Any] | None) -> dict[str, Any]:
    """Attach session:/file: 出处. Needs a nod. Body stays."""
    packed = resolve_memory_retire(args)
    if packed.get("error"):
        return packed
    source = str((args or {}).get("source") or (args or {}).get("path") or "").strip()
    if not source.startswith(("session:", "file:")):
        return {"error": "NO_PATH"}
    return {"id": packed["id"], "source": source}


def resolve_memory_renew(args: dict[str, Any] | None) -> dict[str, Any]:
    """Clear valid_until so the card counts again. Needs a nod. Body stays."""
    packed = resolve_memory_retire(args)
    if packed.get("error"):
        return packed
    return {"id": packed["id"]}


def resolve_health_mute(args: dict[str, Any] | None) -> dict[str, Any]:
    """Stop listing one 梳理 kind. Needs a nod. Body stays."""
    args = dict(args or {})
    kind = str(args.get("kind") or args.get("class") or "").strip()
    if not kind:
        return {"error": "NO_PATH"}
    if not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"error": "NO_NOD"}
    return {"kind": kind}


MEMORY_EDGE_TYPES = ("challenges", "enriches", "confirms", "replaces")


def resolve_memory_edge(args: dict[str, Any] | None) -> dict[str, Any]:
    """Link two 记忆卡片. Needs a nod. Never touches a 已生效 board."""
    args = dict(args or {})
    source = str(args.get("source") or args.get("from") or "").strip()
    target = str(args.get("target") or args.get("to") or "").strip()
    kind = str(args.get("type") or args.get("edge") or "").strip()
    if not source or not target or source == target:
        return {"error": "NO_PATH"}
    if not _truthy(args.get("nodded") or args.get("pointed") or args.get("点头")):
        return {"error": "NO_NOD"}
    if kind not in MEMORY_EDGE_TYPES:
        return {"error": "NOT_A_CARD"}
    return {"source": source, "target": target, "type": kind}


def suggest_memory_edge(newer: str, older: str) -> str:
    """Cheap overlap hint. Not a write."""
    score = 0.0
    a = "".join(str(newer or "").lower().split())
    b = "".join(str(older or "").lower().split())
    if len(a) >= 4 and len(b) >= 4:
        if a in b or b in a:
            score = 1.0
        else:
            window = 4
            total = max(len(a) - window + 1, 1)
            hits = sum(1 for i in range(0, len(a) - window + 1) if a[i:i + window] in b)
            score = hits / total
    if score >= 0.6:
        return "confirms"
    if score >= 0.25:
        return "enriches"
    return ""


def is_memory_card(node: Any) -> bool:
    ntype = ""
    props: dict[str, Any] = {}
    if isinstance(node, dict):
        ntype = str(node.get("type") or "")
        raw = node.get("properties")
        props = raw if isinstance(raw, dict) else node
    return ntype == "记忆卡片" or str(props.get("kind") or "") == "记忆卡片"


def memory_still_counts(node: Any, at: datetime | None = None) -> bool:
    """A card with valid_until in the past is 当时, not 依据. Body stays."""
    props = {}
    if isinstance(node, dict):
        raw = node.get("properties")
        props = raw if isinstance(raw, dict) else node
    until = str(props.get("valid_until") or "").strip()
    if not until:
        return True
    when = at or datetime.now(timezone.utc)
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(until.replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed >= when


def may_cite(node: Any) -> bool:
    """A 起草 / 作废 / 已冲正 board is not 依据. Expired 记忆卡片 are not 依据.
    New 记忆卡片 encode live (已入档) like Semantica AgentMemory.store.
    Vocab / OWL classes are names, not 依据."""
    if not isinstance(node, dict):
        return False
    ntype = str(node.get("type") or "").lower()
    nid = str(node.get("id") or "")
    if ntype == "decision":
        return is_precedent(node)
    if is_memory_card(node):
        if board_status_of(node) in ("", "起草", "已停用"):
            return False
        return memory_still_counts(node)
    if nid.startswith("session:") or nid.startswith("file:"):
        return True
    if ntype in {"skos:concept", "owl:class", "owl:ontology", "owl:objectproperty", "owl:datatypeproperty", "skos:conceptscheme"}:
        return False
    if ntype in {"document"}:
        return True
    return False


def display_iso(value: Any) -> str:
    """Host-local ISO for people and agents. Stored instants stay UTC."""
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, datetime):
        parsed = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return parsed.astimezone().isoformat()
    if isinstance(value, (int, float)):
        raw = float(value)
        if raw > 1e12:
            raw = raw / 1000.0
        if raw <= 0:
            return ""
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc).astimezone().isoformat()
        except (OverflowError, OSError, ValueError):
            return ""
    _date, shown = _local_when(value)
    return shown


def _local_when(raw: Any) -> tuple[str, str]:
    """Stored instants stay UTC. Display uses this machine's calendar clock."""
    text = str(raw or "").strip()
    if not text:
        return "", ""
    try:
        parsed_text = text[:-1] + "+00:00" if text.endswith("Z") else text
        parsed = datetime.fromisoformat(parsed_text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        local = parsed.astimezone()
        return local.date().isoformat(), local.isoformat()
    except ValueError:
        return (text[:10] if len(text) >= 10 else text), text


def then_label(node: Any) -> dict[str, Any]:
    """A graph fact is 当时, never 现在. Date bits are the host-local calendar day."""
    props = {}
    if isinstance(node, dict):
        raw = node.get("properties")
        props = raw if isinstance(raw, dict) else node
    status = str(props.get("status") or props.get("board_status") or "").strip()
    when = str(props.get("valid_from") or props.get("timestamp") or "").strip()
    ticket = str(props.get("ticket") or props.get("单号") or "").strip()
    local_when = display_iso(when)
    local_date = ""
    local_clock = ""
    if local_when:
        try:
            parsed = datetime.fromisoformat(local_when.replace("Z", "+00:00"))
            local_date = parsed.date().isoformat()
            local_clock = parsed.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            local_date = local_when[:10]
            local_clock = local_when[:16].replace("T", " ")
    bits = ["当时"]
    if local_clock:
        bits.append(local_clock)
    elif local_date:
        bits.append(local_date)
    else:
        bits.append("没有日期")
    if status:
        bits.append(status)
    if ticket:
        bits.append(ticket)
    bits.append("不是现在")
    return {"now": False, "label": " · ".join(bits), "status": status, "valid_from": local_when or when, "undated": not bool(local_date)}
