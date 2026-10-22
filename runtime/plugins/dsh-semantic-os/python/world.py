"""Instant world slice: one search, graded envelope, no live connector.

Callers pass search / vocab / bridges in. This module never reads assist
plugin connection config and never assigns system_live.
"""

from __future__ import annotations

import os
import time
from typing import Any, Callable

from intent import route_intent

ALIGN_EXPAND = frozenset({
    "owl:equivalentClass",
    "skos:exactMatch",
    "skos:closeMatch",
})

_MIN_TERM = 2
_EXTRA_CAP = 3
_EXTRA_LIMIT = 6
_DEFAULT_BUDGET_MS = 2500


def _text(value: Any) -> str:
    return str(value or "").strip()


def _props(node: Any) -> dict[str, Any]:
    if not isinstance(node, dict):
        return {}
    raw = node.get("properties")
    return raw if isinstance(raw, dict) else {}


def _list_text(value: Any) -> list[str]:
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        text = _text(item)
        if len(text) < _MIN_TERM or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def source_type_of(nid: str, ntype: str, via: str) -> str:
    ident = _text(nid)
    kind = _text(ntype)
    path = _text(via)
    if ident.startswith("session:"):
        return "session"
    if ident.startswith("file:"):
        return "file"
    if ident.startswith("mail:"):
        return "mail"
    if ident.startswith("memory:") or kind == "记忆卡片" or path == "agent-memory":
        return "memory"
    if kind.lower() == "decision":
        return "decision"
    if kind.startswith("skos:"):
        return "vocab"
    if path == "faiss":
        return "passage"
    return "graph"


def knowledge_grade(nid: str, ntype: str, via: str, props: dict[str, Any] | None) -> str:
    """Conservative defaults. This plugin never yields system_live."""
    meta = props if isinstance(props, dict) else {}
    ident = _text(nid)
    kind = _text(ntype)
    path = _text(via)
    if ident.startswith("memory:") or kind == "记忆卡片" or path == "agent-memory":
        return "user_memory"
    if meta.get("auto") is True or _text(meta.get("source")) == "session_ingest":
        return "inferred"
    if kind.lower() == "decision":
        status = _text(meta.get("status") or meta.get("board_status"))
        receipt = _text(meta.get("receipt_id") or meta.get("receiptId") or meta.get("receipt"))
        nod = _text(meta.get("nod_kind") or meta.get("nodKind"))
        if status == "已生效" and receipt and nod == "业务过账":
            return "verified_receipt"
        return "observation"
    return "observation"


def _snippet_of(node: dict[str, Any]) -> str:
    props = _props(node)
    return _text(node.get("content") or props.get("content") or node.get("id"))


def _confidence(score: Any) -> float:
    try:
        raw = float(score or 0)
    except (TypeError, ValueError):
        return 0.0
    if raw <= 0:
        return 0.0
    if raw <= 1:
        return round(raw, 4)
    return round(min(1.0, raw / 200.0), 4)


def stamp_hit(hit: Any, cwd: str = "") -> Any:
    """Add envelope fields. Does not change snippet or ranking score."""
    if not isinstance(hit, dict):
        return hit
    node = hit.get("node") if isinstance(hit.get("node"), dict) else {}
    props = _props(node)
    nid = _text(node.get("id"))
    ntype = _text(node.get("type"))
    via = _text(hit.get("via") or props.get("via"))
    snippet = _snippet_of(node)
    observed = _text(
        node.get("valid_from")
        or props.get("valid_from")
        or props.get("timestamp")
        or hit.get("observed_at")
    )
    until = _text(node.get("valid_until") or props.get("valid_until") or hit.get("valid_until"))
    workspace = _text(props.get("cwd") or hit.get("workspace") or cwd)
    source_type = source_type_of(nid, ntype, via)
    packed = {
        **hit,
        "id": nid,
        "kind": ntype,
        "title": (snippet[:40] or nid),
        "snippet": snippet,
        "source_uri": nid,
        "source_type": source_type,
        "observed_at": observed,
        "valid_from": observed,
        "valid_until": until or None,
        "confidence": _confidence(hit.get("score")),
        "knowledge_grade": knowledge_grade(nid, ntype, via, props),
        "is_live": False,
        "expires_at": until or None,
        "workspace": workspace,
    }
    return packed


def stamp_hits(hits: Any, cwd: str = "") -> list[dict[str, Any]]:
    if not isinstance(hits, list):
        return []
    out: list[dict[str, Any]] = []
    for row in hits:
        stamped = stamp_hit(row, cwd)
        if isinstance(stamped, dict) and stamped.get("id"):
            out.append(stamped)
    return out


def concepts_from_rows(rows: Any) -> list[dict[str, Any]]:
    """SKOS kinds only. Labels and can/resource come from the node, not a kind-name table."""
    out: list[dict[str, Any]] = []
    if not isinstance(rows, list):
        return out
    for row in rows:
        if not isinstance(row, dict):
            continue
        if _text(row.get("type")) != "skos:Concept":
            continue
        props = _props(row)
        label = _text(row.get("content") or props.get("content") or props.get("prefLabel") or props.get("label"))
        nid = _text(row.get("id"))
        if not nid or not label:
            continue
        alt = _list_text(props.get("altLabels") or props.get("altLabel") or props.get("alt_labels"))
        can = _list_text(props.get("can") if isinstance(props.get("can"), list) else row.get("can"))
        clues = props.get("clues") if isinstance(props.get("clues"), list) else []
        spoken: list[str] = []
        seen: set[str] = set()
        for term in [label, *alt]:
            if len(term) >= _MIN_TERM and term not in seen:
                seen.add(term)
                spoken.append(term)
        for clue in clues:
            if not isinstance(clue, dict):
                continue
            for term in _list_text(clue.get("say")):
                if term not in seen:
                    seen.add(term)
                    spoken.append(term)
        out.append({
            "id": nid,
            "label": label,
            "spoken": spoken,
            "can": can,
            "resource": _text(props.get("resource") or row.get("resource")),
            "fields": _list_text(props.get("fields") if isinstance(props.get("fields"), list) else row.get("fields")),
        })
    return out


def _live_capable(concept: dict[str, Any]) -> bool:
    """A kind is live-capable when the vocab says it has connector actions or a table."""
    if _text(concept.get("resource")):
        return True
    return bool(concept.get("can"))


def spoken_index(concepts: list[dict[str, Any]]) -> list[tuple[str, dict[str, Any]]]:
    pairs: list[tuple[str, dict[str, Any]]] = []
    for concept in concepts or []:
        if not isinstance(concept, dict):
            continue
        for term in concept.get("spoken") or []:
            text = _text(term)
            if len(text) >= _MIN_TERM:
                pairs.append((text, concept))
    pairs.sort(key=lambda item: len(item[0]), reverse=True)
    return pairs


def expand_query(
    query: str,
    concepts: list[dict[str, Any]] | None = None,
    alignments: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Add sibling labels for kinds already named in the query. Original query stays first."""
    q = _text(query)
    extra: list[str] = []
    matched: list[str] = []
    seen: set[str] = set()
    if not q:
        return {"query": q, "extra": extra, "matched": matched}

    def add(term: str) -> None:
        text = _text(term)
        if len(text) < _MIN_TERM or text == q or text in q or text in seen:
            return
        seen.add(text)
        extra.append(text)

    for term, concept in spoken_index(concepts or []):
        if term not in q:
            continue
        cid = _text(concept.get("id"))
        if cid and cid not in matched:
            matched.append(cid)
        for sibling in concept.get("spoken") or []:
            add(sibling)
    labels: dict[str, str] = {}
    for concept in concepts or []:
        if isinstance(concept, dict) and concept.get("id"):
            labels[_text(concept.get("id"))] = _text(concept.get("label"))
    for row in alignments or []:
        if not isinstance(row, dict):
            continue
        rel = _text(row.get("relation") or row.get("type"))
        if rel not in ALIGN_EXPAND:
            continue
        src = _text(row.get("source_label") or labels.get(_text(row.get("source_uri"))))
        tgt = _text(row.get("target_label") or labels.get(_text(row.get("target_uri"))))
        if src and src in q:
            add(tgt)
        if tgt and tgt in q:
            add(src)
    return {"query": q, "extra": extra[:_EXTRA_CAP], "matched": matched}


def missing_live(query: str, concepts: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Kinds named in the query that the vocab says can go to the assist plugin."""
    q = _text(query)
    missing: list[dict[str, Any]] = []
    seen: set[str] = set()
    if not q:
        return missing
    for term, concept in spoken_index(concepts or []):
        if term not in q or not _live_capable(concept):
            continue
        cid = _text(concept.get("id"))
        if not cid or cid in seen:
            continue
        seen.add(cid)
        missing.append({
            "need": "live",
            "kind": _text(concept.get("label")),
            "id": cid,
            "can": list(concept.get("can") or []),
            "via": "assist",
            "detail": "现查走协助插件。连接配置在协助插件上。",
        })
    return missing


def list_sources(
    cwd: str,
    peers: list[str] | None = None,
    concepts: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Derived catalog. Not a second world list. No connector secrets."""
    here = os.path.realpath(cwd or "") if cwd else ""
    rows: list[dict[str, Any]] = []
    if here:
        rows.append({
            "name": os.path.basename(here) or here,
            "source_type": "workspace",
            "location": here,
            "workspace": here,
            "retrievable": True,
            "live": False,
        })
    seen = {here}
    for peer in peers or []:
        path = os.path.realpath(peer) if peer else ""
        if not path or path in seen:
            continue
        seen.add(path)
        rows.append({
            "name": os.path.basename(path) or path,
            "source_type": "bridge",
            "location": path,
            "workspace": path,
            "retrievable": True,
            "live": False,
        })
    for concept in concepts or []:
        if not isinstance(concept, dict) or not _live_capable(concept):
            continue
        rows.append({
            "name": _text(concept.get("label")),
            "source_type": "assist",
            "location": "assist",
            "workspace": here,
            "retrievable": False,
            "live": True,
            "kind": _text(concept.get("label")),
        })
    return rows


def partition_hits(hits: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    evidence: list[dict[str, Any]] = []
    memories: list[dict[str, Any]] = []
    decisions: list[dict[str, Any]] = []
    for row in hits or []:
        kind = _text(row.get("source_type"))
        if kind == "memory":
            memories.append(row)
        elif kind == "decision":
            decisions.append(row)
        else:
            evidence.append(row)
    return {"evidence": evidence, "memories": memories, "decisions": decisions}


def _merge_hits(base: list[dict[str, Any]], extra: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = {_text(row.get("id") or ((row.get("node") or {}).get("id") if isinstance(row.get("node"), dict) else "")) for row in base}
    out = list(base)
    for row in extra:
        nid = _text(row.get("id") or ((row.get("node") or {}).get("id") if isinstance(row.get("node"), dict) else ""))
        if not nid or nid in seen:
            continue
        seen.add(nid)
        out.append(row)
    return out


def generic_live_missing() -> dict[str, Any]:
    return {
        "need": "live",
        "kind": "",
        "id": "",
        "can": [],
        "via": "assist",
        "detail": "现在要走协助插件现查。连接配置在协助插件上。",
    }


def decorate_search(
    packed: dict[str, Any] | None,
    *,
    cwd: str = "",
    query: str = "",
    concepts: list[dict[str, Any]] | None = None,
    peers: list[str] | None = None,
    extra_hits: list[dict[str, Any]] | None = None,
    extra_terms: list[str] | None = None,
    need_current: bool = False,
    partial: bool = False,
    merge_extras: bool = False,
) -> dict[str, Any]:
    """Attach slice fields. Primary ranking stays unless merge_extras is on."""
    out = dict(packed or {})
    here = os.path.realpath(cwd or "") if cwd else _text(out.get("cwd") or cwd)
    q = _text(query or out.get("query"))
    results = stamp_hits(list(out.get("results") or []), here)
    extra_stamped = stamp_hits(extra_hits or [], here)
    if merge_extras and extra_stamped:
        results = _merge_hits(results, extra_stamped)
    out["results"] = results
    try:
        total = int(out.get("total") or 0)
    except (TypeError, ValueError):
        total = 0
    out["total"] = max(total, len(results))
    missing = missing_live(q, concepts)
    if need_current and not missing:
        missing = [generic_live_missing()]
    out["missing"] = missing
    out["sources"] = list_sources(here, peers, concepts)
    out["expanded"] = [str(term) for term in (extra_terms or []) if str(term).strip()]
    out["expanded_hits"] = extra_stamped
    out["live_facts"] = []
    if partial:
        out["partial"] = True
    return out


def _empty_slice(query: str, intent: str, cwd: str, sources: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "ok": True,
        "query": query,
        "intent": intent,
        "results": [],
        "total": 0,
        "evidence": [],
        "memories": [],
        "entities": [],
        "decisions": [],
        "live_facts": [],
        "conflicts": [],
        "missing": [],
        "sources": sources,
        "expanded": [],
        "partial": False,
        "cwd": cwd,
    }


def recall_world(
    cwd: str,
    args: dict[str, Any] | None,
    *,
    search: Callable[[str, dict[str, Any]], dict[str, Any]],
    concepts: list[dict[str, Any]] | None = None,
    alignments: list[dict[str, Any]] | None = None,
    peers: list[str] | None = None,
    budget_ms: int = _DEFAULT_BUDGET_MS,
    clock: Callable[[], float] = time.monotonic,
) -> dict[str, Any]:
    """One primary search, optional alias extras, graded slice. Never live-queries."""
    args = args or {}
    query = _text(args.get("query") or args.get("q") or args.get("text"))
    routed = route_intent(query)
    intent = _text(args.get("intent") or routed.get("intent") or "查询")
    here = os.path.realpath(cwd or "") if cwd else _text(cwd)
    kinds = concepts or []
    sources = list_sources(here, peers, kinds)
    if not query or intent == "闲聊":
        return _empty_slice(query, intent or "闲聊", here, sources)

    started = clock()
    try:
        budget = int(args.get("budget_ms") or budget_ms)
    except (TypeError, ValueError):
        budget = budget_ms
    budget = max(200, min(budget, 8000))

    search_args = {
        "q": query,
        "query": query,
        "intent": intent,
        "date": args.get("date") or args.get("at") or "",
        "date_from": args.get("date_from") or args.get("from") or "",
        "date_to": args.get("date_to") or args.get("to") or "",
        "limit": args.get("limit") or 12,
    }
    if args.get("across_bridges") is not None:
        search_args["across_bridges"] = args.get("across_bridges")

    primary = search(cwd, search_args) or {}
    if not isinstance(primary, dict):
        primary = {}
    hits = list(primary.get("results") or [])
    partial = bool(primary.get("error") or primary.get("partial"))
    expanded = expand_query(query, kinds, alignments)
    extra_terms = list(expanded.get("extra") or [])

    for term in extra_terms:
        if (clock() - started) * 1000 >= budget:
            partial = True
            break
        try:
            packed = search(cwd, {
                "q": term,
                "query": term,
                "intent": intent,
                "across_bridges": False,
                "limit": _EXTRA_LIMIT,
            }) or {}
        except Exception:
            partial = True
            continue
        if not isinstance(packed, dict) or packed.get("error"):
            partial = True
            continue
        hits = _merge_hits(hits, list(packed.get("results") or []))

    decorated = decorate_search(
        {**primary, "results": hits, "query": query, "intent": intent, "cwd": here},
        cwd=here,
        query=query,
        concepts=kinds,
        peers=peers,
        extra_terms=extra_terms,
        need_current=bool(args.get("need_current")),
        partial=partial,
    )
    buckets = partition_hits(list(decorated.get("results") or []))
    decorated["ok"] = True
    decorated["evidence"] = buckets["evidence"]
    decorated["memories"] = buckets["memories"]
    decorated["entities"] = []
    decorated["decisions"] = buckets["decisions"]
    decorated["conflicts"] = []
    decorated["date"] = search_args.get("date") or ""
    decorated["date_from"] = search_args.get("date_from") or ""
    decorated["date_to"] = search_args.get("date_to") or ""
    return decorated
