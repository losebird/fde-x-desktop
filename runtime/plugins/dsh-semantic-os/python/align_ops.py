"""FDE production mouths for official Semantica Explorer / MCP gaps."""

from __future__ import annotations

import json
import os
from collections import deque
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import graph_store
from agent_mem import list_agent_memory_snapshot, store_agent_memory

CAUSAL_TYPES = frozenset({
    "CAUSED", "caused", "PRECEDENT_FOR", "precedent_for",
    "leads_to", "LEADS_TO", "supports", "SUPPORTS",
})

CONNECTOR_EXTRAS = (
    "bigquery", "redshift", "snowflake", "databricks", "salesforce", "sap",
    "powerbi", "airflow", "gdrive", "huggingface", "mcp", "mongo", "elastic", "kafka",
)

_STORE_FIELDS = {
    "databricks": ("storeDatabricksUrl", "storeDatabricksAccount"),
    "snowflake": ("storeSnowflakeUrl", "storeSnowflakeAccount"),
    "neo4j": ("storeNeo4jUrl", "storeNeo4jAccount"),
    "rdf": ("storeRdfUrl", "storeRdfAccount"),
}


def _truthy(value: Any) -> bool:
    if value is True:
        return True
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "on", "nodded", "confirm"}


def _props(row: dict[str, Any]) -> dict[str, Any]:
    raw = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    return dict(raw)


def run_update_node(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    nid = str(args.get("node_id") or args.get("id") or "").strip()
    props = args.get("properties")
    if not nid:
        return {"ok": False, "error": "NO_PATH"}
    if not isinstance(props, dict) or not props:
        return {"ok": False, "error": "NO_PROPERTIES"}
    stored = graph_store.read_one(cwd, nid)
    if not isinstance(stored, dict):
        return {"ok": False, "error": "NO_NODE", "id": nid}
    merged = dict(stored)
    inner = _props(stored)
    inner.update({str(k): v for k, v in props.items()})
    merged["properties"] = inner
    for key, value in props.items():
        if key in {"content", "type", "status"} and value is not None:
            merged[key] = value
        if key == "content" and value is not None:
            merged["content"] = value
    graph_store.put_node(cwd, merged)
    got = graph_store.read_one(cwd, nid) or merged
    return {"ok": True, "id": nid, "status": "updated", "node": graph_store.row_of(got), "properties": _props(got)}


def run_delete_node(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    nid = str(args.get("node_id") or args.get("id") or "").strip()
    if not nid:
        return {"ok": False, "error": "NO_PATH"}
    stored = graph_store.read_one(cwd, nid)
    if not isinstance(stored, dict):
        return {"ok": False, "error": "NO_NODE", "id": nid}
    merged = dict(stored)
    inner = _props(stored)
    inner["status"] = "archived"
    merged["properties"] = inner
    merged["status"] = "archived"
    graph_store.put_node(cwd, merged)
    got = graph_store.read_one(cwd, nid) or merged
    return {
        "ok": True,
        "id": nid,
        "status": "archived",
        "node": graph_store.row_of(got),
        "properties": _props(got),
    }


def _hops(edges: list[dict[str, Any]], src: str, tgt: str) -> int | None:
    if src == tgt:
        return 0
    adj: dict[str, set[str]] = {}
    for edge in edges:
        a = str(edge.get("source") or edge.get("source_id") or "")
        b = str(edge.get("target") or edge.get("target_id") or "")
        if not a or not b:
            continue
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    seen = {src}
    q = deque([(src, 0)])
    while q:
        cur, dist = q.popleft()
        for nxt in adj.get(cur, ()):
            if nxt in seen:
                continue
            if nxt == tgt:
                return dist + 1
            seen.add(nxt)
            q.append((nxt, dist + 1))
    return None


def run_distance_matrix(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    ids = [str(x).strip() for x in (args.get("node_ids") or args.get("ids") or []) if str(x).strip()]
    if len(ids) > 50:
        return {"ok": False, "error": "TOO_MANY", "detail": f"{len(ids)} requested; maximum is 50"}
    metric = str(args.get("metric") or "hops").strip().lower() or "hops"
    if metric == "semantic":
        return {"ok": False, "error": "ENGINE_MISSING", "status": 503, "detail": "metric=semantic needs embeddings"}
    _nodes, edges = graph_store.read_all(cwd)
    matrix: list[list[float | None]] = []
    unreachable: list[list[str]] = []
    for src in ids:
        row: list[float | None] = []
        for tgt in ids:
            hops = _hops(edges, src, tgt)
            row.append(None if hops is None else float(hops))
            if hops is None and src != tgt:
                unreachable.append([src, tgt])
        matrix.append(row)
    return {
        "ok": True,
        "nodes": ids,
        "metric": metric,
        "matrix": matrix,
        "unreachable_pairs": unreachable,
        "computation_time_ms": 0,
    }


def run_causal_distance(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    source = str(args.get("source") or args.get("source_id") or args.get("id1") or "").strip()
    target = str(args.get("target") or args.get("target_id") or args.get("id2") or "").strip()
    if not source or not target:
        return {"ok": False, "error": "NO_PATH"}
    _nodes, edges = graph_store.read_all(cwd)
    adj: dict[str, list[tuple[str, str]]] = {}
    for edge in edges:
        et = str(edge.get("type") or edge.get("edge_type") or "")
        if et not in CAUSAL_TYPES:
            continue
        a = str(edge.get("source") or edge.get("source_id") or "")
        b = str(edge.get("target") or edge.get("target_id") or "")
        if a and b:
            adj.setdefault(a, []).append((b, et))
    if source == target:
        return {
            "ok": True,
            "source_id": source,
            "target_id": target,
            "causal_path": [source],
            "causal_hop_count": 0,
            "intermediate_decisions": [],
            "confidence_decay": 1.0,
            "weakest_link": None,
            "interpretation": "same node",
        }
    seen = {source}
    q = deque([(source, [source])])
    found: list[str] | None = None
    while q:
        cur, path = q.popleft()
        for nxt, _et in adj.get(cur, []):
            if nxt in seen:
                continue
            nxt_path = path + [nxt]
            if nxt == target:
                found = nxt_path
                q.clear()
                break
            seen.add(nxt)
            q.append((nxt, nxt_path))
    if not found:
        return {
            "ok": True,
            "source_id": source,
            "target_id": target,
            "causal_path": [],
            "causal_hop_count": 0,
            "intermediate_decisions": [],
            "confidence_decay": 0.0,
            "weakest_link": None,
            "interpretation": "no causal path",
        }
    hops = len(found) - 1
    mid = found[1:-1]
    return {
        "ok": True,
        "source_id": source,
        "target_id": target,
        "causal_path": found,
        "causal_hop_count": hops,
        "intermediate_decisions": mid,
        "confidence_decay": max(0.0, 1.0 - 0.1 * hops),
        "weakest_link": None,
        "interpretation": f"{hops} causal hop(s)",
    }


def run_analytics_validation(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = args
    nodes, edges = graph_store.read_all(cwd)
    issues: list[dict[str, str]] = []
    ids = set(nodes)
    for nid, row in nodes.items():
        if not str(row.get("type") or "").strip():
            issues.append({"severity": "warning", "message": f"node {nid} missing type"})
    for edge in edges:
        a = str(edge.get("source") or edge.get("source_id") or "")
        b = str(edge.get("target") or edge.get("target_id") or "")
        if a not in ids:
            issues.append({"severity": "error", "message": f"edge source missing: {a}"})
        if b not in ids:
            issues.append({"severity": "error", "message": f"edge target missing: {b}"})
    errors = [row for row in issues if row["severity"] == "error"]
    warnings = [row for row in issues if row["severity"] == "warning"]
    return {
        "ok": True,
        "valid": not errors,
        "error_count": len(errors),
        "warning_count": len(warnings),
        "issues": issues,
    }


def run_enrich_extract(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = cwd
    args = args or {}
    text = str(args.get("text") or "").strip()
    if not text:
        return {"ok": False, "error": "NO_TEXT"}
    try:
        from semantica.semantic_extract import NamedEntityRecognizer, RelationExtractor
    except Exception as exc:
        return {"ok": False, "error": "ENGINE_MISSING", "status": 503, "detail": str(exc)[:200]}
    try:
        recognizer = NamedEntityRecognizer(confidence_threshold=0.7)
        extractor = RelationExtractor(confidence_threshold=0.6)
        entities = recognizer.extract_entities(text) or []
        if not isinstance(entities, list):
            entities = list(getattr(entities, "entities", []) or [])
        relations = extractor.extract_relations(text, entities) or []
        if not isinstance(relations, list):
            relations = list(getattr(relations, "relations", []) or [])
    except Exception as exc:
        return {"ok": False, "error": "ENGINE_MISSING", "status": 503, "detail": str(exc)[:200]}

    def pack(row: Any) -> dict[str, Any]:
        if isinstance(row, dict):
            return dict(row)
        text_v = getattr(row, "text", None) or getattr(row, "label", None)
        return {"text": str(text_v or row)}

    return {
        "ok": True,
        "entities": [pack(row) for row in entities],
        "relations": [pack(row) for row in relations],
    }


def run_enrich_merge(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    if not (_truthy(args.get("confirm")) or _truthy(args.get("nodded"))):
        return {"ok": False, "error": "CONFIRM_REQUIRED"}
    primary = str(args.get("primary_id") or args.get("id") or "").strip()
    dups = [str(x).strip() for x in (args.get("duplicate_ids") or args.get("others") or []) if str(x).strip()]
    other = str(args.get("other") or "").strip()
    if other:
        dups.append(other)
    dups = [x for x in dups if x and x != primary]
    if not primary or not dups:
        return {"ok": False, "error": "NO_PATH"}
    live = graph_store.read_one(cwd, primary)
    if not isinstance(live, dict):
        return {"ok": False, "error": "NO_NODE", "id": primary}
    nodes, edges = graph_store.read_all(cwd)
    merged_props = _props(live)
    for did in dups:
        row = nodes.get(did) or graph_store.read_one(cwd, did)
        if not isinstance(row, dict):
            return {"ok": False, "error": "NO_NODE", "id": did}
        for key, value in _props(row).items():
            if key not in merged_props or merged_props.get(key) in (None, ""):
                merged_props[key] = value
        if not live.get("content") and row.get("content"):
            live["content"] = row.get("content")
    live["properties"] = merged_props
    graph_store.put_node(cwd, live)
    puts: list[tuple[str, dict[str, Any]]] = []
    dels: list[str] = []
    dup_set = set(dups)
    for edge in edges:
        src = str(edge.get("source") or edge.get("source_id") or "")
        tgt = str(edge.get("target") or edge.get("target_id") or "")
        et = str(edge.get("type") or "related_to")
        if src not in dup_set and tgt not in dup_set:
            continue
        dels.append(graph_store.edge_subject(src, tgt, et))
        nsrc = primary if src in dup_set else src
        ntgt = primary if tgt in dup_set else tgt
        if nsrc == ntgt:
            continue
        data = dict(edge)
        data["source"] = nsrc
        data["target"] = ntgt
        puts.append((graph_store.edge_subject(nsrc, ntgt, et), data))
    for did in dups:
        dels.append(graph_store.node_subject(did))
    graph_store.apply(cwd, puts, dels)
    remaining, _ = graph_store.read_all(cwd)
    gone = [did for did in dups if did not in remaining]
    return {
        "ok": True,
        "merged_into": primary,
        "edges_updated": len(puts),
        "duplicates_removed": gone,
    }


def run_list_memories(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    try:
        skip = max(0, int(args.get("skip") or args.get("offset") or 0))
    except (TypeError, ValueError):
        skip = 0
    try:
        limit = max(1, min(int(args.get("limit") or 100), 100))
    except (TypeError, ValueError):
        limit = 100
    return list_agent_memory_snapshot(cwd, skip=skip, limit=limit)


def run_store_memory(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    return store_agent_memory(
        cwd,
        str(args.get("content") or args.get("text") or ""),
        memory_id=str(args.get("memory_id") or args.get("id") or "") or None,
        metadata=args.get("metadata") if isinstance(args.get("metadata"), dict) else {},
    )


def _overlay_path() -> Path:
    home = os.environ.get("DSH_HOME") or str(Path.home() / ".dsh")
    return Path(home) / "dsh-semantic-os.json"


def _read_overlay() -> dict[str, Any]:
    path = _overlay_path()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def connector_config(name: str, args: dict[str, Any] | None = None) -> dict[str, str]:
    args = args or {}
    key = str(name or "").strip().lower()
    url = str(args.get("url") or args.get("store_url") or os.environ.get(f"SEMANTICA_{key.upper()}_URL") or "").strip()
    account = str(args.get("account") or os.environ.get(f"SEMANTICA_{key.upper()}_ACCOUNT") or "").strip()
    overlay = _read_overlay()
    bag = overlay.get("connectors") if isinstance(overlay.get("connectors"), dict) else {}
    row = bag.get(key) if isinstance(bag.get(key), dict) else {}
    if not url:
        url = str(row.get("url") or "").strip()
    if not account:
        account = str(row.get("account") or "").strip()
    fields = _STORE_FIELDS.get(key)
    if fields:
        if not url:
            url = str(overlay.get(fields[0]) or "").strip()
        if not account:
            account = str(overlay.get(fields[1]) or "").strip()
    return {"url": url, "account": account}


def run_connector_status(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = cwd
    args = args or {}
    names = [str(x).strip().lower() for x in (args.get("names") or CONNECTOR_EXTRAS) if str(x).strip()]
    rows = []
    for name in names:
        cfg = connector_config(name, args if str(args.get("name") or "").lower() == name else {})
        if args.get("name") and str(args.get("name")).lower() == name:
            cfg = connector_config(name, args)
        connected = bool(cfg["url"] or cfg["account"])
        rows.append({"name": name, "extra": True, "connected": connected, "url": cfg["url"]})
    return {"ok": True, "connectors": rows}


def run_connector_query(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    _ = cwd
    args = args or {}
    name = str(args.get("name") or args.get("connector") or "").strip().lower()
    if name not in CONNECTOR_EXTRAS:
        return {"ok": False, "error": "UNKNOWN_CONNECTOR"}
    cfg = connector_config(name, args)
    if not cfg["url"] and not cfg["account"]:
        return {"ok": False, "error": "NOT_CONNECTED", "connected": False, "name": name}
    url = cfg["url"]
    parsed = urlparse(url)
    path = parsed.path if parsed.scheme in {"file", "json", "sqlite", ""} else ""
    if parsed.scheme == "file":
        path = parsed.path
    if path and Path(path).is_file():
        text = Path(path).read_text(encoding="utf-8")
        try:
            payload = json.loads(text)
        except Exception:
            payload = {"text": text}
        return {"ok": True, "connected": True, "name": name, "payload": payload}
    return {
        "ok": False,
        "connected": True,
        "name": name,
        "error": "ENGINE_MISSING",
        "detail": "no live session for this connector in this environment",
        "status": 503,
    }
