"""FAISS passage index over DSH log chunks. Ids are session:id:seq (or file:/mail:)."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

PASSAGE_ALGO = "faiss-ip-hash256-v1"
PASSAGE_TEXT = 1200
_LOCK = threading.Lock()
_MEM: dict[str, tuple[Any, list[str]]] = {}


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
        import faiss  # noqa: F401
        import numpy  # noqa: F401
        return {"ok": True, "via": "faiss", "detail": "", "algo": PASSAGE_ALGO}
    except Exception as exc:
        return {"ok": False, "via": "faiss", "detail": str(exc)[:200], "algo": PASSAGE_ALGO}


def passage_index_status(cwd: str) -> dict[str, Any]:
    """Settings-facing FAISS log-chunk index. Not the old graph TF-IDF complement."""
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
    ready = bool(st.get("ok") and (dest / "index.faiss").is_file())
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


def _embed(texts: list[str]):
    import numpy as np
    from sklearn.feature_extraction.text import HashingVectorizer
    from sklearn.preprocessing import normalize

    vec = HashingVectorizer(
        n_features=256,
        analyzer="char_wb",
        ngram_range=(2, 4),
        alternate_sign=False,
        norm=None,
    )
    matrix = vec.transform(texts)
    matrix = normalize(matrix, norm="l2", axis=1, copy=False)
    return np.asarray(matrix.toarray(), dtype="float32")


def _load_store(dest: Path) -> dict[str, str]:
    path = dest / "texts.json"
    if not path.is_file():
        return {}
    try:
        packed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(packed, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in packed.items():
        nid = str(key or "").strip()
        text = str(value or "").strip()
        if nid and text:
            out[nid] = text[:PASSAGE_TEXT]
    return out


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
    legacy = dest / "times.json"
    if legacy.is_file():
        try:
            packed = json.loads(legacy.read_text(encoding="utf-8"))
        except Exception:
            packed = {}
        if isinstance(packed, dict):
            for key, value in packed.items():
                nid = str(key or "").strip()
                stamp = str(value or "").strip()
                if nid and stamp and nid not in out:
                    out[nid] = stamp
    return out


def _load_ids(dest: Path) -> list[str]:
    ids = _load_meta(dest).get("ids")
    if isinstance(ids, list) and ids:
        return [str(x).strip() for x in ids if str(x).strip()]
    return list(_load_store(dest).keys())


def _write_index(dest: Path, index: Any, ids: list[str], times: dict[str, str] | None = None) -> None:
    import faiss

    dest.mkdir(parents=True, exist_ok=True)
    kept_times = {nid: times[nid] for nid in ids if times and times.get(nid)} if times else {}
    dim = int(getattr(index, "d", 256) or 256)
    meta = {
        "count": len(ids),
        "algo": PASSAGE_ALGO,
        "dim": dim,
        "ids": ids,
        "times": kept_times,
    }
    tmp = dest / f".index.{os.getpid()}.faiss"
    tmp_meta = dest / f".meta.{os.getpid()}.json"
    try:
        faiss.write_index(index, str(tmp))
        tmp_meta.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, dest / "index.faiss")
        os.replace(tmp_meta, dest / "meta.json")
        for name in ("texts.json", "times.json"):
            legacy = dest / name
            if legacy.is_file():
                try:
                    legacy.unlink()
                except OSError:
                    pass
        _MEM.pop(str(dest), None)
    finally:
        for path in (tmp, tmp_meta):
            try:
                if path.exists():
                    path.unlink()
            except OSError:
                pass
    _MEM[str(dest)] = (index, ids)


def _open_index(dest: Path):
    import faiss

    key = str(dest)
    loaded = _MEM.get(key)
    if loaded is not None:
        return loaded
    path = dest / "index.faiss"
    if not path.is_file():
        return None
    ids = _load_ids(dest)
    try:
        flags = int(getattr(faiss, "IO_FLAG_MMAP", 0) or 0)
        index = faiss.read_index(str(path), flags) if flags else faiss.read_index(str(path))
    except Exception:
        return None
    if index.ntotal != len(ids):
        return None
    _MEM[key] = (index, ids)
    return (index, ids)


def index_passages(cwd: str, rows: list[Any] | None = None) -> dict[str, Any]:
    st = faiss_status()
    if not st.get("ok"):
        return st
    dest = passage_dir(cwd)
    with _LOCK:
        import faiss

        times = _load_times(dest)
        cap = _passage_max()
        opened = _open_index(dest)
        if opened is None:
            index = faiss.IndexFlatIP(256)
            ids: list[str] = []
        else:
            index, ids = opened
        known = set(ids)
        new_ids: list[str] = []
        new_texts: list[str] = []
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
            if nid in known:
                continue
            if len(ids) + len(new_ids) >= cap:
                continue
            known.add(nid)
            new_ids.append(nid)
            new_texts.append(text[:PASSAGE_TEXT])
            updated += 1
        if new_texts:
            matrix = _embed(new_texts)
            if index.ntotal == 0 and int(matrix.shape[1]) != int(index.d):
                index = faiss.IndexFlatIP(int(matrix.shape[1]))
            index.add(matrix)
            ids.extend(new_ids)
        if not ids and not (dest / "index.faiss").is_file():
            return {**st, "count": 0, "updated": 0, "cap": cap}
        if updated or (dest / "texts.json").is_file() or (dest / "times.json").is_file() or "ids" not in _load_meta(dest):
            _write_index(dest, index, ids, times)
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
    # Expansions first so a long recall wrapper does not bury 8/28.
    ordered = queries[1:] + queries[:1] if len(queries) > 1 else queries
    for pq in ordered:
        for row in _search_passages_one(cwd, pq, limit, dest):
            nid = str(row.get("id") or "")
            if not nid or nid in seen:
                continue
            seen.add(nid)
            merged.append(row)
    return merged[: max(int(limit or 8), 24)]


def _search_passages_one(cwd: str, q: str, limit: int, dest) -> list[dict[str, Any]]:
    if not q:
        return []
    times = _load_times(dest)
    faiss_rows: list[dict[str, Any]] = []
    st = faiss_status()
    loaded = _open_index(dest) if st.get("ok") else None
    if loaded is not None:
        index, ids = loaded
        if ids and index.ntotal > 0:
            k = min(max(int(limit or 8), 1), len(ids))
            qv = _embed([q])
            scores, positions = index.search(qv, k)
            for score, pos in zip(scores[0].tolist(), positions[0].tolist()):
                if pos < 0 or pos >= len(ids):
                    continue
                if float(score) <= 0:
                    continue
                faiss_rows.append({"id": ids[pos], "score": float(score), "time": times.get(ids[pos], "")})
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in faiss_rows:
        nid = str(row.get("id") or "")
        if not nid or nid in seen:
            continue
        seen.add(nid)
        out.append(row)
    return out[: max(int(limit or 8), 24)]
