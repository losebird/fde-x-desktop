"""Oxigraph TripletStore thin sync for one workspace graph.

Each node and edge is one triplet. The object is JSON of a ContextGraph.to_dict()
row plus a rev. Decision nodes, edges that touch a decision, and archive rows
are never deleted by a normal save.
"""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote

PRED = "urn:fdex:p:payload"
PRED_DONE = "urn:fdex:p:done"
SUBJ_META = "urn:fdex:meta"
NODE_PREFIX = "urn:fdex:n:"
EDGE_PREFIX = "urn:fdex:e:"
ARCHIVE_ID_PREFIXES = ("session:", "file:", "mail:")
ARCHIVE_TYPES = frozenset({"Document", "document"})
DECISION_TYPES = frozenset({"decision", "Decision"})
BUSY_DETAIL = "另一个 fdex 正在用这个工作区的图库，稍后再试"
MARKER = ".migrated-070"

_LOCK = threading.Lock()
_STORES: dict[str, Any] = {}


class GraphStoreBusy(RuntimeError):
    def __init__(self, cwd: str = "") -> None:
        super().__init__(BUSY_DETAIL)
        self.cwd = cwd


def graph_name(cwd: str) -> str:
    key = os.path.realpath(cwd or "")
    return "dsh_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def oxigraph_dir(cwd: str) -> Path:
    return Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "oxigraph"


def is_archive_node(nid: str, ntype: str = "") -> bool:
    raw = str(nid or "")
    if raw.startswith(ARCHIVE_ID_PREFIXES):
        return True
    return str(ntype or "") in ARCHIVE_TYPES


def is_decision_node(nid: str, ntype: str = "") -> bool:
    return str(ntype or "").lower() == "decision" or str(nid or "").startswith("decision:")


def node_subject(nid: str) -> str:
    return NODE_PREFIX + quote(str(nid or ""), safe="")


def node_id_of(subject: str) -> str:
    raw = str(subject or "")
    if raw.startswith(NODE_PREFIX):
        return unquote(raw[len(NODE_PREFIX):])
    return raw


def edge_key(src: str, tgt: str, et: str) -> str:
    blob = f"{src}\x1f{tgt}\x1f{et}".encode("utf-8")
    return hashlib.sha1(blob).hexdigest()


def edge_subject(src: str, tgt: str, et: str) -> str:
    return EDGE_PREFIX + edge_key(src, tgt, et)


def _dumps(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True)


def _loads(text: str) -> Any:
    try:
        return json.loads(text)
    except Exception:
        return None


def _triplet(subject: str, predicate: str, obj: str):
    from semantica.semantic_extract.types import Triplet
    return Triplet(subject=subject, predicate=predicate, object=obj)


def _is_lock_error(exc: BaseException) -> bool:
    msg = str(exc) + " " + exc.__class__.__name__
    return "LOCK" in msg or "temporarily unavailable" in msg.lower() or "Resource temporarily unavailable" in msg


def open_store(cwd: str):
    key = str(oxigraph_dir(cwd).resolve())
    with _LOCK:
        hit = _STORES.get(key)
        if hit is not None:
            return hit
    dest = oxigraph_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    from semantica.triplet_store import TripletStore

    last: BaseException | None = None
    deadline = time.monotonic() + 10.0
    while True:
        try:
            store = TripletStore(backend="oxigraph", path=str(dest))
            break
        except Exception as exc:
            last = exc
            if not _is_lock_error(exc) or time.monotonic() >= deadline:
                if _is_lock_error(exc):
                    raise GraphStoreBusy(cwd) from exc
                raise
            time.sleep(0.5)
    else:
        raise GraphStoreBusy(cwd) from last
    with _LOCK:
        _STORES[key] = store
    marker = dest / MARKER
    if not marker.is_file():
        try:
            from migrations.migrate_070 import migrate
            migrate(cwd)
        except Exception:
            pass
    return store


def close_all() -> None:
    with _LOCK:
        _STORES.clear()


def _payloads_for(store: Any, subject: str | None = None) -> list[tuple[str, dict[str, Any]]]:
    try:
        rows = store.get_triplets(subject=subject, predicate=PRED) if subject else store.get_triplets(predicate=PRED)
    except TypeError:
        rows = store.get_triplets(subject=subject) if subject else store.get_triplets()
    out: list[tuple[str, dict[str, Any]]] = []
    for row in rows or []:
        pred = getattr(row, "predicate", "") or ""
        if pred not in {"", PRED}:
            continue
        packed = _loads(getattr(row, "object", "") or "")
        if not isinstance(packed, dict) or "data" not in packed:
            continue
        out.append((getattr(row, "subject", "") or "", packed))
    return out


def _best_by_subject(rows: list[tuple[str, dict[str, Any]]]) -> dict[str, dict[str, Any]]:
    best: dict[str, dict[str, Any]] = {}
    for subj, packed in rows:
        cur = best.get(subj)
        if cur is None or int(packed.get("rev") or 0) >= int(cur.get("rev") or 0):
            best[subj] = packed
    return best


def read_all(cwd: str) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    store = open_store(cwd)
    best = _best_by_subject(_payloads_for(store))
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    for subj, packed in best.items():
        data = packed.get("data")
        if not isinstance(data, dict):
            continue
        if subj.startswith(NODE_PREFIX) or data.get("id"):
            if subj.startswith(EDGE_PREFIX):
                edges.append(data)
                continue
            nid = str(data.get("id") or node_id_of(subj))
            nodes[nid] = data
        elif subj.startswith(EDGE_PREFIX):
            edges.append(data)
    return nodes, edges


def read_one(cwd: str, nid: str) -> dict[str, Any] | None:
    store = open_store(cwd)
    best = _best_by_subject(_payloads_for(store, node_subject(nid)))
    packed = best.get(node_subject(nid))
    if not packed:
        return None
    data = packed.get("data")
    return data if isinstance(data, dict) else None


def row_of(data: dict[str, Any]) -> dict[str, Any]:
    nid = str(data.get("id") or "")
    ntype = str(data.get("type") or data.get("node_type") or "Entity")
    props = data.get("properties") if isinstance(data.get("properties"), dict) else {}
    content = str(data.get("content") or props.get("content") or nid)
    out_props = dict(props)
    for key in ("valid_from", "valid_until", "timestamp", "event_time"):
        if data.get(key) is not None and key not in out_props:
            out_props[key] = data.get(key)
    return {"id": nid, "type": ntype, "content": content, "properties": out_props}


def apply(cwd: str, puts: list[tuple[str, dict[str, Any]]], dels: list[str]) -> dict[str, Any]:
    store = open_store(cwd)
    rev = time.time_ns()
    existing: dict[str, dict[str, Any]] = {}
    for subj, _data in puts:
        existing.update(_best_by_subject(_payloads_for(store, subj)))
    for subj in dels:
        existing.update(_best_by_subject(_payloads_for(store, subj)))
    fresh = []
    for subj, data in puts:
        fresh.append(_triplet(subj, PRED, _dumps({"rev": rev, "data": data})))
    if fresh:
        store.add_triplets(fresh)
    for subj in [s for s, _ in puts] + list(dels):
        old = existing.get(subj)
        if not old:
            continue
        try:
            store.delete_triplet(_triplet(subj, PRED, _dumps(old)))
        except Exception:
            pass
    try:
        for row in store.get_triplets(subject=SUBJ_META, predicate=PRED_DONE) or []:
            try:
                store.delete_triplet(row if hasattr(row, "subject") else _triplet(SUBJ_META, PRED_DONE, getattr(row, "object", "") or ""))
            except Exception:
                pass
    except Exception:
        pass
    store.add_triplets([_triplet(SUBJ_META, PRED_DONE, str(rev))])
    return {"ok": True, "via": "oxigraph", "rev": rev, "wrote": len(puts), "deleted": len(dels)}


def put_node(cwd: str, data: dict[str, Any]) -> dict[str, Any]:
    nid = str(data.get("id") or "")
    if not nid:
        return {"error": "NO_PATH"}
    apply(cwd, [(node_subject(nid), data)], [])
    return {"ok": True, "id": nid, "via": "oxigraph"}


def put_edge(cwd: str, src: str, tgt: str, et: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    src, tgt, et = str(src or ""), str(tgt or ""), str(et or "related_to")
    if not src or not tgt:
        return {"error": "NO_PATH"}
    data = {"source": src, "target": tgt, "type": et}
    if extra:
        data.update({k: v for k, v in extra.items() if v is not None})
    apply(cwd, [(edge_subject(src, tgt, et), data)], [])
    return {"ok": True, "source": src, "target": tgt, "type": et, "via": "oxigraph"}


def _graph_dict(graph: Any) -> dict[str, Any]:
    if graph is None:
        return {"nodes": [], "edges": []}
    if hasattr(graph, "to_dict"):
        packed = graph.to_dict() or {}
        return packed if isinstance(packed, dict) else {"nodes": [], "edges": []}
    nodes = getattr(graph, "nodes", None)
    edges = getattr(graph, "edges", None)
    out_nodes = []
    if isinstance(nodes, dict):
        for nid, node in nodes.items():
            if isinstance(node, dict):
                row = dict(node)
                row.setdefault("id", str(nid))
                out_nodes.append(row)
    elif isinstance(nodes, list):
        out_nodes = [n for n in nodes if isinstance(n, dict)]
    out_edges = []
    bag = edges.values() if isinstance(edges, dict) else (edges or [])
    for edge in bag:
        if isinstance(edge, dict):
            out_edges.append(edge)
        else:
            out_edges.append({
                "source": str(getattr(edge, "source_id", None) or getattr(edge, "source", "") or ""),
                "target": str(getattr(edge, "target_id", None) or getattr(edge, "target", "") or ""),
                "type": str(getattr(edge, "edge_type", None) or getattr(edge, "type", "") or "related_to"),
            })
    return {"nodes": out_nodes, "edges": out_edges}


def baseline_of(graph: Any) -> dict[str, str]:
    packed = _graph_dict(graph)
    out: dict[str, str] = {}
    for node in packed.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        nid = str(node.get("id") or "")
        if not nid:
            continue
        out[node_subject(nid)] = hashlib.sha256(_dumps(node).encode("utf-8")).hexdigest()
    for edge in packed.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or edge.get("source_id") or "")
        tgt = str(edge.get("target") or edge.get("target_id") or "")
        et = str(edge.get("type") or edge.get("edge_type") or "related_to")
        if src and tgt:
            out[edge_subject(src, tgt, et)] = hashlib.sha256(_dumps({"source": src, "target": tgt, "type": et}).encode("utf-8")).hexdigest()
    return out


def _protected(subj: str, data: dict[str, Any], decision_ids: set[str]) -> bool:
    if subj.startswith(NODE_PREFIX):
        nid = str(data.get("id") or node_id_of(subj))
        ntype = str(data.get("type") or "")
        return is_archive_node(nid, ntype) or is_decision_node(nid, ntype)
    src = str(data.get("source") or "")
    tgt = str(data.get("target") or "")
    ntype = str(data.get("type") or "")
    if is_archive_node(src) or is_archive_node(tgt):
        return True
    if src in decision_ids or tgt in decision_ids:
        return True
    if ntype.upper() in {"CAUSED", "INFLUENCED", "PRECEDENT_FOR", "SUPERSEDES"}:
        return True
    return False


def write_graph(graph: Any, cwd: str, replace: bool = False, base: dict[str, str] | None = None) -> dict[str, Any]:
    try:
        open_store(cwd)
    except GraphStoreBusy as exc:
        return {"ok": False, "via": "oxigraph", "detail": str(exc), "wrote": 0, "edges": 0, "mode": "busy", "name": graph_name(cwd)}
    packed = _graph_dict(graph)
    current: dict[str, dict[str, Any]] = {}
    decision_ids: set[str] = set()
    for node in packed.get("nodes") or []:
        if not isinstance(node, dict):
            continue
        nid = str(node.get("id") or "")
        if not nid:
            continue
        current[node_subject(nid)] = node
        if is_decision_node(nid, str(node.get("type") or "")):
            decision_ids.add(nid)
    edge_count = 0
    for edge in packed.get("edges") or []:
        if not isinstance(edge, dict):
            continue
        src = str(edge.get("source") or edge.get("source_id") or "")
        tgt = str(edge.get("target") or edge.get("target_id") or "")
        et = str(edge.get("type") or edge.get("edge_type") or "related_to")
        if not src or not tgt:
            continue
        data = {"source": src, "target": tgt, "type": et}
        for key in ("weight", "metadata", "properties", "valid_from", "valid_until", "id"):
            if edge.get(key) is not None:
                data[key] = edge.get(key)
        current[edge_subject(src, tgt, et)] = data
        edge_count += 1
        if src in decision_ids or tgt in decision_ids:
            pass
    stored_nodes, stored_edges = read_all(cwd)
    for nid, node in stored_nodes.items():
        if is_decision_node(nid, str(node.get("type") or "")):
            decision_ids.add(nid)
    puts: list[tuple[str, dict[str, Any]]] = []
    for subj, data in current.items():
        digest = hashlib.sha256(_dumps(data).encode("utf-8")).hexdigest()
        if base is not None and base.get(subj) == digest:
            continue
        puts.append((subj, data))
    dels: list[str] = []
    if replace:
        for nid, node in stored_nodes.items():
            subj = node_subject(nid)
            if subj not in current:
                dels.append(subj)
        for edge in stored_edges:
            src = str(edge.get("source") or "")
            tgt = str(edge.get("target") or "")
            et = str(edge.get("type") or "related_to")
            subj = edge_subject(src, tgt, et)
            if subj not in current:
                dels.append(subj)
    elif base is not None:
        for subj in base:
            if subj in current:
                continue
            data = None
            if subj.startswith(NODE_PREFIX):
                data = stored_nodes.get(node_id_of(subj))
            else:
                for edge in stored_edges:
                    src = str(edge.get("source") or "")
                    tgt = str(edge.get("target") or "")
                    et = str(edge.get("type") or "related_to")
                    if edge_subject(src, tgt, et) == subj:
                        data = edge
                        break
            if isinstance(data, dict) and _protected(subj, data, decision_ids):
                continue
            dels.append(subj)
    apply(cwd, puts, dels)
    return {
        "ok": True,
        "via": "oxigraph",
        "wrote": len([s for s, _ in puts if s.startswith(NODE_PREFIX)]),
        "edges": edge_count,
        "mode": "replace" if replace else ("full" if base is None else "incr"),
        "name": graph_name(cwd),
    }


def read_graph(cwd: str):
    from semantica.context.context_graph import ContextGraph

    nodes, edges = read_all(cwd)
    if not nodes and not edges:
        return None, {"ok": True, "via": "oxigraph", "empty": True, "nodes": 0, "name": graph_name(cwd)}
    keep_nodes = []
    keep_ids = set()
    for nid, node in nodes.items():
        ntype = str(node.get("type") or "")
        if is_archive_node(nid, ntype):
            continue
        row = dict(node)
        row["id"] = nid
        keep_nodes.append(row)
        keep_ids.add(nid)
    keep_edges = []
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if not src or not tgt:
            continue
        if is_archive_node(src) or is_archive_node(tgt):
            continue
        if src not in keep_ids or tgt not in keep_ids:
            continue
        keep_edges.append(edge)
    graph = ContextGraph()
    graph.from_dict({"nodes": keep_nodes, "edges": keep_edges})
    return graph, {
        "ok": True,
        "via": "oxigraph",
        "empty": False,
        "nodes": len(keep_nodes),
        "edges": len(keep_edges),
        "name": graph_name(cwd),
    }
