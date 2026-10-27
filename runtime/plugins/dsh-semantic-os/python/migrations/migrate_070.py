"""Import FalkorDB export + graph.json into Oxigraph. Idempotent."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def _dsh_home() -> Path:
    raw = (os.environ.get("DSH_HOME") or "").strip()
    return Path(raw) if raw else Path.home() / ".dsh"


def _node_from_export(row: list[Any]) -> dict[str, Any] | None:
    if not isinstance(row, (list, tuple)) or not row:
        return None
    nid = str(row[0] or "")
    if not nid:
        return None
    ntype = str(row[1] if len(row) > 1 else "Entity") or "Entity"
    content = str(row[2] if len(row) > 2 else nid)
    props: dict[str, Any] = {}
    raw = row[3] if len(row) > 3 else "{}"
    if isinstance(raw, dict):
        props = dict(raw)
    else:
        try:
            packed = json.loads(raw or "{}")
            if isinstance(packed, dict):
                props = packed
        except Exception:
            props = {}
    return {"id": nid, "type": ntype, "content": content, "properties": props, "metadata": {}}


def _node_from_graph_json(node: Any, fallback_id: str = "") -> dict[str, Any] | None:
    if not isinstance(node, dict):
        return None
    nid = str(node.get("id") or fallback_id or "")
    if not nid:
        return None
    ntype = str(node.get("type") or node.get("node_type") or "Entity")
    props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    content = str(node.get("content") or props.get("content") or nid)
    out = {"id": nid, "type": ntype, "content": content, "properties": dict(props), "metadata": dict(node.get("metadata") or {})}
    for key in ("valid_from", "valid_until", "timestamp", "event_time"):
        if node.get(key) is not None and key not in out["properties"]:
            out["properties"][key] = node.get(key)
            out[key] = node.get(key)
    return out


def migrate(cwd: str, dsh_home: str | Path | None = None) -> dict[str, Any]:
    from graph_store import apply, edge_subject, graph_name, node_subject, oxigraph_dir

    dest = oxigraph_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    marker = dest / ".migrated-070"
    if marker.is_file():
        return {"ok": True, "skipped": True}
    home = Path(dsh_home) if dsh_home else _dsh_home()
    name = graph_name(cwd)
    nodes: dict[str, dict[str, Any]] = {}
    edges: list[tuple[str, str, str]] = []
    export_path = home / "semantic-os" / "falkordb-export" / f"{name}.json"
    if export_path.is_file():
        try:
            packed = json.loads(export_path.read_text(encoding="utf-8"))
        except Exception:
            packed = {}
        for row in packed.get("nodes") or []:
            node = _node_from_export(row)
            if node:
                nodes[node["id"]] = node
        for row in packed.get("edges") or []:
            if isinstance(row, (list, tuple)) and len(row) >= 2:
                edges.append((str(row[0] or ""), str(row[1] or ""), str(row[2] if len(row) > 2 else "related_to")))
    gj = Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "graph.json"
    if gj.is_file():
        try:
            data = json.loads(gj.read_text(encoding="utf-8"))
        except Exception:
            data = {}
        bag = data.get("nodes") if isinstance(data, dict) else None
        if isinstance(bag, list):
            for node in bag:
                parsed = _node_from_graph_json(node)
                if parsed and parsed["id"] not in nodes:
                    nodes[parsed["id"]] = parsed
        elif isinstance(bag, dict):
            for nid, node in bag.items():
                parsed = _node_from_graph_json(node, str(nid))
                if parsed and parsed["id"] not in nodes:
                    nodes[parsed["id"]] = parsed
        for edge in (data.get("edges") if isinstance(data, dict) else None) or []:
            if not isinstance(edge, dict):
                continue
            src = str(edge.get("source") or edge.get("source_id") or "")
            tgt = str(edge.get("target") or edge.get("target_id") or "")
            et = str(edge.get("type") or edge.get("edge_type") or "related_to")
            if src and tgt and (src, tgt, et) not in edges:
                edges.append((src, tgt, et))
    puts = []
    for nid, node in nodes.items():
        puts.append((node_subject(nid), node))
    for src, tgt, et in edges:
        if src and tgt:
            puts.append((edge_subject(src, tgt, et), {"source": src, "target": tgt, "type": et}))
    if puts:
        apply(cwd, puts, [])
    marker.write_text(json.dumps({"nodes": len(nodes), "edges": len(edges)}, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"ok": True, "nodes": len(nodes), "edges": len(edges), "name": name}
