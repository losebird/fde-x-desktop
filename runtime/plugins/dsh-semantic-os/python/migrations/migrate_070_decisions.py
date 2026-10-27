"""Rebuild native decision indexes and VectorStore from Oxigraph rows. Idempotent."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _dsh_home() -> Path:
    raw = (os.environ.get("DSH_HOME") or "").strip()
    return Path(raw) if raw else Path.home() / ".dsh"


def _is_decision(node: dict[str, Any]) -> bool:
    ntype = str(node.get("type") or node.get("node_type") or "")
    return ntype.lower() == "decision"


def _fields(node: dict[str, Any]) -> dict[str, Any]:
    props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    meta = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
    return {**props, **meta, "id": str(node.get("id") or ""), "content": str(node.get("content") or "")}


def migrate(cwd: str) -> dict[str, Any]:
    from semantica.context import Decision
    from semantica.context.context_graph import ContextGraph
    import graph_store
    from semantic_sync import get_vs, save_vs, vec_put

    dest = graph_store.oxigraph_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    marker = dest / ".migrated-070-decisions"
    if marker.is_file():
        return {"ok": True, "skipped": True}
    graph, meta = graph_store.read_graph(cwd)
    if graph is None:
        marker.write_text("{}\n", encoding="utf-8")
        return {"ok": True, "nodes": 0, "empty": True}
    nodes, edges = graph_store.read_all(cwd)
    rebuilt = 0
    for nid, node in nodes.items():
        if not isinstance(node, dict) or not _is_decision(node):
            continue
        packed = _fields(node)
        if packed.get("scenario") and packed.get("outcome") is not None:
            continue
        ts = packed.get("timestamp") or datetime.now(timezone.utc).replace(tzinfo=None)
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                ts = datetime.now(timezone.utc).replace(tzinfo=None)
        decision = Decision(
            decision_id=nid,
            category=str(packed.get("category") or ""),
            scenario=str(packed.get("scenario") or packed.get("content") or nid),
            reasoning=str(packed.get("reasoning") or ""),
            outcome=str(packed.get("outcome") or packed.get("content") or ""),
            confidence=float(packed.get("confidence") or 0.5),
            timestamp=ts if isinstance(ts, datetime) else datetime.now(timezone.utc).replace(tzinfo=None),
            decision_maker=str(packed.get("decision_maker") or "dsh-semantic-os"),
            metadata={"status": str(packed.get("status") or "起草"), "fdex_id": nid},
            auto_generate_id=False,
        )
        try:
            graph.add_decision(decision)
            rebuilt += 1
        except Exception:
            pass
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        et = str(edge.get("type") or "")
        if not src or not tgt:
            continue
        src_n = nodes.get(src) or {}
        tgt_n = nodes.get(tgt) or {}
        if _is_decision(src_n) and _is_decision(tgt_n):
            rel = "CAUSED" if et in {"leads_to", "causes", "CAUSED"} else "PRECEDENT_FOR" if et in {"supports", "PRECEDENT_FOR"} else "INFLUENCED" if et in {"influences", "INFLUENCED"} else ""
            if rel and hasattr(graph, "add_causal_relationship"):
                try:
                    graph.add_causal_relationship(src, tgt, rel)
                    continue
                except Exception:
                    pass
        try:
            graph.add_edge(src, tgt, et or "related_to")
        except Exception:
            pass
    graph_store.write_graph(graph, cwd)
    graph2, _meta = graph_store.read_graph(cwd)
    vs = get_vs(cwd)
    indexed = 0
    if graph2 is not None:
        from semantic_sync import iter_decision_nodes, _decision_fields
        for node in iter_decision_nodes(graph2):
            packed = _decision_fields(node)
            did = str(packed.get("id") or "")
            status = str(packed.get("status") or "起草")
            if did and vec_put(vs, graph2, did, status):
                indexed += 1
        graph_store.write_graph(graph2, cwd)
        save_vs(cwd, vs)
    marker.write_text(json.dumps({"rebuilt": rebuilt, "indexed": indexed}, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"ok": True, "rebuilt": rebuilt, "indexed": indexed, "via": meta.get("via")}
