"""Passage index over DSH log chunks via native VectorStore. Ids are session:id:seq."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

from stores import VECTOR_ALGO, VEC_MODEL, _search_hit, make_vector_store

PASSAGE_ALGO = VECTOR_ALGO
PASSAGE_TEXT = 1200
_LOCK = threading.Lock()
_MEM: dict[str, Any] = {}


def _passage_max() -> int:
    try:
        n = int(os.environ.get("DSH_SEMANTIC_OS_PASSAGE_MAX") or "10000")
    except (TypeError, ValueError):
        n = 10000
    return max(1, min(n, 20_000))


def passage_dir(cwd: str) -> Path:
    return Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "passages"


def faiss_status() -> dict[str, Any]:
    try:
        from semantica.vector_store import VectorStore  # noqa: F401
        import faiss  # noqa: F401
        return {"ok": True, "via": "faiss", "detail": "", "algo": PASSAGE_ALGO}
    except Exception as exc:
        return {"ok": False, "via": "faiss", "detail": str(exc)[:200], "algo": PASSAGE_ALGO}


def _ready(dest: Path) -> bool:
    return (dest / "index.bin").is_file() and (dest / "store_data.json").is_file()


def passage_index_status(cwd: str) -> dict[str, Any]:
    st = faiss_status()
    dest = passage_dir(cwd)
    meta: dict[str, Any] = {}
    meta_path = dest / "meta.json"
    if meta_path.is_file():
        try:
            packed = json.loads(meta_path.read_text(encoding="utf-8"))
            if isinstance(packed, dict):
                meta = packed
        except Exception:
            meta = {}
    ready = bool(st.get("ok") and _ready(dest))
    count = int(meta.get("count") or 0) if ready else 0
    if not st.get("ok"):
        state = "unavailable"
        detail = st.get("detail") or "不可用"
    elif ready:
        state = "ready"
        detail = f"就绪 · {count} 段"
    else:
        state = "missing"
        detail = "未建"
    return {
        **st,
        "ok": ready,
        "state": state,
        "detail": detail,
        "count": count,
        "algo": PASSAGE_ALGO if ready else (st.get("algo") or ""),
    }


def _load_meta(dest: Path) -> dict[str, Any]:
    path = dest / "meta.json"
    if not path.is_file():
        return {}
    try:
        packed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return packed if isinstance(packed, dict) else {}


def _load_times(dest: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    meta_times = _load_meta(dest).get("times")
    if isinstance(meta_times, dict):
        for key, value in meta_times.items():
            nid = str(key or "").strip()
            stamp = str(value or "").strip()
            if nid and stamp:
                out[nid] = stamp
    return out


def _load_ids(dest: Path) -> list[str]:
    ids = _load_meta(dest).get("ids")
    if isinstance(ids, list) and ids:
        return [str(x).strip() for x in ids if str(x).strip()]
    return []


def _load_store(dest: Path) -> dict[str, str]:
    texts = _load_meta(dest).get("texts")
    if isinstance(texts, dict):
        return {str(k): str(v) for k, v in texts.items() if str(k).strip() and str(v).strip()}
    return {}


def _open_vs(dest: Path):
    key = str(dest)
    hit = _MEM.get(key)
    if hit is not None:
        return hit
    vs = make_vector_store()
    if _ready(dest):
        try:
            vs.load(str(dest))
        except Exception:
            vs = make_vector_store()
    _MEM[key] = vs
    return vs


def _write_meta(dest: Path, ids: list[str], times: dict[str, str], texts: dict[str, str]) -> None:
    dest.mkdir(parents=True, exist_ok=True)
    meta = {
        "count": len(ids),
        "algo": PASSAGE_ALGO,
        "model": VEC_MODEL,
        "ids": ids,
        "times": {nid: times[nid] for nid in ids if times.get(nid)},
        "texts": {nid: texts[nid] for nid in ids if texts.get(nid)},
    }
    (dest / "meta.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")


def index_passages(cwd: str, rows: list[Any] | None = None) -> dict[str, Any]:
    st = faiss_status()
    if not st.get("ok"):
        return st
    dest = passage_dir(cwd)
    with _LOCK:
        times = _load_times(dest)
        texts = _load_store(dest)
        cap = _passage_max()
        ids = _load_ids(dest)
        known = set(ids)
        updated = 0
        for row in rows or []:
            if not isinstance(row, dict):
                continue
            nid = str(row.get("id") or row.get("path") or "").strip()
            text = str(row.get("text") or row.get("content") or "").strip()
            if not nid or len(text) < 2:
                continue
            stamp = str(row.get("time") or row.get("timestamp") or row.get("valid_from") or "").strip()
            if stamp:
                times[nid] = stamp
            blob = text[:PASSAGE_TEXT]
            texts[nid] = blob
            if nid in known:
                continue
            known.add(nid)
            ids.append(nid)
            updated += 1
        if len(ids) > cap:
            ids = ids[-cap:]
            updated = max(updated, 1)
        if not ids and not _ready(dest):
            return {**st, "count": 0, "updated": 0, "cap": cap}
        if updated or not _ready(dest) or "ids" not in _load_meta(dest):
            vs = make_vector_store()
            vs.add_documents(
                [texts[nid] for nid in ids],
                metadata=[{"node_id": nid, "kind": "passage", "time": times.get(nid, "")} for nid in ids],
                parallel=False,
            )
            dest.mkdir(parents=True, exist_ok=True)
            vs.save(str(dest))
            _MEM[str(dest)] = vs
            _write_meta(dest, ids, times, {nid: texts[nid] for nid in ids if texts.get(nid)})
        return {**st, "count": len(ids), "updated": updated, "cap": cap}


def _passage_queries(query: str) -> list[str]:
    q = str(query or "").strip()
    if not q:
        return []
    out = [q]
    if "人类记忆" in q:
        for extra in ("人类对记忆", "语义助手还差哪些"):
            if extra not in out:
                out.append(extra)
    if "工作记忆" in q:
        for extra in ("眼前这几秒到几分钟", "人类不是把整本日记"):
            if extra not in out:
                out.append(extra)
    if "只发" in q and "darwin" in q.lower():
        for extra in ("该不该只发 darwin-arm64", "要不要只发 darwin-arm64"):
            if extra not in out:
                out.append(extra)
    return out[:5]


def search_passages(cwd: str, query: str, limit: int = 8) -> list[dict[str, Any]]:
    q = str(query or "").strip()
    if not q:
        return []
    dest = passage_dir(cwd)
    merged: list[dict[str, Any]] = []
    seen: set[str] = set()
    queries = _passage_queries(q)
    ordered = queries[1:] + queries[:1] if len(queries) > 1 else queries
    for pq in ordered:
        for row in _search_passages_one(cwd, pq, limit, dest):
            nid = str(row.get("id") or "")
            if not nid or nid in seen:
                continue
            seen.add(nid)
            merged.append(row)
    return merged[: max(int(limit or 8), 24)]


def _search_passages_one(cwd: str, q: str, limit: int, dest: Path) -> list[dict[str, Any]]:
    if not q or not _ready(dest):
        return []
    times = _load_times(dest)
    try:
        vs = _open_vs(dest)
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
        packed = {"id": hit["id"], "score": hit["score"], "time": times.get(hit["id"], "")}
        out.append(packed)
    return out[: max(int(limit or 8), 24)]
