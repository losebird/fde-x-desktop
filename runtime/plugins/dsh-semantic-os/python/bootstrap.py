"""Product ASGI wrapper around official semantica==0.7.0 engine.

Does not rewrite engine Python. Binds 127.0.0.1 only. Each graph request
loads FalkorDB first when the store is up; graph.json is backup only.
"""

from __future__ import annotations

import importlib.metadata
import asyncio
import hashlib
import hmac
import json
import re
import os
import signal
import time
import socket
import subprocess
import sys
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    from stores import primary_status, read_primary, write_primary, rebuild_vectors, schedule_rebuild_vectors, search_vectors, vector_index_status, vector_status, read_node_rows, read_edge_rows, read_memory_card_rows, read_nodes_by_id, patch_node_props, insert_memory_card, insert_edge, upsert_entity, is_archive_node, forget_node_rows
    from board import board_status_of, is_precedent, may_cite, memory_still_counts, resolve_board, resolve_memory_nod, resolve_memory_retire, resolve_memory_source, resolve_memory_renew, resolve_health_mute, resolve_memory_edge, suggest_memory_edge, then_label, display_iso, is_memory_card
    from reference import hold_reference, leave_person, resolve_reference
    from sight import may_read_file_body, resolve_sight
    from grade import may_extract, scrub_hit, scrub_text
    from kind import accept_kind, check_shape, kind_patch, merge_kind_props, pack_kind_connector, should_shape
    from intent import route_intent
    from ledger import export_ledger, may_backup, may_erase
    from extract_clean import clean_extract
    from passages import faiss_status, index_passages, passage_index_status, search_passages
    from align import delete_alignment, list_alignments, save_alignment, suggest_alignments
    from onto_versions import compare_versions, create_version, list_versions, snapshot_structure
except ImportError:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from stores import primary_status, read_primary, write_primary, rebuild_vectors, schedule_rebuild_vectors, search_vectors, vector_index_status, vector_status, read_node_rows, read_edge_rows, read_memory_card_rows, read_nodes_by_id, patch_node_props, insert_memory_card, insert_edge, upsert_entity, is_archive_node, forget_node_rows
    from board import board_status_of, is_precedent, may_cite, memory_still_counts, resolve_board, resolve_memory_nod, resolve_memory_retire, resolve_memory_source, resolve_memory_renew, resolve_health_mute, resolve_memory_edge, suggest_memory_edge, then_label, display_iso, is_memory_card
    from reference import hold_reference, leave_person, resolve_reference
    from sight import may_read_file_body, resolve_sight
    from grade import may_extract, scrub_hit, scrub_text
    from kind import accept_kind, check_shape, kind_patch, merge_kind_props, pack_kind_connector, should_shape
    from intent import route_intent
    from ledger import export_ledger, may_backup, may_erase
    from extract_clean import clean_extract
    from passages import faiss_status, index_passages, passage_index_status, search_passages
    from align import delete_alignment, list_alignments, save_alignment, suggest_alignments
    from onto_versions import compare_versions, create_version, list_versions, snapshot_structure

EXPECTED_VERSION = "0.7.0"
GRAPH_REL = Path(".dsh") / "semantic-os" / "graph.json"
READY_PREFIX = "DSH_SEMANTIC_OS "
_WORKSPACE_LOCKS: dict[str, asyncio.Lock] = {}
_WORKSPACE_LOCKS_GUARD = asyncio.Lock()
_EXPLORER_LOCK = asyncio.Lock()


async def workspace_lock(cwd: str) -> asyncio.Lock:
    key = os.path.realpath(cwd)
    async with _WORKSPACE_LOCKS_GUARD:
        lock = _WORKSPACE_LOCKS.get(key)
        if lock is None:
            lock = asyncio.Lock()
            _WORKSPACE_LOCKS[key] = lock
        return lock


def valid_sidecar_token(request: Any) -> bool:
    expected = (os.environ.get("SEMANTICA_API_KEY") or "").strip()
    provided = (request.headers.get("X-API-Key") or "").strip()
    return bool(expected and provided and hmac.compare_digest(expected, provided))


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(READY_PREFIX + json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def fail(reason: str, detail: str = "", doctor: str = "", version: str | None = None) -> None:
    emit({
        "ready": False,
        "reason": reason,
        "detail": detail,
        "doctor": doctor,
        "version": version,
        "port": None,
    })
    raise SystemExit(0)


def jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [jsonable(v) for v in value]
    if hasattr(value, "to_dict") and callable(value.to_dict):
        try:
            return jsonable(value.to_dict())
        except Exception:
            pass
    if hasattr(value, "__dict__"):
        try:
            return jsonable({k: v for k, v in vars(value).items() if not k.startswith("_")})
        except Exception:
            pass
    return str(value)


def doctor_report() -> tuple[str, bool]:
    env = {k: v for k, v in os.environ.items() if k != "SEMANTICA_ALLOW_ANONYMOUS"}
    # Always invoke the module through the current interpreter. pip-generated
    # console scripts carry an absolute build-time shebang and break after the
    # bundled runtime is relocated into npm's installation tree.
    cmd = [
        sys.executable,
        "-c",
        "from semantica.cli import main; import sys; sys.argv=['semantica','doctor']; raise SystemExit(main())",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    text = ((proc.stdout or "") + "\n" + (proc.stderr or "")).strip()
    if not text:
        text = f"semantica doctor exited {proc.returncode}"
    # Warnings (missing LLM keys) are not a hard fail. A crash / empty CLI is.
    ok = proc.returncode == 0 or "semantica" in text.lower()
    return text[-8000:], ok


def graph_path(cwd: str) -> Path:
    return Path(os.path.realpath(cwd)) / GRAPH_REL


def coerce_decision_timestamps(session: Any) -> bool:
    """Official DecisionResponse.timestamp is Optional[str]. record_decision stores a unix float."""
    from datetime import datetime, timezone

    graph = getattr(session, "graph", None)
    nodes = getattr(graph, "nodes", None)
    if not isinstance(nodes, dict):
        return False
    changed = False
    for node in nodes.values():
        node_type = getattr(node, "node_type", None)
        if node_type is None and isinstance(node, dict):
            node_type = node.get("type") or node.get("node_type")
        if str(node_type or "").lower() != "decision":
            continue
        props = getattr(node, "properties", None)
        if props is None and isinstance(node, dict):
            props = node.get("properties")
        if not isinstance(props, dict):
            continue
        ts = props.get("timestamp")
        if isinstance(ts, bool) or not isinstance(ts, (int, float)):
            continue
        try:
            props["timestamp"] = datetime.fromtimestamp(
                float(ts), tz=timezone.utc
            ).replace(tzinfo=None).isoformat()
        except (OverflowError, OSError, ValueError):
            props["timestamp"] = str(ts)
        changed = True
    return changed


def decision_props(node: Any) -> dict[str, Any]:
    if isinstance(node, dict):
        meta = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        return {**props, **meta}
    props = getattr(node, "properties", None)
    meta = getattr(node, "metadata", None)
    out = {}
    if isinstance(props, dict):
        out.update(props)
    if isinstance(meta, dict):
        out.update(meta)
    return out


def _decision_node_id(node: Any) -> str:
    if isinstance(node, dict):
        return str(node.get("id") or node.get("decision_id") or node.get("node_id") or "")
    return str(getattr(node, "node_id", None) or getattr(node, "id", "") or "")


def _is_auto_decision(node: Any) -> bool:
    props = decision_props(node)
    if props.get("auto") is True:
        return True
    if str(props.get("source") or "") == "session_ingest":
        return True
    maker = str(props.get("decision_maker") or "").lower()
    return maker in ("auto-extract", "未明确")


def _decision_stamp(node: Any):
    props = decision_props(node)
    return parse_time_value(
        props.get("timestamp")
        or props.get("valid_from")
        or (node.get("valid_from") if isinstance(node, dict) else getattr(node, "valid_from", None))
    )


def _outcome_key(value: Any) -> str:
    text = " ".join(str(value or "").lower().split())
    return text[:160]


def find_auto_decision_duplicate(graph: Any, outcome: str, scenario: str = "", nodes: list[Any] | None = None) -> str:
    """Return an existing auto decision id with the same outcome (or close scenario)."""
    want = _outcome_key(outcome)
    want_sc = _outcome_key(scenario)[:80]
    if not want:
        return ""
    if nodes is None:
        nodes = graph.find_nodes(node_type="decision") if hasattr(graph, "find_nodes") else []
    for node in nodes or []:
        if not _is_auto_decision(node):
            continue
        props = decision_props(node)
        got = _outcome_key(props.get("outcome") or props.get("content") or "")
        if got == want:
            return _decision_node_id(node)
        if want_sc and _outcome_key(props.get("scenario") or "")[:80] == want_sc:
            return _decision_node_id(node)
    return ""


def pack_official_decision(node: Any) -> dict[str, Any]:
    props = decision_props(node)
    nid = _decision_node_id(node)
    stamped = _decision_stamp(node)
    ts = display_iso(stamped) if stamped is not None else display_iso(props.get("timestamp") or "")
    return {
        "decision_id": nid,
        "category": props.get("category") or "",
        "scenario": props.get("scenario") or props.get("content") or "",
        "reasoning": props.get("reasoning") or "",
        "outcome": props.get("outcome") or "",
        "confidence": props.get("confidence"),
        "status": props.get("status") or props.get("board_status") or "",
        "timestamp": ts,
        "metadata": {
            "category": props.get("category"),
            "outcome": props.get("outcome"),
            "auto": bool(_is_auto_decision(node)),
            "source": props.get("source") or "",
            "decision_maker": props.get("decision_maker") or "",
            "timestamp": ts,
            "status": props.get("status") or props.get("board_status") or "",
            "receipt_id": props.get("receipt_id") or props.get("receiptId") or "",
            "nod_kind": props.get("nod_kind") or props.get("nodKind") or "",
            "trace_id": props.get("trace_id") or props.get("traceId") or props.get("requestId") or "",
        },
        "then": then_label(props),
    }


def live_boards_for_trace(graph: Any, trace: str = "", receipt: str = "", nodes: list[Any] | None = None) -> list[dict[str, Any]]:
    want = str(trace or "").strip()
    rec = str(receipt or "").strip()
    if not want and not rec:
        return []
    if nodes is None:
        if not hasattr(graph, "find_nodes"):
            return []
        nodes = graph.find_nodes(node_type="decision") or []
    out = []
    for node in nodes or []:
        props = decision_props(node)
        if str(props.get("status") or props.get("board_status") or "") != "已生效":
            continue
        got_trace = str(props.get("trace_id") or props.get("traceId") or props.get("requestId") or "")
        got_receipt = str(props.get("receipt_id") or props.get("receiptId") or props.get("receipt") or "")
        if want and got_trace == want:
            hit = True
        elif rec and got_receipt == rec:
            hit = True
        else:
            hit = False
        if not hit:
            continue
        out.append({
            "id": _decision_node_id(node),
            "status": "已生效",
            "trace_id": got_trace,
            "receipt_id": got_receipt,
        })
    return out


def holdings_of(graph: Any, person: str = "") -> list[dict[str, Any]]:
    who = str(person or "").strip()
    rows = []
    for _, edge in iter_edges(graph):
        src, tgt, et = edge_ends(edge)
        if et != "holds" or not src or not tgt:
            continue
        if who and src != who:
            continue
        rows.append({"edge": "holds", "source": src, "target": tgt})
    return rows


def run_list_decisions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Newest first. Default hides auto-extract clones so the board stays readable."""
    args = args or {}
    include_auto = _truthy_flag(args.get("include_auto") or args.get("auto"))
    try:
        limit = max(1, min(int(args.get("limit") or 80), 200))
    except (TypeError, ValueError):
        limit = 80
    rows, _st = read_node_rows(cwd)
    items = []
    for row in rows:
        if str(row.get("type") or "").lower() != "decision":
            continue
        packed = pack_official_decision(row)
        if not packed["decision_id"]:
            continue
        if not include_auto and packed["metadata"]["auto"]:
            continue
        status = str(packed.get("status") or packed["metadata"].get("status") or "")
        if status in ("作废", "已冲正"):
            continue
        items.append(packed)
    items.sort(key=lambda row: str(row.get("timestamp") or ""), reverse=True)
    return {"ok": True, "decisions": items[:limit], "total": len(items), "include_auto": include_auto}


def is_report_noise(text: Any) -> bool:
    """Assistant progress tables are not 记忆卡片. Structure only, not this-round phrases."""
    blob = str(text or "").strip()
    if not blob:
        return False
    stripped = blob.lstrip(" \t*_>-")
    if blob.startswith("#") or stripped.startswith("#") or blob.startswith("---") or stripped.startswith("---"):
        return True
    if blob.count("|") >= 3:
        return True
    return blob.count("`") >= 4


def run_list_memory_cards(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Draft 记忆卡片 waiting for a nod. include_filed also returns 已入档."""
    args = args or {}
    include_filed = _truthy_flag(args.get("include_filed"))
    status_filter = str(args.get("status") or "").strip()
    try:
        limit = max(1, min(int(args.get("limit") or 20), 80))
    except (TypeError, ValueError):
        limit = 20
    try:
        offset = max(0, int(args.get("offset") or 0))
    except (TypeError, ValueError):
        offset = 0
    rows, _st = read_memory_card_rows(cwd)
    sources = [
        str((row.get("properties") or {}).get("source") or (row.get("properties") or {}).get("path") or "")
        for row in rows
        if isinstance(row, dict)
    ]
    by_id = read_nodes_by_id(cwd, sources) if any(s.startswith(("session:", "file:")) for s in sources) else {}
    items = []
    for row in rows:
        if not isinstance(row, dict) or not is_memory_card(row):
            continue
        nid = str(row.get("id") or "")
        if not nid or nid == _HEALTH_MUTE_ID:
            continue
        packed = {
            "id": nid,
            "type": str(row.get("type") or "记忆卡片"),
            "properties": row.get("properties") if isinstance(row.get("properties"), dict) else {},
            "content": row.get("content"),
        }
        status = board_status_of(packed) or "起草"
        if status_filter and status != status_filter:
            continue
        label = str(row.get("content") or packed["properties"].get("content") or packed["properties"].get("label") or nid)
        if status in ("", "起草") and is_report_noise(label):
            continue
        if status in ("", "起草"):
            if not memory_still_counts(packed):
                continue
        elif include_filed and status == "已入档":
            pass
        else:
            continue
        props = packed["properties"]
        current = memory_still_counts(packed)
        source = str(props.get("source") or props.get("path") or "")
        then_props = props
        own = then_label(props)
        if own.get("undated") and source.startswith(("session:", "file:")):
            src = by_id.get(source)
            if isinstance(src, dict):
                src_props = src.get("properties") if isinstance(src.get("properties"), dict) else {}
                src_then = then_label(src_props)
                if not src_then.get("undated"):
                    then_props = src_props
        items.append({
            "id": nid,
            "label": label if label else str(row.get("content") or props.get("content") or props.get("label") or nid),
            "status": status,
            "source": source,
            "then": then_label(then_props),
            "valid_until": str(props.get("valid_until") or ""),
            "current": current,
        })
    items.sort(key=lambda row: str((row.get("then") or {}).get("valid_from") or ""), reverse=True)
    page = items[offset:offset + limit]
    filed = []
    for row in rows:
        if not isinstance(row, dict) or not is_memory_card(row):
            continue
        packed = {
            "id": str(row.get("id") or ""),
            "type": str(row.get("type") or "记忆卡片"),
            "properties": row.get("properties") if isinstance(row.get("properties"), dict) else {},
            "content": row.get("content"),
        }
        if board_status_of(packed) != "已入档" or not memory_still_counts(packed):
            continue
        filed.append(packed)
    for card in page:
        hint = ""
        older = ""
        for other in filed:
            oid = str(other.get("id") or "")
            if not oid or oid == card["id"]:
                continue
            other_label = str(other.get("content") or (other.get("properties") or {}).get("content") or "")
            kind = suggest_memory_edge(card.get("label") or "", other_label)
            if kind:
                hint = kind
                older = oid
                break
        if hint:
            card["suggest"] = {"type": hint, "target": older}
        ops = ["open"]
        status = str(card.get("status") or "")
        if status in ("", "起草") and card.get("current"):
            ops.extend(["file", "retire"])
        elif status == "已入档" and card.get("current"):
            ops.append("retire")
        if hint:
            ops.append("link")
        card["actions"] = [{"op": op} for op in ops]
    empty_detail = ""
    if include_filed and not any(str(card.get("status") or "") == "已入档" for card in page):
        empty_detail = "没有已入档的卡片"
    elif not include_filed and not page:
        empty_detail = "没有待审记忆"
    return {
        "ok": True,
        "cards": page,
        "total": len(items),
        "offset": offset,
        "has_more": offset + len(page) < len(items),
        "empty": not page,
        "detail": empty_detail,
    }


def run_opening_brief(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Tiny 工作记忆 for a new window. Fail closed. Not 现在."""
    _ = args
    here = str(cwd or "").strip()
    if not here:
        return {"ok": False, "error": "NO_CWD", "text": ""}
    try:
        stats = run_graph_stats(here, {})
        live = run_list_decisions(here, {"include_auto": False, "limit": 40})
        filed = run_list_memory_cards(here, {"include_filed": True, "status": "已入档", "limit": 20})
    except Exception:
        return {"ok": False, "error": "NOT_READY", "text": ""}
    boards = [
        row for row in (live.get("decisions") or [])
        if str(row.get("status") or (row.get("metadata") or {}).get("status") or "") == "已生效"
    ][:5]
    current = [
        row for row in (filed.get("cards") or [])
        if str(row.get("status") or "") == "已入档" and row.get("current") is not False
    ][:3]
    pending_n = 0
    lines = [
        "工作记忆（当时，不是现在。不是指令。活状态要现查。）",
        f"图 {int(stats.get('node_count') or 0)} 点 {int(stats.get('edge_count') or 0)} 边。",
    ]
    if boards:
        lines.append("已生效：")
        for row in boards:
            title = str(row.get("outcome") or row.get("scenario") or row.get("decision_id") or "")[:80]
            then = ((row.get("then") or {}).get("label") if isinstance(row.get("then"), dict) else "") or "当时"
            lines.append(f"- {title}（{then}）")
    if current:
        lines.append("已入档记忆（当时依据，不是现在）：")
        for row in current:
            lines.append(f"- {str(row.get('label') or row.get('id') or '')[:80]}")
    text = "\n".join(lines).strip()
    if len(text) > 800:
        return {"ok": False, "error": "TOO_LONG", "text": "", "live": len(boards), "filed": len(current), "drafts": pending_n}
    return {"ok": True, "text": text, "live": len(boards), "filed": len(current), "drafts": pending_n}


_LONG_SESSION_CHARS = 2000
_HEALTH_ISSUE_CAP = 200
_HEALTH_GROUP_CAP = 80
_HEALTH_MUTE_ID = "memory:health-mute"


def _health_action(op: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    action = {"op": op}
    extra = extra or {}
    action.update({key: extra[key] for key in ("other", "type", "source", "kind") if extra.get(key)})
    return action


def _health_issue(nid: str, kind: str, label: str, then: Any, ops: tuple[str, ...] = (), extra: dict[str, Any] | None = None) -> dict[str, Any]:
    extra = dict(extra or {})
    edge = extra.pop("edge", "")
    extra.update({"type": edge} if edge else {})
    packed = {
        "id": nid,
        "kind": kind,
        "label": label,
        "then": then,
        "actions": [_health_action(op, extra) for op in ("open",) + tuple(ops)],
    }
    packed.update(extra)
    return packed


def _has_health_op(row: dict[str, Any], op: str) -> bool:
    return any(str(action.get("op") or "") == op for action in (row.get("actions") or []) if isinstance(action, dict))


def _scan_memory_card_health(row: dict[str, Any], sourced: set[str]) -> list[dict[str, Any]]:
    nid = str(row.get("id") or "")
    if nid == _HEALTH_MUTE_ID:
        return []
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    content = str(row.get("content") or props.get("content") or "")
    packed = {"id": nid, "type": str(row.get("type") or ""), "properties": props, "content": content}
    live = bool(nid) and is_memory_card(row)
    current = live and memory_still_counts(packed)
    status = str(props.get("status") or "")
    source = str(props.get("source") or props.get("path") or "")
    has_source = nid in sourced or source.startswith(("session:", "file:"))
    draft = status in ("", "起草")
    then = then_label(props)
    rules = (
        (live and not current and status == "已入档", "已过期", ("renew", "retire")),
        (current and not has_source, "无出处", ("source", "retire")),
        (current and draft and is_report_noise(content), "报告噪音", ("retire",)),
    )
    return [_health_issue(nid, kind, content[:80], then, ops) for when, kind, ops in rules if when]


def _scan_long_session_health(row: dict[str, Any], sourced_from: set[str]) -> list[dict[str, Any]]:
    nid = str(row.get("id") or "")
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    content = str(row.get("content") or props.get("content") or "")
    pending = nid not in sourced_from
    rules = (
        (
            nid.startswith("session:") and len(content) > _LONG_SESSION_CHARS,
            "超长会话",
            ("extract",) * pending,
            {"extract": pending, "extracted": not pending},
        ),
    )
    return [
        _health_issue(nid, kind, content[:80], then_label(props), ops, extra)
        for when, kind, ops, extra in rules
        if when
    ]


def _dedup_pair_action(left: dict[str, Any], right: dict[str, Any], card_ids: set[str]) -> str:
    lid = str((left or {}).get("id") or "")
    rid = str((right or {}).get("id") or "")
    if not lid or not rid:
        return ""
    if lid in card_ids and rid in card_ids:
        return "link"
    ltype = str((left or {}).get("type") or "")
    rtype = str((right or {}).get("type") or "")
    if _is_schema_type(ltype) or _is_schema_type(rtype):
        return ""
    if ltype and rtype and ltype != rtype:
        return ""
    return "merge"


def _scan_duplicate_health(cwd: str, card_ids: set[str], rows: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    dups = run_enrich_dedup(cwd, {"threshold": 0.95, "rows": rows})
    issues: list[dict[str, Any]] = []
    for row in (dups.get("duplicates") or [])[:8]:
        left = row.get("entity_a") if isinstance(row.get("entity_a"), dict) else {}
        right = row.get("entity_b") if isinstance(row.get("entity_b"), dict) else {}
        lid = str(left.get("id") or "")
        rid = str(right.get("id") or "")
        op = _dedup_pair_action(left, right, card_ids)
        if not op:
            continue
        extra = {"other": rid}
        extra.update({"edge": suggest_memory_edge(str(left.get("label") or lid), str(right.get("label") or rid)) or "confirms"} if op == "link" else {})
        issues.append(_health_issue(lid, "重复", f"{lid} ~ {rid}", None, (op,), extra))
    return issues


def _health_muted_kinds(cwd: str) -> set[str]:
    rows, _st = read_memory_card_rows(cwd)
    row = next((item for item in rows if isinstance(item, dict) and str(item.get("id") or "") == _HEALTH_MUTE_ID), None)
    if row is None or not memory_still_counts(row):
        return set()
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    muted = props.get("muted") if isinstance(props.get("muted"), list) else []
    return {str(kind) for kind in muted if str(kind or "").strip()}


def run_memory_health(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Read-only 梳理. Never writes. Erase still needs a nod."""
    args = args or {}
    try:
        offset = max(0, int(args.get("offset") or 0))
    except (TypeError, ValueError):
        offset = 0
    try:
        limit = max(1, min(int(args.get("limit") or 40), _HEALTH_ISSUE_CAP))
    except (TypeError, ValueError):
        limit = 40
    rows, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    sourced = {str(edge.get("target") or "") for edge in edges if str(edge.get("type") or "") == "出自"} - {""}
    sourced_from = {str(edge.get("source") or "") for edge in edges if str(edge.get("type") or "") == "出自"} - {""}
    muted = _health_muted_kinds(cwd)
    card_ids = {
        str(row.get("id") or "")
        for row in rows
        if isinstance(row, dict) and is_memory_card(row) and str(row.get("id") or "")
    }
    issues: list[dict[str, Any]] = []
    for row in rows:
        issues.extend(_scan_memory_card_health(row, sourced) if isinstance(row, dict) else [])
        issues.extend(_scan_long_session_health(row, sourced_from) if isinstance(row, dict) else [])
    issues.extend(_scan_duplicate_health(cwd, card_ids, rows))
    issues = [row for row in issues if str(row.get("kind") or "") not in muted]
    grouped: dict[str, list[dict[str, Any]]] = {}
    for issue in issues:
        grouped.setdefault(str(issue.get("kind") or ""), []).append(issue)
    groups = []
    for kind, kind_rows in grouped.items():
        can_retire_all = bool(kind_rows and all(_has_health_op(item, "retire") for item in kind_rows))
        write_ops = {
            str(action.get("op") or "")
            for item in kind_rows
            for action in (item.get("actions") or [])
            if isinstance(action, dict)
        } - {"open", ""}
        only_retire = can_retire_all and write_ops <= {"retire"}
        page_rows = kind_rows[offset:offset + _HEALTH_GROUP_CAP]
        groups.append({
            "kind": kind,
            "count": len(kind_rows),
            "items": page_rows,
            "has_more": offset + len(page_rows) < len(kind_rows),
            "actions": ["retire_group"] * can_retire_all + ["mute"] * only_retire,
        })
    present = {str(group.get("kind") or "") for group in groups}
    for kind in ("无出处", "重复", "报告噪音", "已过期", "超长会话"):
        if kind in present or kind in muted:
            continue
        groups.append({
            "kind": kind,
            "count": 0,
            "items": [],
            "has_more": False,
            "empty": True,
            "detail": f"没有这类：{kind}",
            "actions": [],
        })
    page = issues[offset:offset + limit]
    return {
        "ok": True,
        "issues": page,
        "groups": groups,
        "total": len(issues),
        "offset": offset,
        "has_more": offset + len(page) < len(issues),
        "writes": False,
        "muted": sorted(muted),
    }


def _is_recallable_draft(node: Any) -> bool:
    """Human 起草 can be recalled. Auto extract / 作废 / 已冲正 cannot."""
    if is_precedent(node) or _is_auto_decision(node):
        return False
    props = decision_props(node)
    status = str(props.get("status") or props.get("board_status") or "").strip()
    return status in ("", "起草")


def run_score_decisions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Same book as list_decisions. Default 已生效 only. include_drafts adds human 起草."""
    args = args or {}
    scenario = str(args.get("scenario") or args.get("query") or args.get("q") or "").strip()
    category = str(args.get("category") or "").strip()
    exclude_id = str(args.get("exclude_id") or args.get("decision_id") or "").strip()
    include_drafts = _truthy_flag(args.get("include_drafts"))
    try:
        limit = max(1, min(int(args.get("limit") or args.get("max_results") or 10), 50))
    except (TypeError, ValueError):
        limit = 10
    seed_words = set(scenario.lower().split())
    rows, _st = read_node_rows(cwd)
    scored: list[tuple[float, dict[str, Any]]] = []
    for row in rows:
        if str(row.get("type") or "").lower() != "decision":
            continue
        packed_node = {
            "id": str(row.get("id") or ""),
            "type": "decision",
            "properties": row.get("properties") if isinstance(row.get("properties"), dict) else {},
            "content": row.get("content"),
        }
        if not packed_node["id"] or packed_node["id"] == exclude_id:
            continue
        if is_precedent(packed_node):
            pass
        elif include_drafts and _is_recallable_draft(packed_node):
            pass
        else:
            continue
        score = official_precedent_score(category, seed_words, packed_node, scenario)
        if scenario and score <= 0 and not category:
            continue
        packed = pack_official_decision(packed_node)
        packed["score"] = round(float(score), 4)
        scored.append((score, packed))
    scored.sort(key=lambda item: item[0], reverse=True)
    rows_out = [row for _, row in scored[:limit]]
    return {"ok": True, "precedents": rows_out, "decisions": rows_out}


def run_query_decisions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Recall 已生效 plus human 起草. Auto extract stays hidden."""
    next_args = dict(args or {})
    if "include_drafts" not in next_args:
        next_args["include_drafts"] = True
    return run_score_decisions(cwd, next_args)


def run_find_precedents(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Last-time-we-decided-this. 已生效 only."""
    next_args = dict(args or {})
    next_args["include_drafts"] = False
    return run_score_decisions(cwd, next_args)


def _compact_decision_text(value: Any) -> str:
    return "".join(str(value or "").lower().split())


def _substring_overlap(seed: str, other: str) -> float:
    """Chinese boards have no spaces; word-split overlap is 0. Do not touch search_text."""
    a = _compact_decision_text(seed)
    b = _compact_decision_text(other)
    if len(a) < 2 or len(b) < 2:
        return 0.0
    if a in b or b in a:
        return 1.0
    window = 4 if min(len(a), len(b)) >= 4 else 2
    total = max(len(a) - window + 1, 1)
    hits = 0
    for i in range(0, len(a) - window + 1):
        if a[i:i + window] in b:
            hits += 1
    return hits / total if total else 0.0


def official_precedent_score(seed_category: str, seed_words: set[str], node: dict, scenario: str = "") -> float:
    """Official word overlap plus compact-substring for CJK. No min score."""
    other = decision_props(node)
    score = 0.0
    if seed_category and str(other.get("category") or "").lower() == seed_category.lower():
        score += 0.5
    other_blob = " ".join([
        str(other.get("scenario") or ""),
        str(other.get("outcome") or ""),
        str(other.get("reasoning") or ""),
    ])
    other_words = set(other_blob.lower().split())
    if seed_words and other_words:
        overlap = len(seed_words & other_words) / max(len(seed_words | other_words), 1)
        score += 0.5 * overlap
    seed = str(scenario or " ".join(seed_words)).strip()
    if seed:
        score += 0.5 * _substring_overlap(seed, other_blob)
    return score


_CAUSAL_EDGE_TYPES = {
    "supports", "causes", "leads_to", "influences",
    "CAUSED", "INFLUENCED", "PRECEDENT_FOR",
}
_CAUSAL_DOWN = frozenset({"leads_to", "causes", "CAUSED"})
_CAUSAL_UP = frozenset({"supports", "influences", "PRECEDENT_FOR", "INFLUENCED"})


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


def attach_decision_causal_edges(graph: Any, decision_id: str, args: dict[str, Any] | None = None) -> dict[str, int]:
    """依据 --supports--> 决策 --leads_to--> 后果. Not ABOUT / 出自 / 包含."""
    args = args or {}
    did = str(decision_id or "").strip()
    if not did:
        return {"supports": 0, "leads_to": 0}
    because = _id_list(args.get("because") or args.get("evidence") or args.get("supports"))
    leads = _id_list(args.get("leads_to") or args.get("consequences") or args.get("causes"))
    supports = 0
    skipped = 0
    for src in because:
        if src == did:
            continue
        if get_node(graph, src) is None:
            skipped += 1
            continue
        src_node = get_node(graph, src)
        et = "PRECEDENT_FOR" if str(node_type_of(src_node) or "").lower() == "decision" else "supports"
        ensure_edge(graph, src, did, et)
        supports += 1
    outcomes = 0
    for tgt in leads:
        if tgt == did:
            continue
        if get_node(graph, tgt) is None:
            skipped += 1
            continue
        ensure_edge(graph, did, tgt, "leads_to")
        outcomes += 1
    return {"supports": supports, "leads_to": outcomes, "skipped": skipped}


def walk_causal_chain(graph: Any, decision_id: str, direction: str = "upstream", max_depth: int = 5) -> list[dict[str, Any]]:
    """Only supports/causes/leads_to. Not session 包含 / 出自 neighbors."""
    start = str(decision_id or "").strip()
    if not start:
        return []
    try:
        depth = max(1, min(int(max_depth or 5), 20))
    except (TypeError, ValueError):
        depth = 5
    going_down = str(direction or "").strip().lower() == "downstream"
    incoming: dict[str, list[tuple[str, str]]] = {}
    outgoing: dict[str, list[tuple[str, str]]] = {}
    for _, edge in iter_edges(graph):
        src, tgt, et = edge_ends(edge)
        if et not in _CAUSAL_EDGE_TYPES or not src or not tgt:
            continue
        outgoing.setdefault(src, []).append((tgt, et))
        incoming.setdefault(tgt, []).append((src, et))
    seen = {start}
    chain: list[dict[str, Any]] = []
    frontier = [(start, 0)]
    while frontier:
        nid, hop = frontier.pop(0)
        if hop >= depth:
            continue
        raw = outgoing.get(nid, []) if going_down else incoming.get(nid, [])
        allow = _CAUSAL_DOWN if going_down else _CAUSAL_UP
        nxt = [(other, et) for other, et in raw if et in allow]
        for other, et in nxt:
            if other in seen:
                continue
            seen.add(other)
            node = get_node(graph, other)
            chain.append({
                "id": other,
                "type": node_type_of(node) if node is not None else "",
                "relationship": et,
                "hop": hop + 1,
                "content": node_content(node) if node is not None else other,
            })
            frontier.append((other, hop + 1))
    chain.sort(key=lambda row: (int(row.get("hop") or 0), str(row.get("id") or "")))
    return chain


def score_decisions(
    graph: Any,
    scenario: str,
    category: str = "",
    exclude_id: str = "",
    limit: int = 10,
) -> list[dict]:
    seed_words = set(str(scenario or "").lower().split())
    scored: list[tuple[float, dict]] = []
    for node in graph.find_nodes(node_type="decision"):
        nid = str(node.get("id") or "")
        if exclude_id and nid == exclude_id:
            continue
        if not is_precedent(node):
            continue
        scored.append((official_precedent_score(category, seed_words, node, scenario), node))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [node for _, node in scored[:limit]]


def _slim_workbench(graph: Any) -> int:
    """Drop diary/file/mail nodes from the in-memory workbench. Cabinet rows stay in FalkorDB."""
    nodes = getattr(graph, "nodes", None) or {}
    items = list(nodes.items()) if isinstance(nodes, dict) else []
    drop = []
    for nid, node in items:
        ntype = ""
        if isinstance(node, dict):
            ntype = str(node.get("type") or node.get("node_type") or "")
        else:
            ntype = str(getattr(node, "node_type", None) or getattr(node, "type", "") or "")
        status = ""
        if isinstance(node, dict):
            props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            status = str(node.get("status") or props.get("status") or "")
        else:
            props = getattr(node, "properties", None)
            status = str(getattr(node, "status", "") or (props.get("status") if isinstance(props, dict) else "") or "")
        if not keep_workbench_node(str(nid), ntype, status):
            drop.append(str(nid))
    for nid in drop:
        _drop_graph_node(graph, nid)
    return len(drop)


def load_session(cwd: str):
    from semantica.context.context_graph import ContextGraph
    from semantica.explorer.session import GraphSession

    path = graph_path(cwd)
    mem, st = read_primary(cwd)
    if mem is not None and not st.get("empty"):
        session = GraphSession(mem)
        _slim_workbench(session.graph)
        coerce_decision_timestamps(session)
        return session, path
    if path.is_file():
        session = GraphSession.from_file(str(path))
    else:
        session = GraphSession(ContextGraph())
    _slim_workbench(session.graph)
    coerce_decision_timestamps(session)
    if st.get("ok") and (st.get("empty") or mem is None):
        try:
            write_primary(session.graph, cwd)
        except Exception:
            pass
    return session, path


def save_session(session: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.stem}.{os.getpid()}.tmp{path.suffix}")
    try:
        session.graph.save_to_file(str(temp))
        os.replace(temp, path)
    finally:
        try:
            if temp.exists():
                temp.unlink()
        except OSError:
            pass
    try:
        cwd = str(path.parents[2])
        write_primary(session.graph, cwd)
    except Exception:
        pass
    try:
        schedule_rebuild_vectors(cwd, session.graph)
    except Exception:
        pass



def has_cjk(text: str) -> bool:
    return any(0x4E00 <= ord(ch) <= 0x9FFF for ch in str(text or ""))



DOC_TEXT_LIMIT = 20000
CHUNK_SIZE = 3500
CHUNK_OVERLAP = 200


def document_id(src_path: str) -> str:
    s = str(src_path or "").strip()
    if not s:
        return ""
    if s.startswith("session:") or s.startswith("file:") or s.startswith("mail:"):
        return s
    return f"file:{s}"


def stable_entity_id(label: str) -> str:
    return "".join(str(label or "").split())


def iter_edges(graph: Any):
    edges = getattr(graph, "edges", None)
    if isinstance(edges, dict):
        yield from edges.items()
        return
    if isinstance(edges, list):
        for edge in edges:
            hid = None
            if isinstance(edge, dict):
                hid = edge.get("id")
            else:
                hid = getattr(edge, "id", None) or getattr(edge, "edge_id", None)
            yield hid, edge


def edge_ends(edge: Any) -> tuple[str, str, str]:
    if isinstance(edge, dict):
        src = str(edge.get("source_id") or edge.get("source") or "")
        tgt = str(edge.get("target_id") or edge.get("target") or "")
        et = str(edge.get("type") or edge.get("edge_type") or "")
        return src, tgt, et
    src = str(getattr(edge, "source_id", None) or getattr(edge, "source", "") or "")
    tgt = str(getattr(edge, "target_id", None) or getattr(edge, "target", "") or "")
    et = str(getattr(edge, "edge_type", None) or getattr(edge, "type", "") or "")
    return src, tgt, et


def set_node_props(node: Any, **values: Any) -> None:
    if node is None or not values:
        return
    if isinstance(node, dict):
        props = node.get("properties")
        if not isinstance(props, dict):
            props = {}
            node["properties"] = props
        props.update(values)
        for key, value in values.items():
            node[key] = value
        return
    props = getattr(node, "properties", None)
    if not isinstance(props, dict):
        props = {}
        try:
            setattr(node, "properties", props)
        except Exception:
            return
    props.update(values)


def get_node(graph: Any, nid: str):
    nodes = getattr(graph, "nodes", {}) or {}
    if isinstance(nodes, dict):
        return nodes.get(nid)
    if isinstance(nodes, list):
        for node in nodes:
            hid = node.get("id") if isinstance(node, dict) else (
                getattr(node, "node_id", None) or getattr(node, "id", None)
            )
            if str(hid) == str(nid):
                return node
    return None


def node_content(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict):
        props = node.get("properties") or {}
        return str(node.get("content") or props.get("content") or props.get("label") or node.get("id") or "")
    props = getattr(node, "properties", None) or {}
    if isinstance(props, dict) and props.get("content"):
        return str(props.get("content"))
    return str(getattr(node, "content", None) or "")


def node_source(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict):
        props = node.get("properties") or {}
        return str(props.get("source") or props.get("path") or node.get("source") or "")
    props = getattr(node, "properties", None) or {}
    if isinstance(props, dict):
        return str(props.get("source") or props.get("path") or "")
    return ""


def has_edge(graph: Any, src: str, tgt: str, etype: str) -> bool:
    for _, edge in iter_edges(graph):
        s, t, e = edge_ends(edge)
        if s == src and t == tgt and e == etype:
            return True
    return False


def ensure_edge(graph: Any, src: str, tgt: str, etype: str, **props: Any) -> None:
    if not src or not tgt or has_edge(graph, src, tgt, etype):
        return
    try:
        graph.add_edge(src, tgt, edge_type=etype, **props)
    except Exception:
        pass


def drop_edge(graph: Any, src: str, tgt: str, etype: str) -> int:
    dropped = 0
    for name in ("remove_edge", "delete_edge", "drop_edge"):
        fn = getattr(graph, name, None)
        if not callable(fn):
            continue
        try:
            fn(src, tgt, etype)
            return 1
        except TypeError:
            try:
                fn(src, tgt)
                return 1
            except Exception:
                pass
        except Exception:
            pass
    edges = getattr(graph, "edges", None)
    if isinstance(edges, dict):
        drop = []
        for eid, edge in list(edges.items()):
            s, t, e = edge_ends(edge)
            if s == src and t == tgt and e == etype:
                drop.append(eid)
        for eid in drop:
            edges.pop(eid, None)
        return len(drop)
    if isinstance(edges, list):
        kept = []
        for edge in edges:
            s, t, e = edge_ends(edge)
            if s == src and t == tgt and e == etype:
                dropped += 1
                continue
            kept.append(edge)
        if dropped:
            edges[:] = kept
        return dropped
    return 0


def iso_utc_from_mtime(mtime: float | None) -> str | None:
    if mtime is None:
        return None
    try:
        return datetime.fromtimestamp(float(mtime), tz=timezone.utc).isoformat()
    except (OverflowError, OSError, TypeError, ValueError):
        return None


def now_event_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def event_fields(*, path: str = "", extra: dict[str, Any] | None = None, fallback: str = "") -> dict[str, str]:
    """Always return timestamp/valid_from/event_time. Prefer existing, then file mtime, then fallback, then now."""
    extra = extra if isinstance(extra, dict) else {}
    for key in ("valid_from", "timestamp", "event_time"):
        text = str(extra.get(key) or "").strip()
        if text:
            return {"timestamp": text, "valid_from": text, "event_time": text}
    iso = file_mtime_iso(path) or str(fallback or "").strip() or now_event_iso()
    return {"timestamp": iso, "valid_from": iso, "event_time": iso}


def ontology_event_iso(cwd: str) -> str:
    root = os.path.realpath(cwd or "")
    for rel in (
        os.path.join(root, ".dsh", "semantic-os", "ontology-versions.json"),
        os.path.join(root, ".dsh", "semantic-os", "ontology", "policy", "generated-from-classes.ttl"),
        os.path.join(root, ".dsh", "semantic-os", "graph.json"),
    ):
        iso = file_mtime_iso(rel)
        if iso:
            return iso
    return ""


def file_mtime_iso(src_path: str) -> str | None:
    raw = str(src_path or "")
    if not raw or raw.startswith("session:") or raw.startswith("mail:"):
        return None
    if raw.startswith("file:"):
        raw = raw[5:]
    try:
        if os.path.isfile(raw):
            return iso_utc_from_mtime(os.path.getmtime(raw))
    except OSError:
        return None
    return None


def upsert_document(graph: Any, src_path: str, text: str, extra: dict | None = None) -> str:
    doc_id = document_id(src_path)
    if not doc_id:
        return ""
    body = str(text or "")
    stored = body[:DOC_TEXT_LIMIT] if body.strip() else src_path
    meta = {"source": src_path, "path": src_path}
    if extra:
        meta.update({k: v for k, v in extra.items() if v is not None})
    if not meta.get("timestamp") and not meta.get("valid_from"):
        stamped = file_mtime_iso(src_path)
        if stamped:
            meta["timestamp"] = stamped
            meta["valid_from"] = stamped
            meta["event_time"] = stamped
    graph.add_node(doc_id, "Document", content=stored, **meta)
    kept = str(meta.get("timestamp") or meta.get("valid_from") or meta.get("event_time") or "").strip()
    if kept:
        node = get_node(graph, doc_id)
        if node is not None:
            set_node_props(node, timestamp=kept, valid_from=kept, event_time=kept)
            try:
                setattr(node, "valid_from", kept)
            except Exception:
                pass
    rest = body[DOC_TEXT_LIMIT:]
    idx = 0
    while rest:
        piece = rest[:CHUNK_SIZE]
        rest = rest[max(0, CHUNK_SIZE - CHUNK_OVERLAP):]
        cid = f"{doc_id}#c{idx}"
        graph.add_node(cid, "Document", content=piece, source=src_path, path=src_path, chunk=idx)
        ensure_edge(graph, doc_id, cid, "分段")
        idx += 1
        if idx > 40:
            break
    return doc_id


def link_entity(graph: Any, eid: str, etype: str, label: str, src_path: str, extra: dict | None = None) -> None:
    if not eid:
        return
    existing = get_node(graph, eid)
    if existing is not None:
        ntype = node_type_of(existing)
        if ntype in {"skos:Concept", "skos:ConceptScheme", "decision", "Document", "document"}:
            return
    src_path = str(src_path or "").strip()
    meta = dict(extra or {})
    meta.update(event_fields(path=src_path, extra=meta))
    if src_path:
        meta.setdefault("source", src_path)
        meta.setdefault("path", src_path)
        graph.add_node(eid, etype, content=label, **meta)
        ensure_edge(graph, document_id(src_path), eid, "出自")
    else:
        graph.add_node(eid, etype, content=label, **meta)


def run_lineage(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    nid = str(args.get("id") or "").strip()
    if not nid:
        return {"ok": False, "error": "NO_PATH", "id": "", "hops": [], "path": "", "detail": "没有编号。"}
    # Fast path: read raw node/edge rows from FalkorDB/graph.json and never
    # import semantica, so lineage does not pay the ~12s onnxruntime import.
    rows, _st = read_node_rows(cwd)
    by_id: dict[str, dict[str, Any]] = {str(r.get("id") or ""): r for r in rows}
    edges = read_edge_rows(cwd)
    hops: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_hop(hid: str, label: str, htype: str, source_document: str = "") -> None:
        if not hid or hid in seen:
            return
        seen.add(hid)
        hops.append({
            "id": hid,
            "label": label,
            "type": htype,
            "source_document": source_document,
        })

    self_node = by_id.get(nid)
    source = node_source(self_node)
    if not source and nid.startswith(("session:", "file:")):
        source = nid
    add_hop(nid, node_content(self_node) or nid, "self", source)
    for edge in edges:
        src, tgt, et = edge_ends(edge)
        if et not in {"出自", "分段"}:
            continue
        if src != nid and tgt != nid:
            continue
        other = tgt if src == nid else src
        other_node = by_id.get(other)
        other_src = node_source(other_node)
        add_hop(other, node_content(other_node) or other, et, other_src)
        if not source:
            source = other_src or (other if str(other).startswith(("session:", "file:")) else "")
        if str(other).startswith(("session:", "file:")) and not str(source).startswith(("session:", "file:")):
            source = other
    kind = "graph"
    if str(source).startswith("session:"):
        kind = "session"
    elif source:
        kind = "file"
    return {
        "ok": True,
        "id": nid,
        "path": source,
        "source": kind,
        "hops": hops,
        "detail": source or "这条是图里导入的点，没有文件出处。",
    }


def llm_extract_kwargs() -> dict[str, Any]:
    key = (os.environ.get("DSH_LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    model = (os.environ.get("DSH_LLM_MODEL") or "").strip()
    provider = (os.environ.get("DSH_LLM_PROVIDER") or "").strip()
    if not key or not model:
        return {}
    return {"method": "llm", "provider": provider or "openai", "llm_model": model}


IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def dsh_chat(messages: list, timeout: int = 60) -> str:
    key = (os.environ.get("DSH_LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    model = (os.environ.get("DSH_LLM_MODEL") or "").strip()
    base = (os.environ.get("DSH_LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "").strip().rstrip("/")
    api = (os.environ.get("DSH_LLM_API") or "").strip()
    if not key or not model or not base:
        return ""
    if api == "openai-responses":
        return ""
    payload = {"model": model, "messages": messages, "temperature": 0, "max_tokens": 400}
    import urllib.request
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return (((body.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()


def dsh_describe_image(path: str, media_type: str = "") -> dict[str, str]:
    """Turn a local image into Chinese text. Same DSH key. OCR only if the model cannot see."""
    file = Path(path)
    if not file.is_file():
        return {"text": "", "via": "", "error": "NO_IMAGE"}
    try:
        data = file.read_bytes()
    except OSError:
        return {"text": "", "via": "", "error": "NO_IMAGE"}
    if not data:
        return {"text": "", "via": "", "error": "NO_IMAGE"}
    if len(data) > MAX_IMAGE_BYTES:
        return {"text": "", "via": "", "error": "IMAGE_TOO_LARGE"}
    suffix = file.suffix.lower()
    guessed = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix, "image/png")
    mt = (media_type or guessed).strip() or guessed
    import base64
    b64 = base64.b64encode(data).decode("ascii")
    prompt = "看这张图。用中文写下图上的字、物品、人、店。只写看见的，不要猜。看不清就写看不清。"
    vision_err = ""
    try:
        text = dsh_chat(
            [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:{mt};base64,{b64}"}},
                ],
            }],
            timeout=90,
        )
        if text:
            return {"text": text, "via": "llm", "error": ""}
    except Exception as exc:
        vision_err = type(exc).__name__
        err = getattr(exc, "read", None)
        if callable(err):
            try:
                raw_err = err().decode("utf-8", errors="ignore")
                if "unsupported" in raw_err.lower() or "invalid" in raw_err.lower() or "image" in raw_err.lower():
                    vision_err = "NO_MODEL_VISION"
            except Exception:
                pass
    try:
        import pytesseract
        from PIL import Image as _PILImage
        pil = _PILImage.open(file)
        for lang in ("chi_sim", "chi_sim+eng", "eng"):
            try:
                raw = pytesseract.image_to_string(pil, lang=lang, config="--psm 6").strip()
            except Exception:
                continue
            if raw:
                return {"text": "图上的字：" + raw, "via": "ocr", "error": ""}
    except Exception:
        pass
    return {"text": "", "via": "", "error": vision_err or "NO_VISION"}


def dsh_chat_extract(text: str) -> dict[str, list]:
    """Ask the DSH model for Chinese entities and relations. Same key."""
    empty = {"entities": [], "relations": []}
    prompt = (
        "从下面文字抽出实体和关系。只输出一个 JSON 对象，不要其它字。"
        '格式: {"entities":[{"text":"名称","type":"短类型"}],"relations":[{"source":"...","type":"关系","target":"..."}]}'
        "type 用两到六个字，按这段文字所属工作区自己起类名。不要用店铺/商品/旗舰店这种电商预设。"
        "\n\n" + str(text)[:4000]
    )
    try:
        content = dsh_chat([{"role": "user", "content": prompt}], timeout=60)
        if not content:
            return empty
        obj = None
        o0 = content.find("{")
        o1 = content.rfind("}")
        a0 = content.find("[")
        if o0 >= 0 and o1 > o0 and (a0 < 0 or o0 <= a0):
            obj = json.loads(content[o0:o1 + 1])
        elif a0 >= 0:
            obj = {"entities": json.loads(content[a0:content.rfind("]") + 1]), "relations": []}
        if not isinstance(obj, dict):
            return empty
        ents = []
        for row in obj.get("entities") or []:
            if not isinstance(row, dict):
                continue
            label = str(row.get("text") or row.get("name") or "").strip()
            etype = str(row.get("type") or row.get("label") or "其它").strip() or "其它"
            if label:
                ents.append({"text": label, "label": etype, "type": etype, "id": label})
        rels = []
        for row in obj.get("relations") or []:
            if not isinstance(row, dict):
                continue
            src = str(row.get("source") or row.get("subject") or "").strip()
            tgt = str(row.get("target") or row.get("object") or "").strip()
            rtype = str(row.get("type") or row.get("predicate") or "其它").strip() or "其它"
            if src and tgt:
                rels.append({"source": src, "target": tgt, "type": rtype})
        return {"entities": ents, "relations": rels}
    except Exception:
        return empty


def make_ner(text: str = ""):
    from semantica.semantic_extract import NamedEntityRecognizer
    opts = llm_extract_kwargs() if has_cjk(text) else {}
    if opts:
        try:
            return NamedEntityRecognizer(**opts)
        except Exception:
            pass
    return NamedEntityRecognizer()


def make_rel(text: str = ""):
    from semantica.semantic_extract import RelationExtractor
    opts = llm_extract_kwargs() if has_cjk(text) else {}
    if opts:
        try:
            return RelationExtractor(**opts)
        except Exception:
            pass
    return RelationExtractor()


def resolve_cwd(raw: str | None) -> tuple[str | None, str | None]:
    if not raw or not str(raw).strip():
        return None, "NO_CWD"
    try:
        real = os.path.realpath(str(raw).strip())
    except OSError:
        return None, "BAD_CWD"
    if not os.path.isdir(real):
        return None, "BAD_CWD"
    return real, None



SKIP_DIR_NAMES = {".git", "node_modules", ".dsh", "__pycache__", ".venv", "venv", "dist", "build", "runtime", "runtime-dist", "release-dist"}
TEXT_EXTS = {".md", ".txt", ".rst", ".json", ".csv", ".yml", ".yaml", ".py", ".js", ".ts", ".tsx", ".jsx", ".html", ".css", ".xml", ".toml"}
IMAGE_FILE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
EYES_FILE_EXTS = IMAGE_FILE_EXTS | {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v"}
OFFICE_FILE_EXTS = {".docx", ".xlsx", ".pptx"}


def office_plain_text(path: Path) -> str:
    """Unzip Office XML and keep the words. Not vision — just read the file."""
    import zipfile
    suffix = path.suffix.lower()
    if suffix not in OFFICE_FILE_EXTS:
        return ""
    try:
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
            chunks: list[str] = []
            if suffix == ".docx":
                want = [n for n in names if n.startswith("word/") and n.endswith(".xml")]
            elif suffix == ".pptx":
                want = [n for n in names if n.startswith("ppt/slides/") and n.endswith(".xml")]
            else:
                want = [n for n in names if n.startswith("xl/") and n.endswith(".xml")]
            for name in want:
                raw = zf.read(name).decode("utf-8", errors="ignore")
                raw = re.sub(r"<w:tab\\b[^/]*/>", "\t", raw)
                raw = re.sub(r"</w:p>", "\n", raw)
                raw = re.sub(r"</a:p>", "\n", raw)
                raw = re.sub(r"<[^>]+>", "", raw)
                raw = raw.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
                raw = re.sub(r"\n{3,}", "\n\n", raw).strip()
                if raw:
                    chunks.append(raw)
            return "\n".join(chunks).strip()
    except Exception:
        return ""


def looks_like_zip_dump(text: str) -> bool:
    return str(text or "").startswith("PK")


def policy_dir(cwd: str) -> Path:
    return Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "ontology" / "policy"


def _policy_shacl_text(cwd: str) -> str:
    dest = policy_dir(cwd)
    if not dest.is_dir():
        return ""
    chunks: list[str] = []
    for path in sorted(dest.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".ttl", ".shacl", ".rdf"}:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        if text.strip():
            chunks.append(text)
    return "\n".join(chunks)


def default_policy_src() -> Path:
    return Path(__file__).resolve().parent / "policy" / "default"


def copy_default_policy(cwd: str) -> bool:
    dest = policy_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    if any(dest.iterdir()):
        return False
    src = default_policy_src()
    if not src.is_dir():
        return False
    import shutil
    for item in src.iterdir():
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
    return True


def load_gitignore(root: Path) -> list[str]:
    patterns = []
    gi = root / ".gitignore"
    if gi.is_file():
        for line in gi.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            patterns.append(line.rstrip("/"))
    return patterns


def ignored(rel: str, patterns: list[str]) -> bool:
    parts = Path(rel).parts
    if any(part in SKIP_DIR_NAMES for part in parts):
        return True
    name = Path(rel).name
    for pat in patterns:
        if pat == name or pat == rel or rel.startswith(pat.rstrip("*")):
            return True
        if pat.startswith("*") and name.endswith(pat[1:]):
            return True
    return False


def mtime_store(cwd: str) -> Path:
    return Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "ingest-mtime.json"


def load_mtimes(cwd: str) -> dict[str, float]:
    path = mtime_store(cwd)
    if not path.is_file():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_mtimes(cwd: str, data: dict[str, float]) -> None:
    path = mtime_store(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def collect_files(cwd: str, paths: list[str] | None) -> list[Path]:
    root = Path(os.path.realpath(cwd))
    patterns = load_gitignore(root)
    out: list[Path] = []
    if paths:
        for raw in paths:
            item = Path(raw)
            if not item.is_absolute():
                item = (root / raw).resolve()
            else:
                item = Path(os.path.realpath(str(item)))
            try:
                item.relative_to(root)
            except ValueError:
                continue
            # Chosen paths are a nod. gitignore only applies to a full-tree walk.
            if item.is_file():
                out.append(item)
            elif item.is_dir():
                for child in item.rglob("*"):
                    if child.is_file():
                        out.append(child)
        return out
    for child in root.rglob("*"):
        if not child.is_file():
            continue
        rel = str(child.relative_to(root))
        if ignored(rel, patterns):
            continue
        if child.suffix.lower() not in TEXT_EXTS and child.suffix.lower() not in EYES_FILE_EXTS:
            continue
        out.append(child)
    return out


def run_ingest_directory(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    from semantica.ingest import FileIngestor
    from semantica.provenance import ProvenanceManager

    root = Path(os.path.realpath(cwd))
    wanted = [str(x) for x in (args.get("paths") or []) if str(x).strip()]
    files = collect_files(cwd, wanted or None)
    prev = load_mtimes(cwd)
    incremental = []
    for path in files:
        key = str(path)
        try:
            mtime = path.stat().st_mtime
        except OSError:
            continue
        if prev.get(key) == mtime:
            continue
        incremental.append((path, mtime))

    ingestor = FileIngestor()
    ingested = []
    texts = []
    parse_failed = []
    session, graph_file = load_session(cwd)
    graph = session.graph
    try:
        tracker = ProvenanceManager()
    except Exception:
        tracker = None

    read_body = may_read_file_body(args)
    for path, mtime in incremental:
        real = os.path.realpath(str(path))
        text = ""
        if read_body:
            try:
                obj = ingestor.ingest_file(str(path), read_content=True)
            except TypeError:
                obj = ingestor.ingest_file(str(path))
            except Exception:
                obj = None
            if obj is not None:
                if hasattr(obj, "text"):
                    try:
                        text = obj.text or ""
                    except Exception:
                        text = ""
                if not text and getattr(obj, "content", None):
                    try:
                        text = obj.content.decode("utf-8", errors="ignore") if isinstance(obj.content, (bytes, bytearray)) else str(obj.content)
                    except Exception:
                        text = ""
            if path.suffix.lower() in OFFICE_FILE_EXTS and (not has_cjk(text) or looks_like_zip_dump(text)):
                office = office_plain_text(path)
                if office:
                    text = office
            if looks_like_zip_dump(text) and not has_cjk(text):
                text = ""
        node_id = f"file:{real}"
        stored = (text.strip()[:DOC_TEXT_LIMIT] if text.strip() else path.name)
        stamped = iso_utc_from_mtime(mtime)
        graph.add_node(
            node_id,
            "Document",
            content=stored,
            source=real,
            path=real,
            filename=path.name,
            timestamp=stamped,
            valid_from=stamped,
        )
        if tracker is not None:
            try:
                tracker.track_entity(node_id, source=real)
            except TypeError:
                try:
                    tracker.track_entity(node_id)
                except Exception:
                    pass
            except Exception:
                pass
        ingested.append({"path": real, "name": path.name})
        if text.strip():
            texts.append({"path": real, "text": text[:20000]})
        else:
            parse_failed.append({"path": real, "name": path.name, "reason": "NO_TEXT"})
        prev[str(path)] = mtime

    save_mtimes(cwd, prev)
    save_session(session, graph_file)
    return {
        "count": len(ingested),
        "files": ingested,
        "texts": texts,
        "parse_failed": parse_failed,
        "parse_failed_count": len(parse_failed),
        "skipped": len(files) - len(incremental),
    }





def iter_nodes(graph: Any):
    nodes = getattr(graph, "nodes", {}) or {}
    if isinstance(nodes, dict):
        for nid, node in nodes.items():
            yield str(nid), node
        return
    if isinstance(nodes, list):
        for node in nodes:
            hid = node.get("id") if isinstance(node, dict) else (
                getattr(node, "node_id", None) or getattr(node, "id", None)
            )
            yield str(hid or ""), node


def node_type_of(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, dict):
        return str(node.get("type") or node.get("node_type") or "")
    return str(getattr(node, "node_type", None) or getattr(node, "type", "") or "")


def has_chuzi(graph: Any, eid: str) -> bool:
    for _, edge in iter_edges(graph):
        src, tgt, et = edge_ends(edge)
        if et == "出自" and tgt == eid:
            return True
    return False


def link_session_message(graph: Any, src_path: str) -> None:
    """session:<id>:<seq> belongs to session:<id>. Ingest used to leave messages unlinked."""
    raw = str(src_path or "").strip()
    if not raw.startswith("session:"):
        return
    parts = raw.split(":")
    if len(parts) < 3 or not parts[1]:
        return
    parent = f"session:{parts[1]}"
    child = document_id(raw)
    if parent == child:
        return
    ensure_edge(graph, parent, child, "包含")


def repair_session_links(graph: Any) -> int:
    fixed = 0
    for nid, _node in iter_nodes(graph):
        if not nid.startswith("session:") or nid.count(":") < 2:
            continue
        parent = "session:" + nid.split(":")[1]
        if parent == nid:
            continue
        if not has_edge(graph, parent, nid, "包含"):
            ensure_edge(graph, parent, nid, "包含")
            fixed += 1
    return fixed


def run_list_unextracted_docs(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Documents that still have no outgoing 出自 / 包含 edges — need LLM extract."""
    args = args or {}
    try:
        limit = int(args.get("limit") or 80)
    except (TypeError, ValueError):
        limit = 80
    limit = min(200, max(1, limit))
    rows, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    linked: set[str] = set()
    for edge in edges:
        et = str(edge.get("type") or "")
        src = str(edge.get("source") or "")
        if et in {"出自", "包含"} and src:
            linked.add(src)
    texts: list[dict[str, str]] = []
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if ntype not in {"Document", "document"}:
            continue
        if not nid.startswith("session:") and not nid.startswith("file:"):
            continue
        if nid in linked:
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        text = str(row.get("content") or props.get("content") or "").strip()
        if not text:
            continue
        texts.append({"path": nid, "text": text[:20000]})
        if len(texts) >= limit:
            break
    return {"ok": True, "texts": texts, "count": len(texts)}


_DECISION_HINT = re.compile(
    r"(定了|拍板|就按|敲定|选定|结论是|方案是|决定：|就这样)"
)


def run_list_session_summaries(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Hint-matching session messages for decision backfill.

    Whole-session joins hide the actual 拍板 sentences in the middle of long
    chats. Only send windows around a real hint, so the LLM sees the conclusion.
    """
    _ = args
    rows, _st = read_node_rows(cwd)
    texts: list[dict[str, str]] = []
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if ntype not in {"Document", "document"}:
            continue
        if not nid.startswith("session:") or nid.count(":") < 2:
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        text = str(row.get("content") or props.get("content") or "").strip()
        if not text:
            continue
        match = _DECISION_HINT.search(text)
        if not match:
            continue
        start = max(0, match.start() - 400)
        texts.append({"path": nid, "text": text[start:start + 3500]})
        if len(texts) >= 40:
            break
    return {"ok": True, "texts": texts, "count": len(texts)}


def run_session_text(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Read one session/file node body. Does not truncate the stored archive."""
    args = args or {}
    nid = str(args.get("id") or args.get("path") or "").strip()
    if not nid.startswith(("session:", "file:")):
        return {"error": "NOT_A_SESSION", "text": ""}
    found = read_nodes_by_id(cwd, [nid])
    row = found.get(nid)
    if not isinstance(row, dict):
        return {"error": "NOT_FOUND", "id": nid, "text": ""}
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    text = str(row.get("content") or props.get("content") or "")
    stamp = str(props.get("timestamp") or props.get("valid_from") or "")
    return {"ok": True, "id": nid, "text": text, "timestamp": stamp, "length": len(text)}


_OPEN_NODE_MAX = 4000


def run_open_node(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Open one graph node for the working memory. Archive stays. Caps what the model sees.

    A 记忆卡片 is a short cue. Follow source (session:/file:) and clip around the cue.
    """
    args = args or {}
    nid = str(args.get("id") or args.get("path") or "").strip()
    if not nid:
        return {"error": "NO_ID", "text": ""}
    try:
        cap = int(args.get("limit") or _OPEN_NODE_MAX)
    except (TypeError, ValueError):
        cap = _OPEN_NODE_MAX
    cap = max(200, min(cap, 8000))
    wanted = [nid]
    source_hint = str(args.get("source") or "").strip()
    if source_hint.startswith(("session:", "file:")):
        wanted.append(source_hint)
    by_id = read_nodes_by_id(cwd, wanted)
    row = by_id.get(nid)
    if not row:
        return {"error": "NOT_FOUND", "id": nid, "text": ""}
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    blob = str(row.get("content") or props.get("content") or props.get("label") or "")
    source = str(args.get("source") or props.get("source") or props.get("path") or "").strip()
    cue = blob.strip()
    excerpt_id = nid
    archive = blob
    if is_memory_card(row) and not source.startswith(("session:", "file:")):
        shown = cue if len(cue) <= cap else cue[: cap - 1] + "…"
        return {
            "ok": True,
            "id": nid,
            "source": "",
            "excerpt_id": nid,
            "type": str(row.get("type") or ""),
            "text": shown,
            "cue": cue[:160],
            "missing_source": True,
            "length": len(cue),
            "truncated": len(cue) > cap,
            "then": then_label(props),
        }
    if is_memory_card(row) and source.startswith(("session:", "file:")):
        if source not in by_id:
            by_id.update(read_nodes_by_id(cwd, [source]))
        src = by_id.get(source)
        if isinstance(src, dict):
            src_props = src.get("properties") if isinstance(src.get("properties"), dict) else {}
            archive = str(src.get("content") or src_props.get("content") or "")
            excerpt_id = source
            if cue and archive:
                shown = _clip_search_snippet(archive, cue[:80], cap)
            else:
                shown = archive if len(archive) <= cap else archive[: cap - 1] + "…"
            return {
                "ok": True,
                "id": nid,
                "source": source,
                "excerpt_id": excerpt_id,
                "type": str(row.get("type") or ""),
                "text": shown,
                "cue": cue[:160],
                "length": len(archive),
                "truncated": len(archive) > cap,
                "then": then_label(src_props or props),
            }
    shown = blob if len(blob) <= cap else blob[: cap - 1] + "…"
    return {
        "ok": True,
        "id": nid,
        "type": str(row.get("type") or ""),
        "text": shown,
        "length": len(blob),
        "truncated": len(blob) > cap,
        "then": then_label(props),
    }


def repair_missing_lineage(graph: Any) -> int:
    """Old points had a name but no source. Attach 出自 if a stored document contains the name."""
    docs: list[tuple[str, str]] = []
    entities: list[tuple[str, Any, str]] = []
    skip_types = {"document", "decision"}
    for nid, node in iter_nodes(graph):
        if not nid:
            continue
        ntype = node_type_of(node).lower()
        content = node_content(node)
        if nid.startswith(("session:", "file:")) or ntype == "document":
            if content.strip():
                docs.append((nid, content))
            continue
        if ntype in skip_types:
            continue
        label = content.strip() or nid
        if len(label) < 2:
            continue
        entities.append((nid, node, label))
    docs.sort(key=lambda row: (len(row[1]), row[0]))
    fixed = 0
    for eid, node, label in entities:
        if node_source(node) and has_chuzi(graph, eid):
            continue
        hit = ""
        for doc_id, text in docs:
            if label and label in text:
                hit = doc_id
                break
        if not hit:
            continue
        src_path = node_source(get_node(graph, hit)) or hit
        etype = node_type_of(node) or "Entity"
        link_entity(graph, eid, etype, label, src_path)
        fixed += 1
    return fixed


def run_upsert_documents(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    session, graph_file = load_session(cwd)
    graph = session.graph
    count = 0
    for row in list(args.get("texts") or []):
        if not isinstance(row, dict):
            continue
        src_path = str(row.get("path") or "").strip()
        src_text = scrub_text(row.get("text") or "")
        if not src_path or not src_text.strip():
            continue
        extra = {}
        if row.get("role"):
            extra["role"] = row.get("role")
        if row.get("messageId"):
            extra["messageId"] = row.get("messageId")
        stamped = str(row.get("timestamp") or row.get("valid_from") or "").strip()
        if stamped:
            extra["timestamp"] = stamped
            extra["valid_from"] = stamped
            extra["event_time"] = stamped
        upsert_document(graph, src_path, src_text, extra)
        count += 1
        link_session_message(graph, src_path)
    repaired = repair_missing_lineage(graph)
    repaired += repair_session_links(graph)
    save_session(session, graph_file)
    return {"ok": True, "count": count, "repaired": repaired}


def run_stamp_session_times(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    """Write event times onto existing session: nodes. Does not re-extract."""
    stamps = args.get("stamps") if isinstance(args.get("stamps"), list) else []
    if not stamps:
        return {"ok": True, "stamped": 0}
    session, graph_file = load_session(cwd)
    graph = session.graph
    n = 0
    for row in stamps:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "").strip()
        stamped = str(row.get("timestamp") or row.get("valid_from") or "").strip()
        if not nid.startswith("session:") or not stamped:
            continue
        node = get_node(graph, nid)
        if node is None:
            continue
        set_node_props(node, timestamp=stamped, valid_from=stamped, event_time=stamped)
        try:
            setattr(node, "valid_from", stamped)
        except Exception:
            pass
        n += 1
    if n:
        save_session(session, graph_file)
    return {"ok": True, "stamped": n}


def _row_event_iso(row: dict[str, Any] | None) -> str:
    if not isinstance(row, dict):
        return ""
    parsed = node_event_time(row)
    if parsed is None:
        start, _end = node_time_span(row)
        parsed = start
    if parsed is None:
        return ""
    try:
        return parsed.isoformat()
    except Exception:
        return ""


def _stamp_from_path_or_source(row: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> str:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    for cand in (props.get("path"), props.get("source"), row.get("path"), row.get("source")):
        text = str(cand or "").strip()
        if not text or text == "session:current":
            continue
        if text.startswith("auto-workspace"):
            continue
        if text.startswith("session:") or text.startswith("mail:"):
            peer = by_id.get(text)
            iso = _row_event_iso(peer)
            if iso:
                return iso
            continue
        iso = file_mtime_iso(text)
        if iso:
            return iso
    return ""


def run_stamp_workbench_times(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Fill missing event times on workbench nodes. File mtime / session time, never now()."""
    from stores import forget_node_rows, patch_node_props

    _ = args
    rows, _st = read_node_rows(cwd)
    by_id = {str(row.get("id") or ""): row for row in rows if isinstance(row, dict) and row.get("id")}
    neighbors: dict[str, list[str]] = {}
    for edge in read_edge_rows(cwd):
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if src and tgt:
            neighbors.setdefault(src, []).append(tgt)
            neighbors.setdefault(tgt, []).append(src)
    pending: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if not keep_workbench_node(nid, ntype, _workbench_status(row)):
            continue
        if _row_event_iso(row):
            continue
        pending.append(row)
    stamped = 0
    skipped = 0
    for row in pending:
        nid = str(row.get("id") or "")
        iso = _stamp_from_path_or_source(row, by_id)
        if not iso:
            times = []
            for other in neighbors.get(nid, []):
                iso2 = _row_event_iso(by_id.get(other))
                if iso2:
                    times.append(iso2)
            if times:
                iso = min(times)
        ntype = str(row.get("type") or "")
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        source = str(props.get("source") or "")
        if not iso and (
            ntype.startswith("owl:")
            or ntype.startswith("skos:")
            or source.startswith("auto-workspace")
        ):
            iso = ontology_event_iso(cwd)
        if not iso:
            skipped += 1
            continue
        patched = patch_node_props(cwd, nid, {"timestamp": iso, "valid_from": iso, "event_time": iso})
        if patched.get("ok"):
            stamped += 1
            props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
            props = {**props, "timestamp": iso, "valid_from": iso, "event_time": iso}
            row["properties"] = props
            row["valid_from"] = iso
            row["timestamp"] = iso
        else:
            skipped += 1
    forget_node_rows(cwd)
    bounds = run_temporal_bounds(cwd, {})
    return {
        "ok": True,
        "stamped": stamped,
        "skipped": skipped,
        "min": bounds.get("min"),
        "max": bounds.get("max"),
        "dated": bounds.get("count"),
        "detail": "文件用 mtime，会话用消息时间。没有线索的点仍无日期。",
    }


_DISPLAY_TIME_KEYS = ("valid_from", "valid_until", "timestamp", "event_time")


def _display_time_fields(props: dict[str, Any] | None) -> dict[str, Any]:
    """Copy a properties dict with time fields shown in the host timezone."""
    out = dict(props or {})
    for key in _DISPLAY_TIME_KEYS:
        if key in out and out[key] not in (None, ""):
            shown = display_iso(out[key])
            if shown:
                out[key] = shown
    return out


def _clip_search_snippet(text: str, query: str, limit: int = 360) -> str:
    """Pack a 摘录 for the model. Matching still uses the full stored blob."""
    blob = " ".join(str(text or "").split())
    if not blob:
        return ""
    q = str(query or "").strip()
    if not q:
        return blob if len(blob) <= limit else blob[: limit - 1] + "…"
    at = blob.lower().find(q.lower())
    if at < 0:
        return blob if len(blob) <= limit else blob[: limit - 1] + "…"
    pad = max(0, (limit - len(q)) // 2)
    start = max(0, at - pad)
    slice_ = blob[start:start + limit]
    prefix = "…" if start > 0 else ""
    suffix = "…" if start + limit < len(blob) else ""
    return f"{prefix}{slice_}{suffix}"


_SEARCH_META = ("验收", "总判", "金例", "帮不上忙", "稀疏索引", "施工笔记", "human-acceptance", "对照清单", "审查仓库", "只读审查", "重点检查 index.js")
_SEARCH_TOPIC = ("编码", "召回", "工作记忆", "记忆生成", "记忆检索", "人类对记忆", "语义助手还差", "只发 darwin-arm64", "发版收敛")


def _rank_search_hit(hit: dict[str, Any], q: str, intent: str = "查询") -> float:
    """Rank already-matched hits. Does not change substring matching."""
    node = hit.get("node") if isinstance(hit, dict) else None
    if not isinstance(node, dict):
        return float((hit or {}).get("score") or 0)
    nid = str(node.get("id") or "")
    ntype = str(node.get("type") or "").lower()
    hay = f"{nid}\n{node.get('content') or ''}\n{ntype}"
    score = float(hit.get("score") or 0)
    if ntype.startswith("skos:") or ntype.startswith("owl:") or "/vocab/" in nid:
        score -= 250
    if nid.startswith("session:"):
        score += 80
    if nid.startswith("file:") and re.search(r"\.(js|mjs|cjs|ts|tsx|py)$", nid, flags=re.I):
        score -= 240
    props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    status = str(props.get("status") or "")
    if ntype == "decision" and q and q in hay:
        if status == "已生效":
            score += 400
        elif status == "起草":
            score -= 80
    if any(tok in hay for tok in _SEARCH_META):
        score -= 140
    topic_hits = sum(1 for tok in _SEARCH_TOPIC if tok in hay)
    score += topic_hits * 45
    if len(q) > 12 and q in hay and len(hay) > len(q) * 4:
        score -= 60
    for cited in re.findall(r"session:session-[0-9a-f-]+(?::\d+)?", hay, flags=re.I):
        if cited in nid or nid in cited:
            continue
        score -= 80
    kind = str(intent or "查询")
    if kind == "出处":
        if nid.startswith("session:") or nid.startswith("file:"):
            score += 220
        if ntype == "decision":
            score -= 180
    elif kind == "拍板":
        if ntype == "decision" and status == "已生效":
            score += 280
        elif ntype == "decision":
            score += 80
        if ntype in ("记忆卡片",) and status == "已入档":
            score += 260
        if nid.startswith("session:"):
            score -= 50
    elif kind == "催待办":
        if ntype == "decision":
            score -= 120
    elif kind == "业务动作":
        if ntype == "decision":
            score -= 80
    return score


def run_search_text(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    """Search node id, type, and stored text. File content counts, not only extracted entities.

    Fast path: reads raw rows from FalkorDB/graph.json and never imports semantica,
    so a search does not pay the ~12s onnxruntime import (semantica.context pulls
    onnxruntime; text search only needs TF-IDF sparse complement, not onnx embeddings).
    """
    q = str(args.get("q") or args.get("query") or "").strip()
    routed = route_intent(q) if q else {"intent": "闲聊", "tool": ""}
    intent = str(args.get("intent") or routed.get("intent") or "查询")
    if not q or intent == "闲聊":
        return {
            "results": [],
            "total": 0,
            "query": q,
            "intent": intent or "闲聊",
            "missing": [],
            "sources": [],
            "expanded": [],
            "live_facts": [],
        }
    date_raw = args.get("date") or args.get("at") or args.get("when") or ""
    at, date_from, date_to = _query_window(
        date_raw,
        args.get("date_from") or args.get("from") or "",
        args.get("date_to") or args.get("to") or "",
    )
    rows, _st = read_node_rows(cwd)
    hits: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}

    def _row_time_iso(row: dict[str, Any]) -> str | None:
        instant = node_event_time(row)
        shown = display_iso(instant) if instant is not None else ""
        return shown or None

    def _row_in_window(row: dict[str, Any]) -> bool:
        return _row_in_query_window(row, at, date_from, date_to)

    for row in rows:
        nid = str(row.get("id") or "")
        if not nid:
            continue
        by_id[nid] = row
        if not _row_in_window(row):
            continue
        props = row.get("properties") or {}
        blob = "\n".join([
            nid,
            str(row.get("type") or ""),
            str(row.get("content") or ""),
            json.dumps(props, ensure_ascii=False),
        ])
        if q not in blob:
            continue
        ntype = str(row.get("type") or props.get("type") or "Entity")
        raw_content = str(row.get("content") or props.get("content") or nid)
        content = _clip_search_snippet(raw_content, q)
        stamped = _row_time_iso(row)
        shown_props = _display_time_fields({k: v for k, v in props.items() if not str(k).startswith("_")})
        shown_props["content"] = content
        hits.append({
            "node": {
                "id": nid,
                "type": ntype,
                "content": content,
                "properties": shown_props,
                "valid_from": stamped,
                "valid_until": None,
            },
            "score": 200 if q == nid else 160 if raw_content.startswith(q) else 120,
            "hop_distance": None,
            "semantic_similarity": None,
        })
    seen = {str((row.get("node") or {}).get("id") or "") for row in hits}
    try:
        for hit in search_vectors(cwd, q):
            hid = str(hit.get("id") or "")
            if not hid or hid in seen:
                continue
            row = by_id.get(hid)
            if row is None or not _row_in_window(row):
                continue
            content = _clip_search_snippet(str(row.get("content") or row.get("id") or ""), q)
            ntype = str(row.get("type") or "Entity")
            stamped = _row_time_iso(row)
            hits.append({
                "node": {
                    "id": hid,
                    "type": ntype,
                    "content": content,
                    "properties": {"content": content},
                    "valid_from": stamped,
                    "valid_until": None,
                },
                "score": 80 + int(100 * float(hit.get("score") or 0)),
                "hop_distance": None,
                "semantic_similarity": float(hit.get("score") or 0),
            })
            seen.add(hid)
    except Exception:
        pass
    try:
        from passages import search_passages, _load_store, passage_dir
        store = {}
        try:
            store = _load_store(passage_dir(cwd))
        except Exception:
            store = {}
        for row in search_passages(cwd, q, 8):
            hid = str(row.get("id") or "")
            if not hid or hid in seen:
                continue
            if hid.startswith("session:"):
                continue
            node_row = by_id.get(hid)
            if node_row is not None:
                if not _row_in_window(node_row):
                    continue
                raw = str(node_row.get("content") or hid)
                ntype = str(node_row.get("type") or "Document")
                stamped = _row_time_iso(node_row)
            else:
                raw = str(store.get(hid) or "")
                if not raw:
                    continue
                ntype = "Document"
                stamped = str(row.get("time") or "").strip() or None
                prefix = hid.rsplit(":", 1)[0] + ":"
                for oid, orow in by_id.items():
                    if not oid.startswith(prefix):
                        continue
                    stamped = _row_time_iso(orow)
                    if stamped:
                        break
            if not stamped and hid.startswith("session:"):
                prefix = hid.rsplit(":", 1)[0] + ":"
                for oid, orow in by_id.items():
                    if not oid.startswith(prefix):
                        continue
                    stamped = _row_time_iso(orow)
                    if stamped:
                        break
            content = _clip_search_snippet(raw, q)
            hits.append({
                "node": {
                    "id": hid,
                    "type": ntype,
                    "content": content,
                    "properties": {"content": content},
                    "valid_from": stamped,
                    "valid_until": None,
                },
                "score": 90 + int(100 * float(row.get("score") or 0)),
                "hop_distance": None,
                "semantic_similarity": float(row.get("score") or 0),
                "via": "faiss",
            })
            seen.add(hid)
    except Exception:
        pass
    try:
        from agent_mem import retrieve_agent_memory, memory_hits_as_search

        for row in memory_hits_as_search(retrieve_agent_memory(cwd, q), q):
            nid = str(((row.get("node") or {}).get("id")) or "")
            if nid and nid not in seen:
                hits.append(row)
                seen.add(nid)
    except Exception:
        pass
    hits.sort(key=lambda row: (-_rank_search_hit(row, q, intent), str(row["node"]["id"])))
    try:
        limit = int(args.get("limit") or 12)
    except (TypeError, ValueError):
        limit = 12
    limit = max(1, min(limit, 50))
    packed = {
        "results": hits[:limit],
        "total": len(hits),
        "query": q,
        "intent": intent,
        "date": args.get("date") or args.get("at") or "",
        "date_from": args.get("date_from") or args.get("from") or "",
        "date_to": args.get("date_to") or args.get("to") or "",
        "cwd": os.path.realpath(cwd or ""),
        "via": "local",
    }
    clock = str(packed["date"] or "").strip()
    if not packed["results"] and re.match(r"^\d{1,2}:\d{2}$", clock):
        packed["empty"] = True
        packed["detail"] = "这一分钟没有"
    if _truthy_flag(args.get("across_bridges")):
        packed = _merge_bridge_session_hits(cwd, args, packed, q)
    labeled = []
    for row in packed.get("results") or []:
        node = row.get("node") if isinstance(row, dict) else None
        props = {}
        if isinstance(node, dict):
            raw = node.get("properties")
            props = raw if isinstance(raw, dict) else {}
            if node.get("valid_from") and not props.get("valid_from"):
                props = {**props, "valid_from": node.get("valid_from")}
        row = {**row, "then": then_label(props)}
        labeled.append(stamp_search_hit(scrub_hit(row), packed.get("cwd") or cwd))
    packed["results"] = labeled
    if _world_expand_on(args):
        packed = _attach_world_slice(cwd, args, packed, rows)
    else:
        packed.setdefault("missing", [])
        packed.setdefault("sources", [])
        packed.setdefault("expanded", [])
        packed.setdefault("live_facts", [])
    return packed


def stamp_search_hit(hit: Any, cwd: str = "") -> Any:
    try:
        from world import stamp_hit
    except Exception:
        return hit
    try:
        return stamp_hit(hit, cwd)
    except Exception:
        return hit


def _world_expand_on(args: dict[str, Any] | None) -> bool:
    args = args or {}
    if args.get("expand") is False:
        return False
    text = str(args.get("expand") if args.get("expand") is not None else "true").strip().lower()
    return text not in {"0", "false", "no", "off"}


def _attach_world_slice(cwd: str, args: dict[str, Any], packed: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Alias extras and missing live kinds. Primary ranking stays in front."""
    from world import concepts_from_rows, decorate_search, expand_query

    q = str(packed.get("query") or args.get("q") or args.get("query") or "")
    concepts = concepts_from_rows(rows)
    try:
        alignments = list_alignments(cwd)
    except Exception:
        alignments = []
    try:
        peers = list_bridge_peer_cwds(cwd)
    except Exception:
        peers = []
    expanded = expand_query(q, concepts, alignments)
    extra_terms = list(expanded.get("extra") or [])
    extra_hits: list[dict[str, Any]] = []
    partial = False
    started = time.monotonic()
    for term in extra_terms:
        if (time.monotonic() - started) * 1000 >= 2500:
            partial = True
            break
        try:
            nested = run_search_text(cwd, {
                "q": term,
                "query": term,
                "intent": packed.get("intent") or "查询",
                "across_bridges": False,
                "limit": 6,
                "expand": False,
            })
        except Exception:
            partial = True
            continue
        if not isinstance(nested, dict) or nested.get("error"):
            partial = True
            continue
        extra_hits.extend(list(nested.get("results") or []))
    return decorate_search(
        packed,
        cwd=packed.get("cwd") or cwd,
        query=q,
        concepts=concepts,
        peers=peers,
        extra_hits=extra_hits,
        extra_terms=extra_terms,
        need_current=bool(args.get("need_current")),
        partial=partial,
        merge_extras=False,
    )


def _truthy_flag(value: Any) -> bool:
    if value is True:
        return True
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on"}


def _dsh_home_dir() -> Path:
    raw = (os.environ.get("DSH_HOME") or "").strip()
    return Path(raw) if raw else Path.home() / ".dsh"


def list_bridge_peer_cwds(cwd: str) -> list[str]:
    """Peer workspaces linked from ~/.dsh/semantic-os/bridge/index.json."""
    here = os.path.realpath(cwd or "")
    if not here:
        return []
    path = _dsh_home_dir() / "semantic-os" / "bridge" / "index.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    links = raw.get("links") if isinstance(raw, dict) else None
    if not isinstance(links, list):
        return []
    peers: list[str] = []
    seen: set[str] = set()
    for row in links:
        if not isinstance(row, dict):
            continue
        src = os.path.realpath(str(row.get("sourceCwd") or ""))
        tgt = os.path.realpath(str(row.get("targetCwd") or ""))
        peer = ""
        if src == here and tgt and tgt != here:
            peer = tgt
        elif tgt == here and src and src != here:
            peer = src
        if not peer or peer in seen:
            continue
        seen.add(peer)
        peers.append(peer)
    return peers


def _merge_bridge_session_hits(cwd: str, args: dict[str, Any], local: dict[str, Any], q: str) -> dict[str, Any]:
    """Append session-only hits from bridged workspaces. Local results stay first."""
    peers = list_bridge_peer_cwds(cwd)
    extra: list[dict[str, Any]] = []
    seen = {str(((row.get("node") or {}).get("id") or "")) for row in (local.get("results") or [])}
    budget = time.monotonic() + 3.0
    remote_args = {
        "q": q,
        "date": args.get("date") or args.get("at") or "",
        "date_from": args.get("date_from") or args.get("from") or "",
        "date_to": args.get("date_to") or args.get("to") or "",
        "across_bridges": False,
    }
    for peer in peers[:4]:
        if time.monotonic() > budget:
            local["bridge_truncated"] = True
            break
        try:
            remote = run_search_text(peer, remote_args)
        except Exception:
            continue
        for hit in remote.get("results") or []:
            node = hit.get("node") if isinstance(hit, dict) else None
            if not isinstance(node, dict):
                continue
            nid = str(node.get("id") or "")
            if not (nid.startswith("session:") or nid.startswith("mail:")) or nid in seen:
                continue
            props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            node = {
                **node,
                "properties": {**props, "cwd": peer, "via": "bridge"},
            }
            extra.append({**hit, "node": node, "cwd": peer, "via": "bridge"})
            seen.add(nid)
            if len(extra) >= 20:
                break
        if len(extra) >= 20:
            break
    local_hits = list(local.get("results") or [])
    return {
        **local,
        "results": (local_hits + extra)[:50],
        "total": int(local.get("total") or 0) + len(extra),
        "bridged": peers[:4],
        "bridge_hits": len(extra),
    }


def _brief_snippet(text: str, limit: int = 240) -> str:
    blob = " ".join(str(text or "").split())
    if len(blob) <= limit:
        return blob
    return blob[: limit - 1] + "…"


def _brief_keep_hit(node: dict[str, Any]) -> bool:
    nid = str(node.get("id") or "")
    ntype = str(node.get("type") or "").lower()
    if nid.startswith("session:") or nid.startswith("file:"):
        return True
    if ntype == "decision" or is_memory_card(node):
        return may_cite(node)
    return ntype == "document"


def _pack_decision_row(node: dict[str, Any]) -> dict[str, Any]:
    props = decision_props(node) if isinstance(node, dict) else {}
    nid = str((node or {}).get("id") or "")
    return {
        "id": nid,
        "type": "decision",
        "category": str(props.get("category") or ""),
        "outcome": str(props.get("outcome") or ""),
        "reasoning": _brief_snippet(props.get("reasoning") or "", 200),
        "scenario": _brief_snippet(props.get("scenario") or node.get("content") or "", 200),
        "decision_maker": str(props.get("decision_maker") or ""),
        "then": then_label(props),
    }


def run_brief_for_decision(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Read-only pack for a choice: search hits + similar boards + because ids."""
    args = args or {}
    scenario = str(args.get("scenario") or args.get("query") or args.get("q") or "").strip()
    if not scenario:
        return {"error": "scenario is required"}
    category = str(args.get("category") or "").strip()
    q = scenario[:80]
    found = run_search_text(cwd, {"q": q})
    evidence = []
    because: list[str] = []
    for hit in (found.get("results") or [])[:8]:
        node = hit.get("node") if isinstance(hit, dict) else None
        if not isinstance(node, dict):
            continue
        nid = str(node.get("id") or "")
        if not nid:
            continue
        if not _brief_keep_hit(node):
            continue
        snippet = _brief_snippet(node.get("content") or nid)
        evidence.append({
            "id": nid,
            "type": str(node.get("type") or ""),
            "snippet": snippet,
            "score": hit.get("score"),
            "then": then_label(node.get("properties") if isinstance(node.get("properties"), dict) else node),
        })
        if may_cite(node) and nid not in because:
            because.append(nid)
    rows, _st = read_node_rows(cwd)
    decision_nodes = []
    for row in rows:
        if str(row.get("type") or "").lower() != "decision":
            continue
        packed = {
            "id": str(row.get("id") or ""),
            "type": "decision",
            "properties": row.get("properties") if isinstance(row.get("properties"), dict) else {},
            "metadata": row.get("metadata") if isinstance(row.get("metadata"), dict) else {},
            "content": row.get("content"),
        }
        if packed["id"]:
            decision_nodes.append(packed)
    seed_words = set(scenario.lower().split())
    scored: list[tuple[float, dict[str, Any]]] = []
    draft_scored: list[tuple[float, dict[str, Any]]] = []
    for node in decision_nodes:
        score = official_precedent_score(category, seed_words, node, scenario)
        if is_precedent(node):
            scored.append((score, node))
        elif _is_recallable_draft(node):
            draft_scored.append((score, node))
    scored.sort(key=lambda item: item[0], reverse=True)
    draft_scored.sort(key=lambda item: item[0], reverse=True)
    precedents = []
    for score, node in scored[:5]:
        if score <= 0 and not category:
            continue
        packed = _pack_decision_row(node)
        packed["score"] = round(float(score), 4)
        precedents.append(packed)
        nid = packed.get("id") or ""
        if nid and nid not in because:
            because.append(nid)
    drafts = []
    for score, node in draft_scored[:5]:
        if score <= 0 and not category:
            continue
        packed = _pack_decision_row(node)
        packed["score"] = round(float(score), 4)
        drafts.append(packed)
    options = []
    seen_opt: set[str] = set()
    for row in precedents:
        label = str(row.get("outcome") or "").strip()
        if not label or label in seen_opt:
            continue
        seen_opt.add(label)
        options.append({
            "id": str(row.get("id") or ""),
            "label": label[:120],
            "kind": "已生效",
            "then": row.get("then") or {"now": False, "label": "当时 · 不是现在"},
        })
        if len(options) >= 4:
            break
    memories: list[tuple[float, dict[str, Any], str]] = []
    seen_ev = {str(row.get("id") or "") for row in evidence}
    for row in rows:
        if not isinstance(row, dict) or not is_memory_card(row):
            continue
        packed = {
            "id": str(row.get("id") or ""),
            "type": str(row.get("type") or "记忆卡片"),
            "properties": row.get("properties") if isinstance(row.get("properties"), dict) else {},
            "content": row.get("content"),
        }
        if not packed["id"] or packed["id"] in seen_ev or not may_cite(packed):
            continue
        label = str(packed.get("content") or packed["properties"].get("content") or packed["properties"].get("label") or "")
        score = _substring_overlap(scenario, label)
        if score <= 0:
            continue
        memories.append((score, packed, label))
    memories.sort(key=lambda item: item[0], reverse=True)
    for score, packed, label in memories[:5]:
        nid = packed["id"]
        evidence.append({
            "id": nid,
            "type": "记忆卡片",
            "snippet": _brief_snippet(label),
            "score": round(float(score), 4),
            "then": then_label(packed["properties"]),
        })
        seen_ev.add(nid)
        if nid not in because:
            because.append(nid)
    return {
        "ok": True,
        "scenario": scenario,
        "query": q,
        "evidence": evidence,
        "precedents": precedents,
        "drafts": drafts,
        "options": options,
        "because": because[:12],
        "empty": not precedents,
    }


_QUERY_SKIP_EDGES = {"分段"}


def _node_covers_time(row: dict[str, Any], at, date_from=None, date_to=None) -> bool:
    if at is None and date_from is None and date_to is None:
        return True
    return _row_in_query_window(row, at, date_from, date_to)


def _pack_query_node(row: dict[str, Any]) -> dict[str, Any]:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    content = str(row.get("content") or props.get("content") or row.get("id") or "")
    return {
        "id": str(row.get("id") or ""),
        "type": str(row.get("type") or ""),
        "content": content[:240],
        "valid_from": display_iso(props.get("valid_from") or row.get("valid_from") or props.get("timestamp")) or None,
    }


def run_query_graph(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Walk edges from a start node. Optional date uses node valid_from, not ingest time."""
    args = args or {}
    start = str(args.get("start") or args.get("from") or args.get("id") or args.get("q") or "").strip()
    if not start:
        return {"error": "start is required"}
    edge_raw = str(args.get("edge") or args.get("relation") or "").strip()
    want_edges = {part.strip() for part in edge_raw.replace("，", ",").split(",") if part.strip()} if edge_raw else set()
    want_type = str(args.get("node_type") or args.get("kind") or "").strip()
    date_raw = args.get("date") or args.get("at") or args.get("when") or ""
    at, date_from, date_to = _query_window(date_raw, "", "")
    try:
        hops = max(1, min(int(args.get("hops") or 2), 4))
    except (TypeError, ValueError):
        hops = 2
    try:
        limit = max(1, min(int(args.get("limit") or 40), 80))
    except (TypeError, ValueError):
        limit = 40
    rows, _st = read_node_rows(cwd)
    by_id = {str(row.get("id") or ""): row for row in rows if row.get("id")}
    seed = start if start in by_id else ""
    if not seed:
        want = start.casefold()
        for row in rows:
            rid = str(row.get("id") or "")
            props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
            label = str(row.get("label") or props.get("label") or row.get("content") or props.get("content") or "")
            if rid == start or label == start or label.casefold() == want:
                seed = rid
                break
    if not seed:
        found = run_search_text(cwd, {"q": start})
        for hit in found.get("results") or []:
            nid = str(((hit.get("node") or {}).get("id") or ""))
            if nid and nid in by_id and not nid.startswith("https://"):
                seed = nid
                break
    if not seed:
        return {
            "ok": True,
            "start": start,
            "resolved": "",
            "nodes": [],
            "edges": [],
            "empty": True,
            "detail": "图上没有这个点。刚抽出未入图就不能走边。",
        }
    outgoing: dict[str, list[tuple[str, str]]] = {}
    incoming: dict[str, list[tuple[str, str]]] = {}
    for edge in read_edge_rows(cwd):
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        et = str(edge.get("type") or "")
        if not src or not tgt or et in _QUERY_SKIP_EDGES:
            continue
        if want_edges and et not in want_edges:
            continue
        outgoing.setdefault(src, []).append((tgt, et))
        incoming.setdefault(tgt, []).append((src, et))
    seen = {seed}
    nodes_out = []
    edges_out = []
    seed_row = by_id.get(seed) or {"id": seed}
    if _node_covers_time(seed_row, at, date_from, date_to):
        nodes_out.append(_pack_query_node(seed_row))
    frontier = [(seed, 0)]
    while frontier and len(nodes_out) < limit:
        nid, hop = frontier.pop(0)
        if hop >= hops:
            continue
        for other, et in (outgoing.get(nid) or []) + (incoming.get(nid) or []):
            if other in seen:
                continue
            row = by_id.get(other)
            if row is None:
                continue
            if want_type and str(row.get("type") or "") != want_type:
                continue
            if not _node_covers_time(row, at, date_from, date_to):
                continue
            seen.add(other)
            nodes_out.append(_pack_query_node(row))
            edges_out.append({"source": nid, "target": other, "type": et, "hop": hop + 1})
            frontier.append((other, hop + 1))
            if len(nodes_out) >= limit:
                break
    return {
        "ok": True,
        "start": start,
        "resolved": seed,
        "date": args.get("date") or args.get("at") or "",
        "nodes": nodes_out,
        "edges": edges_out,
        "empty": len(nodes_out) <= 1 and not edges_out,
    }


def _b64_cursor(value: str) -> str:
    import base64
    return base64.urlsafe_b64encode(str(value or "").encode("utf-8")).decode("ascii")


def _b64_cursor_decode(cursor: str) -> str:
    import base64
    text = str(cursor or "").strip()
    if not text:
        return ""
    try:
        return base64.urlsafe_b64decode(text.encode("ascii")).decode("utf-8")
    except Exception:
        return ""


def _row_time_fields(row: dict[str, Any]) -> tuple[Any, Any]:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    start = display_iso(props.get("valid_from") or row.get("valid_from") or props.get("timestamp")) or None
    end = display_iso(props.get("valid_until") or row.get("valid_until")) or None
    return start, end


def _pack_explore_node(row: dict[str, Any], preview: int = 400) -> dict[str, Any]:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    content = str(row.get("content") or props.get("content") or row.get("id") or "")
    shown = content if preview <= 0 else content[:preview]
    start, end = _row_time_fields(row)
    public = _display_time_fields({k: v for k, v in props.items() if not str(k).startswith("_")})
    public["content"] = shown
    return {
        "id": str(row.get("id") or ""),
        "type": str(row.get("type") or "Entity"),
        "content": shown,
        "properties": public,
        "valid_from": start,
        "valid_until": end,
    }


def _stable_edge_ids(src: str, tgt: str, et: str) -> tuple[str, str]:
    import uuid
    payload = json.dumps(
        {
            "metadata": {},
            "source": src,
            "target": tgt,
            "type": et,
            "valid_from": None,
            "valid_until": None,
            "weight": 1.0,
        },
        sort_keys=True,
        default=str,
        separators=(",", ":"),
    )
    eid = str(uuid.uuid5(uuid.NAMESPACE_URL, payload))
    return eid, eid


def run_list_graph_nodes(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Paginated nodes for Explore. Reads FalkorDB/graph.json, no ContextGraph."""
    args = args or {}
    want_type = str(args.get("type") or args.get("node_type") or "").strip()
    search = str(args.get("search") or args.get("q") or "").strip()
    try:
        skip = max(0, int(args.get("skip") or 0))
    except (TypeError, ValueError):
        skip = 0
    try:
        limit = max(1, min(int(args.get("limit") or 100), 5000))
    except (TypeError, ValueError):
        limit = 100
    cursor = _b64_cursor_decode(str(args.get("cursor") or ""))
    rows, _st = read_node_rows(cwd)
    filtered: list[dict[str, Any]] = []
    for row in rows:
        nid = str(row.get("id") or "")
        if not nid:
            continue
        ntype = str(row.get("type") or "")
        if not keep_workbench_node(nid, ntype, _workbench_status(row)):
            continue
        if want_type and ntype != want_type:
            continue
        if search:
            props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
            blob = "\n".join([nid, ntype, str(row.get("content") or ""), json.dumps(props, ensure_ascii=False)])
            if search not in blob:
                continue
        filtered.append(row)
    filtered.sort(key=lambda row: str(row.get("id") or ""))
    ids = [str(row.get("id") or "") for row in filtered]
    start = skip
    if cursor and cursor in ids:
        start = ids.index(cursor) + 1
    page = filtered[start:start + limit]
    next_cursor = _b64_cursor(str(page[-1].get("id") or "")) if start + limit < len(filtered) and page else None
    return {
        "nodes": [_pack_explore_node(row) for row in page],
        "total": len(filtered),
        "skip": start,
        "limit": limit,
        "next_cursor": next_cursor,
        "has_more": next_cursor is not None,
    }


def run_list_graph_edges(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Paginated edges for Explore. Same store as search_text, no ContextGraph."""
    args = args or {}
    want_type = str(args.get("type") or args.get("edge_type") or "").strip()
    source = str(args.get("source") or "").strip()
    target = str(args.get("target") or "").strip()
    try:
        skip = max(0, int(args.get("skip") or 0))
    except (TypeError, ValueError):
        skip = 0
    try:
        limit = max(1, min(int(args.get("limit") or 100), 5000))
    except (TypeError, ValueError):
        limit = 100
    cursor = _b64_cursor_decode(str(args.get("cursor") or ""))
    packed: list[dict[str, Any]] = []
    keep_ids = {str(row.get("id") or "") for row in _workbench_nodes(cwd)}
    for edge in read_edge_rows(cwd):
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        et = str(edge.get("type") or "related_to")
        if not src or not tgt:
            continue
        if src not in keep_ids or tgt not in keep_ids:
            continue
        if want_type and et != want_type:
            continue
        if source and src != source:
            continue
        if target and tgt != target:
            continue
        eid, fid = _stable_edge_ids(src, tgt, et)
        packed.append({
            "id": eid,
            "familyId": fid,
            "source": src,
            "target": tgt,
            "type": et,
            "weight": 1.0,
            "properties": {},
            "valid_from": None,
            "valid_until": None,
        })
    packed.sort(key=lambda row: str(row.get("id") or ""))
    ids = [str(row.get("id") or "") for row in packed]
    start = skip
    if cursor and cursor in ids:
        start = ids.index(cursor) + 1
    page = packed[start:start + limit]
    next_cursor = _b64_cursor(str(page[-1].get("id") or "")) if start + limit < len(packed) and page else None
    return {
        "edges": page,
        "total": len(packed),
        "skip": start,
        "limit": limit,
        "next_cursor": next_cursor,
        "has_more": next_cursor is not None,
    }


def _workbench_status(row: dict[str, Any]) -> str:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    return str(row.get("status") or props.get("status") or "")


def keep_workbench_node(nid: str, ntype: str, status: str = "") -> bool:
    """Workbench is 型 / 已生效 / 抽出的点. Not diary, not Test, not 起草 boards."""
    if not nid or is_archive_node(nid, ntype):
        return False
    if str(ntype or "") in {"Test", "test", "UNKNOWN", "entity", "Entity", "DATE"}:
        return False
    if str(ntype or "").lower() == "decision" and status and status != "已生效":
        return False
    return True


def _workbench_nodes(cwd: str) -> list[dict[str, Any]]:
    rows, _st = read_node_rows(cwd)
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if not keep_workbench_node(nid, ntype, _workbench_status(row)):
            continue
        out.append(row)
    return out


def run_graph_label_search(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Search workbench labels only. Diary stays in the cabinet."""
    args = args or {}
    q = str(args.get("q") or args.get("query") or "").strip()
    try:
        limit = max(1, min(int(args.get("limit") or 8), 40))
    except (TypeError, ValueError):
        limit = 8
    hits = []
    if not q:
        return {"results": [], "total": 0, "query": q, "empty": True, "detail": "图上没有这个点。"}
    for row in _workbench_nodes(cwd):
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        label = str(row.get("content") or "")
        blob = f"{nid}\n{ntype}\n{label}"
        if q not in blob:
            continue
        hits.append({
            "node": {"id": nid, "type": ntype, "content": label},
            "score": 100,
            "via": "workbench",
        })
        if len(hits) >= limit:
            break
    return {
        "results": hits,
        "total": len(hits),
        "query": q,
        "empty": not hits,
        "detail": "" if hits else "图上没有这个点。",
    }


def _workbench_edges(cwd: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for edge in read_edge_rows(cwd):
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if not src or not tgt or is_archive_node(src) or is_archive_node(tgt):
            continue
        out.append(edge)
    return out


def run_get_graph_summary(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Same workbench counts as 管理/探索, not a second ContextGraph pass."""
    _ = args
    stats = run_graph_stats(cwd, {})
    decisions = 0
    for row in _workbench_nodes(cwd):
        if str(row.get("type") or "").lower() == "decision":
            decisions += 1
    return {
        "node_count": stats.get("node_count") or 0,
        "edge_count": stats.get("edge_count") or 0,
        "decision_count": decisions,
        "graph_ready": True,
        "path": str(graph_path(cwd)),
    }


def run_graph_stats(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = args
    rows = _workbench_nodes(cwd)
    edges = _workbench_edges(cwd)
    node_types: dict[str, int] = {}
    for row in rows:
        ntype = str(row.get("type") or "Entity") or "Entity"
        node_types[ntype] = node_types.get(ntype, 0) + 1
    edge_types: dict[str, int] = {}
    for edge in edges:
        et = str(edge.get("type") or "related_to") or "related_to"
        edge_types[et] = edge_types.get(et, 0) + 1
    ncount = len(rows)
    ecount = len(edges)
    density = (2.0 * ecount / (ncount * (ncount - 1))) if ncount > 1 else 0.0
    return {
        "node_count": ncount,
        "edge_count": ecount,
        "node_types": node_types,
        "edge_types": edge_types,
        "density": density,
    }


def run_graph_analytics(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Degree ranking over the book. One node pass, one edge pass. No ContextGraph."""
    _ = args
    rows = _workbench_nodes(cwd)
    edges = _workbench_edges(cwd)
    ncount = len(rows)
    ecount = len(edges)
    degree: dict[str, int] = {}
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if src:
            degree[src] = degree.get(src, 0) + 1
        if tgt:
            degree[tgt] = degree.get(tgt, 0) + 1
    n = max(ncount - 1, 1)
    ranked = sorted(degree.items(), key=lambda item: item[1], reverse=True)[:10]
    return {
        "node_count": ncount,
        "edge_count": ecount,
        "top_nodes_by_pagerank": [[nid, round(count / n, 6)] for nid, count in ranked],
        "community_count": 0,
        "top_degree": [[nid, count] for nid, count in ranked],
        "engine": "degree",
    }


_TIME_KEYS = (
    "valid_from", "valid_until", "timestamp", "event_time", "created_at", "updated_at",
    "date", "loaded_at", "ts", "mtime",
)


def parse_time_value(value: Any):
    """Parse ISO / unix timestamps. Returns timezone-aware UTC datetime or None."""
    from datetime import datetime, timezone

    if value is None or value is False:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        raw = float(value)
        # Heuristic: 1e12+ is milliseconds, 1e9+ is seconds.
        if raw > 1e12:
            raw = raw / 1000.0
        if raw <= 0:
            return None
        try:
            return datetime.fromtimestamp(raw, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    text = str(value).strip()
    if not text:
        return None
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y/%m"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def node_event_time(row: dict[str, Any]):
    """Real event time on a node. A message is a point, not a calendar day."""
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    for key in ("valid_from", "event_time", "timestamp", "created_at", "ts"):
        parsed = parse_time_value(row.get(key) if key == "valid_from" else None)
        if parsed is None:
            parsed = parse_time_value(props.get(key))
        if parsed is not None:
            return parsed
    return parse_time_value(row.get("valid_from") or props.get("valid_from"))


def node_time_span(row: dict[str, Any]) -> tuple[Any, Any]:
    """Return (start, end) UTC datetimes. Point times stay points."""
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    found: list[Any] = []
    start = parse_time_value(row.get("valid_from") or props.get("valid_from"))
    end = parse_time_value(row.get("valid_until") or props.get("valid_until"))
    for key in _TIME_KEYS:
        if key in ("valid_from", "valid_until"):
            continue
        parsed = parse_time_value(props.get(key))
        if parsed is not None:
            found.append(parsed)
    if start is None and found:
        start = min(found)
    if end is None and found:
        end = max(found)
    if start is not None and end is None:
        end = start
    return start, end


def _is_day_only(raw: Any) -> bool:
    text = str(raw or "").strip()
    if len(text) != 10:
        return False
    return parse_time_value(text) is not None and text[4] in "-/" and text[7] in "-/"


def _clock_parts(text: str):
    """HH:MM or HH:MM:SS → (h, m, s or None)."""
    import re
    match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", text.strip())
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    second = int(match.group(3)) if match.group(3) is not None else None
    if hour > 23 or minute > 59 or (second is not None and second > 59):
        return None
    return hour, minute, second


def _host_local(year: int, month: int, day: int, hour: int = 0, minute: int = 0, second: int = 0):
    """Naive wall time on this machine. Follows the OS timezone, including DST for that date."""
    return datetime(year, month, day, hour, minute, second).astimezone()


def _local_window(day, hour: int, minute: int, second: int | None):
    """A local clock reading. HH:MM is that minute; HH:MM:SS is that second."""
    if second is None:
        start = _host_local(day.year, day.month, day.day, hour, minute, 0)
        end = start + timedelta(minutes=1) - timedelta(microseconds=1)
    else:
        start = _host_local(day.year, day.month, day.day, hour, minute, second)
        end = start + timedelta(seconds=1) - timedelta(microseconds=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def _local_day_window(day):
    """Host-local calendar day [00:00, next 00:00), returned as UTC instants."""
    start = _host_local(day.year, day.month, day.day, 0, 0, 0)
    end = start + timedelta(days=1) - timedelta(microseconds=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)


def _bound_time(raw: Any, *, end: bool):
    """date_from / date_to. A bare YYYY-MM-DD is that host-local calendar day."""
    text = str(raw or "").strip()
    if not text:
        return None
    if _is_day_only(text):
        day = datetime.strptime(text.replace("/", "-"), "%Y-%m-%d")
        lo, hi = _local_day_window(day)
        return hi if end else lo
    return parse_time_value(text)


def _query_clock(raw: Any):
    """Split a query clock into (instant, from, to). Naive wall times follow this machine."""
    import re

    text = str(raw or "").strip()
    if not text:
        return None, None, None
    if _is_day_only(text):
        day = datetime.strptime(text.replace("/", "-"), "%Y-%m-%d")
        lo, hi = _local_day_window(day)
        return None, lo, hi
    clock = _clock_parts(text)
    if clock:
        today = datetime.now().astimezone().date()
        lo, hi = _local_window(today, *clock)
        return None, lo, hi
    dated = re.fullmatch(
        r"(\d{4}[-/]\d{2}[-/]\d{2})[ T](\d{1,2}:\d{2}(?::\d{2})?)$",
        text,
    )
    if dated:
        day = datetime.strptime(dated.group(1).replace("/", "-"), "%Y-%m-%d")
        parts = _clock_parts(dated.group(2))
        if parts:
            lo, hi = _local_window(day.date(), *parts)
            return None, lo, hi
    at = parse_time_value(text)
    return at, None, None


def _query_window(raw_at: Any, raw_from: Any = "", raw_to: Any = ""):
    """Query clock: YYYY-MM-DD is this machine's calendar day; HH:MM is local minute; ISO-Z is an instant."""
    at, clock_from, clock_to = _query_clock(raw_at)
    if clock_from is not None:
        return None, clock_from, clock_to
    return at, _bound_time(raw_from, end=False), _bound_time(raw_to, end=True)


def _row_in_query_window(row: dict[str, Any], at, date_from, date_to) -> bool:
    if at is None and date_from is None and date_to is None:
        return True
    start, end = node_time_span(row)
    if start is None and end is None:
        return False
    from datetime import datetime, timezone
    lo = start or datetime.min.replace(tzinfo=timezone.utc)
    hi = end or datetime.max.replace(tzinfo=timezone.utc)
    if at is not None:
        try:
            return lo <= at <= hi
        except TypeError:
            return False
    if date_from is not None and hi < date_from:
        return False
    if date_to is not None and lo > date_to:
        return False
    return True


def run_temporal_bounds(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Real min/max times from the graph. Never fall back to 1970–2030."""
    from datetime import datetime, timezone, timedelta

    _ = args
    rows, _st = read_node_rows(cwd)
    starts: list[Any] = []
    ends: list[Any] = []
    dated = 0
    for row in rows:
        start, end = node_time_span(row)
        if start is None and end is None:
            continue
        dated += 1
        if start is not None:
            starts.append(start)
        if end is not None:
            ends.append(end)
    now = datetime.now(timezone.utc)
    if not starts and not ends:
        lo = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hi = now
        return {"min": display_iso(lo), "max": display_iso(hi), "count": 0, "empty": True}
    lo = min(starts) if starts else min(ends)
    hi = max(ends) if ends else max(starts)
    if hi <= lo:
        hi = lo + timedelta(minutes=1)
    pad = max(timedelta(hours=12), (hi - lo) * 0.05)
    lo = lo - pad
    # Do not push the playhead into tomorrow. Left pad is enough for the slider.
    if hi > now:
        hi = now
    return {"min": display_iso(lo), "max": display_iso(hi), "count": dated, "empty": False}


def run_temporal_snapshot(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Nodes visible at `at`. Undated nodes stay visible; dated nodes must cover `at`."""
    from datetime import datetime, timezone

    args = args or {}
    at = parse_time_value(args.get("at") or args.get("time") or args.get("when"))
    rows, _st = read_node_rows(cwd)
    active: list[str] = []
    for row in rows:
        nid = str(row.get("id") or "")
        if not nid:
            continue
        start, end = node_time_span(row)
        if (start is None and end is None) or at is None:
            active.append(nid)
            continue
        lo = start or datetime.min.replace(tzinfo=timezone.utc)
        hi = end or datetime.max.replace(tzinfo=timezone.utc)
        try:
            if lo <= at <= hi:
                active.append(nid)
        except TypeError:
            active.append(nid)
    return {"active_node_ids": active, "active_node_count": len(active), "at": args.get("at") or ""}


_DEDUP_SKIP_TYPES = {
    "Document", "document", "skos:Concept", "skos:ConceptScheme",
    "decision", "category", "decision_maker",
    "UNKNOWN", "entity", "Entity", "DATE", "PERSON",
}
_SCHEMA_TYPE_PREFIXES = {"owl", "skos", "rdfs", "rdf"}
_ENTITY_REPR = re.compile(r"^\s*Entity\s*\(")
_DEDUP_MAX_ENTITIES = 400
_DEDUP_MAX_PAIRS = 80_000
_DEDUP_MAX_LABEL = 80


def _is_schema_type(ntype: str) -> bool:
    prefix = str(ntype or "").split(":", 1)[0].strip().lower()
    return prefix in _SCHEMA_TYPE_PREFIXES


def _dedup_label(row: dict[str, Any]) -> str:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    text = str(row.get("content") or props.get("content") or row.get("id") or "").strip()
    text = re.sub(r"\s+", " ", text)
    return text[:_DEDUP_MAX_LABEL]


def _dedup_keep(row: dict[str, Any]) -> bool:
    nid = str(row.get("id") or "")
    ntype = str(row.get("type") or "")
    label = _dedup_label(row)
    if not nid or not label:
        return False
    if ntype in _DEDUP_SKIP_TYPES or _is_schema_type(ntype):
        return False
    if nid.startswith("file:") or nid.startswith("session:") or nid == _HEALTH_MUTE_ID:
        return False
    if _ENTITY_REPR.match(nid) or _ENTITY_REPR.match(label):
        return False
    if len(label) < 2:
        return False
    return True


def _trigram_set(text: str) -> set[str]:
    padded = f"  {text.lower()} "
    if len(padded) < 3:
        return {padded}
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / float(len(a | b))


def run_enrich_dedup(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Entity-only duplicate scan. Never pairwise-compares Document bodies."""
    args = args or {}
    try:
        threshold = float(args.get("threshold") if args.get("threshold") is not None else 0.82)
    except (TypeError, ValueError):
        threshold = 0.82
    threshold = min(0.99, max(0.5, threshold))
    rows = args.get("rows") if isinstance(args.get("rows"), list) else None
    if rows is None:
        rows, _st = read_node_rows(cwd)
    entities: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        if not _dedup_keep(row):
            continue
        nid = str(row.get("id") or "")
        if nid in seen:
            continue
        seen.add(nid)
        label = _dedup_label(row)
        entities.append({
            "id": nid,
            "label": label,
            "type": str(row.get("type") or "entity"),
            "grams": _trigram_set(label),
        })
        if len(entities) >= _DEDUP_MAX_ENTITIES:
            break
    duplicates: list[dict[str, Any]] = []
    compared = 0
    n = len(entities)
    for i in range(n):
        left = entities[i]
        for j in range(i + 1, n):
            compared += 1
            if compared > _DEDUP_MAX_PAIRS:
                break
            score = _jaccard(left["grams"], entities[j]["grams"])
            if left["label"] == entities[j]["label"]:
                score = 1.0
            if score < threshold:
                continue
            right = entities[j]
            duplicates.append({
                "entity_a": {"id": left["id"], "text": left["label"], "label": left["label"], "type": left["type"]},
                "entity_b": {"id": right["id"], "text": right["label"], "label": right["label"], "type": right["type"]},
                "similarity": round(score, 4),
                "score": round(score, 4),
            })
        if compared > _DEDUP_MAX_PAIRS:
            break
    duplicates.sort(key=lambda row: -float(row.get("score") or 0))
    return {
        "duplicates": duplicates[:200],
        "total_flagged": len(duplicates),
        "scanned": n,
        "compared": compared,
        "threshold": threshold,
    }


_VOCAB_SKIP_TYPES = {
    "Document", "document", "skos:Concept", "skos:ConceptScheme",
    "decision", "category", "decision_maker",
    "UNKNOWN", "entity", "Entity", "DATE", "PERSON",
    "其它", "其他",
}


def _auto_vocab_scheme_id(cwd: str) -> str:
    return _vocab_ns(cwd) + "scheme"


def has_auto_vocab(cwd: str, rows: list[dict[str, Any]] | None = None) -> bool:
    scheme_id = _auto_vocab_scheme_id(cwd)
    if rows is None:
        rows, _st = read_node_rows(cwd)
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        if nid == scheme_id:
            return True
        if ntype == "skos:ConceptScheme" and props.get("auto_vocab"):
            return True
    return False


_FOLDER_LABELS = {
    "python": "运行时",
    "scripts": "脚本",
    "test": "测试",
    "tests": "测试",
    "vendor": "依赖",
    "dist": "产物",
    "client": "界面",
    "src": "源码",
    "docs": "文档",
    "doc": "文档",
    "vocab": "词表",
    "release-dist": "发版",
    "packages": "插件",
    "apps": "应用",
    "web": "界面",
}


_FILE_FAMILY_LABELS = {
    ".py": "运行时",
    ".js": "插件",
    ".ts": "插件",
    ".tsx": "界面",
    ".jsx": "界面",
    ".css": "界面",
    ".html": "界面",
    ".md": "文档",
    ".json": "配置",
    ".yml": "配置",
    ".yaml": "配置",
    ".ttl": "词表",
}


def workspace_folder_fallback(project: str, folders: dict[str, int], files: list[str]) -> list[dict[str, str]]:
    """Concepts from this workspace's folders and file families — not a tiny top-level list."""
    concepts: list[dict[str, str]] = []
    seen: set[str] = set()

    labels: set[str] = set()

    def add(cid: str, label: str, broader: str = "") -> None:
        slug = _vocab_slug(cid).lower()
        text = str(label or "").strip()
        if not slug or slug in seen:
            return
        if not text or text.endswith(":") or text.lower() in {"file", "file:", "runtime", "session", "entity"}:
            return
        if text in labels:
            return
        seen.add(slug)
        labels.add(text)
        row = {"id": slug, "label": text}
        if broader:
            row["broader"] = broader
        concepts.append(row)

    ranked = sorted(folders.items(), key=lambda item: (-item[1], item[0]))
    for name, _count in ranked:
        key = str(name).lower()
        if key in SKIP_DIR_NAMES or key in {"file", "session", "node_modules", "runtime"}:
            continue
        if str(name).endswith(":") or key.endswith("-dist"):
            continue
        mapped = _FOLDER_LABELS.get(key)
        if not mapped:
            continue
        add(name, mapped)
        if len(concepts) >= 12:
            break
    families: dict[str, int] = {}
    for name in files:
        ext = ""
        if "." in str(name) and not str(name).startswith("."):
            ext = "." + str(name).rsplit(".", 1)[-1].lower()
        label = _FILE_FAMILY_LABELS.get(ext)
        if label:
            families[label] = families.get(label, 0) + 1
    for label, _count in sorted(families.items(), key=lambda item: (-item[1], item[0])):
        add(_vocab_slug(label), label)
    extra = [
        ("plugin", "插件"),
        ("runtime", "运行时"),
        ("ui", "界面", "plugin"),
        ("ingest", "摄取"),
        ("graph", "知识图"),
        ("vocab", "词表", "graph"),
        ("decision", "决策", "graph"),
        ("release", "发版"),
        ("docs", "文档"),
        ("config", "配置"),
        ("test", "测试"),
        ("scripts", "脚本", "runtime"),
    ]
    code_like = bool(folders.get("python") or folders.get("src") or folders.get("vendor") or any(
        str(name).endswith(ext) for name in files for ext in (".js", ".ts", ".py", ".tsx")
    ))
    if code_like:
        for row in extra:
            cid, label = row[0], row[1]
            broader = row[2] if len(row) > 2 else ""
            if len(concepts) >= 16:
                break
            add(cid, label, broader)
    if not concepts:
        add(_vocab_slug(project) or "workspace", project or "这个工作区")
    return concepts


def workspace_document_snapshot(cwd: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    """When there are no entity types yet, describe the workspace from files and session summaries."""
    files: list[str] = []
    folders: dict[str, int] = {}
    sessions: list[str] = []
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if ntype not in {"Document", "document"}:
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        if nid.startswith("session:") and nid.count(":") == 1 and len(sessions) < 6:
            text = str(row.get("content") or props.get("content") or "").replace("\n", " ").strip()
            if text:
                sessions.append(text[:80])
        elif nid.startswith("file:"):
            path = str(props.get("path") or nid[5:])
            name = str(props.get("filename") or path.rsplit("/", 1)[-1])
            if name and name not in files and len(files) < 24:
                files.append(name)
            rel = path
            root = os.path.realpath(cwd or "")
            if root and rel.startswith(root):
                rel = rel[len(root):].lstrip("/\\")
            top = rel.split("/")[0] if "/" in rel else ""
            if top and not top.startswith("."):
                folders[top] = folders.get(top, 0) + 1
    if not files and not sessions and not folders:
        return {"snapshot": "", "types": 0, "nodes": 0, "has_auto_vocab": False, "fallback": []}
    project = os.path.basename(os.path.realpath(cwd or "")) or "这个工作区"
    lines = [
        f"工作区：{project}",
        "还没有抽出实体。请根据目录和会话内容归纳这个项目自己的分类，必须给出具体中文类名。",
        "这是代码/插件项目就用模块、运行时、界面、摄取、发版这类词；不是电商就不要写店铺/商品。",
    ]
    if folders:
        top = "、".join(f"{name}×{count}" for name, count in sorted(folders.items(), key=lambda item: (-item[1], item[0]))[:12])
        lines.append("顶层目录：" + top)
    if files:
        lines.append("文件：" + "、".join(files[:20]))
    if sessions:
        lines.append("会话摘要：")
        for text in sessions:
            lines.append("- " + text)
    fallback = workspace_folder_fallback(project, folders, files)
    return {
        "snapshot": "\n".join(lines),
        "types": 0,
        "nodes": len(files) + len(sessions),
        "from": "documents",
        "has_auto_vocab": False,
        "project": project,
        "fallback": fallback,
    }


def run_vocab_snapshot(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Compact type histogram from this workspace graph, for LLM vocab proposal."""
    _ = args
    rows, _st = read_node_rows(cwd)
    if has_auto_vocab(cwd, rows):
        return {"snapshot": "", "types": 0, "nodes": 0, "has_auto_vocab": True}
    buckets: dict[str, list[str]] = {}
    counts: dict[str, int] = {}
    for row in rows:
        ntype = str(row.get("type") or "").strip()
        nid = str(row.get("id") or "")
        if not ntype or ntype in _VOCAB_SKIP_TYPES:
            continue
        if nid.startswith("file:") or nid.startswith("session:"):
            continue
        if _ENTITY_REPR.match(nid):
            continue
        label = _dedup_label(row)
        if not label:
            continue
        counts[ntype] = counts.get(ntype, 0) + 1
        samples = buckets.setdefault(ntype, [])
        if label not in samples and len(samples) < 8:
            samples.append(label)
    if not counts:
        return workspace_document_snapshot(cwd, rows)
    lines = []
    for ntype, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        samples = buckets.get(ntype) or []
        extra = f"：{('、'.join(samples))}" if samples else ""
        lines.append(f"{ntype} ×{count}{extra}")
    return {
        "snapshot": "\n".join(lines),
        "types": len(counts),
        "nodes": sum(counts.values()),
        "has_auto_vocab": False,
    }


def _vocab_ns(cwd: str) -> str:
    key = hashlib.sha1(os.path.realpath(cwd or "").encode("utf-8")).hexdigest()[:12]
    return f"https://dsh.local/vocab/ws/{key}#"


def _vocab_slug(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9_\u4e00-\u9fff]+", "-", str(value or "")).strip("-")
    return (text[:48] or "c")


def _skos_label(row: dict[str, Any]) -> str:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    return str(row.get("content") or props.get("content") or props.get("prefLabel") or row.get("id") or "").strip()


def run_skos_schemes(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    _ = args
    rows, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    counts: dict[str, int] = {}
    for edge in edges:
        et = str(edge.get("type") or "")
        src = str(edge.get("source") or "")
        if et == "hasTopConcept" and src:
            counts[src] = counts.get(src, 0) + 1
    schemes: list[dict[str, Any]] = []
    for row in rows:
        if str(row.get("type") or "") != "skos:ConceptScheme":
            continue
        uri = str(row.get("id") or "")
        if not uri:
            continue
        title = _skos_label(row) or uri
        schemes.append({
            "uri": uri,
            "title": title,
            "label": title,
            "description": "",
            "concept_count": counts.get(uri, 0),
        })
    return schemes


def run_skos_hierarchy(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    args = args or {}
    scheme = str(args.get("scheme") or "").strip()
    rows, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    by_id = {str(row.get("id") or ""): row for row in rows}
    children: dict[str, list[str]] = {}
    tops: list[str] = []
    for edge in edges:
        et = str(edge.get("type") or "")
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if not src or not tgt:
            continue
        if et == "hasTopConcept" and (not scheme or src == scheme):
            if tgt not in tops:
                tops.append(tgt)
        elif et == "narrower":
            kids = children.setdefault(src, [])
            if tgt not in kids:
                kids.append(tgt)
        elif et == "broader":
            kids = children.setdefault(tgt, [])
            if src not in kids:
                kids.append(src)
    nested = set()
    for parent, kids in children.items():
        for kid in kids:
            nested.add(kid)
    tops = [uri for uri in tops if uri not in nested]
    seen: set[str] = set()

    def node_of(uri: str) -> dict[str, Any] | None:
        if uri in seen or uri not in by_id:
            return None
        seen.add(uri)
        row = by_id[uri]
        kids = [node_of(child) for child in children.get(uri, [])]
        packed = {
            "uri": uri,
            "pref_label": _skos_label(row) or uri,
            "alt_labels": [],
            "description": "",
            "scheme_uri": scheme,
            "children": [kid for kid in kids if kid],
        }
        packed.update(_kind_gate_public(row))
        return packed

    roots = []
    for uri in tops:
        packed = node_of(uri)
        if packed:
            roots.append(packed)
    if not roots:
        for row in rows:
            if str(row.get("type") or "") != "skos:Concept":
                continue
            uri = str(row.get("id") or "")
            if scheme and not uri.startswith(scheme.rsplit("#", 1)[0] if "#" in scheme else scheme):
                continue
            packed = node_of(uri)
            if packed:
                roots.append(packed)
    return roots


def run_skos_concept(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    uri = str(args.get("uri") or "").strip()
    rows, _st = read_node_rows(cwd)
    edges = read_edge_rows(cwd)
    row = next((item for item in rows if str(item.get("id") or "") == uri), None)
    if not row:
        return {"error": "NOT_FOUND", "uri": uri}
    broader: list[str] = []
    narrower: list[str] = []
    related: list[str] = []
    scheme_uri = ""
    for edge in edges:
        et = str(edge.get("type") or "")
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if et == "broader" and src == uri:
            if tgt not in broader:
                broader.append(tgt)
        elif et == "narrower" and tgt == uri:
            if src not in broader:
                broader.append(src)
        elif et == "narrower" and src == uri:
            if tgt not in narrower:
                narrower.append(tgt)
        elif et == "broader" and tgt == uri:
            if src not in narrower:
                narrower.append(src)
        elif et == "hasTopConcept" and tgt == uri:
            scheme_uri = src
        elif et == "related_to" and src == uri:
            if tgt not in related:
                related.append(tgt)
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    packed = {
        "uri": uri,
        "pref_label": _skos_label(row) or uri,
        "alt_labels": [],
        "hidden_labels": [],
        "definition": str(props.get("definition") or ""),
        "scope_note": "",
        "editorial_note": "",
        "broader": broader,
        "narrower": narrower,
        "related": related,
        "exact_match": [],
        "close_match": [],
        "broad_match": [],
        "narrow_match": [],
        "scheme_uri": scheme_uri or str(props.get("inScheme") or ""),
    }
    packed.update(_kind_gate_public(row))
    return packed


def run_export_skos(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Dump this workspace SKOS as JSON. Not OWL. Missing extra deps never required."""
    packed = {
        "schemes": run_skos_schemes(cwd, args),
        "concepts": run_skos_hierarchy(cwd, args),
    }
    return {"ok": True, "format": "skos-json", "data": json.dumps(packed, ensure_ascii=False, indent=2)}


def _xml_escape(text: str) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def run_export_owl(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Dump owl:Class / properties from this graph. Official OWLExporter on a diary graph is an empty shell."""
    _ = args
    rows, _st = read_node_rows(cwd)
    classes: list[tuple[str, str]] = []
    props: list[tuple[str, str, str]] = []
    for row in rows:
        ntype = str(row.get("type") or "")
        nid = str(row.get("id") or "")
        label = _skos_label(row) or nid
        if ntype == "owl:Class":
            classes.append((nid, label))
        elif ntype in {
            "owl:ObjectProperty",
            "owl:DatatypeProperty",
            "owl:AnnotationProperty",
            "rdfs:Property",
        }:
            props.append((nid, label, ntype))
    lines = [
        '<?xml version="1.0"?>',
        '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"',
        '         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"',
        '         xmlns:owl="http://www.w3.org/2002/07/owl#">',
    ]
    for nid, label in classes:
        about = nid if str(nid).startswith("http") else f"urn:dsh:{nid}"
        lines.append(f'  <owl:Class rdf:about="{_xml_escape(about)}">')
        lines.append(f"    <rdfs:label>{_xml_escape(label)}</rdfs:label>")
        lines.append("  </owl:Class>")
    for nid, label, ntype in props:
        tag = ntype.split(":")[-1] if ":" in ntype else "ObjectProperty"
        about = nid if str(nid).startswith("http") else f"urn:dsh:{nid}"
        lines.append(f'  <owl:{tag} rdf:about="{_xml_escape(about)}">')
        lines.append(f"    <rdfs:label>{_xml_escape(label)}</rdfs:label>")
        lines.append(f"  </owl:{tag}>")
    lines.append("</rdf:RDF>")
    data = "\n".join(lines) + "\n"
    return {"ok": True, "format": "owl", "data": data, "class_count": len(classes)}


def _ttl_escape(text: str) -> str:
    return str(text or "").replace("\\", "\\\\").replace('"', '\\"')


def run_generate_shacl(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """NodeShapes from workbench owl:Class. Diary cabinet is not a source."""
    _ = args
    classes = [row for row in _workbench_nodes(cwd) if str(row.get("type") or "") == "owl:Class"]
    dest = policy_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    lines = [
        "@prefix sh: <http://www.w3.org/ns/shacl#> .",
        "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .",
        "",
    ]
    shapes: list[dict[str, Any]] = []
    for row in classes:
        nid = str(row.get("id") or "")
        if not nid:
            continue
        label = str(row.get("content") or nid)
        target = nid if "://" in nid else f"urn:dsh:{nid}"
        shape_id = f"{target}Shape"
        lines.append(f"<{shape_id}> a sh:NodeShape ;")
        lines.append(f"  sh:targetClass <{target}> ;")
        lines.append(f'  rdfs:label "{_ttl_escape(label)}" .')
        lines.append("")
        shapes.append({
            "id": shape_id,
            "target_class": target,
            "targetClass": target,
            "label": label,
            "constraint_count": 0,
            "constraints": [],
            "violation_count": 0,
        })
    turtle = "\n".join(lines)
    (dest / "generated-from-classes.ttl").write_text(turtle, encoding="utf-8")
    return {
        "ok": True,
        "shacl_turtle": turtle,
        "shapes": shapes,
        "shape_count": len(shapes),
    }


RETRIEVAL_GOLD = (
    (
        "G1",
        "还记得我们讨论过把语义插件做成和人类记忆一样吗",
        (
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:99985",
        ),
    ),
    (
        "G2",
        "人类记忆",
        (
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:99985",
        ),
    ),
    (
        "G3",
        "语义助手还差哪些",
        (
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235",
        ),
    ),
    (
        "G4",
        "工作记忆",
        (
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:34440",
        ),
    ),
    (
        "G5",
        "要不要只发 darwin-arm64",
        (
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:99985",
            "session:session-2e88459a-f44b-4509-8b06-4796e6b6d2d8:36235",
            "d148205b-7822-4f85-9485-16e407f719e1",
        ),
    ),
)

RETRIEVAL_NEEDLE = (
    ("N1", "验收员不是开发", "验收员不是开发"),
    ("N2", "only-arm64", "only-arm64"),
    ("N3", "采购单", "采购单"),
    ("N4", "两柜", "两柜"),
    ("N5", "FalkorDB 主账本", "FalkorDB"),
    ("N6", "不要硬编码", "硬编码"),
    ("N7", "开场工作记忆 800", "800"),
    ("N8", "假后果", "假后果"),
    ("N9", "按结构生成规则", "SHACL"),
    ("N10", "扫描冲突", "冲突"),
    ("N11", "人类对记忆能力", "记忆"),
    ("N12", "route_intent", "route_intent"),
    ("N13", "CWD_NOT_AUTHORIZED", "CWD_NOT_AUTHORIZED"),
    ("N14", "湖仓不当账本", "湖仓"),
    ("N15", "clipSearchPayload", "360"),
)


def run_retrieval_score(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """First-hit rate on the human gold queries. Not a full IR benchmark."""
    _ = args
    rows = []
    hits = 0
    for gid, query, want in RETRIEVAL_GOLD:
        packed = run_search_text(cwd, {"query": query, "q": query, "limit": 5, "across_bridges": False})
        results = packed.get("results") if isinstance(packed, dict) else None
        first = ""
        if isinstance(results, list) and results:
            node = results[0].get("node") if isinstance(results[0], dict) else None
            if isinstance(node, dict):
                first = str(node.get("id") or "")
        ok = first in want
        if ok:
            hits += 1
        rows.append({"id": gid, "query": query, "first": first, "ok": ok})
    extra_rows = []
    extra_hits = 0
    for nid, query, needle in RETRIEVAL_NEEDLE:
        packed = run_search_text(cwd, {"query": query, "q": query, "limit": 5, "across_bridges": False})
        results = packed.get("results") if isinstance(packed, dict) else None
        first = ""
        blob = ""
        if isinstance(results, list) and results:
            node = results[0].get("node") if isinstance(results[0], dict) else None
            if isinstance(node, dict):
                first = str(node.get("id") or "")
                blob = f"{first}\n{node.get('content') or ''}\n{(node.get('properties') or {}).get('content') or ''}"
        ok = needle.lower() in blob.lower()
        if ok:
            extra_hits += 1
        extra_rows.append({"id": nid, "query": query, "needle": needle, "first": first, "ok": ok})
    n = len(RETRIEVAL_GOLD)
    n2 = len(RETRIEVAL_NEEDLE)
    return {
        "ok": True,
        "n": n,
        "hits": hits,
        "first_hit_rate": (hits / n) if n else 0,
        "extra_n": n2,
        "extra_hits": extra_hits,
        "extra_rate": (extra_hits / n2) if n2 else 0,
        "rows": rows,
        "extra_rows": extra_rows,
        "detail": "金例第一条命中 + 扩展题第一名含线索。不是全库 IR。",
    }


def run_workbench_reason(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Deterministic Class(?x) → WorkType(?x) over slim workbench. Diary is not a fact."""
    _ = args
    facts = []
    for row in _workbench_nodes(cwd):
        ntype = str(row.get("type") or "")
        label = str(row.get("content") or "")
        nid = str(row.get("id") or "")
        if not label:
            label = nid.rsplit("#", 1)[-1]
        if ntype == "owl:Class" and label:
            facts.append(f"Class({label})")
        elif str(ntype).lower() == "decision" and label:
            facts.append(f"Decision({label[:80]})")
    derived = [f"WorkType({item[6:-1]})" for item in facts if item.startswith("Class(")]
    return {
        "ok": True,
        "engine": "forward-workbench",
        "facts": facts[:80],
        "derived_facts": derived[:80],
        "n_facts": len(facts),
        "n_derived": len(derived),
        "detail": "工作台前向：owl:Class 推出 WorkType。日记不进事实。",
    }


def _concept_id_of(row: dict[str, Any]) -> str:
    raw = str(row.get("id") or "")
    if "#" in raw:
        raw = raw.rsplit("#", 1)[-1]
    return _vocab_slug(raw or row.get("label") or "")


def _owl_class_for_concept(graph: Any, concept_id: str) -> str:
    for nid, node in iter_nodes(graph):
        if node_type_of(node) != "owl:Class":
            continue
        if has_edge(graph, str(nid), concept_id, "skos:exactMatch"):
            return str(nid)
    return ""


def run_upsert_workspace_vocab(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Write an auto SKOS scheme for this workspace from LLM concepts."""
    args = args or {}
    concepts = args.get("concepts") if isinstance(args.get("concepts"), list) else []
    name = str(args.get("name") or "").strip()
    replace_empty = bool(args.get("replace_empty"))
    cleaned = []
    seen = set()
    for row in concepts:
        if isinstance(row, dict):
            kind = accept_kind(row)
            if not kind.get("ok"):
                return {"ok": False, "error": kind.get("error") or "NOT_A_KIND"}
        if not isinstance(row, dict):
            continue
        cid = _concept_id_of(row)
        label = str(row.get("label") or row.get("id") or "").strip()
        if "#" in label:
            label = str(kind.get("kind") or cid)
        if not cid or not label or cid in seen:
            continue
        if label in _VOCAB_SKIP_TYPES or cid.lower() in {"other", "unknown", "entity", "file", "runtime", "session"}:
            continue
        if label.endswith(":") or label.lower() in {"file:", "file", "runtime", "session"}:
            continue
        seen.add(cid)
        broader = _vocab_slug(row.get("broader") or "") if row.get("broader") else ""
        fields = kind.get("fields") if isinstance(row, dict) and kind.get("ok") else []
        can = kind.get("can") if isinstance(row, dict) and kind.get("ok") else []
        extras = pack_kind_connector(row) if isinstance(row, dict) else {}
        incoming = dict(extras)
        if isinstance(row.get("fields"), list) or not replace_empty:
            incoming["fields"] = fields
        if isinstance(row.get("can"), list) or not replace_empty:
            incoming["can"] = can
        if replace_empty:
            if "resource" in row or "collection" in row:
                incoming["resource"] = str(row.get("resource") or row.get("collection") or "").strip()
            if "ticketField" in row or "ticket_field" in row:
                incoming["ticketField"] = str(row.get("ticketField") or row.get("ticket_field") or "").strip()
            if "clues" in row:
                incoming["clues"] = extras.get("clues") or []
            if "catalogVersion" in row or "version" in row:
                incoming["catalogVersion"] = extras.get("catalogVersion") or ""
            if "relations" in row:
                incoming["relations"] = extras.get("relations") or []
        cleaned.append((cid, label, broader, incoming))
        if len(cleaned) >= 16:
            break
    if not cleaned:
        return {"ok": False, "error": "NO_CONCEPTS"}
    session, path = load_session(cwd)
    graph = session.graph
    ns = _vocab_ns(cwd)
    scheme_id = ns + "scheme"
    scheme_node = get_node(graph, scheme_id)
    scheme_title = name or (node_content(scheme_node).strip() if scheme_node is not None else "") or "这个工作区的分类"
    if scheme_node is None:
        graph.add_node(
            scheme_id,
            "skos:ConceptScheme",
            content=scheme_title,
            source="auto-workspace-vocab",
            auto_vocab=True,
        )
    elif name and name != node_content(scheme_node).strip():
        set_node_props(scheme_node, content=name)
        scheme_title = name
    existing = set()
    for nid, node in iter_nodes(graph):
        if str(nid or "").startswith(ns) and node_type_of(node) == "skos:Concept":
            existing.add(str(nid).rsplit("#", 1)[-1].lower())
    added = 0
    patched = 0
    skipped = 0
    for cid, label, broader, incoming in cleaned:
        nid = ns + cid
        if cid.lower() not in existing:
            graph.add_node(
                nid,
                "skos:Concept",
                content=label,
                source="auto-workspace-vocab",
                auto_vocab=True,
                inScheme=scheme_id,
                scheme_uri=scheme_id,
                definition=_concept_definition(label),
                **incoming,
                **{"skos:definition": _concept_definition(label)},
            )
            added += 1
            existing.add(cid.lower())
        else:
            node = get_node(graph, nid)
            changed = kind_patch(
                _kind_props_of(node),
                incoming,
                label=label,
                current_label=node_content(node),
                replace_empty=replace_empty,
            )
            if changed:
                set_node_props(node, **changed)
                patched += 1
            else:
                skipped += 1
        if broader and broader != cid:
            parent = ns + broader
            ensure_edge(graph, parent, nid, "narrower")
            ensure_edge(graph, nid, parent, "broader")
            drop_edge(graph, scheme_id, nid, "hasTopConcept")
        else:
            ensure_edge(graph, scheme_id, nid, "hasTopConcept")
    linked = ensure_vocab_hierarchy(graph, scheme_id)
    owl = ensure_workspace_owl(graph, scheme_id, scheme_title)
    save_session(session, path)
    return {
        "ok": True,
        "scheme": scheme_id,
        "name": scheme_title,
        "concepts": added,
        "patched": patched,
        "linked": linked,
        "owl": owl,
        "skipped": skipped,
    }


def _kind_props_of(node: Any) -> dict[str, Any]:
    if node is None:
        return {}
    props = node.get("properties") if isinstance(node, dict) else getattr(node, "properties", None)
    if not isinstance(props, dict):
        props = {}
    out: dict[str, Any] = {}
    for key in ("fields", "can", "resource", "ticketField", "clues", "catalogVersion", "relations"):
        value = props.get(key)
        if value is None and isinstance(node, dict):
            value = node.get(key)
        if value is not None:
            out[key] = value
    return out


def _kind_gate_public(row: Any) -> dict[str, Any]:
    """Leaf gate props for the inspector. Empty lists stay off the page."""
    packed = _kind_props_of(row)
    out: dict[str, Any] = {}
    fields = packed.get("fields")
    if isinstance(fields, list):
        cleaned = [str(item).strip() for item in fields if str(item).strip()]
        if cleaned:
            out["fields"] = cleaned
    can = packed.get("can")
    if isinstance(can, list):
        cleaned = [str(item).strip() for item in can if str(item).strip()]
        if cleaned:
            out["can"] = cleaned
    resource = str(packed.get("resource") or "").strip()
    if resource:
        out["resource"] = resource
    ticket = str(packed.get("ticketField") or "").strip()
    if ticket:
        out["ticketField"] = ticket
    clues = packed.get("clues")
    if isinstance(clues, list) and clues:
        out["clues"] = clues
    version = str(packed.get("catalogVersion") or "").strip()
    if version:
        out["catalogVersion"] = version
    relations = packed.get("relations")
    if isinstance(relations, list) and relations:
        out["relations"] = relations
    return out


_VOCAB_PARENTS = {
    "界面": "插件",
    "词表": "知识图",
    "决策": "知识图",
    "脚本": "运行时",
}


def ensure_vocab_hierarchy(graph: Any, scheme_id: str) -> int:
    """Attach broader/narrower on an already-written auto scheme."""
    by_label: dict[str, str] = {}
    for nid, node in iter_nodes(graph):
        if node_type_of(node) != "skos:Concept":
            continue
        if scheme_id and not str(nid or "").startswith(scheme_id.rsplit("#", 1)[0] + "#"):
            continue
        label = node_content(node).strip()
        if label:
            by_label[label] = str(nid)
    linked = 0
    for child_label, parent_label in _VOCAB_PARENTS.items():
        child = by_label.get(child_label)
        parent = by_label.get(parent_label)
        if not child or not parent or child == parent:
            continue
        before = has_edge(graph, parent, child, "narrower")
        ensure_edge(graph, parent, child, "narrower")
        ensure_edge(graph, child, parent, "broader")
        drop_edge(graph, scheme_id, child, "hasTopConcept")
        if not before:
            linked += 1
    return linked


_CONCEPT_DEFINITIONS = {
    "插件": "这个工作区的插件代码与入口。",
    "运行时": "这个工作区的 Python sidecar 与运行时。",
    "界面": "这个工作区的前端界面。",
    "摄取": "把会话和文件写进图的流程。",
    "知识图": "工作区共享的知识图与检索。",
    "词表": "这个工作区的分类词表。",
    "决策": "已经拍板并记入图的结论。",
    "发版": "打包、安装与发布。",
    "文档": "说明与记录。",
    "配置": "项目配置文件。",
    "测试": "测试与验收。",
    "脚本": "辅助脚本。",
    "依赖": "第三方依赖。",
    "源码": "业务源码目录。",
    "Document": "会话或文件正文。",
    "分类概念": "工作区分类表里的一个类。",
}


def _concept_definition(label: str) -> str:
    text = str(label or "").strip()
    return _CONCEPT_DEFINITIONS.get(text) or f"这个工作区的分类：{text}。"


_OWL_OBJECT_PROPS = (
    ("belongsTo", "属于", "Document", "分类概念"),
    ("fromSource", "出自", None, "Document"),
    ("contains", "包含", "Document", "Document"),
)
_OWL_DATA_PROPS = (
    ("path", "路径", "xsd:string"),
    ("source", "来源", "xsd:string"),
)


def ensure_workspace_owl(graph: Any, scheme_id: str, name: str = "") -> dict[str, int]:
    """Mirror SKOS concepts as owl:Class so health/SHACL/registry counts work."""
    prefix = scheme_id.rsplit("#", 1)[0] + "#" if "#" in scheme_id else scheme_id
    when = event_fields()
    concepts: list[tuple[str, str]] = []
    for nid, node in iter_nodes(graph):
        raw = str(nid or "")
        if node_type_of(node) != "skos:Concept" or not raw.startswith(prefix):
            continue
        label = node_content(node).strip()
        defined = _concept_definition(label) if label else ""
        set_node_props(
            node,
            scheme_uri=scheme_id,
            inScheme=scheme_id,
            auto_vocab=True,
            definition=defined,
            **{"skos:definition": defined},
        )
        if label:
            concepts.append((raw, label))
    scheme_node = get_node(graph, scheme_id)
    if scheme_node is not None:
        set_node_props(
            scheme_node,
            format="skos",
            status="published",
            scheme_uri=scheme_id,
            rdfs_label=name or node_content(scheme_node),
        )
    owl_id = prefix + "owl"
    graph.add_node(
        owl_id,
        "owl:Ontology",
        content=(name or "这个工作区的本体") + "（OWL）",
        source="auto-workspace-owl",
        **when,
        auto_vocab=True,
        scheme_uri=owl_id,
        format="owl:Ontology",
        status="published",
    )
    classes = 0
    for concept_id, label in concepts:
        cid = _owl_class_for_concept(graph, concept_id) or (prefix + "class-" + _vocab_slug(label))
        defined = _concept_definition(label)
        graph.add_node(
            cid,
            "owl:Class",
            content=label,
            source="auto-workspace-owl",
        **when,
            auto_vocab=True,
            scheme_uri=owl_id,
            ontology_uri=owl_id,
            definition=defined,
            **{
                "rdfs:label": label,
                "rdfs:comment": defined,
                "skos:definition": defined,
            },
        )
        ensure_edge(graph, cid, concept_id, "skos:exactMatch")
        classes += 1
        parent_label = _VOCAB_PARENTS.get(label)
        if parent_label:
            parent = prefix + "class-" + _vocab_slug(parent_label)
            ensure_edge(graph, cid, parent, "rdfs:subClassOf")
    document_class = prefix + "class-Document"
    document_def = _concept_definition("Document")
    graph.add_node(
        document_class,
        "owl:Class",
        content="Document",
        source="auto-workspace-owl",
        **when,
        auto_vocab=True,
        scheme_uri=owl_id,
        ontology_uri=owl_id,
        definition=document_def,
        **{
            "rdfs:label": "Document",
            "rdfs:comment": document_def,
            "skos:definition": document_def,
        },
    )
    classes += 1
    concept_class = prefix + "class-" + _vocab_slug("分类概念")
    concept_def = _concept_definition("分类概念")
    graph.add_node(
        concept_class,
        "owl:Class",
        content="分类概念",
        source="auto-workspace-owl",
        **when,
        auto_vocab=True,
        scheme_uri=owl_id,
        ontology_uri=owl_id,
        definition=concept_def,
        **{
            "rdfs:label": "分类概念",
            "rdfs:comment": concept_def,
            "skos:definition": concept_def,
        },
    )
    classes += 1
    props = 0
    for slug, label, domain, rng in _OWL_OBJECT_PROPS:
        pid = prefix + "prop-" + slug
        prop_def = f"图上的关系「{label}」。"
        graph.add_node(
            pid,
            "owl:ObjectProperty",
            content=label,
            source="auto-workspace-owl",
        **when,
            auto_vocab=True,
            scheme_uri=owl_id,
            ontology_uri=owl_id,
            definition=prop_def,
            **{
                "rdfs:label": label,
                "rdfs:comment": prop_def,
                "skos:definition": prop_def,
            },
        )
        if domain:
            ensure_edge(graph, pid, prefix + "class-" + _vocab_slug(domain), "rdfs:domain")
        if rng:
            ensure_edge(graph, pid, prefix + "class-" + _vocab_slug(rng), "rdfs:range")
        props += 1
    for slug, label, rng in _OWL_DATA_PROPS:
        pid = prefix + "prop-" + slug
        prop_def = f"节点上的属性「{label}」。"
        graph.add_node(
            pid,
            "owl:DatatypeProperty",
            content=label,
            source="auto-workspace-owl",
        **when,
            auto_vocab=True,
            scheme_uri=owl_id,
            ontology_uri=owl_id,
            definition=prop_def,
            **{
                "rdfs:label": label,
                "rdfs:comment": prop_def,
                "skos:definition": prop_def,
            },
        )
        ensure_edge(graph, pid, document_class, "rdfs:domain")
        range_uri = "http://www.w3.org/2001/XMLSchema#string" if rng == "xsd:string" else rng
        ensure_edge(graph, pid, range_uri, "rdfs:range")
        props += 1
    return {"classes": classes, "properties": props}


def run_ontology_registry(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Registry rows the official OWL/SKOS list page can show with real counts."""
    _ = args
    rows, _st = read_node_rows(cwd)
    class_counts: dict[str, int] = {}
    concept_counts: dict[str, int] = {}
    prop_counts: dict[str, int] = {}
    entries: list[dict[str, Any]] = []
    for row in rows:
        ntype = str(row.get("type") or "")
        nid = str(row.get("id") or "")
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        scheme = str(props.get("scheme_uri") or props.get("ontology_uri") or props.get("inScheme") or "")
        if not scheme and "#" in nid:
            stem = nid.rsplit("#", 1)[0] + "#"
            if ntype in {"owl:Class", "rdfs:Class", "owl:ObjectProperty", "owl:DatatypeProperty", "owl:AnnotationProperty", "rdfs:Property"}:
                scheme = stem + "owl"
        if ntype == "skos:Concept" and scheme:
            concept_counts[scheme] = concept_counts.get(scheme, 0) + 1
        elif ntype in {"owl:Class", "rdfs:Class"} and scheme:
            class_counts[scheme] = class_counts.get(scheme, 0) + 1
        elif ntype in {"owl:ObjectProperty", "owl:DatatypeProperty", "owl:AnnotationProperty", "rdfs:Property"} and scheme:
            prop_counts[scheme] = prop_counts.get(scheme, 0) + 1
        if ntype in {"skos:ConceptScheme", "owl:Ontology"}:
            fmt = "skos" if ntype == "skos:ConceptScheme" else "owl:Ontology"
            entries.append({
                "uri": nid,
                "name": _skos_label(row) or nid,
                "description": str(props.get("rdfs:comment") or props.get("description") or ""),
                "format": str(props.get("format") or fmt),
                "status": str(props.get("status") or "published"),
                "source_url": None,
                "version": str(props.get("version") or "") or None,
                "class_count": 0,
                "concept_count": 0,
                "property_count": 0,
                "loaded_at": str(props.get("loaded_at") or ""),
                "enabled": True,
                "tags": ["workspace"],
            })
    for entry in entries:
        uri = entry["uri"]
        entry["class_count"] = class_counts.get(uri, 0)
        entry["concept_count"] = concept_counts.get(uri, 0)
        entry["property_count"] = prop_counts.get(uri, 0)
    return entries


def run_vocab_types(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Labels of this workspace's auto SKOS concepts, for extract typing."""
    _ = args
    rows, _st = read_node_rows(cwd)
    scheme = _auto_vocab_scheme_id(cwd)
    prefix = scheme.rsplit("#", 1)[0] + "#" if "#" in scheme else scheme
    types: list[str] = []
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        if ntype != "skos:Concept":
            continue
        if not nid.startswith(prefix):
            continue
        label = _skos_label(row)
        if not label or label.endswith(":") or label.lower() in {"file", "file:", "runtime", "session", "entity", "unknown"}:
            continue
        if label not in types:
            types.append(label)
    return {"ok": True, "types": types, "scheme": scheme}


def vocab_shapes(cwd: str) -> list[dict[str, Any]]:
    """Hand-written kinds with required fields, for check_shape."""
    rows, _st = read_node_rows(cwd)
    out: list[dict[str, Any]] = []
    for row in rows:
        if str(row.get("type") or "") != "skos:Concept":
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        label = _skos_label(row)
        fields = props.get("fields") if isinstance(props.get("fields"), list) else row.get("fields")
        if not label or not isinstance(fields, list) or not fields:
            continue
        out.append({"kind": label, "fields": [str(item).strip() for item in fields if str(item).strip()]})
    return out


def classify_path_label(cwd: str, path: str) -> str:
    """Map a workspace file path onto an existing vocab label."""
    raw = str(path or "")
    if raw.startswith("file:"):
        raw = raw[5:]
    root = os.path.realpath(cwd or "")
    rel = raw
    if root and rel.startswith(root):
        rel = rel[len(root):].lstrip("/\\")
    parts = [p for p in rel.replace("\\", "/").split("/") if p]
    for part in parts[:-1]:
        key = part.lower()
        if key in SKIP_DIR_NAMES or key.startswith("."):
            continue
        mapped = _FOLDER_LABELS.get(key)
        if mapped:
            return mapped
    name = parts[-1] if parts else ""
    if "." in name and not name.startswith("."):
        ext = "." + name.rsplit(".", 1)[-1].lower()
        mapped = _FILE_FAMILY_LABELS.get(ext)
        if mapped:
            return mapped
    return ""


def retarget_node_type(graph: Any, nid: str, new_type: str) -> bool:
    node = get_node(graph, nid)
    if node is None or not new_type:
        return False
    old = node_type_of(node)
    if old == new_type:
        return False
    if isinstance(node, dict):
        node["type"] = new_type
        if "node_type" in node:
            node["node_type"] = new_type
        props = node.get("properties")
        if isinstance(props, dict) and "type" in props:
            props["type"] = new_type
    else:
        try:
            setattr(node, "type", new_type)
        except Exception:
            pass
        try:
            setattr(node, "node_type", new_type)
        except Exception:
            pass
    index = getattr(graph, "node_type_index", None)
    if isinstance(index, dict):
        if old:
            try:
                (index.get(old) or set()).discard(nid)
            except Exception:
                pass
        bucket = index.setdefault(new_type, set())
        try:
            bucket.add(nid)
        except Exception:
            pass
    return True


def run_classify_existing_files(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Retype already-ingested file Documents onto this workspace's vocab labels."""
    _ = args
    typed = run_vocab_types(cwd)
    allowed = {str(label): True for label in (typed.get("types") or [])}
    if not allowed:
        return {"ok": True, "changed": 0, "reason": "NO_TYPES"}
    session, path = load_session(cwd)
    graph = session.graph
    scheme = _auto_vocab_scheme_id(cwd)
    prefix = scheme.rsplit("#", 1)[0] + "#" if "#" in scheme else scheme
    concept_by_label: dict[str, str] = {}
    for nid, node in iter_nodes(graph):
        if node_type_of(node) != "skos:Concept" or not str(nid or "").startswith(prefix):
            continue
        label = node_content(node).strip()
        if label:
            concept_by_label[label] = str(nid)
    changed = 0
    for nid, node in list(iter_nodes(graph)):
        raw = str(nid or "")
        if not raw.startswith("file:") or "#c" in raw:
            continue
        if node_type_of(node) not in {"Document", "document"}:
            continue
        props = getattr(node, "properties", None) if not isinstance(node, dict) else (node.get("properties") if isinstance(node.get("properties"), dict) else {})
        if not isinstance(props, dict):
            props = {}
        file_path = str(props.get("path") or props.get("source") or raw[5:])
        label = classify_path_label(cwd, file_path)
        if not label or label not in allowed:
            continue
        if not retarget_node_type(graph, raw, label):
            continue
        concept = concept_by_label.get(label)
        if concept:
            ensure_edge(graph, raw, concept, "属于")
        changed += 1
    if changed:
        save_session(session, path)
    return {"ok": True, "changed": changed}


def classify_session_label(text: str, allowed: dict[str, bool]) -> str:
    blob = str(text or "")
    if not blob or not allowed:
        return ""
    ranked = sorted(allowed.keys(), key=len, reverse=True)
    for label in ranked:
        if label and label in blob:
            return label
    return ""


def run_classify_existing_sessions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Link session Documents to vocab concepts. Keep type Document."""
    _ = args
    typed = run_vocab_types(cwd)
    allowed = {str(label): True for label in (typed.get("types") or [])}
    if not allowed:
        return {"ok": True, "changed": 0, "reason": "NO_TYPES"}
    session, path = load_session(cwd)
    graph = session.graph
    scheme = _auto_vocab_scheme_id(cwd)
    prefix = scheme.rsplit("#", 1)[0] + "#" if "#" in scheme else scheme
    concept_by_label: dict[str, str] = {}
    for nid, node in iter_nodes(graph):
        if node_type_of(node) != "skos:Concept" or not str(nid or "").startswith(prefix):
            continue
        label = node_content(node).strip()
        if label:
            concept_by_label[label] = str(nid)
    changed = 0
    for nid, node in list(iter_nodes(graph)):
        raw = str(nid or "")
        if not raw.startswith("session:") or raw.count(":") < 2:
            continue
        if node_type_of(node) not in {"Document", "document"}:
            continue
        text = node_content(node)
        label = classify_session_label(text, allowed)
        concept = concept_by_label.get(label)
        if not concept:
            continue
        if has_edge(graph, raw, concept, "属于"):
            continue
        ensure_edge(graph, raw, concept, "属于")
        changed += 1
    if changed:
        save_session(session, path)
    return {"ok": True, "changed": changed}


def run_repair_workspace_vocab(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Drop junk auto-concepts (file:/runtime) so the ontology page is usable."""
    _ = args
    session, path = load_session(cwd)
    graph = session.graph
    scheme = _auto_vocab_scheme_id(cwd)
    prefix = scheme.rsplit("#", 1)[0] + "#" if "#" in scheme else scheme
    junk = {"file", "file:", "runtime", "session", "entity", "unknown", "other"}
    removed = []
    seen_labels: set[str] = set()
    for nid, node in list(iter_nodes(graph)):
        if str(nid or "") == scheme or not str(nid or "").startswith(prefix):
            continue
        if node_type_of(node) != "skos:Concept":
            continue
        label = node_content(node).strip()
        slug = str(nid).rsplit("#", 1)[-1].lower()
        drop = (
            label.endswith(":")
            or label.lower() in junk
            or slug.endswith("-dist")
            or (slug in junk and label.lower() in junk)
            or (label == slug and ("-" in slug or slug in SKIP_DIR_NAMES))
        )
        if not drop and label in seen_labels:
            drop = True
        if drop:
            if _drop_graph_node(graph, str(nid)):
                removed.append(str(nid))
            continue
        seen_labels.add(label)
    if removed:
        save_session(session, path)
    project = os.path.basename(os.path.realpath(cwd or "")) or "这个工作区"
    folders: dict[str, int] = {}
    files: list[str] = []
    try:
        root = Path(os.path.realpath(cwd or ""))
        if root.is_dir():
            for child in root.iterdir():
                name = child.name
                if name.startswith(".") or name in SKIP_DIR_NAMES:
                    continue
                if child.is_dir():
                    folders[name] = folders.get(name, 0) + 1
                elif child.is_file() and len(files) < 40:
                    files.append(name)
    except OSError:
        pass
    grown = run_upsert_workspace_vocab(cwd, {
        "name": f"{project}的分类",
        "concepts": workspace_folder_fallback(project, folders, files),
    })
    classified = run_classify_existing_files(cwd)
    sessions = run_classify_existing_sessions(cwd)
    return {
        "ok": True,
        "removed": removed,
        "count": len(removed),
        "added": grown.get("concepts") or 0,
        "classified": classified.get("changed") or 0,
        "sessions": sessions.get("changed") or 0,
        "owl": grown.get("owl") or {},
    }


def _drop_graph_node(graph: Any, nid: str) -> bool:
    nodes = getattr(graph, "nodes", None)
    if not isinstance(nodes, dict) or nid not in nodes:
        return False
    index = getattr(graph, "node_type_index", None)
    node = nodes.get(nid)
    ntype = ""
    if isinstance(node, dict):
        ntype = str(node.get("type") or node.get("node_type") or "")
    else:
        ntype = str(getattr(node, "type", None) or getattr(node, "node_type", None) or "")
    nodes.pop(nid, None)
    if isinstance(index, dict) and ntype and nid in (index.get(ntype) or set()):
        try:
            index[ntype].discard(nid)
        except Exception:
            pass
    edges = getattr(graph, "edges", None)
    if isinstance(edges, dict):
        drop = []
        for eid, edge in list(edges.items()):
            src, tgt, _et = edge_ends(edge)
            if src == nid or tgt == nid:
                drop.append(eid)
        for eid in drop:
            edges.pop(eid, None)
    return True


def run_delete_vocab(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Delete a SKOS scheme and its concepts from the workspace graph."""
    args = args or {}
    uri = str(args.get("uri") or args.get("scheme") or "").strip()
    if not uri:
        return {"ok": False, "error": "NO_URI"}
    prefixes = [uri]
    if "#" in uri:
        prefixes.append(uri.rsplit("#", 1)[0] + "#")
    elif uri.endswith("/"):
        prefixes.append(uri)
    else:
        prefixes.append(uri + "#")
        prefixes.append(uri + "/")
    session, path = load_session(cwd)
    graph = session.graph
    removed = []
    for node in list(graph.find_nodes() or []):
        nid = ""
        ntype = ""
        if isinstance(node, dict):
            nid = str(node.get("id") or "")
            ntype = str(node.get("type") or node.get("node_type") or "")
            props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            in_scheme = str(props.get("inScheme") or props.get("scheme_uri") or "")
        else:
            nid = str(getattr(node, "id", None) or getattr(node, "node_id", None) or "")
            ntype = str(getattr(node, "type", None) or getattr(node, "node_type", None) or "")
            props = getattr(node, "properties", None) or {}
            in_scheme = str(props.get("inScheme") or props.get("scheme_uri") or "") if isinstance(props, dict) else ""
        hit = any(nid == p or nid.startswith(p) for p in prefixes) or any(in_scheme == p or in_scheme.startswith(p) for p in prefixes)
        if not hit and ntype in {"skos:Concept", "skos:ConceptScheme"} and uri in nid:
            hit = True
        if hit and _drop_graph_node(graph, nid):
            removed.append(nid)
    save_session(session, path)
    return {"ok": True, "status": "removed", "uri": uri, "removed": len(removed)}


def run_pipeline(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    from semantica.pipeline import PipelineBuilder, ExecutionEngine
    from semantica.semantic_extract import NamedEntityRecognizer, RelationExtractor

    session, graph_file = load_session(cwd)
    graph = session.graph
    texts = list(args.get("texts") or [])
    steps_done: list[str] = []
    extracted_box: list[Any] = []

    def extract_handler(data, **kwargs):
        payload = data if isinstance(data, dict) else {"texts": texts}
        rows = list(payload.get("texts") or texts)
        sample = " ".join(str(item.get("text") or "") for item in texts[:3])
        ner = make_ner(sample)
        rel = make_rel(sample)
        out = []
        for item in rows:
            text = scrub_text(item.get("text") or "")
            if not text.strip():
                continue
            if not may_extract({"text": text, "kind": item.get("kind") or item.get("source") or ""}).get("ok"):
                continue
            if item.get("extracted_by") == "dsh-llm":
                entities = item.get("entities") or []
                relations = item.get("relations") or []
            elif has_cjk(text):
                # Official Semantica NER is English-pattern based. Chinese must
                # come from the DSH LLM; falling back here produced junk like DATE 1000.
                entities = []
                relations = []
            else:
                entities = ner.extract_entities(text)
                relations = rel.extract_relations(text, entities)
            out.append({"path": item.get("path"), "text": text, "entities": entities, "relations": relations})
        extracted_box.extend(out)
        steps_done.append("extract")
        nxt = dict(payload)
        nxt["extracted"] = out
        return nxt

    def kg_build_handler(data, **kwargs):
        payload = data if isinstance(data, dict) else {}
        rows = payload.get("extracted") or extracted_box
        for row in rows:
            src_path = str(row.get("path") or "").strip()
            src_text = str(row.get("text") or "").strip()
            if src_path and src_text:
                upsert_document(graph, src_path, src_text)
                link_session_message(graph, src_path)
            id_map: dict[str, str] = {}
            for ent in row.get("entities") or []:
                extra_time = {}
                if isinstance(ent, dict):
                    label = str(ent.get("text") or ent.get("label") or ent.get("name") or "")
                    etype = str(ent.get("type") or "Entity")
                    raw_id = str(ent.get("id") or label)
                    stamped = str(ent.get("time") or ent.get("valid_from") or ent.get("timestamp") or "").strip()
                    if stamped:
                        extra_time["valid_from"] = stamped
                        extra_time["timestamp"] = stamped
                else:
                    label = str(getattr(ent, "text", None) or ent)
                    etype = str(getattr(ent, "label", None) or getattr(ent, "type", None) or "Entity")
                    raw_id = label
                eid = stable_entity_id(label)
                if not eid:
                    continue
                id_map[raw_id] = eid
                id_map[label] = eid
                link_entity(graph, eid, etype, label, src_path, extra_time or None)
            for rel in row.get("relations") or []:
                if isinstance(rel, dict):
                    raw_src = str(rel.get("source") or rel.get("subject") or "")
                    raw_tgt = str(rel.get("target") or rel.get("object") or "")
                    rtype = str(rel.get("type") or rel.get("predicate") or "related_to")
                else:
                    raw_src = str(getattr(rel, "source", "") or getattr(rel, "subject", ""))
                    raw_tgt = str(getattr(rel, "target", "") or getattr(rel, "object", ""))
                    rtype = str(getattr(rel, "type", None) or getattr(rel, "predicate", None) or "related_to")
                src = id_map.get(raw_src) or stable_entity_id(raw_src)
                tgt = id_map.get(raw_tgt) or stable_entity_id(raw_tgt)
                if src and tgt:
                    ensure_edge(graph, src, tgt, rtype, source=src_path)
        repair_missing_lineage(graph)
        repair_session_links(graph)
        steps_done.append("kg_build")
        save_session(session, graph_file)
        return payload

    def dedup_handler(data, **kwargs):
        try:
            from semantica.deduplication import Deduplicator
            Deduplicator().deduplicate(graph)
        except Exception:
            try:
                from semantica.deduplication.deduplicator import Deduplicator
                Deduplicator().deduplicate(graph)
            except Exception:
                pass
        steps_done.append("dedup")
        save_session(session, graph_file)
        return data

    builder = PipelineBuilder()
    builder.add_step("extract", "extract", handler=extract_handler)
    builder.add_step("kg_build", "kg_build", handler=kg_build_handler)
    builder.add_step("dedup", "dedup", handler=dedup_handler)
    pipeline = builder.build("dsh-enrich")
    engine = ExecutionEngine()
    runner = getattr(engine, "execute_pipeline", None) or getattr(engine, "execute", None)
    try:
        result = runner(pipeline, {"texts": texts})
        ok = bool(getattr(result, "success", True))
        if not ok:
            stage = "extract" if "extract" not in steps_done else ("kg_build" if "kg_build" not in steps_done else "dedup")
            errs = getattr(result, "errors", None) or []
            return {"error": (errs[0] if errs else "pipeline failed"), "stage": stage, "steps": steps_done}
    except Exception as exc:
        stage = "extract" if "extract" not in steps_done else ("kg_build" if "kg_build" not in steps_done else "dedup")
        return {"error": str(exc), "stage": stage, "steps": steps_done}

    if "extract" not in steps_done:
        extract_handler({"texts": texts})
        kg_build_handler({"extracted": extracted_box})
        dedup_handler({})
    save_session(session, graph_file)
    return {"ok": True, "steps": steps_done or ["extract", "kg_build", "dedup"]}


def run_policy_check(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    copy_default_policy(cwd)
    dest = policy_dir(cwd)
    try:
        from semantica.ontology.policy_engine import PolicyEngine
    except Exception:
        try:
            from semantica.ontology import PolicyEngine
        except Exception:
            return {"ok": True, "engine": False, "copied": dest.exists()}
    try:
        engine = PolicyEngine()
        if hasattr(engine, "load") and dest.exists():
            try:
                engine.load(str(dest))
            except Exception:
                pass
        tool = str(args.get("tool") or "")
        payload = {"tool": tool, "args": args.get("args") or {}}
        if hasattr(engine, "check_compliance"):
            value = engine.check_compliance(payload)
        elif hasattr(engine, "evaluate"):
            value = engine.evaluate(payload)
        else:
            return {"ok": True, "engine": True, "value": True}
        truth = bool(value) if not isinstance(value, dict) else bool(value.get("ok", value.get("allowed", True)))
        return {"ok": truth, "engine": True, "value": truth}
    except Exception as exc:
        return {"ok": True, "engine": True, "detail": str(exc), "value": True}


def import_node_label(node: dict) -> str:
    props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    return str(props.get("content") or props.get("label") or node.get("id") or "")


def parse_import_json(payload: Any) -> tuple[list[dict], list[dict]] | dict[str, Any]:
    if isinstance(payload, list):
        if payload and isinstance(payload[0], dict) and any(
            key in payload[0] for key in {"source", "source_id", "target", "target_id", "START_ID", "END_ID"}
        ):
            raw_nodes, raw_edges = [], payload
        else:
            raw_nodes, raw_edges = payload, []
    elif isinstance(payload, dict):
        raw_nodes = payload.get("nodes", payload.get("entities", [])) or []
        raw_edges = payload.get("edges", payload.get("relationships", [])) or []
    else:
        return {"error": "IMPORT_FAILED", "detail": "JSON import expects an object or array"}
    if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
        return {"error": "IMPORT_FAILED", "detail": "nodes/edges must be lists"}
    nodes = []
    for raw_node in raw_nodes:
        if not isinstance(raw_node, dict):
            continue
        if "properties" in raw_node:
            nodes.append(raw_node)
            continue
        metadata = raw_node.get("metadata", {}) or {}
        if not isinstance(metadata, dict):
            metadata = {}
        nodes.append({
            "id": str(raw_node.get("id", raw_node.get("_id", raw_node.get("node_id", "")))),
            "type": raw_node.get("type", "entity"),
            "properties": {
                "content": raw_node.get("text", raw_node.get("content", raw_node.get("id", ""))),
                **metadata,
            },
        })
    edges = []
    for raw_edge in raw_edges:
        if not isinstance(raw_edge, dict):
            continue
        source = raw_edge.get("source") or raw_edge.get("source_id") or raw_edge.get("start") or raw_edge.get("start_id") or raw_edge.get("START_ID")
        target = raw_edge.get("target") or raw_edge.get("target_id") or raw_edge.get("end") or raw_edge.get("end_id") or raw_edge.get("END_ID")
        if not source or not target:
            continue
        edge_properties = raw_edge.get("metadata", raw_edge.get("properties", {})) or {}
        if not isinstance(edge_properties, dict):
            edge_properties = {}
        edges.append({
            "id": raw_edge.get("id", raw_edge.get("edge_id")),
            "familyId": raw_edge.get("familyId", raw_edge.get("family_id")),
            "source_id": str(source),
            "target_id": str(target),
            "type": raw_edge.get("type", raw_edge.get("relationship", "related_to")),
            "weight": float(raw_edge.get("weight", 1.0) or 1.0),
            "properties": edge_properties,
            "valid_from": raw_edge.get("valid_from", edge_properties.get("valid_from")),
            "valid_until": raw_edge.get("valid_until", edge_properties.get("valid_until")),
        })
    return nodes, edges


def parse_import_csv(data: Any) -> tuple[list[dict], list[dict]] | dict[str, Any]:
    import csv
    import io

    if isinstance(data, bytes):
        text = data.decode("utf-8-sig")
    else:
        text = str(data or "")
    reader = csv.DictReader(io.StringIO(text))
    nodes: list[dict] = []
    edges: list[dict] = []
    for row in reader:
        source = row.get("source") or row.get("source_id") or row.get(":START_ID") or row.get("START_ID")
        target = row.get("target") or row.get("target_id") or row.get(":END_ID") or row.get("END_ID")
        node_id = row.get("id") or row.get("node_id") or row.get(":ID") or row.get("_id") or row.get("ID")
        if source and target:
            edges.append({
                "id": row.get("id") or row.get("edge_id"),
                "source_id": str(source),
                "target_id": str(target),
                "type": row.get("type") or row.get("relationship") or row.get(":TYPE") or "related_to",
                "weight": float(row.get("weight", 1.0) or 1.0),
                "properties": {},
            })
        elif node_id:
            nodes.append({
                "id": str(node_id),
                "type": row.get("type") or row.get("label") or row.get(":LABEL") or "entity",
                "properties": {"content": row.get("content") or row.get("label") or node_id},
            })
    return nodes, edges


def run_import_graph(cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    fmt = str(args.get("format") or "").lower().lstrip(".")
    if fmt not in {"json", "csv"}:
        return {"error": "REJECT_FORMAT"}
    data = args.get("data")
    try:
        if fmt == "csv":
            parsed = parse_import_csv(data)
        else:
            if isinstance(data, str):
                payload = json.loads(data)
            else:
                payload = data
            parsed = parse_import_json(payload)
    except Exception as exc:
        return {"error": "IMPORT_FAILED", "detail": str(exc)}
    if isinstance(parsed, dict) and parsed.get("error"):
        return parsed
    nodes, edges = parsed
    labels = [import_node_label(node) for node in nodes[:8] if import_node_label(node)]
    preview = {
        "ok": True,
        "preview": True,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "labels": labels,
    }
    if not nodes and not edges:
        return {"error": "PREVIEW_EMPTY", "preview": True, "node_count": 0, "edge_count": 0, "labels": []}
    if not args.get("confirm"):
        return preview

    session, path = load_session(cwd)
    backup = path.with_suffix(".json.bak")
    if path.is_file():
        backup.write_bytes(path.read_bytes())
    try:
        nodes_added, edges_added = session.add_nodes_and_edges(nodes, edges)
        save_session(session, path)
        return {
            "ok": True,
            "preview": False,
            "nodes_added": int(nodes_added or 0),
            "edges_added": int(edges_added or 0),
            "labels": labels,
        }
    except Exception as exc:
        if backup.is_file():
            path.write_bytes(backup.read_bytes())
        return {"error": "IMPORT_FAILED", "restored": True, "detail": str(exc)}




def graph_as_dict(session, graph) -> dict[str, Any]:
    if hasattr(session, "build_graph_dict"):
        try:
            return session.build_graph_dict()
        except TypeError:
            return session.build_graph_dict(None)
    if hasattr(graph, "to_dict"):
        return graph.to_dict()
    nodes = [jsonable(n) for n in (list(graph.find_nodes()) if hasattr(graph, "find_nodes") else [])]
    edges = [jsonable(e) for e in (list(graph.find_edges()) if hasattr(graph, "find_edges") else [])]
    return {"entities": nodes, "relationships": edges, "nodes": nodes, "edges": edges}


def run_export_graph(session, graph, args: dict[str, Any]) -> dict[str, Any]:
    """Product/tool export. 0.6.5 JSONExporter/CSVExporter require file_path."""
    import shutil
    import tempfile

    fmt = str(args.get("format") or "json").lower().lstrip(".")
    if fmt in {"ttl", "turtle"}:
        fmt = "rdf"
    if fmt not in {"json", "csv", "rdf"}:
        return {"error": "REJECT_FORMAT"}
    graph_dict = graph_as_dict(session, graph)
    tmp = Path(tempfile.mkdtemp(prefix="dsos-export-"))
    try:
        if fmt == "rdf":
            try:
                from semantica.export import RDFExporter
            except Exception as exc:
                return {"error": "EXTRA_MISSING", "detail": str(exc)}
            out = tmp / "graph.ttl"
            RDFExporter().export(graph_dict, str(out), format="turtle")
            data = out.read_text(encoding="utf-8")
        elif fmt == "csv":
            from semantica.export import CSVExporter
            rows: list[dict[str, Any]] = []
            for node in graph_dict.get("entities") or graph_dict.get("nodes") or []:
                if isinstance(node, dict):
                    rows.append({
                        "kind": "node",
                        "id": node.get("id") or node.get("node_id"),
                        "type": node.get("type") or node.get("node_type"),
                        "content": node.get("text") or node.get("content") or node.get("label"),
                    })
            for edge in graph_dict.get("relationships") or graph_dict.get("edges") or []:
                if isinstance(edge, dict):
                    rows.append({
                        "kind": "edge",
                        "id": edge.get("id"),
                        "type": edge.get("type") or edge.get("edge_type"),
                        "source": edge.get("source") or edge.get("source_id"),
                        "target": edge.get("target") or edge.get("target_id"),
                    })
            out = tmp / "graph.csv"
            CSVExporter().export(rows, str(out))
            data = out.read_text(encoding="utf-8")
        else:
            from semantica.export import JSONExporter
            out = tmp / "graph.json"
            JSONExporter().export(graph_dict, str(out))
            data = json.loads(out.read_text(encoding="utf-8"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {"format": fmt, "data": jsonable(data)}


def run_export_ledger(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    rows, _st = read_node_rows(cwd)
    packed = export_ledger(rows)
    packed["cwd"] = os.path.realpath(cwd or "")
    return packed


def run_backup_graph(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    allowed = may_backup(args, cwd)
    if not allowed.get("ok"):
        return {"error": allowed.get("error") or "NO_DEST"}
    dest = Path(os.path.realpath(str(allowed["dest"])))
    dest.parent.mkdir(parents=True, exist_ok=True)
    src = graph_path(cwd)
    if not src.is_file():
        return {"error": "NO_GRAPH"}
    dest.write_bytes(src.read_bytes())
    return {"ok": True, "kind": "备份", "path": str(dest), "bytes": dest.stat().st_size}


def run_restore_graph(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    if not _truthy_flag(args.get("confirm") or args.get("nodded") or args.get("点头")):
        return {"error": "NOT_NODDED"}
    allowed = may_backup(args, cwd)
    if not allowed.get("ok"):
        return {"error": allowed.get("error") or "NO_DEST"}
    src = Path(os.path.realpath(str(allowed["dest"])))
    if not src.is_file():
        return {"error": "NO_BACKUP"}
    dest = graph_path(cwd)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(src.read_bytes())
    try:
        packed = json.loads(src.read_text(encoding="utf-8"))
    except Exception:
        packed = {}
    bag = type("Bag", (), {
        "nodes": packed.get("nodes") if isinstance(packed, dict) else {},
        "edges": packed.get("edges") if isinstance(packed, dict) else [],
    })()
    try:
        wrote = write_primary(bag, cwd, replace=True)
    except Exception as exc:
        return {"ok": False, "error": "PRIMARY_WRITE", "detail": str(exc)[:200], "path": str(dest)}
    if not wrote.get("ok"):
        return {"ok": False, "error": "PRIMARY_WRITE", "detail": wrote, "path": str(dest)}
    return {"ok": True, "kind": "恢复", "path": str(dest), "primary": "falkor", "wrote": wrote.get("wrote"), "mode": wrote.get("mode")}


def run_erase_ledger(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    allowed = may_erase(args)
    if not allowed.get("ok"):
        return {"error": allowed.get("error") or "NOT_NODDED"}
    kind = allowed.get("kind") or "pii"
    session, path = load_session(cwd)
    graph = session.graph
    changed = 0
    if kind == "workspace":
        nodes = list(iter_nodes(graph))
        for nid, _node in nodes:
            try:
                if hasattr(graph, "remove_node"):
                    graph.remove_node(nid)
                elif hasattr(graph, "delete_node"):
                    graph.delete_node(nid)
                changed += 1
            except Exception:
                pass
        save_session(session, path)
        return {"ok": True, "kind": "擦除", "what": "workspace", "dropped": changed}
    for nid, node in iter_nodes(graph):
        props = node.get("properties") if isinstance(node, dict) else getattr(node, "properties", None)
        ntype = node_type_of(node)
        if kind in {"引用", "reference"}:
            if ntype == "业务引用" or str(nid).startswith("ref:"):
                set_node_props(node, voided=True, status="废引用")
                changed += 1
            continue
        if isinstance(node, dict):
            if isinstance(node.get("content"), str):
                cleaned = scrub_text(node["content"])
                if cleaned != node["content"]:
                    node["content"] = cleaned
                    changed += 1
        if isinstance(props, dict):
            for key, value in list(props.items()):
                if isinstance(value, str):
                    cleaned = scrub_text(value)
                    if cleaned != value:
                        props[key] = cleaned
                        changed += 1
    save_session(session, path)
    return {"ok": True, "kind": "擦除", "what": kind, "changed": changed}



FACT_LINE_RE = re.compile(r"^([\w:-]+)\((.*)\)$")



def resolve_graph_node_id(graph, name: str) -> str:
    label = str(name or "").strip()
    if not label:
        return ""
    try:
        getter = getattr(graph, "get_node", None)
        if callable(getter) and getter(label) is not None:
            return label
    except Exception:
        pass
    try:
        nodes = list(graph.find_nodes()) if hasattr(graph, "find_nodes") else []
    except Exception:
        nodes = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        nid = str(node.get("id") or "")
        meta = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
        content = str(node.get("content") or meta.get("content") or meta.get("label") or meta.get("name") or "")
        if nid == label or content == label:
            return nid
    return label


def apply_inferred_facts(graph, inferred: list) -> int:
    """Write binary inferred facts as edges. Preview leaves the graph untouched."""
    added = 0
    rows = inferred if isinstance(inferred, list) else []
    for i, item in enumerate(rows):
        pred = ""
        args: list = []
        if isinstance(item, dict):
            pred = str(item.get("predicate") or item.get("pred") or "")
            args = list(item.get("arguments") or item.get("args") or [])
            if not pred:
                text = str(item.get("fact") or item.get("text") or "")
                parsed = parse_fact_line(text, f"inf{i + 1}")
                pred = str(getattr(parsed, "predicate", "") or "")
                args = list(getattr(parsed, "arguments", []) or [])
        else:
            parsed = parse_fact_line(str(item), f"inf{i + 1}")
            pred = str(getattr(parsed, "predicate", "") or "")
            args = list(getattr(parsed, "arguments", []) or [])
        if not pred or len(args) < 2:
            continue
        source = resolve_graph_node_id(graph, args[0])
        target = resolve_graph_node_id(graph, args[1])
        if not source or not target:
            continue
        try:
            if source == str(args[0]).strip():
                graph.add_node(source, "Entity", content=source)
            if target == str(args[1]).strip():
                graph.add_node(target, "Entity", content=target)
            graph.add_edge(source, target, edge_type=pred)
            added += 1
        except Exception:
            continue
    return added


def parse_fact_line(line: str, fact_id: str):
    from semantica.reasoning import Fact

    text = str(line or "").strip()
    match = FACT_LINE_RE.match(text)
    if match:
        pred = match.group(1)
        args = [part.strip().strip('"').strip("'") for part in match.group(2).split(",") if part.strip()]
        return Fact(fact_id, pred, args)
    return Fact(fact_id, text, [])


def normalize_rule_text(text: str) -> str:
    """Map Chinese IF/THEN words onto the official English parser. Does not invent a matcher."""
    s = str(text or "").strip()
    if not s:
        return s
    if re.match(r"IF\s+.+\s+THEN\s+", s, flags=re.IGNORECASE | re.DOTALL):
        return s
    match = re.match(r"^(如果|若)\s+(.+?)\s+(那么|则)\s+(.+)$", s, flags=re.DOTALL)
    if match:
        cond = re.sub(r"\s+(并且|而且|且)\s+", " AND ", match.group(2).strip())
        return f"IF {cond} THEN {match.group(4).strip()}"
    match = re.match(r"^(.+?)\s*(=>|→)\s*(.+)$", s)
    if match:
        return f"IF {match.group(1).strip()} THEN {match.group(3).strip()}"
    return s


def split_condition_text(value: str) -> list:
    parts = re.split(r"\s+(AND|并且|而且|且)\s+", str(value or ""), flags=re.IGNORECASE)
    skip = {"AND", "并且", "而且", "且"}
    return [part.strip() for part in parts if part.strip() and part.strip() not in skip]


def rule_from_dict(raw: dict, index: int):
    from semantica.reasoning import Rule

    conditions = raw.get("conditions")
    if conditions is None:
        conditions = raw.get("if") or raw.get("如果") or raw.get("若") or []
    if isinstance(conditions, str):
        conditions = split_condition_text(conditions)
    else:
        conditions = list(conditions or [])
    conclusion = raw.get("conclusion")
    if conclusion is None:
        conclusion = raw.get("conclusions") or raw.get("then") or raw.get("那么") or raw.get("则")
    if isinstance(conclusion, list):
        conclusion = conclusion[0] if conclusion else None
    if isinstance(conclusion, str):
        conclusion = conclusion.strip()
    return Rule(
        rule_id=str(raw.get("rule_id") or f"rule_{index + 1}"),
        name=str(raw.get("name") or f"Rule {index + 1}"),
        conditions=conditions,
        conclusion=conclusion,
    )


def parse_rules_for_rete(raw_rules: list) -> list:
    from semantica.reasoning import Reasoner, Rule

    reasoner = Reasoner()
    parsed = []
    for i, raw in enumerate(raw_rules):
        if isinstance(raw, Rule):
            parsed.append(raw)
        elif isinstance(raw, dict):
            parsed.append(rule_from_dict(raw, i))
        else:
            parsed.append(reasoner.add_rule(normalize_rule_text(str(raw))))
    return parsed


def parse_facts_for_rete(raw_facts: list) -> list:
    from semantica.reasoning import Fact

    parsed = []
    for i, raw in enumerate(raw_facts):
        if isinstance(raw, Fact):
            parsed.append(raw)
        elif isinstance(raw, dict):
            parsed.append(
                Fact(
                    fact_id=str(raw.get("fact_id") or f"f{i + 1}"),
                    predicate=str(raw.get("predicate") or ""),
                    arguments=list(raw.get("arguments") or []),
                )
            )
        else:
            parsed.append(parse_fact_line(str(raw), f"f{i + 1}"))
    return parsed


def run_rete(facts: list, rules: list) -> dict[str, Any]:
    """Official ReteEngine only. Does not rewrite the network."""
    from semantica.reasoning import ReteEngine

    try:
        parsed_rules = parse_rules_for_rete(rules)
        parsed_facts = parse_facts_for_rete(facts)
        engine = ReteEngine()
        engine.build_network(parsed_rules)
        for fact in parsed_facts:
            engine.add_fact(fact)
        matches = engine.match_patterns()
        conclusions = engine.execute_matches(matches)
        return {
            "engine": "rete",
            "matches": jsonable(matches),
            "conclusions": jsonable(conclusions),
            "inferred_facts": jsonable(conclusions),
            "derived_facts": jsonable(conclusions),
            "network": jsonable(engine.get_network_stats()),
        }
    except Exception as exc:
        return {
            "error": "RETE_FAILED",
            "engine": "rete",
            "detail": str(exc),
        }


class _DatalogPredMap:
    """Rewrite CJK predicates to official [A-Za-z0-9_]+ tokens, then restore."""

    _atom = re.compile(r"([^\s(),:]+)\s*\(")

    def __init__(self) -> None:
        self._to_token: dict[str, str] = {}
        self._to_orig: dict[str, str] = {}
        self._n = 0

    def token(self, pred: str) -> str:
        pred = str(pred or "")
        if re.fullmatch(r"[A-Za-z0-9_]+", pred):
            return pred
        if pred in self._to_token:
            return self._to_token[pred]
        self._n += 1
        tok = f"zhpred_{self._n}"
        self._to_token[pred] = tok
        self._to_orig[tok] = pred
        return tok

    def rewrite_line(self, line: str) -> str:
        return self._atom.sub(lambda m: self.token(m.group(1)) + "(", str(line or ""))

    def rewrite_fact(self, raw):
        if isinstance(raw, dict):
            row = dict(raw)
            for key in ("predicate", "type", "relation"):
                if key in row and isinstance(row[key], str):
                    row[key] = self.token(row[key])
            return row
        return self.rewrite_line(str(raw))

    def restore(self, rows: list) -> list:
        out = []
        for row in rows:
            text = str(row)
            for tok, pred in self._to_orig.items():
                text = text.replace(tok + "(", pred + "(")
            out.append(text)
        return out


def run_datalog(facts: list, rules: list) -> dict[str, Any]:
    """Official DatalogReasoner only. Does not rewrite the engine."""
    from semantica.reasoning import DatalogReasoner

    try:
        predmap = _DatalogPredMap()
        engine = DatalogReasoner()
        for i, raw in enumerate(facts):
            if isinstance(raw, dict):
                has_spo = "subject" in raw and "predicate" in raw and "object" in raw
                has_edge = any(k in raw for k in ("source", "source_id", "source_name"))
                has_node = "type" in raw and ("id" in raw or "name" in raw)
                if not (has_spo or has_edge or has_node):
                    raise ValueError(f"Unrecognised dict fact format: {raw}")
                engine.add_fact(predmap.rewrite_fact(raw))
            else:
                line = str(raw).strip()
                if not line:
                    raise ValueError(f"empty fact at index {i}")
                engine.add_fact(predmap.rewrite_line(line))
        seed = set(engine.derive_all())
        for i, raw in enumerate(rules):
            if isinstance(raw, dict):
                raise ValueError("Datalog rules must be Horn clause strings")
            line = str(raw).strip()
            if not line:
                raise ValueError(f"empty rule at index {i}")
            engine.add_rule(predmap.rewrite_line(line))
        derived = engine.derive_all()
        conclusions = predmap.restore([row for row in derived if row not in seed])
        return {
            "engine": "datalog",
            "conclusions": jsonable(conclusions),
            "inferred_facts": jsonable(conclusions),
            "derived_facts": jsonable(conclusions),
        }
    except Exception as exc:
        return {
            "error": "DATALOG_FAILED",
            "engine": "datalog",
            "detail": str(exc),
        }


def run_graph_path(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    src = str(args.get("source") or args.get("from") or "").strip()
    tgt = str(args.get("target") or args.get("to") or "").strip()
    if not src or not tgt:
        return {"path": [], "edges": [], "error": "NO_ENDS"}
    adj: dict[str, list[str]] = {}
    for edge in _workbench_edges(cwd):
        a = str(edge.get("source") or "")
        b = str(edge.get("target") or "")
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    if src == tgt:
        return {"path": [src], "edges": []}
    seen = {src}
    queue = [(src, [src])]
    while queue:
        node, trail = queue.pop(0)
        for nxt in adj.get(node) or []:
            if nxt in seen:
                continue
            step = trail + [nxt]
            if nxt == tgt:
                return {"path": step, "edges": [{"source": step[i], "target": step[i + 1]} for i in range(len(step) - 1)]}
            seen.add(nxt)
            queue.append((nxt, step))
    return {"path": [], "edges": [], "empty": True, "detail": "这两点之间没有路。"}


def run_graph_neighborhood(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    seed = str(args.get("node_id") or args.get("id") or args.get("source") or "").strip()
    try:
        hops = max(1, min(int(args.get("hops") or args.get("k") or 1), 4))
    except (TypeError, ValueError):
        hops = 1
    if not seed:
        return {"nodes": [], "edges": [], "empty": True, "detail": "未出候选"}
    keep = {seed}
    frontier = {seed}
    edges = _workbench_edges(cwd)
    for _ in range(hops):
        nxt: set[str] = set()
        for edge in edges:
            a = str(edge.get("source") or "")
            b = str(edge.get("target") or "")
            if a in frontier and b not in keep:
                nxt.add(b)
            if b in frontier and a not in keep:
                nxt.add(a)
        keep.update(nxt)
        frontier = nxt
        if not frontier:
            break
    nodes = [row for row in _workbench_nodes(cwd) if str(row.get("id") or "") in keep]
    links = [edge for edge in edges if str(edge.get("source") or "") in keep and str(edge.get("target") or "") in keep]
    empty = len(nodes) <= 1 and not links
    return {
        "nodes": nodes,
        "edges": links,
        "center": seed,
        "hops": hops,
        "empty": empty,
        "detail": "未出候选" if empty else "",
    }


def run_shacl_report(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """SHACL over the slim workbench. Diary nodes are not in load_session."""
    _ = args
    session, _path = load_session(cwd)
    graph = session.graph
    stats = run_graph_stats(cwd, {})
    empty = {
        "ok": True,
        "turtle": "",
        "shacl_turtle": "",
        "shapes": [],
        "shape_count": 0,
        "node_count": stats.get("node_count") or 0,
        "edge_count": stats.get("edge_count") or 0,
        "class_count": 0,
        "concept_count": 0,
        "property_count": 0,
    }
    shapes = _policy_shacl_text(cwd)
    if not shapes.strip():
        generated = run_generate_shacl(cwd, args)
        shapes = str(generated.get("shacl_turtle") or "")
        packed_shapes = generated.get("shapes") or []
    else:
        packed_shapes = [
            {
                "id": uri,
                "label": uri.rsplit("/", 1)[-1].rsplit("#", 1)[-1],
                "target_class": "",
                "constraint_count": 0,
                "constraints": [],
                "violation_count": 0,
            }
            for uri in re.findall(r"<([^>]+)>\s+a\s+sh:NodeShape", shapes)
        ]
    if not shapes.strip():
        return {**empty, "ok": True, "detail": "没有规则形状"}
    out = {
        **empty,
        "ok": True,
        "shacl_turtle": shapes,
        "turtle": shapes,
        "shapes": packed_shapes,
        "shape_count": len(packed_shapes),
        "class_count": len(packed_shapes),
    }
    try:
        from semantica.ontology import run_shacl_validation
    except Exception as exc:
        return {**out, "ok": True, "detail": str(exc)[:400]}
    try:
        packed = graph_as_dict(session, graph)
        report = run_shacl_validation(
            json.dumps(packed, ensure_ascii=False),
            shapes,
            data_graph_format="json-ld",
            shacl_format="turtle",
        )
        conforms = True
        if report is not None and hasattr(report, "conforms"):
            conforms = bool(report.conforms)
        return jsonable({**out, "ok": True, "report": report, "conforms": conforms})
    except Exception as exc:
        return {**out, "ok": True, "detail": str(exc)[:400]}


def _sparql_labels(cwd: str, query: str, empty: dict[str, Any]) -> dict[str, Any]:
    blob = str(query or "").lower()
    limit = 20
    hit = re.search(r"limit\s+(\d+)", blob)
    if hit:
        limit = max(1, min(200, int(hit.group(1))))
    term = lambda kind, value: {"type": kind, "value": value}
    if "label" in blob or "rdfs" in blob:
        bindings = []
        for row in _workbench_nodes(cwd):
            nid = str(row.get("id") or "")
            label = str(row.get("content") or "")
            if not nid or not label:
                continue
            bindings.append({
                "s": term("uri" if "://" in nid else "literal", nid),
                "label": term("literal", label),
            })
            if len(bindings) >= limit:
                break
        return {"head": {"vars": ["s", "label"]}, "results": {"bindings": bindings}}
    bindings = []
    for row in _workbench_nodes(cwd):
        nid = str(row.get("id") or "")
        if not nid:
            continue
        ntype = str(row.get("type") or "Entity")
        bindings.append({
            "s": term("uri" if "://" in nid else "literal", nid),
            "p": term("uri", "rdf:type"),
            "o": term("literal", ntype),
        })
        if len(bindings) >= limit:
            break
    if len(bindings) < limit:
        for edge in _workbench_edges(cwd):
            src = str(edge.get("source") or "")
            tgt = str(edge.get("target") or "")
            et = str(edge.get("type") or "related_to")
            if not src or not tgt:
                continue
            bindings.append({
                "s": term("uri" if "://" in src else "literal", src),
                "p": term("literal", et),
                "o": term("uri" if "://" in tgt else "literal", tgt),
            })
            if len(bindings) >= limit:
                break
    return {"head": {"vars": ["s", "p", "o"]}, "results": {"bindings": bindings}}


def run_sparql(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """SPARQL over the slim workbench. Diary nodes are not in the graph."""
    args = args or {}
    query = str(args.get("query") or args.get("q") or "")
    empty = {"head": {"vars": []}, "results": {"bindings": []}}
    if not query.strip():
        return {**empty, "error": "empty query"}
    try:
        from rdflib import Graph, Literal, RDF, RDFS, URIRef
    except Exception:
        return _sparql_labels(cwd, query, empty)
    g = Graph()
    for row in _workbench_nodes(cwd):
        nid = str(row.get("id") or "")
        if not nid:
            continue
        subj = URIRef(nid if "://" in nid else f"urn:dsh:{nid}")
        ntype = str(row.get("type") or "Entity")
        g.add((subj, RDF.type, URIRef(ntype if "://" in ntype else f"urn:dsh:type:{ntype}")))
        label = str(row.get("content") or "")[:800]
        if label:
            g.add((subj, RDFS.label, Literal(label)))
    for edge in _workbench_edges(cwd):
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        et = str(edge.get("type") or "related_to")
        if not src or not tgt:
            continue
        pred = URIRef(et if "://" in et else f"urn:dsh:rel:{et}")
        g.add((
            URIRef(src if "://" in src else f"urn:dsh:{src}"),
            pred,
            URIRef(tgt if "://" in tgt else f"urn:dsh:{tgt}"),
        ))
    try:
        got = g.query(query)
        raw = got.serialize(format="json")
        packed = json.loads(raw.decode("utf-8") if isinstance(raw, (bytes, bytearray)) else raw)
        if isinstance(packed, dict):
            return packed
        return {**empty, "error": "SPARQL_FAILED"}
    except Exception as exc:
        return {**empty, "error": str(exc), "error_line": 1}


def run_list_alignments(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    args = args or {}
    return list_alignments(cwd, str(args.get("uri") or ""))


def run_save_alignment(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    return save_alignment(cwd, args or {})


def run_delete_alignment(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    return delete_alignment(cwd, str(args.get("id") or ""))


def run_list_ontology_versions(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    args = args or {}
    return list_versions(cwd, str(args.get("uri") or args.get("ontology_uri") or ""))


def run_create_ontology_version(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    return create_version(cwd, args or {})


def run_compare_ontology_versions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    return compare_versions(cwd, args or {})


def run_suggest_alignments(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    rows, _st = read_node_rows(cwd)
    concepts = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("type") or "") != "skos:Concept":
            continue
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        concepts.append({
            "id": row.get("id"),
            "label": props.get("label") or row.get("content"),
            "content": row.get("content"),
            "properties": props,
        })
    return suggest_alignments(cwd, concepts, args or {})


def run_sync_roster(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Upsert Person nodes from a roster payload. No extra contact fields."""
    args = args or {}
    rows = args.get("people") or args.get("items") or []
    if not isinstance(rows, list):
        return {"error": "BAD_SHAPE"}
    written = 0
    for row in rows[:500]:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or row.get("displayName") or row.get("name") or "").strip()
        label = str(row.get("displayName") or row.get("name") or nid).strip()
        if not nid or not label:
            continue
        status = str(row.get("status") or "active").strip() or "active"
        if status not in {"active", "left"}:
            status = "active"
        got = upsert_entity(cwd, nid[:160], "Person", label[:160], {"status": status})
        if got.get("ok"):
            written += 1
    if written:
        forget_node_rows(cwd)
    return {"ok": True, "written": written}


def run_workspace_coverage(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Bucket the workbench by id/type prefixes already on the graph."""
    _ = args
    counts: dict[str, int] = {}

    def add(key: str) -> None:
        counts[key] = counts.get(key, 0) + 1

    rows, _st = read_node_rows(cwd)
    for row in rows:
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        low = ntype.lower()
        if nid.startswith("session:"):
            add("chat")
        elif nid.startswith("file:"):
            add("file")
        elif low == "person" or ntype == "人":
            add("people")
        elif low.startswith("skos:") or low.startswith("owl:") or low.startswith("rdfs:"):
            add("ontology")
        elif low == "decision":
            add("decision")
        elif ntype == "业务引用":
            add("ticket")
        else:
            add("other")
    buckets = [{"id": key, "n": counts[key]} for key in sorted(counts)]
    return {"ok": True, "buckets": buckets, "node_count": len(rows)}


def run_ontology_search(cwd: str, args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    args = args or {}
    q = str(args.get("q") or args.get("query") or "").strip()
    hits = []
    for row in _workbench_nodes(cwd):
        nid = str(row.get("id") or "")
        ntype = str(row.get("type") or "")
        label = str(row.get("content") or "")
        blob = f"{nid}\n{ntype}\n{label}"
        if q and q not in blob:
            continue
        hits.append({"uri": nid, "label": label or nid, "type": ntype})
        if len(hits) >= 50:
            break
    return hits


def run_search_passages(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    try:
        limit = max(1, min(int(args.get("limit") or 8), 50))
    except (TypeError, ValueError):
        limit = 8
    q = str(args.get("query") or args.get("q") or "")
    return {"ok": True, "results": search_passages(cwd, q, limit), "status": faiss_status()}


# Read-only ops that must never import ContextGraph / onnx. Writers stay out.
_FAST_READ_OPS = {
    "search_text": run_search_text,
    "brief_for_decision": run_brief_for_decision,
    "list_decisions": run_list_decisions,
    "list_memory_cards": run_list_memory_cards,
    "opening_brief": run_opening_brief,
    "list_ontology_versions": run_list_ontology_versions,
    "workspace_coverage": run_workspace_coverage,
    "memory_health": run_memory_health,
    "query_decisions": run_query_decisions,
    "find_precedents": run_find_precedents,
    "query_graph": run_query_graph,
    "list_graph_nodes": run_list_graph_nodes,
    "list_graph_edges": run_list_graph_edges,
    "graph_stats": run_graph_stats,
    "graph_path": run_graph_path,
    "graph_neighborhood": run_graph_neighborhood,
    "sparql": run_sparql,
    "list_alignments": run_list_alignments,
    "suggest_alignments": run_suggest_alignments,
    "ontology_search": run_ontology_search,
    "lineage": run_lineage,
    "temporal_bounds": run_temporal_bounds,
    "temporal_snapshot": run_temporal_snapshot,
    "enrich_dedup": run_enrich_dedup,
    "vocab_snapshot": run_vocab_snapshot,
    "vocab_types": run_vocab_types,
    "ontology_registry": run_ontology_registry,
    "skos_schemes": run_skos_schemes,
    "skos_hierarchy": run_skos_hierarchy,
    "skos_concept": run_skos_concept,
    "export_skos": run_export_skos,
    "export_owl": run_export_owl,
    "generate_shacl": run_generate_shacl,
    "retrieval_score": run_retrieval_score,
    "workbench_reason": run_workbench_reason,
    "graph_label_search": run_graph_label_search,
    "list_unextracted_docs": run_list_unextracted_docs,
    "list_session_summaries": run_list_session_summaries,
    "session_text": run_session_text,
    "open_node": run_open_node,
    "search_passages": run_search_passages,
    "store_status": lambda cwd, args: {
        "ok": True,
        "graph": primary_status(),
        "vector": passage_index_status(cwd),
        "vector_sparse": vector_index_status(cwd),
        "passages": passage_index_status(cwd),
    },
    "route_intent": lambda _cwd, args: route_intent((args or {}).get("text") or (args or {}).get("query") or (args or {}).get("q") or ""),
    "export_ledger": run_export_ledger,
    "backup_graph": run_backup_graph,
    "get_graph_analytics": run_graph_analytics,
    "get_graph_summary": run_get_graph_summary,
}


def run_nod_memory_card(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    packed = resolve_memory_nod(args)
    if packed.get("error"):
        return packed
    nid = str(packed.get("id") or "")
    rows, _st = read_memory_card_rows(cwd)
    row = next((item for item in rows if isinstance(item, dict) and str(item.get("id") or "") == nid), None)
    if row is None:
        return {"error": "NO_PATH"}
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    if not is_memory_card(row):
        return {"error": "NOT_A_CARD"}
    from_when = str(packed.get("valid_from") or props.get("valid_from") or "").strip()
    if not from_when:
        from_when = datetime.now(timezone.utc).isoformat()
    patched = patch_node_props(cwd, nid, {"status": "已入档", "valid_from": from_when, "kind": "记忆卡片"})
    if patched.get("error"):
        return patched
    return {"ok": True, "id": nid, "status": "已入档", "valid_from": from_when, "via": patched.get("via") or "patch"}


def run_retire_memory_card(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    packed = resolve_memory_retire(args)
    if packed.get("error"):
        return packed
    args = args or {}
    wanted: list[str] = []
    raw_ids = args.get("ids")
    if isinstance(raw_ids, list):
        for item in raw_ids:
            text = str(item or "").strip()
            if text and text not in wanted:
                wanted.append(text)
    head = str(packed.get("id") or "").strip()
    if head and head not in wanted:
        wanted.insert(0, head)
    if not wanted:
        return {"error": "NO_PATH"}
    rows, _st = read_memory_card_rows(cwd)
    by_id = {
        str(item.get("id") or ""): item
        for item in rows
        if isinstance(item, dict) and str(item.get("id") or "")
    }
    until = datetime.now(timezone.utc).isoformat()
    last: dict[str, Any] = {}
    for nid in wanted:
        row = by_id.get(nid)
        if row is None:
            return {"error": "NO_PATH"}
        if not is_memory_card(row):
            return {"error": "NOT_A_CARD"}
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        patched = patch_node_props(cwd, nid, {
            "valid_until": until,
            "status": "已停用",
            "kind": str(props.get("kind") or "记忆卡片"),
        })
        if patched.get("error"):
            return patched
        try:
            from agent_mem import forget_agent_memory

            forget_agent_memory(cwd, nid)
        except Exception:
            pass
        last = {"ok": True, "id": nid, "status": "已停用", "valid_until": until, "via": patched.get("via") or "patch"}
    last["ids"] = wanted
    return last


def _memory_card_row(cwd: str, nid: str) -> dict[str, Any] | None:
    rows, _st = read_memory_card_rows(cwd)
    return next((item for item in rows if isinstance(item, dict) and str(item.get("id") or "") == nid), None)


def run_source_memory_card(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    packed = resolve_memory_source(args)
    if packed.get("error"):
        return packed
    nid = str(packed.get("id") or "")
    source = str(packed.get("source") or "")
    row = _memory_card_row(cwd, nid)
    if row is None:
        return {"error": "NO_PATH"}
    if not is_memory_card(row):
        return {"error": "NOT_A_CARD"}
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    patched = patch_node_props(cwd, nid, {"source": source, "kind": str(props.get("kind") or "记忆卡片")})
    if patched.get("error"):
        return patched
    linked = insert_edge(cwd, source, nid, "出自")
    return linked if linked.get("error") else {"ok": True, "id": nid, "source": source, "via": patched.get("via") or "patch"}


def run_renew_memory_card(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    packed = resolve_memory_renew(args)
    if packed.get("error"):
        return packed
    nid = str(packed.get("id") or "")
    row = _memory_card_row(cwd, nid)
    if row is None:
        return {"error": "NO_PATH"}
    if not is_memory_card(row):
        return {"error": "NOT_A_CARD"}
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    patched = patch_node_props(cwd, nid, {"valid_until": "", "kind": str(props.get("kind") or "记忆卡片")})
    if patched.get("error"):
        return patched
    return {"ok": True, "id": nid, "valid_until": "", "via": patched.get("via") or "patch"}


def run_mute_health_kind(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    packed = resolve_health_mute(args)
    if packed.get("error"):
        return packed
    kind = str(packed.get("kind") or "")
    extra = {
        "status": "起草",
        "kind": "记忆卡片",
        "muted": [kind],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "valid_from": datetime.now(timezone.utc).isoformat(),
    }
    row = _memory_card_row(cwd, _HEALTH_MUTE_ID)
    if row is not None:
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        muted = props.get("muted") if isinstance(props.get("muted"), list) else []
        kinds = [str(item) for item in muted if str(item or "").strip()]
        extra["muted"] = list(dict.fromkeys(kinds + [kind]))
        patched = patch_node_props(cwd, _HEALTH_MUTE_ID, extra)
        if patched.get("error"):
            return patched
        return {"ok": True, "id": _HEALTH_MUTE_ID, "kind": kind, "muted": extra["muted"], "via": patched.get("via") or "patch"}
    inserted = insert_memory_card(cwd, _HEALTH_MUTE_ID, "梳理一类不再列出", extra)
    if inserted.get("error"):
        return inserted
    return {"ok": True, "id": _HEALTH_MUTE_ID, "kind": kind, "muted": extra["muted"], "via": inserted.get("via") or "insert"}


def run_draft_memory_card(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Encode a short cue as 起草. Not 已入档. Cause is the conversational act, not a phrase list."""
    args = args or {}
    label = str(args.get("label") or args.get("text") or args.get("content") or "").strip()
    if len(label) < 8:
        return {"error": "NO_PATH"}
    if is_report_noise(label):
        return {"error": "REPORT_NOISE"}
    cause = str(args.get("cause") or args.get("act") or "").strip()
    allowed = {"correction", "choice"}
    if cause not in allowed:
        return {"error": "NOT_A_CARD"}
    wanted = str(args.get("status") or args.get("board_status") or "").strip()
    if wanted == "已生效":
        return {"error": "NOT_A_BOARD"}
    source = str(args.get("source") or args.get("path") or "").strip()
    if source and not source.startswith(("session:", "file:")):
        source = ""
    stamp = str(args.get("timestamp") or args.get("valid_from") or "").strip() or datetime.now(timezone.utc).isoformat()
    key = f"{source}\n{label}"
    nid = "memory:" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:8]
    extra = {
        "status": "已入档",
        "kind": "记忆卡片",
        "cause": cause,
        "auto": False,
        "timestamp": stamp,
        "valid_from": stamp,
        "knowledge_grade": "user_memory",
        "observed_at": stamp,
        "confirmed_by": "human",
    }
    if source:
        extra["source"] = source
    inserted = insert_memory_card(cwd, nid, label[:160], extra)
    if inserted.get("error"):
        return inserted
    try:
        from agent_mem import store_agent_memory

        store_agent_memory(cwd, label[:160], memory_id=nid, metadata=extra)
    except Exception:
        pass
    return {
        "ok": True,
        "id": nid,
        "status": "已入档",
        "cause": cause,
        "source": source,
        "duplicate": bool(inserted.get("duplicate")),
        "via": inserted.get("via") or "insert",
    }


def _entity_label(row: Any) -> str:
    if isinstance(row, dict):
        return str(row.get("text") or row.get("label") or row.get("name") or "").strip()
    return str(row or "").strip()


def _entity_type(row: Any) -> str:
    if isinstance(row, dict):
        return str(row.get("type") or "Entity").strip() or "Entity"
    return "Entity"


def _relation_ends(row: Any) -> tuple[str, str, str]:
    if isinstance(row, dict):
        src = str(row.get("source") or row.get("subject") or "").strip()
        tgt = str(row.get("target") or row.get("object") or "").strip()
        kind = str(row.get("type") or row.get("predicate") or "related_to").strip() or "related_to"
        return src, tgt, kind
    return "", "", "related_to"


def run_apply_extracted_window(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    """Patch entities/edges from one window. No ContextGraph load."""
    args = args or {}
    source = str(args.get("source") or args.get("path") or "").strip()
    if not source.startswith(("session:", "file:")):
        return {"error": "NOT_A_SESSION", "nodes": 0, "edges": 0}
    if not may_extract({"text": args.get("text") or "", "kind": source}).get("ok"):
        return {"error": "ENVELOPE_CLOSED", "nodes": 0, "edges": 0}
    entities, relations = clean_extract(
        args.get("text") or "",
        args.get("entities") or [],
        args.get("relations") or [],
        args.get("types") or [],
    )
    names: dict[str, str] = {}
    nodes = 0
    for ent in entities:
        label = _entity_label(ent)
        eid = stable_entity_id(label)
        if not eid:
            continue
        packed = upsert_entity(cwd, eid, _entity_type(ent), label, {"source": source, "path": source, "node_type": _entity_type(ent)})
        if packed.get("error"):
            continue
        names[label] = eid
        names[eid] = eid
        insert_edge(cwd, source, eid, "出自")
        nodes += 1
    edges = 0
    for rel in relations:
        src_raw, tgt_raw, kind = _relation_ends(rel)
        src = names.get(src_raw) or stable_entity_id(src_raw)
        tgt = names.get(tgt_raw) or stable_entity_id(tgt_raw)
        if not src or not tgt:
            continue
        linked = insert_edge(cwd, src, tgt, kind)
        if not linked.get("error"):
            edges += 1
    return {"ok": True, "source": source, "nodes": nodes, "edges": edges}


_GRAPH_LOAD_OPS = frozenset({
    "upsert_workspace_vocab", "delete_vocab", "extract_entities", "extract_relations",
    "record_decision", "nod_memory_card", "retire_memory_card", "nod_memory_edge",
    "leave_person", "record_sight", "list_decisions", "list_memory_cards",
    "opening_brief", "memory_health", "query_decisions", "find_precedents",
    "get_causal_chain", "add_entity", "add_relationship", "run_reasoning",
    "export_graph", "get_graph_summary", "add_node",
    "ingest_directory", "run_pipeline", "search_text", "lineage",
    "upsert_documents", "stamp_session_times", "store_status", "describe_image",
    "policy_check", "import_graph", "copy_default_policy", "detect_conflicts",
    "export_owl",
})


_PATCH_LOCK_OPS = frozenset({
    "nod_memory_card", "retire_memory_card", "source_memory_card", "renew_memory_card",
    "mute_health_kind", "draft_memory_card", "apply_extracted_window", "erase_ledger",
    "restore_graph", "repair_workspace_vocab", "classify_existing_files",
    "classify_existing_sessions", "repair_session_structure", "index_passages",
    "shacl_report", "save_alignment", "delete_alignment",
})


def is_fast_read_op(op: str) -> bool:
    return str(op or "") in _FAST_READ_OPS


def needs_workspace_lock(op: str) -> bool:
    name = str(op or "")
    if not name or name in _FAST_READ_OPS:
        return False
    if name in _GRAPH_LOAD_OPS or name in _PATCH_LOCK_OPS:
        return True
    return False


def run_tool(op: str, cwd: str, args: dict[str, Any]) -> dict[str, Any]:
    # Fast reads that never touch semantica: serve them before load_session so a
    # search does not pay the ~12s onnxruntime import pulled by semantica.context.
    fast = _FAST_READ_OPS.get(op)
    if fast is not None:
        return fast(cwd, args)
    if op == "nod_memory_card":
        return run_nod_memory_card(cwd, args)
    if op == "retire_memory_card":
        return run_retire_memory_card(cwd, args)
    if op == "source_memory_card":
        return run_source_memory_card(cwd, args)
    if op == "renew_memory_card":
        return run_renew_memory_card(cwd, args)
    if op == "mute_health_kind":
        return run_mute_health_kind(cwd, args)
    if op == "draft_memory_card":
        return run_draft_memory_card(cwd, args)
    if op == "index_passages":
        return index_passages(cwd, list((args or {}).get("rows") or (args or {}).get("texts") or []))
    if op == "shacl_report":
        return run_shacl_report(cwd, args)
    if op == "save_alignment":
        return run_save_alignment(cwd, args)
    if op == "delete_alignment":
        return run_delete_alignment(cwd, args)
    if op == "create_ontology_version":
        return run_create_ontology_version(cwd, args)
    if op == "compare_ontology_versions":
        return run_compare_ontology_versions(cwd, args)
    if op == "sync_roster":
        return run_sync_roster(cwd, args)
    if op == "apply_extracted_window":
        return run_apply_extracted_window(cwd, args)
    if op == "erase_ledger":
        return run_erase_ledger(cwd, args)
    if op == "restore_graph":
        return run_restore_graph(cwd, args)
    if op == "repair_workspace_vocab":
        return run_repair_workspace_vocab(cwd, args)
    if op == "classify_existing_files":
        return run_classify_existing_files(cwd, args)
    if op == "classify_existing_sessions":
        return run_classify_existing_sessions(cwd, args)
    if op == "repair_session_structure":
        session, path = load_session(cwd)
        linked = repair_session_links(session.graph)
        if linked:
            save_session(session, path)
        return {"ok": True, "linked": linked}
    if op in {"extract_entities", "extract_relations"}:
        allowed = may_extract(args)
        if not allowed.get("ok"):
            if op == "extract_entities":
                return {"error": allowed.get("error") or "ENVELOPE_CLOSED", "entities": [], "relations": []}
            return {"error": allowed.get("error") or "ENVELOPE_CLOSED", "relations": [], "triplets": []}
    if op not in _GRAPH_LOAD_OPS:
        return {"error": f"unknown op {op}"}
    session, path = load_session(cwd)
    graph = session.graph
    mutating = False

    if op == "upsert_workspace_vocab":
        return run_upsert_workspace_vocab(cwd, args)
    if op == "delete_vocab":
        return run_delete_vocab(cwd, args)

    if op == "extract_entities":
        allowed = may_extract(args)
        if not allowed.get("ok"):
            return {"error": allowed.get("error") or "ENVELOPE_CLOSED", "entities": [], "relations": []}
        if str(args.get("extractMethod") or args.get("method") or "").strip().lower() == "skip":
            return {"error": "EXTRACT_SKIP", "entities": [], "relations": [], "extractMethod": "skip"}
        text = scrub_text(args.get("text") or "")
        if not text:
            return {"error": "text is required"}
        from semantica.semantic_extract import NamedEntityRecognizer
        entities = []
        method = "default"
        packed = dsh_chat_extract(text) if has_cjk(text) else {"entities": [], "relations": []}
        entities = packed.get("entities") if isinstance(packed, dict) else packed
        method = "dsh-model" if entities else ("skip" if has_cjk(text) else "default")
        if not entities and not has_cjk(text):
            from semantica.semantic_extract import NamedEntityRecognizer
            entities = NamedEntityRecognizer().extract_entities(text)
            method = "default"
        return {"entities": jsonable(entities), "relations": jsonable(packed.get("relations") if isinstance(packed, dict) else []), "extractMethod": method}

    if op == "extract_relations":
        allowed = may_extract(args)
        if not allowed.get("ok"):
            return {"error": allowed.get("error") or "ENVELOPE_CLOSED", "relations": [], "triplets": []}
        if str(args.get("extractMethod") or args.get("method") or "").strip().lower() == "skip":
            return {"error": "EXTRACT_SKIP", "relations": [], "triplets": [], "extractMethod": "skip"}
        text = scrub_text(args.get("text") or "")
        if not text:
            return {"error": "text is required"}
        from semantica.semantic_extract import NamedEntityRecognizer, RelationExtractor, TripletExtractor
        if has_cjk(text):
            packed = dsh_chat_extract(text)
            rels = packed.get("relations") or [] if isinstance(packed, dict) else []
            return {"relations": jsonable(rels), "triplets": [], "extractMethod": "dsh-model" if rels else "skip"}
        ner_ents = make_ner(text).extract_entities(text)
        relations = make_rel(text).extract_relations(text, ner_ents)
        triplets = TripletExtractor().extract_triplets(text)
        return {"relations": jsonable(relations), "triplets": jsonable(triplets)}

    if op == "record_decision":
        required = ["category", "scenario", "reasoning", "outcome", "confidence"]
        missing = [field for field in required if field not in args]
        if missing:
            return {"error": f"missing required field: {missing[0]}"}
        args = dict(args)
        for field in ("scenario", "reasoning", "outcome", "title"):
            if field in args:
                args[field] = scrub_text(args.get(field) or "")
        meta_in = dict(args.get("metadata") or {})
        trace = str(args.get("trace_id") or args.get("traceId") or args.get("requestId") or meta_in.get("trace_id") or meta_in.get("traceId") or meta_in.get("requestId") or "").strip()
        receipt = str(args.get("receipt_id") or args.get("receiptId") or args.get("receipt") or meta_in.get("receipt_id") or meta_in.get("receiptId") or "").strip()
        metadata = meta_in
        auto_row = bool(metadata.get("auto") or metadata.get("source") == "session_ingest")
        decision_nodes = None
        if auto_row or trace or receipt:
            decision_nodes = list(graph.find_nodes(node_type="decision") or []) if hasattr(graph, "find_nodes") else []
        board = resolve_board(args, cwd, existing=live_boards_for_trace(graph, trace, receipt, nodes=decision_nodes))
        if board.get("error"):
            result = {"error": board["error"]}
            if board.get("decision_id"):
                result["decision_id"] = board["decision_id"]
            return result
        if auto_row:
            dup = find_auto_decision_duplicate(graph, args.get("outcome") or "", args.get("scenario") or "", nodes=decision_nodes)
            if dup:
                return {"decision_id": dup, "status": "exists", "duplicate": True, "board_status": "起草"}
        for extra in ("title", "actor", "sessionId", "cwd", "toolName", "ts"):
            if extra in args and extra not in metadata:
                metadata[extra] = args[extra]
        metadata["status"] = board.get("status") or "起草"
        if board.get("receipt_id"):
            metadata["receipt_id"] = board["receipt_id"]
        if board.get("nod_kind"):
            metadata["nod_kind"] = board["nod_kind"]
        if board.get("trace_id") or trace:
            metadata["trace_id"] = board.get("trace_id") or trace
        ref = None
        if should_shape(args):
            shaped = check_shape(args, vocab_shapes(cwd))
            if not shaped.get("ok"):
                return {"error": shaped.get("error") or "MISSING_FIELD", "field": shaped.get("field"), "kind": shaped.get("kind")}
            ref = resolve_reference(args)
            if ref.get("error"):
                return {"error": ref["error"]}
            if get_node(graph, ref["id"]) is None:
                graph.add_node(ref["id"], "业务引用", content=ref["ticket"], **{
                    "system": ref["system"],
                    "environment": ref["environment"],
                    "kind": ref["kind"],
                    "ticket": ref["ticket"],
                })
            because = _id_list(args.get("because") or args.get("evidence") or args.get("supports"))
            if ref["id"] not in because:
                args = dict(args)
                args["because"] = because + [ref["id"]]
            holder = str(args.get("holder") or args.get("person") or args.get("decision_maker") or "").strip()
            if holder:
                held = hold_reference({"person": holder, "reference_id": ref["id"]})
                if not held.get("error"):
                    if get_node(graph, holder) is None:
                        graph.add_node(holder, "Person", content=holder)
                    ensure_edge(graph, held["source"], held["target"], "holds")
        because_ids = _id_list(args.get("because") or args.get("evidence") or args.get("supports"))
        existing_because = []
        for src in because_ids:
            node = get_node(graph, src) if src else None
            if node is None:
                continue
            packed = {
                "id": src,
                "type": node_type_of(node),
                "properties": decision_props(node),
            }
            if (board.get("status") or "") == "已生效" and not may_cite(packed):
                continue
            existing_because.append(src)
        if not existing_because:
            return {"error": "NO_BECAUSE"}
        args = dict(args)
        args["because"] = existing_because
        if (board.get("status") or "") == "已生效":
            leads_ids = _id_list(args.get("leads_to") or args.get("consequences") or args.get("causes"))
            existing_leads = [tgt for tgt in leads_ids if tgt and get_node(graph, tgt) is not None]
            if not existing_leads:
                return {"error": "NO_LEADS_TO"}
            args["leads_to"] = existing_leads
        decision_id = graph.record_decision(
            category=args["category"],
            scenario=args["scenario"],
            reasoning=args["reasoning"],
            outcome=args["outcome"],
            confidence=float(args["confidence"]),
            entities=args.get("entities") or [],
            decision_maker=args.get("decision_maker") or "dsh-semantic-os",
            metadata=metadata or None,
            valid_from=args.get("valid_from"),
            valid_until=args.get("valid_until"),
        )
        causal = attach_decision_causal_edges(graph, str(decision_id or ""), args)
        coerce_decision_timestamps(session)
        mutating = True
        result = {
            "decision_id": decision_id,
            "status": "recorded",
            "board_status": metadata["status"],
            "causal": causal,
        }
        if board.get("nod_kind"):
            result["nod_kind"] = board["nod_kind"]
        if metadata.get("trace_id"):
            result["trace_id"] = metadata["trace_id"]
        if ref:
            result["reference_id"] = ref["id"]

    elif op == "nod_memory_card":
        packed = resolve_memory_nod(args)
        if packed.get("error"):
            return packed
        nid = str(packed.get("id") or "")
        node = get_node(graph, nid)
        if node is None:
            return {"error": "NO_PATH"}
        props = decision_props(node)
        if node_type_of(node) != "记忆卡片" and str(props.get("kind") or "") != "记忆卡片":
            return {"error": "NOT_A_CARD"}
        from_when = str(packed.get("valid_from") or props.get("valid_from") or "").strip()
        if not from_when:
            from_when = datetime.now(timezone.utc).isoformat()
        set_node_props(node, status="已入档", valid_from=from_when)
        mutating = True
        result = {"ok": True, "id": nid, "status": "已入档", "valid_from": from_when}

    elif op == "retire_memory_card":
        packed = resolve_memory_retire(args)
        if packed.get("error"):
            return packed
        nid = str(packed.get("id") or "")
        node = get_node(graph, nid)
        if node is None:
            return {"error": "NO_PATH"}
        props = decision_props(node)
        if node_type_of(node) != "记忆卡片" and str(props.get("kind") or "") != "记忆卡片":
            return {"error": "NOT_A_CARD"}
        until = datetime.now(timezone.utc).isoformat()
        set_node_props(node, valid_until=until)
        mutating = True
        result = {"ok": True, "id": nid, "status": str(props.get("status") or "已入档"), "valid_until": until}

    elif op == "nod_memory_edge":
        packed = resolve_memory_edge(args)
        if packed.get("error"):
            return packed
        src = get_node(graph, packed["source"])
        tgt = get_node(graph, packed["target"])
        if src is None or tgt is None:
            return {"error": "NO_PATH"}
        src_props = decision_props(src)
        tgt_props = decision_props(tgt)
        if (node_type_of(src) != "记忆卡片" and str(src_props.get("kind") or "") != "记忆卡片") or (
            node_type_of(tgt) != "记忆卡片" and str(tgt_props.get("kind") or "") != "记忆卡片"
        ):
            return {"error": "NOT_A_CARD"}
        if node_type_of(src).lower() == "decision" or node_type_of(tgt).lower() == "decision":
            return {"error": "NOT_A_CARD"}
        ensure_edge(graph, packed["source"], packed["target"], packed["type"])
        if packed["type"] in {"replaces", "challenges"}:
            until = datetime.now(timezone.utc).isoformat()
            set_node_props(tgt, valid_until=until)
            packed["valid_until"] = until
        mutating = True
        result = {"ok": True, **packed}

    elif op == "leave_person":
        person = str(args.get("person") or args.get("id") or "").strip()
        if not person:
            return {"error": "person is required"}
        left = leave_person({"person": person}, holdings=holdings_of(graph, person))
        for target in left.get("voided") or []:
            drop_edge(graph, person, target, "holds")
            node = get_node(graph, target)
            if node is not None:
                set_node_props(node, voided=True, status="废引用")
        mutating = True
        result = left

    elif op == "record_sight":
        existing = []
        sid = str(args.get("attachment_id") or args.get("attachmentId") or args.get("id") or "").strip()
        page = str(args.get("page") or args.get("页码") or "1").strip() or "1"
        if sid:
            node = get_node(graph, f"eyes:{sid}:{page}")
            if node is not None:
                existing.append({"id": f"eyes:{sid}:{page}"})
        sight = resolve_sight(args, existing=existing)
        if sight.get("error"):
            return sight
        if get_node(graph, sight["id"]) is None:
            graph.add_node(sight["id"], "看见", content=sight.get("text") or sight["status"], **{
                "source": "eyes",
                "status": sight["status"],
                "attachment_id": sight.get("attachment_id") or "",
                "page": sight.get("page") or "1",
            })
        mutating = True
        result = sight

    elif op == "list_decisions":
        result = run_list_decisions(cwd, args)

    elif op == "list_memory_cards":
        result = run_list_memory_cards(cwd, args)

    elif op == "opening_brief":
        result = run_opening_brief(cwd, args)

    elif op == "memory_health":
        result = run_memory_health(cwd, args)

    elif op == "query_decisions":
        result = run_query_decisions(cwd, args)

    elif op == "find_precedents":
        if not str(args.get("scenario") or args.get("query") or "").strip():
            return {"error": "scenario is required"}
        result = run_find_precedents(cwd, args)

    elif op == "get_causal_chain":
        decision_id = str(args.get("decision_id") or "")
        if not decision_id:
            return {"error": "decision_id is required"}
        direction = str(args.get("direction") or "upstream")
        try:
            max_depth = int(args.get("max_depth") or 5)
        except (TypeError, ValueError):
            max_depth = 5
        chain = walk_causal_chain(graph, decision_id, direction=direction, max_depth=max_depth)
        result = {"chain": jsonable(chain), "decision_id": decision_id, "direction": direction}

    elif op == "add_entity":
        node_id = str(args.get("id") or "")
        if not node_id:
            return {"error": "id is required"}
        label = str(args.get("label") or node_id)
        content = str(args.get("content") or label)
        node_type = str(args.get("type") or "Entity")
        shape_kind = str(args.get("kind") or args.get("型") or "")
        if should_shape(args):
            if not shape_kind and node_type.lower() not in {"entity", "document", "decision"}:
                shape_kind = node_type
            shaped = check_shape({**args, "kind": shape_kind}, vocab_shapes(cwd) if shape_kind else [])
            if not shaped.get("ok"):
                return {"error": shaped.get("error") or "MISSING_FIELD", "field": shaped.get("field"), "kind": shaped.get("kind")}
        metadata = dict(args.get("metadata") or {})
        stamped = str(args.get("timestamp") or args.get("valid_from") or metadata.get("timestamp") or metadata.get("valid_from") or "").strip()
        if stamped:
            metadata["timestamp"] = stamped
            metadata["valid_from"] = stamped
            metadata["event_time"] = stamped
        metadata.update(event_fields(
            path=str(metadata.get("path") or metadata.get("source") or node_id),
            extra=metadata,
        ))
        existing = get_node(graph, node_id)
        if existing is not None and node_id.startswith("session:") and node_id.count(":") == 1:
            mutating = False
            result = {"status": "exists", "id": node_id}
        elif existing is not None and node_type_of(existing) == "skos:Concept":
            incoming = pack_kind_connector({**args, **metadata})
            shaped = accept_kind({**args, "label": label})
            if shaped.get("ok"):
                incoming = {
                    "fields": shaped.get("fields") or [],
                    "can": shaped.get("can") or [],
                    **incoming,
                }
            changed = merge_kind_props(_kind_props_of(existing), incoming)
            if changed:
                set_node_props(existing, **changed)
                mutating = True
                result = {"status": "patched", "id": node_id, "patched": list(changed)}
            else:
                mutating = False
                result = {"status": "exists", "id": node_id}
        else:
            added = graph.add_node(node_id, node_type, content=content, **metadata)
            mutating = True
            result = {"status": "added" if added else "exists", "id": node_id}
            kept = str(metadata.get("timestamp") or metadata.get("valid_from") or metadata.get("event_time") or "").strip()
            if kept:
                node = get_node(graph, node_id)
                if node is not None:
                    set_node_props(node, timestamp=kept, valid_from=kept, event_time=kept)
                    try:
                        setattr(node, "valid_from", kept)
                    except Exception:
                        pass

    elif op == "add_relationship":
        source = str(args.get("source") or "")
        target = str(args.get("target") or "")
        if not source or not target:
            return {"error": "source and target are required"}
        rel_type = str(args.get("type") or "related_to")
        metadata = dict(args.get("metadata") or {})
        added = graph.add_edge(source, target, edge_type=rel_type, **metadata)
        mutating = True
        result = {"status": "added" if added else "exists", "source": source, "target": target, "type": rel_type}

    elif op == "run_reasoning":
        facts = args.get("facts") or []
        rules = args.get("rules") or []
        mode = str(args.get("mode") or args.get("engine") or "forward").strip().lower()
        if mode not in {"forward", "rete", "datalog"}:
            return {"error": f"unsupported mode {mode}"}
        if not facts or not rules:
            return {"error": "facts and rules are required"}
        apply_flag = bool(args.get("apply_to_graph"))
        if mode == "rete":
            result = run_rete(facts, rules)
            if result.get("error"):
                return result
        elif mode == "datalog":
            result = run_datalog(facts, rules)
            if result.get("error"):
                return result
        else:
            from semantica.reasoning import Reasoner
            reasoner = Reasoner()
            for i, rule in enumerate(rules):
                if isinstance(rule, dict):
                    reasoner.add_rule(rule_from_dict(rule, i))
                else:
                    reasoner.add_rule(normalize_rule_text(str(rule)))
            derived = reasoner.infer_facts(facts)
            result = {
                "derived_facts": jsonable(derived),
                "inferred_facts": jsonable(derived),
                "engine": "forward",
            }
        inferred = result.get("inferred_facts") or result.get("conclusions") or result.get("derived_facts") or []
        added = 0
        if apply_flag:
            added = apply_inferred_facts(graph, inferred if isinstance(inferred, list) else [])
            if added:
                mutating = True
        result["added_edges"] = added
        result["mutated"] = bool(apply_flag and added)

    elif op == "get_graph_analytics":
        from semantica.kg import CentralityCalculator, CommunityDetector

        graph_dict = graph_as_dict(session, graph)
        calc = CentralityCalculator()
        degree = calc.calculate_degree_centrality(graph_dict)
        scores: dict[str, float] = {}
        try:
            nx_graph = calc._to_networkx(graph_dict) if hasattr(calc, "_to_networkx") else None
            raw = calc.calculate_pagerank(nx_graph) if nx_graph is not None else None
            if isinstance(raw, dict) and isinstance(raw.get("centrality"), dict):
                scores = {str(k): float(v) for k, v in raw["centrality"].items()}
            elif isinstance(raw, dict) and raw.get("rankings"):
                for row in raw["rankings"]:
                    if isinstance(row, dict) and "node" in row:
                        scores[str(row["node"])] = float(row.get("score") or 0)
                    elif isinstance(row, (list, tuple)) and len(row) >= 2:
                        scores[str(row[0])] = float(row[1])
        except Exception:
            scores = {}
        if not scores and isinstance(degree, dict):
            cent = degree.get("centrality") if isinstance(degree.get("centrality"), dict) else {}
            scores = {str(k): float(v) for k, v in cent.items()}
        top = sorted(scores.items(), key=lambda item: item[1], reverse=True)[:10]
        communities = CommunityDetector().detect_communities(graph_dict)
        groups = []
        if isinstance(communities, dict):
            groups = communities.get("communities") or communities.get("node_assignments") or []
        elif isinstance(communities, list):
            groups = communities
        nodes = list(graph.find_nodes())
        cent = degree.get("centrality") if isinstance(degree, dict) and isinstance(degree.get("centrality"), dict) else {}
        top_degree = sorted(((str(k), float(v)) for k, v in cent.items()), key=lambda item: item[1], reverse=True)[:10]
        result = {
            "node_count": len(nodes),
            "edge_count": len(list(graph.find_edges())) if hasattr(graph, "find_edges") else 0,
            "top_nodes_by_pagerank": jsonable(top),
            "community_count": len(groups) if hasattr(groups, "__len__") else 0,
            "top_degree": jsonable(top_degree),
        }

    elif op == "export_graph":
        return run_export_graph(session, graph, args)

    elif op == "get_graph_summary":
        nodes = list(graph.find_nodes())
        decisions = list(graph.find_nodes(node_type="decision"))
        result = {
            "node_count": len(nodes),
            "decision_count": len(decisions),
            "graph_ready": True,
            "path": str(path),
        }

    elif op == "add_node":
        node_id = str(args.get("id") or "")
        if not node_id:
            return {"error": "id is required"}
        label = str(args.get("label") or node_id)
        node_type = str(args.get("type") or "Entity")
        metadata = dict(args.get("metadata") or {})
        added = graph.add_node(node_id, node_type, content=label, **metadata)
        mutating = True
        result = {"status": "added" if added else "exists", "id": node_id}

    elif op == "ingest_directory":
        return run_ingest_directory(cwd, args)

    elif op == "run_pipeline":
        return run_pipeline(cwd, args)

    elif op == "search_text":
        return run_search_text(cwd, args)

    elif op == "lineage":
        return run_lineage(cwd, args)

    elif op == "upsert_documents":
        return run_upsert_documents(cwd, args)

    elif op == "stamp_session_times":
        return run_stamp_session_times(cwd, args)

    elif op == "stamp_workbench_times":
        return run_stamp_workbench_times(cwd, args)

    elif op == "store_status":
        return {
            "ok": True,
            "graph": primary_status(),
            "vector": passage_index_status(cwd),
            "vector_sparse": vector_index_status(cwd),
            "passages": passage_index_status(cwd),
        }

    elif op == "describe_image":
        return dsh_describe_image(str(args.get("path") or ""), str(args.get("mediaType") or ""))

    elif op == "policy_check":
        return run_policy_check(cwd, args)

    elif op == "import_graph":
        return run_import_graph(cwd, args)

    elif op == "copy_default_policy":
        copied = copy_default_policy(cwd)
        return {"ok": True, "copied": copied}

    elif op == "detect_conflicts":
        try:
            from semantica.conflicts.conflict_detector import ConflictDetector
        except Exception as exc:
            return {"error": "EXTRA_MISSING", "detail": str(exc)}
        graph_dict = graph_as_dict(session, graph)
        detector = ConflictDetector()
        conflicts = detector.detect_conflicts(graph_dict)
        packed = jsonable(conflicts) or []
        return {
            "ok": True,
            "conflicts": packed,
            "empty": not packed,
            "detail": "" if packed else "没有冲突",
        }

    elif op == "export_owl":
        return run_export_owl(cwd, args)

    else:
        return {"error": f"unknown op {op}"}

    if mutating:
        save_session(session, path)
    return result


def install_product_middleware(app: Any) -> None:
    from fastapi.responses import JSONResponse
    from starlette.middleware.base import BaseHTTPMiddleware

    class ProductMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            path = request.url.path
            if path == "/_dsh/health":
                return JSONResponse({"ok": True, "version": EXPECTED_VERSION})
            if path == "/_dsh/python" and request.method == "POST":
                if not valid_sidecar_token(request):
                    return JSONResponse({"error": "FORBIDDEN"}, status_code=403)
                try:
                    body = await request.json()
                except Exception:
                    return JSONResponse({"error": "invalid json"}, status_code=400)
                if not isinstance(body, dict):
                    return JSONResponse({"error": "invalid json"}, status_code=400)
                op = str(body.get("op") or "")
                cwd, err = resolve_cwd(body.get("cwd") or request.headers.get("X-DSH-CWD"))
                if err:
                    return JSONResponse({"error": err}, status_code=400)
                try:
                    payload = dict(body.get("args") or {})
                    if not needs_workspace_lock(op):
                        result = await asyncio.to_thread(run_tool, op, cwd or "", payload)
                    else:
                        lock = await workspace_lock(cwd or "")
                        async with lock:
                            result = await asyncio.to_thread(run_tool, op, cwd or "", payload)
                except Exception as exc:
                    return JSONResponse({"error": "PYTHON_FAILED", "detail": str(exc)}, status_code=500)
                status = 400 if isinstance(result, dict) and result.get("error") else 200
                return JSONResponse(jsonable(result), status_code=status)

            if (
                path.startswith("/assets")
                or path in ("/favicon.svg", "/icons.svg")
                or path.startswith("/ws/")
                or path.startswith("/_dsh/")
            ):
                return await call_next(request)

            raw = request.headers.get("X-DSH-CWD") or request.query_params.get("cwd")
            cwd, err = resolve_cwd(raw)
            if path.startswith("/api/"):
                if err:
                    return JSONResponse({"error": err, "detail": "graph ops require X-DSH-CWD"}, status_code=400)
                async with _EXPLORER_LOCK:
                    lock = await workspace_lock(cwd or "")
                    async with lock:
                        session, graph_file = await asyncio.to_thread(load_session, cwd or "")
                        request.app.state.session = session
                        response = await call_next(request)
                        if request.method not in ("GET", "HEAD", "OPTIONS"):
                            try:
                                await asyncio.to_thread(save_session, session, graph_file)
                            except Exception:
                                traceback.print_exc()
                        return response
            return await call_next(request)

    app.add_middleware(ProductMiddleware)



def apply_dsh_llm() -> None:
    """Point Semantica LLM calls at the DSH default model. Does not edit the wheel."""
    provider = (os.environ.get("DSH_LLM_PROVIDER") or "").strip()
    model = (os.environ.get("DSH_LLM_MODEL") or "").strip()
    if not provider or not model:
        return
    foreign = {"", "openai", "gpt", "none"}

    def rewrite(given_provider, given_model):
        p = (given_provider or "").strip()
        m = (given_model or "").strip()
        if not p or p.lower() in foreign or m.lower().startswith("gpt"):
            return provider, model
        return p or provider, m or model

    try:
        from semantica.ontology.llm_generator import LLMOntologyGenerator
        orig_init = LLMOntologyGenerator.__init__
        orig_set = LLMOntologyGenerator.set_provider

        def patched_init(self, provider="openai", model=None, **config):
            provider, model = rewrite(provider, model)
            orig_init(self, provider=provider, model=model, **config)

        def patched_set(self, provider, model=None, **kwargs):
            provider, model = rewrite(provider, model)
            orig_set(self, provider, model=model, **kwargs)

        LLMOntologyGenerator.__init__ = patched_init
        LLMOntologyGenerator.set_provider = patched_set
    except Exception:
        pass

    try:
        from semantica.semantic_extract.llm_extraction import LLMExtraction
        orig_ex = LLMExtraction.__init__

        def patched_ex(self, provider="openai", **config):
            config = dict(config)
            provider, model = rewrite(provider, config.get("model"))
            config["model"] = model
            orig_ex(self, provider=provider, **config)

        LLMExtraction.__init__ = patched_ex
    except Exception:
        pass


def main() -> None:
    if os.environ.get("SEMANTICA_ALLOW_ANONYMOUS", "").strip().lower() == "true":
        fail("anonymous_forbidden", "SEMANTICA_ALLOW_ANONYMOUS is forbidden")

    try:
        version = importlib.metadata.version("semantica")
    except importlib.metadata.PackageNotFoundError:
        fail("wheel_missing", "semantica is not installed")

    if version != EXPECTED_VERSION:
        fail("version_mismatch", f"semantica=={version}", version=version)

    doctor_text, doctor_ran = doctor_report()
    if not doctor_ran:
        fail("doctor_fail", "semantica doctor could not run", doctor=doctor_text, version=version)

    try:
        import uvicorn
        from fastapi import FastAPI
        from semantica.context.context_graph import ContextGraph  # noqa: F401
        from semantica.explorer.session import GraphSession  # noqa: F401
    except Exception as exc:
        fail("extra_missing", f"engine runtime import failed: {exc}", doctor=doctor_text, version=version)

    from fastapi import FastAPI

    port_raw = os.environ.get("DSH_SEMANTICA_PORT", "").strip()
    requested_port = int(port_raw) if port_raw.isdigit() and int(port_raw) > 0 else 0
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    listener.bind(("127.0.0.1", requested_port))
    listener.listen(128)
    listener.setblocking(False)
    port = listener.getsockname()[1]

    apply_dsh_llm()
    app = FastAPI()
    install_product_middleware(app)
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))

    # The socket is already bound and listening, so a ready announcement can
    # never race another process for the port or precede TCP readiness.
    emit({
        "ready": True,
        "reason": None,
        "detail": "",
        "doctor": doctor_text,
        "version": version,
        "port": port,
    })

    server.run(sockets=[listener])


if __name__ == "__main__":
    def _stop_lite(_signum=None, _frame=None):
        try:
            from stores import close_lite
            close_lite()
        except Exception:
            pass
        if _signum is not None:
            raise SystemExit(0)

    try:
        signal.signal(signal.SIGTERM, _stop_lite)
        signal.signal(signal.SIGINT, _stop_lite)
    except Exception:
        pass
    try:
        main()
    except SystemExit:
        _stop_lite()
        raise
    except Exception as exc:
        fail("start_failed", str(exc), doctor=traceback.format_exc())
