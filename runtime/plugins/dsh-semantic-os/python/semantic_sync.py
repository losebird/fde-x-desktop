"""Decision VectorStore sync. The Oxigraph graph is the authority."""
from __future__ import annotations

import os
import threading
from pathlib import Path
from typing import Any

VEC_MODEL = "BAAI/bge-small-zh-v1.5"
VEC_DIM = 512

_LOCK = threading.Lock()
_VS: dict[str, Any] = {}


def vec_dir(cwd: str) -> Path:
    return Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "vec"


def _decision_fields(node: Any) -> dict[str, Any]:
    if isinstance(node, dict):
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        meta = node.get("metadata") if isinstance(node.get("metadata"), dict) else {}
        nid = str(node.get("id") or node.get("decision_id") or node.get("node_id") or "")
        ntype = str(node.get("type") or node.get("node_type") or "")
        content = str(node.get("content") or "")
    else:
        props = getattr(node, "properties", None) or {}
        meta = getattr(node, "metadata", None) or {}
        nid = str(getattr(node, "node_id", None) or getattr(node, "id", "") or "")
        ntype = str(getattr(node, "node_type", None) or getattr(node, "type", "") or "")
        content = str(getattr(node, "content", None) or "")
        if not isinstance(props, dict):
            props = {}
        if not isinstance(meta, dict):
            meta = {}
    packed = {**props, **meta}
    packed["id"] = nid
    packed["type"] = ntype
    packed.setdefault("scenario", packed.get("scenario") or content)
    return packed


def iter_decision_nodes(graph: Any) -> list[Any]:
    out = []
    if graph is None:
        return out
    if hasattr(graph, "find_nodes"):
        try:
            for node in graph.find_nodes(node_type="decision") or []:
                out.append(node)
            for node in graph.find_nodes(node_type="Decision") or []:
                out.append(node)
        except Exception:
            pass
    if out:
        return out
    nodes = getattr(graph, "nodes", None) or {}
    items = nodes.items() if isinstance(nodes, dict) else []
    for nid, node in items:
        ntype = ""
        if isinstance(node, dict):
            ntype = str(node.get("type") or node.get("node_type") or "")
        else:
            ntype = str(getattr(node, "node_type", None) or getattr(node, "type", "") or "")
        if ntype.lower() == "decision":
            out.append(node if isinstance(node, dict) else {"id": nid, "type": ntype, "properties": getattr(node, "properties", None) or {}, "metadata": getattr(node, "metadata", None) or {}, "content": getattr(node, "content", "")})
    return out


def get_vs(cwd: str):
    key = os.path.realpath(cwd or "")
    with _LOCK:
        hit = _VS.get(key)
        if hit is not None:
            return hit
    from semantica.vector_store import VectorStore

    vs = VectorStore(backend="faiss", dimension=VEC_DIM)
    try:
        vs.embedder.set_text_model("fastembed", VEC_MODEL)
    except Exception:
        pass
    dest = vec_dir(cwd)
    if dest.exists():
        try:
            vs.load(str(dest))
        except Exception:
            pass
    try:
        vs.initialize_decision_pipeline()
    except Exception:
        pass
    with _LOCK:
        _VS[key] = vs
    return vs


def save_vs(cwd: str, vs: Any | None = None) -> None:
    store = vs or _VS.get(os.path.realpath(cwd or ""))
    if store is None:
        return
    dest = vec_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    try:
        store.save(str(dest))
    except Exception:
        pass


def vec_put(vs: Any, graph: Any, did: str, status: str) -> str:
    did = str(did or "").strip()
    if not did or vs is None:
        return ""
    node = None
    if hasattr(graph, "nodes") and isinstance(graph.nodes, dict):
        node = graph.nodes.get(did)
    packed = _decision_fields(node) if node is not None else {"id": did}
    old = str(packed.get("vector_id") or "").strip()
    if old:
        try:
            vs.delete_vectors([old])
        except Exception:
            pass
    entities = packed.get("entities") or []
    if isinstance(entities, str):
        entities = [entities]
    try:
        vid = vs.store_decision(
            str(packed.get("scenario") or packed.get("content") or did),
            reasoning=str(packed.get("reasoning") or ""),
            outcome=str(packed.get("outcome") or ""),
            confidence=float(packed.get("confidence") or 0.5),
            entities=[str(x) for x in entities],
            category=str(packed.get("category") or ""),
            decision_id=did,
            status=status,
        )
    except Exception:
        return ""
    if hasattr(graph, "add_node_attribute"):
        try:
            graph.add_node_attribute(did, {"vector_id": vid, "status": status})
        except Exception:
            pass
    return str(vid or "")


def vec_reconcile(vs: Any, graph: Any) -> dict[str, Any]:
    if vs is None or graph is None:
        return {"ok": False, "added": 0}
    known: dict[str, str] = {}
    try:
        for row in vs.iter_vectors(batch_size=200) or []:
            meta = row.get("metadata") if isinstance(row, dict) else {}
            if not isinstance(meta, dict):
                continue
            did = str(meta.get("decision_id") or "").strip()
            vid = str(row.get("id") or "")
            if did and vid:
                known[did] = vid
    except Exception:
        known = {}
    added = 0
    for node in iter_decision_nodes(graph):
        packed = _decision_fields(node)
        did = str(packed.get("id") or "")
        if not did:
            continue
        status = str(packed.get("status") or packed.get("board_status") or "起草")
        if did in known and str(packed.get("vector_id") or "") == known[did]:
            continue
        if vec_put(vs, graph, did, status):
            added += 1
    return {"ok": True, "added": added, "known": len(known)}
