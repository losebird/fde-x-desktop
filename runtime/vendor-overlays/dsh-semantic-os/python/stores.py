from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from pathlib import Path
from typing import Any

import graph_store
from graph_store import GraphStoreBusy, graph_name, is_archive_node, oxigraph_dir

ARCHIVE_ID_PREFIXES = graph_store.ARCHIVE_ID_PREFIXES
ARCHIVE_TYPES = graph_store.ARCHIVE_TYPES

BUSY_DETAIL = graph_store.BUSY_DETAIL


def primary_status() -> dict[str, Any]:
    try:
        from semantica.triplet_store import TripletStore  # noqa: F401
        import pyoxigraph  # noqa: F401
    except Exception as exc:
        return {"ok": False, "via": "oxigraph", "detail": str(exc)[:240]}
    return {"ok": True, "via": "oxigraph"}


def write_primary(graph: Any, cwd: str, replace: bool = False, base: dict[str, str] | None = None) -> dict[str, Any]:
    forget_node_rows(cwd)
    try:
        return graph_store.write_graph(graph, cwd, replace=replace, base=base)
    except GraphStoreBusy as exc:
        return {"ok": False, "via": "oxigraph", "detail": str(exc), "wrote": 0, "edges": 0, "mode": "busy", "name": graph_name(cwd)}


def read_primary(cwd: str) -> tuple[Any | None, dict[str, Any]]:
    st = primary_status()
    if not st.get("ok"):
        return None, st
    try:
        graph, meta = graph_store.read_graph(cwd)
    except GraphStoreBusy as exc:
        return None, {"ok": False, "via": "oxigraph", "detail": str(exc), "empty": True}
    if graph is None:
        return None, {**st, **meta, "empty": True}
    return graph, {**st, **meta}


def _iter_nodes(graph: Any):
    nodes = getattr(graph, "nodes", {}) or {}
    if isinstance(nodes, dict):
        yield from nodes.items()
        return
    if isinstance(nodes, list):
        for node in nodes:
            hid = node.get("id") if isinstance(node, dict) else (
                getattr(node, "node_id", None) or getattr(node, "id", None)
            )
            yield str(hid or ""), node


def _iter_edges(graph: Any):
    edges = getattr(graph, "edges", None)
    if isinstance(edges, dict):
        yield from edges.values()
        return
    if isinstance(edges, list):
        yield from edges


def forget_node_rows(cwd: str = "") -> None:
    key = os.path.realpath(cwd or "")
    with _ROWS_LOCK:
        if key:
            _ROWS_CACHE.pop(key, None)
        else:
            _ROWS_CACHE.clear()


_ROWS_CACHE: dict[str, tuple[float, list[dict[str, Any]], dict[str, Any]]] = {}
_ROWS_LOCK = threading.Lock()
_ROWS_TTL = 2.0


def read_node_rows(cwd: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    cache_key = os.path.realpath(cwd or "")
    now = time.time()
    with _ROWS_LOCK:
        hit = _ROWS_CACHE.get(cache_key)
        if hit and now - hit[0] < _ROWS_TTL:
            return hit[1], hit[2]
    st = primary_status()
    try:
        nodes, _edges = graph_store.read_all(cwd)
    except GraphStoreBusy as exc:
        return [], {"ok": False, "via": "oxigraph", "detail": str(exc)}
    except Exception as exc:
        return [], {"ok": False, "via": "oxigraph", "detail": str(exc)[:240]}
    out = [graph_store.row_of(node) for node in nodes.values() if isinstance(node, dict)]
    packed = {**st, "nodes": len(out), "via": "oxigraph"}
    with _ROWS_LOCK:
        _ROWS_CACHE[cache_key] = (time.time(), out, packed)
    return out, packed


def read_memory_card_rows(cwd: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows, st = read_node_rows(cwd)
    cards = [row for row in rows if isinstance(row, dict) and str(row.get("type") or "") == "记忆卡片"]
    return cards, {**st, "nodes": len(cards)}


def read_nodes_by_id(cwd: str, ids: list[str]) -> dict[str, dict[str, Any]]:
    wanted = [str(nid or "").strip() for nid in ids if str(nid or "").strip()]
    out: dict[str, dict[str, Any]] = {}
    for nid in wanted:
        node = graph_store.read_one(cwd, nid)
        if node:
            out[nid] = graph_store.row_of(node)
    return out


def patch_node_props(cwd: str, nid: str, extra: dict[str, Any]) -> dict[str, Any]:
    nid = str(nid or "").strip()
    if not nid:
        return {"error": "NO_PATH"}
    extra = extra if isinstance(extra, dict) else {}
    node = graph_store.read_one(cwd, nid)
    if node is None:
        return {"error": "NO_PATH", "id": nid}
    props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    props = dict(props)
    props.update({str(k): v for k, v in extra.items() if v is not None})
    node = dict(node)
    node["properties"] = props
    for key in ("valid_from", "valid_until"):
        if key in extra:
            node[key] = extra[key]
    graph_store.put_node(cwd, node)
    forget_node_rows(cwd)
    return {"ok": True, "id": nid, "via": "patch", "properties": props}


def insert_memory_card(cwd: str, nid: str, label: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    nid = str(nid or "").strip()
    label = str(label or "").strip()
    extra = extra if isinstance(extra, dict) else {}
    if not nid or not label:
        return {"error": "NO_PATH"}
    if graph_store.read_one(cwd, nid):
        return {"ok": True, "id": nid, "status": "exists", "duplicate": True}
    props = {str(k): v for k, v in extra.items() if v is not None}
    props.setdefault("kind", "记忆卡片")
    props.setdefault("status", "起草")
    data = {"id": nid, "type": "记忆卡片", "content": label[:160], "properties": props, "metadata": {}}
    graph_store.put_node(cwd, data)
    source = str(props.get("source") or props.get("path") or "").strip()
    if source.startswith(("session:", "file:")):
        graph_store.put_edge(cwd, source, nid, "出自")
    forget_node_rows(cwd)
    return {"ok": True, "id": nid, "status": str(props.get("status") or "起草"), "via": "insert"}


def insert_edge(cwd: str, src: str, tgt: str, et: str) -> dict[str, Any]:
    src = str(src or "").strip()
    tgt = str(tgt or "").strip()
    et = str(et or "").strip()
    if not src or not tgt or not et:
        return {"error": "NO_PATH"}
    graph_store.put_edge(cwd, src, tgt, et)
    forget_node_rows(cwd)
    return {"ok": True, "source": src, "target": tgt, "type": et, "via": "insert"}


def upsert_entity(cwd: str, nid: str, ntype: str, label: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    nid = str(nid or "").strip()
    ntype = str(ntype or "Entity").strip() or "Entity"
    label = str(label or nid).strip() or nid
    extra = extra if isinstance(extra, dict) else {}
    if not nid:
        return {"error": "NO_PATH"}
    existing = graph_store.read_one(cwd, nid)
    if existing:
        return {"ok": True, "id": nid, "duplicate": True, "via": "exists"}
    props = {str(k): v for k, v in extra.items() if v is not None}
    props.setdefault("node_type", ntype)
    graph_store.put_node(cwd, {"id": nid, "type": ntype, "content": label[:20000], "properties": props, "metadata": {}})
    forget_node_rows(cwd)
    return {"ok": True, "id": nid, "via": "insert"}


def read_edge_rows(cwd: str) -> list[dict[str, Any]]:
    try:
        _nodes, edges = graph_store.read_all(cwd)
    except GraphStoreBusy:
        return []
    out = []
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        et = str(edge.get("type") or "related_to")
        if src and tgt:
            out.append({"source": src, "target": tgt, "type": et})
    return out


def close_store() -> None:
    graph_store.close_all()


close_lite = close_store


VECTOR_ALGO = "faiss-bge-small-zh-v1.5"
VEC_MODEL = "BAAI/bge-small-zh-v1.5"
VEC_DIM = 512
LEGACY_FAISS_NAME = "index.faiss"
_VECTOR_MEM: dict[str, Any] = {}
_VECTOR_LOCK = threading.Lock()
_VECTOR_PENDING: dict[str, tuple[list[str], list[str]]] = {}
_VECTOR_RUNNING: set[str] = set()
_VECTOR_ERROR: dict[str, str] = {}


def make_vector_store():
    from semantica.vector_store import VectorStore

    vs = VectorStore(backend="faiss", dimension=VEC_DIM)
    vs.embedder.set_text_model("fastembed", VEC_MODEL)
    return vs


def vector_status() -> dict[str, Any]:
    try:
        from semantica.vector_store import VectorStore  # noqa: F401
        import faiss  # noqa: F401
        return {"ok": True, "via": "faiss", "detail": "", "algo": VECTOR_ALGO}
    except Exception as exc:
        return {"ok": False, "via": "faiss", "detail": str(exc)[:200], "algo": VECTOR_ALGO}


def vector_dir(cwd: str) -> Path:
    return Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "vectors"


def _collect_vector_texts(graph: Any) -> tuple[list[str], list[str]]:
    ids: list[str] = []
    texts: list[str] = []
    for nid, node in _iter_nodes(graph):
        if not nid:
            continue
        if isinstance(node, dict):
            content = str(node.get("content") or (node.get("properties") or {}).get("content") or "")
        else:
            content = str(getattr(node, "content", None) or "")
        if len(content.strip()) < 2:
            continue
        ids.append(str(nid))
        texts.append(str(nid) + "\n" + content[:8000])
    return ids, texts


def _vector_fingerprint(ids: list[str], texts: list[str]) -> str:
    fp = hashlib.sha1()
    for nid, text in zip(ids, texts):
        fp.update(nid.encode("utf-8", "ignore"))
        fp.update(b"\0")
        fp.update(text.encode("utf-8", "ignore"))
        fp.update(b"\n")
    return fp.hexdigest()


def _read_vector_meta(dest: Path) -> dict[str, Any]:
    meta_path = dest / "meta.json"
    if not meta_path.is_file():
        return {}
    try:
        raw = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return raw if isinstance(raw, dict) else {}


def _vector_ready(dest: Path, meta: dict[str, Any] | None = None) -> bool:
    packed = meta if meta is not None else _read_vector_meta(dest)
    return (
        str(packed.get("algo") or "") == VECTOR_ALGO
        and (dest / "index.bin").is_file()
        and (dest / "store_data.json").is_file()
    )


def _remember_vectors(cwd: str, vs: Any) -> None:
    _VECTOR_MEM[os.path.realpath(cwd or "")] = vs


def _open_doc_vs(cwd: str):
    root = os.path.realpath(cwd or "")
    hit = _VECTOR_MEM.get(root)
    if hit is not None:
        return hit
    dest = vector_dir(cwd)
    vs = make_vector_store()
    if _vector_ready(dest):
        try:
            vs.load(str(dest))
        except Exception:
            vs = make_vector_store()
    _remember_vectors(cwd, vs)
    return vs


def _save_doc_vs(cwd: str, vs: Any, ids: list[str], digest: str) -> None:
    dest = vector_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    vs.save(str(dest))
    (dest / "meta.json").write_text(
        json.dumps({"fp": digest, "count": len(ids), "algo": VECTOR_ALGO, "ids": ids}, ensure_ascii=False),
        encoding="utf-8",
    )
    _remember_vectors(cwd, vs)


def rebuild_vectors(cwd: str, graph: Any) -> dict[str, Any]:
    ids, texts = _collect_vector_texts(graph)
    return _rebuild_from_texts(cwd, ids, texts)


def _rebuild_from_texts(cwd: str, ids: list[str], texts: list[str]) -> dict[str, Any]:
    st = vector_status()
    if not st.get("ok"):
        return st
    if not texts:
        return {**st, "count": 0, "algo": VECTOR_ALGO}
    dest = vector_dir(cwd)
    digest = _vector_fingerprint(ids, texts)
    meta = _read_vector_meta(dest)
    if _vector_ready(dest, meta) and str(meta.get("fp") or "") == digest:
        return {**st, "count": len(ids), "skipped": True, "algo": VECTOR_ALGO}
    vs = make_vector_store()
    for start in range(0, len(texts), 256):
        batch_ids = ids[start:start + 256]
        batch_texts = texts[start:start + 256]
        vs.add_documents(
            batch_texts,
            metadata=[{"node_id": nid, "kind": "node"} for nid in batch_ids],
            parallel=False,
        )
    _save_doc_vs(cwd, vs, ids, digest)
    return {**st, "count": len(ids), "skipped": False, "algo": VECTOR_ALGO}


def _vector_root(cwd: str) -> str:
    return os.path.realpath(cwd or "")


def schedule_rebuild_vectors(cwd: str, graph: Any) -> dict[str, Any]:
    root = _vector_root(cwd)
    ids, texts = _collect_vector_texts(graph)
    with _VECTOR_LOCK:
        _VECTOR_PENDING[root] = (ids, texts)
        if root in _VECTOR_RUNNING:
            return {"ok": True, "queued": True, "merged": True, "cwd": root}
        _VECTOR_RUNNING.add(root)
    thread = threading.Thread(target=_vector_worker, args=(root,), name=f"dsos-vec-{root[-8:]}", daemon=True)
    thread.start()
    return {"ok": True, "queued": True, "merged": False, "cwd": root}


def _vector_worker(root: str) -> None:
    while True:
        with _VECTOR_LOCK:
            job = _VECTOR_PENDING.pop(root, None)
            if job is None:
                _VECTOR_RUNNING.discard(root)
                return
        try:
            _rebuild_from_texts(root, job[0], job[1])
            with _VECTOR_LOCK:
                _VECTOR_ERROR.pop(root, None)
        except Exception as exc:
            with _VECTOR_LOCK:
                _VECTOR_ERROR[root] = str(exc)[:200]


def wait_vector_rebuild(cwd: str, timeout: float = 15.0) -> bool:
    root = _vector_root(cwd)
    deadline = time.time() + max(float(timeout or 0), 0.1)
    while time.time() < deadline:
        with _VECTOR_LOCK:
            if root not in _VECTOR_RUNNING and root not in _VECTOR_PENDING:
                return True
        time.sleep(0.02)
    return False


def vector_index_status(cwd: str) -> dict[str, Any]:
    st = vector_status()
    dest = vector_dir(cwd)
    meta = _read_vector_meta(dest)
    ready = _vector_ready(dest, meta)
    legacy = (dest / LEGACY_FAISS_NAME).is_file() and not ready
    root = _vector_root(cwd)
    with _VECTOR_LOCK:
        building = root in _VECTOR_RUNNING or root in _VECTOR_PENDING
        err = _VECTOR_ERROR.get(root) or ""
    if not st.get("ok"):
        state = "unavailable"
    elif building:
        state = "building"
    elif ready:
        state = "ready"
    elif legacy:
        state = "ignored_faiss"
    else:
        state = "missing"
    details = {
        "ready": "就绪",
        "building": "正在建",
        "ignored_faiss": "旧 FAISS 已忽略",
        "missing": "未建",
        "unavailable": st.get("detail") or "不可用",
    }
    return {
        **st,
        "state": state,
        "detail": details.get(state) or state,
        "count": int(meta.get("count") or 0) if ready else 0,
        "algo": VECTOR_ALGO if ready else "",
        "legacy_faiss": legacy,
        "error": err,
    }


def _search_hit(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        nid = str(meta.get("node_id") or row.get("id") or "").strip()
        score = float(row.get("score") or 0)
    else:
        meta = getattr(row, "metadata", None)
        meta = meta if isinstance(meta, dict) else {}
        nid = str(meta.get("node_id") or getattr(row, "id", "") or "").strip()
        score = float(getattr(row, "score", 0) or 0)
    if not nid:
        return None
    return {"id": nid, "score": score}


def search_vectors(cwd: str, query: str, limit: int = 8) -> list[dict[str, Any]]:
    q = str(query or "").strip()
    if not q:
        return []
    dest = vector_dir(cwd)
    if not _vector_ready(dest):
        return []
    try:
        vs = _open_doc_vs(cwd)
        rows = vs.search(q, limit=max(int(limit or 8), 1)) or []
    except Exception:
        return []
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in rows:
        hit = _search_hit(row)
        if not hit or hit["id"] in seen or hit["score"] <= 0:
            continue
        seen.add(hit["id"])
        out.append(hit)
    return out[: max(int(limit or 8), 1)]
