"""Semantica AgentMemory per workspace. Fail closed if the engine is missing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from board import memory_still_counts


_CACHE: dict[str, Any] = {}


def _has_cjk(text: str) -> bool:
    return any(0x4E00 <= ord(ch) <= 0x9FFF for ch in str(text or ""))


def _norm_entity(row: Any) -> dict[str, Any] | None:
    if isinstance(row, str) and row.strip():
        label = row.strip()
        return {"id": label, "type": "entity", "text": label}
    if not isinstance(row, dict):
        return None
    label = str(row.get("text") or row.get("label") or row.get("name") or "").strip()
    eid = str(row.get("id") or row.get("entity_id") or label).strip()
    if not eid:
        return None
    return {"id": eid, "type": str(row.get("type") or "entity"), "text": label or eid}


def _norm_rel(row: Any) -> dict[str, Any] | None:
    if not isinstance(row, dict):
        return None
    src = str(row.get("source_id") or row.get("source") or "").strip()
    tgt = str(row.get("target_id") or row.get("target") or "").strip()
    if not src or not tgt:
        return None
    return {"source_id": src, "target_id": tgt, "type": str(row.get("type") or "related_to")}


def _extract(text: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    blob = str(text or "").strip()
    if not blob:
        return [], []
    try:
        import bootstrap
    except Exception:
        return [], []
    try:
        ner = bootstrap.make_ner(blob)
        ents = [_norm_entity(row) for row in (ner.extract_entities(blob) or [])]
        ents = [row for row in ents if row]
        rels = []
        try:
            if bootstrap.llm_extract_kwargs() or not _has_cjk(blob):
                rels = [_norm_rel(row) for row in (bootstrap.make_rel(blob).extract_relations(blob, ents) or [])]
        except Exception:
            pass
        return ents, [row for row in rels if row]
    except Exception:
        return [], []


class WorkspaceGraph:
    """GraphStore-shaped adapter onto the workspace book. No ContextGraph import."""

    def __init__(self, cwd: str):
        self.cwd = cwd

    def add_nodes(self, nodes: list[Any]) -> None:
        from stores import upsert_entity

        for node in nodes or []:
            if not isinstance(node, dict):
                continue
            nid = str(node.get("id") or "").strip()
            if not nid:
                continue
            props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
            label = str(props.get("content") or node.get("text") or nid)
            ntype = str(node.get("type") or "entity")
            upsert_entity(self.cwd, nid, ntype, label[:160], {"content": label[:160]})

    def add_edges(self, edges: list[Any]) -> None:
        from stores import insert_edge

        for edge in edges or []:
            if not isinstance(edge, dict):
                continue
            src = str(edge.get("source_id") or edge.get("source") or "").strip()
            tgt = str(edge.get("target_id") or edge.get("target") or "").strip()
            et = str(edge.get("type") or "related_to").strip() or "related_to"
            if src and tgt:
                insert_edge(self.cwd, src, tgt, et)


def memory_dir(cwd: str) -> Path:
    return Path(str(cwd or "")).resolve() / ".dsh" / "semantic-os"


def _official_vector_store() -> Any | None:
    try:
        from semantica.vector_store.vector_store import VectorStore
    except Exception:
        return None
    try:
        store = VectorStore(backend="faiss", dimension=384)
    except Exception:
        return None
    tracker = getattr(store, "progress_tracker", None)
    if tracker is not None:
        tracker.enabled = False
    if getattr(store, "embedder", None) is None:
        return None
    return store


def _new_memory() -> Any:
    import sys
    import types

    import semantica

    name = "semantica.context"
    if name not in sys.modules:
        root = Path(semantica.__file__).resolve().parent / "context"
        pkg = types.ModuleType(name)
        pkg.__path__ = [str(root)]
        pkg.__package__ = name
        sys.modules[name] = pkg
    from semantica.context.agent_memory import AgentMemory

    mem = AgentMemory(config={
        "retention_policy": "unlimited",
        "vector_store": _official_vector_store(),
    })
    tracker = getattr(mem, "progress_tracker", None)
    if tracker is not None:
        tracker.enabled = False
    return mem


def load_agent_memory(cwd: str) -> Any | None:
    key = str(cwd or "").strip()
    if not key:
        return None
    folder = memory_dir(key)
    cached = _CACHE.get(str(folder))
    if cached is not None:
        return cached
    try:
        mem = _new_memory()
    except Exception:
        return None
    try:
        if (folder / "agent_memory.json").exists():
            mem.load(str(folder))
    except Exception:
        pass
    if getattr(mem, "knowledge_graph", None) is None:
        mem.knowledge_graph = WorkspaceGraph(key)
    _CACHE[str(folder)] = mem
    return mem


def store_agent_memory(
    cwd: str,
    content: str,
    *,
    memory_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    blob = str(content or "").strip()
    if not blob:
        return {"ok": False, "error": "EMPTY"}
    mem = load_agent_memory(cwd)
    if mem is None:
        from uuid import uuid4
        card_id = str(memory_id or "").strip() or f"memory:{uuid4().hex[:12]}"
        if not card_id.startswith("memory:"):
            card_id = f"memory:{card_id}"
        _file_graph_card(cwd, card_id, blob, metadata or {})
        return {"ok": True, "id": card_id, "via": "graph"}
    opts: dict[str, Any] = {
        "skip_vector": not bool(getattr(mem, "vector_store", None)),
        "skip_graph": not bool(getattr(mem, "knowledge_graph", None)),
    }
    if memory_id:
        opts["memory_id"] = str(memory_id)
    ents, rels = _extract(blob)
    try:
        mid = mem.store(
            blob,
            metadata=metadata or {},
            entities=ents,
            relationships=rels,
            **opts,
        )
        folder = memory_dir(cwd)
        folder.mkdir(parents=True, exist_ok=True)
        mem.save(str(folder))
        card_id = str(mid or "").strip()
        if card_id and not card_id.startswith("memory:"):
            card_id = f"memory:{card_id}"
        if card_id:
            try:
                _file_graph_card(cwd, card_id, blob, metadata or {})
            except Exception:
                pass
        return {"ok": True, "id": card_id or mid}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def _file_graph_card(cwd: str, card_id: str, content: str, metadata: dict[str, Any]) -> None:
    try:
        import graph_store
    except Exception:
        return
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    props = {
        "content": content,
        "status": "已入档",
        "kind": "记忆卡片",
        "valid_from": metadata.get("updated_at") or metadata.get("valid_from") or now,
        **{k: v for k, v in metadata.items() if v is not None},
    }
    graph_store.put_node(cwd, {
        "id": card_id,
        "type": "记忆卡片",
        "content": content,
        "properties": props,
    })


def list_agent_memory_snapshot(cwd: str, skip: int = 0, limit: int = 100) -> dict[str, Any]:
    mem = load_agent_memory(cwd)
    items: list[dict[str, Any]] = []
    total = 0
    if mem is not None:
        try:
            if hasattr(mem, "list_snapshot"):
                records, total = mem.list_snapshot(offset=skip, limit=limit)
            else:
                records = list((getattr(mem, "memory_items", {}) or {}).values())
                total = len(records)
                records = records[skip:skip + limit]
        except Exception:
            records = []
            total = 0
        for row in records or []:
            if not isinstance(row, dict):
                continue
            meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
            mid = str(row.get("memory_id") or row.get("id") or "")
            if mid and not mid.startswith("memory:"):
                mid = f"memory:{mid}"
            content = str(row.get("content") or "")
            excerpt = " ".join(content.split())[:160]
            items.append({
                "id": mid,
                "type": str(meta.get("type") or "general"),
                "excerpt": excerpt,
                "updated_at": str(meta.get("updated_at") or row.get("timestamp") or "") or None,
            })
    if not items:
        try:
            import graph_store
            from board import is_memory_card, board_status_of, memory_still_counts
            nodes, _edges = graph_store.read_all(cwd)
            filed = []
            for row in nodes.values():
                if not isinstance(row, dict) or not is_memory_card(row):
                    continue
                if board_status_of(row) != "已入档" or not memory_still_counts(row):
                    continue
                filed.append(row)
            total = len(filed)
            for row in filed[skip:skip + limit]:
                nid = str(row.get("id") or "")
                props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
                content = str(row.get("content") or props.get("content") or "")
                items.append({
                    "id": nid,
                    "type": str(props.get("type") or "general"),
                    "excerpt": " ".join(content.split())[:160],
                    "updated_at": str(props.get("updated_at") or props.get("valid_from") or row.get("recorded_at") or "") or None,
                })
        except Exception:
            pass
    return {"ok": True, "items": items, "total": total or len(items), "skip": skip, "limit": limit}


def retrieve_agent_memory(cwd: str, query: str, max_results: int = 8) -> list[dict[str, Any]]:
    q = str(query or "").strip()
    if not q:
        return []
    mem = load_agent_memory(cwd)
    if mem is None:
        return []
    try:
        rows = mem.retrieve(q, max_results=max_results) or []
    except Exception:
        return []
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        if not memory_still_counts({"type": "记忆卡片", "properties": meta}):
            continue
        text = str(row.get("content") or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(row)
    return out


def forget_agent_memory(cwd: str, memory_id: str) -> dict[str, Any]:
    mid = str(memory_id or "").strip()
    if not mid:
        return {"ok": False, "error": "NO_PATH"}
    mem = load_agent_memory(cwd)
    if mem is None:
        return {"ok": False, "error": "NO_SEMANTICA"}
    try:
        ok = bool(mem.forget(mid) if hasattr(mem, "forget") else mem.delete_memory(mid, skip_vector=True))
        folder = memory_dir(cwd)
        folder.mkdir(parents=True, exist_ok=True)
        mem.save(str(folder))
        return {"ok": ok, "id": mid}
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:200]}


def memory_hits_as_search(rows: list[dict[str, Any]], query: str) -> list[dict[str, Any]]:
    hits = []
    for row in rows:
        mid = str(row.get("memory_id") or "")
        text = str(row.get("content") or "").strip()
        if not mid or not text:
            continue
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        hits.append({
            "node": {
                "id": mid if mid.startswith("memory:") else f"memory:{mid}",
                "type": "记忆卡片",
                "content": text,
                "properties": {
                    "content": text,
                    "status": "已入档",
                    "kind": "记忆卡片",
                    **(row.get("metadata") if isinstance(row.get("metadata"), dict) else {}),
                },
                "valid_from": row.get("timestamp") or meta.get("valid_from"),
                "valid_until": meta.get("valid_until"),
            },
            "score": 150 + int(100 * float(row.get("score") or 0)),
            "hop_distance": None,
            "semantic_similarity": float(row.get("score") or 0) if row.get("score") is not None else None,
            "via": "agent-memory",
        })
    return hits
