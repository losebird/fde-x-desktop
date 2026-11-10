"""Semantica temporal occupancy: bitemporal facts, Allen intervals, time travel."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

TEMPORAL_KEYS = ("valid_from", "valid_until", "recorded_at", "superseded_at")


def _engine():
    from semantica.kg.temporal_reasoning import TemporalReasoningEngine

    return TemporalReasoningEngine()


def _interval_cls():
    from semantica.kg.temporal_reasoning import TemporalInterval

    return TemporalInterval


def _bound_open():
    from semantica.kg.temporal_model import TemporalBound

    return TemporalBound.OPEN


def _parse_value(value: Any):
    from semantica.kg.temporal_model import parse_temporal_value

    if value is None or value == "" or value is False:
        return None
    try:
        return parse_temporal_value(value)
    except Exception:
        return None


def _fact_from(row: dict[str, Any]):
    from semantica.kg.temporal_model import BiTemporalFact

    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    packed = {**props}
    for key in TEMPORAL_KEYS:
        if row.get(key) is not None:
            packed[key] = row.get(key)
    return BiTemporalFact.from_relationship(packed)


def stamp_bitemporal(data: dict[str, Any], *, now: datetime | None = None, keep_recorded: bool = True) -> dict[str, Any]:
    """Write Semantica BiTemporalFact fields onto a node/edge payload."""
    if not isinstance(data, dict):
        return data
    instant = now or datetime.now(timezone.utc)
    iso = instant.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    props = data.get("properties") if isinstance(data.get("properties"), dict) else {}
    recorded = data.get("recorded_at") or props.get("recorded_at")
    if keep_recorded and recorded:
        pass
    else:
        data["recorded_at"] = iso
        recorded = iso
    if data.get("superseded_at") is None and props.get("superseded_at") is None:
        data["superseded_at"] = "OPEN"
    if data.get("valid_from") is None and props.get("valid_from") is None:
        data["valid_from"] = data.get("timestamp") or props.get("timestamp") or recorded or iso
    fields = {
        "valid_from": data.get("valid_from") or props.get("valid_from"),
        "valid_until": data.get("valid_until") if data.get("valid_until") is not None else props.get("valid_until"),
        "recorded_at": data.get("recorded_at") or recorded,
        "superseded_at": data.get("superseded_at") or props.get("superseded_at") or "OPEN",
    }
    for key, value in fields.items():
        if value is None:
            continue
        data[key] = value
        if isinstance(data.get("properties"), dict):
            data["properties"][key] = value
        elif "properties" not in data:
            data["properties"] = {key: value}
    return data


def _interval_of_row(row: dict[str, Any]):
    TemporalInterval = _interval_cls()
    fact = _fact_from(row)
    start = fact.valid_from
    if start is None:
        return None
    end = fact.valid_until if fact.valid_until is not None else _bound_open()
    return TemporalInterval(start=start, end=end)


def covers_valid(row: dict[str, Any], at: Any) -> bool:
    """True if the fact's valid interval covers `at`. Undated rows stay visible."""
    point = _parse_value(at)
    interval = _interval_of_row(row)
    if interval is None or point is None:
        return True
    return _engine().active_at(interval, point)


def recorded_as_of(row: dict[str, Any], at: Any) -> bool:
    """True if this version was on the ledger at transaction time `at`."""
    raw = str(at or "").strip()
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        at = raw + "T23:59:59Z"
    point = _parse_value(at)
    if point is None:
        return True
    fact = _fact_from(row)
    recorded = fact.recorded_at
    if recorded is None:
        return True
    if recorded > point:
        return False
    superseded = fact.superseded_at
    if superseded is None or superseded == _bound_open() or str(superseded) == "OPEN":
        return True
    until = _parse_value(superseded)
    if until is None:
        return True
    return point < until


def parse_interval(text: str):
    """Parse 'start/end' or a single instant into a TemporalInterval."""
    TemporalInterval = _interval_cls()
    raw = str(text or "").strip()
    if not raw:
        raise ValueError("empty interval")
    if "/" in raw:
        left, right = raw.split("/", 1)
    elif "," in raw:
        left, right = raw.split(",", 1)
    else:
        left, right = raw, ""
    start = _parse_value(left.strip())
    if start is None:
        raise ValueError(f"bad start {left!r}")
    end_raw = right.strip()
    if not end_raw or end_raw.upper() == "OPEN":
        return TemporalInterval(start=start, end=_bound_open())
    end = _parse_value(end_raw)
    if end is None:
        raise ValueError(f"bad end {right!r}")
    return TemporalInterval(start=start, end=end)


def allen_relation(interval1: str, interval2: str) -> dict[str, Any]:
    a = parse_interval(interval1)
    b = parse_interval(interval2)
    rel = _engine().relation(a, b)
    name = rel.value if hasattr(rel, "value") else str(rel)
    return {
        "ok": True,
        "interval1": interval1,
        "interval2": interval2,
        "relation": name,
        "via": "semantica",
    }


def _row_span(row: dict[str, Any]) -> dict[str, str]:
    props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
    label = str(row.get("content") or props.get("scenario") or props.get("label") or "").strip()
    return {
        "id": str(row.get("id") or ""),
        "label": label[:40],
        "from": str(row.get("valid_from") or props.get("valid_from") or ""),
        "until": str(row.get("valid_until") or props.get("valid_until") or ""),
    }


def allen_nodes(row_a: dict[str, Any], row_b: dict[str, Any]) -> dict[str, Any]:
    a = _interval_of_row(row_a)
    b = _interval_of_row(row_b)
    if a is None or b is None:
        return {"ok": False, "error": "NO_INTERVAL", "relation": "", "a": _row_span(row_a), "b": _row_span(row_b)}
    rel = _engine().relation(a, b)
    name = rel.value if hasattr(rel, "value") else str(rel)
    return {
        "ok": True,
        "id1": str(row_a.get("id") or ""),
        "id2": str(row_b.get("id") or ""),
        "relation": name,
        "a": _row_span(row_a),
        "b": _row_span(row_b),
        "via": "semantica",
    }


def logical_id(nid: str) -> str:
    raw = str(nid or "")
    cut = raw.find("#v")
    return raw[:cut] if cut > 0 else raw


def snapshot_rows(rows: list[dict[str, Any]], at: Any, recorded_at: Any = None) -> dict[str, Any]:
    chosen: dict[str, tuple[Any, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "")
        if not nid:
            continue
        if not covers_valid(row, at):
            continue
        if recorded_at is not None and str(recorded_at).strip() and not recorded_as_of(row, recorded_at):
            continue
        lid = logical_id(nid)
        rec = _parse_value(row.get("recorded_at") or (row.get("properties") or {}).get("recorded_at"))
        prev = chosen.get(lid)
        if prev is None or (rec is not None and (prev[0] is None or rec >= prev[0])):
            chosen[lid] = (rec, lid)
    active = [lid for _rec, lid in chosen.values()]
    return {
        "active_node_ids": active,
        "active_node_count": len(active),
        "at": at or "",
        "recorded_as_of": recorded_at or "",
        "via": "semantica",
    }


def diff_rows(rows: list[dict[str, Any]], from_time: Any, to_time: Any) -> dict[str, Any]:
    start = snapshot_rows(rows, from_time)
    end = snapshot_rows(rows, to_time)
    start_ids = set(start["active_node_ids"])
    end_ids = set(end["active_node_ids"])
    return {
        "from_time": from_time or "",
        "to_time": to_time or "",
        "added_nodes": sorted(end_ids - start_ids),
        "removed_nodes": sorted(start_ids - end_ids),
        "via": "semantica",
    }


def _edge_rel(edge: dict[str, Any]) -> dict[str, Any]:
    props = edge.get("properties") if isinstance(edge.get("properties"), dict) else {}
    return {
        "source": str(edge.get("source") or edge.get("source_id") or ""),
        "target": str(edge.get("target") or edge.get("target_id") or ""),
        "type": str(edge.get("type") or edge.get("edge_type") or "related_to"),
        "valid_from": edge.get("valid_from") or props.get("valid_from"),
        "valid_until": edge.get("valid_until") or props.get("valid_until"),
        "recorded_at": edge.get("recorded_at") or props.get("recorded_at"),
        "superseded_at": edge.get("superseded_at") or props.get("superseded_at"),
    }


def detect_patterns(nodes: list[dict[str, Any]], edges: list[dict[str, Any]], pattern_type: str = "sequence") -> dict[str, Any]:
    _ = nodes
    rels = [_edge_rel(edge) for edge in edges if isinstance(edge, dict)]
    rels = [row for row in rels if row["source"] and row["target"]]
    patterns: list[Any] = []
    via = "semantica"
    try:
        from semantica.kg.temporal_query import TemporalPatternDetector
        detector = TemporalPatternDetector()
        got = detector.detect_temporal_patterns({"relationships": rels}, pattern_type=pattern_type or "sequence")
        if isinstance(got, list):
            patterns = got
        elif isinstance(got, dict):
            patterns = list(got.get("patterns") or [])
    except Exception as exc:
        via = f"error:{exc.__class__.__name__}"
    packed = []
    for row in patterns:
        if not isinstance(row, dict):
            continue
        item = dict(row)
        sig = item.get("signature")
        if isinstance(sig, tuple):
            item["signature"] = list(sig)
        packed.append(item)
    return {"ok": True, "patterns": packed, "count": len(packed), "pattern_type": pattern_type or "sequence", "via": via}


def _hops(edges: list[dict[str, Any]], src: str, tgt: str, active: set[str]) -> int | None:
    if src not in active or tgt not in active:
        return None
    if src == tgt:
        return 0
    adj: dict[str, set[str]] = {}
    for edge in edges:
        a = str(edge.get("source") or edge.get("source_id") or "")
        b = str(edge.get("target") or edge.get("target_id") or "")
        if not a or not b or a not in active or b not in active:
            continue
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    seen = {src}
    q = [(src, 0)]
    i = 0
    while i < len(q):
        cur, dist = q[i]
        i += 1
        for nxt in adj.get(cur, ()):
            if nxt in seen:
                continue
            if nxt == tgt:
                return dist + 1
            seen.add(nxt)
            q.append((nxt, dist + 1))
    return None


def distance_history(nodes: list[dict[str, Any]], edges: list[dict[str, Any]], source: str, target: str, samples: int = 10) -> dict[str, Any]:
    from datetime import timedelta

    source, target = str(source or "").strip(), str(target or "").strip()
    starts = []
    ends = []
    for row in nodes:
        vf = _parse_value(row.get("valid_from") or (row.get("properties") or {}).get("valid_from"))
        vu = _parse_value(row.get("valid_until") or (row.get("properties") or {}).get("valid_until"))
        if vf:
            starts.append(vf)
        if vu:
            ends.append(vu)
    if not starts:
        snap = snapshot_rows(nodes, None)
        hops = _hops(edges, source, target, set(snap["active_node_ids"]))
        return {"ok": True, "source_id": source, "target_id": target, "metric": "hops", "history": [{"timestamp": "", "hop_count": hops}], "events": [], "via": "semantica"}
    lo = min(starts)
    hi = max(ends) if ends else lo
    n = max(2, min(int(samples or 10), 12))
    span = (hi - lo) / (n - 1) if hi != lo else timedelta(0)
    history = []
    prev = None
    events = []
    for i in range(n):
        at = lo + span * i
        iso = at.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        snap = snapshot_rows(nodes, iso)
        hops = _hops(edges, source, target, set(snap["active_node_ids"]))
        history.append({"timestamp": iso, "hop_count": hops})
        if prev is not None and prev != hops:
            events.append({"timestamp": iso, "from": prev, "to": hops})
        prev = hops
    return {
        "ok": True,
        "source_id": source,
        "target_id": target,
        "metric": "hops",
        "history": history,
        "events": events,
        "via": "semantica",
    }
