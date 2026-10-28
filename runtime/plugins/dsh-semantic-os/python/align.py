"""Workspace ontology alignments. File-backed, not Explorer."""

from __future__ import annotations

import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any

RELATIONS = frozenset({
    "owl:equivalentClass",
    "owl:equivalentProperty",
    "skos:exactMatch",
    "skos:closeMatch",
    "skos:broadMatch",
    "skos:narrowMatch",
    "skos:relatedMatch",
})


def _path(cwd: str) -> Path:
    return Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "alignments.json"


def _load(cwd: str) -> list[dict[str, Any]]:
    path = _path(cwd)
    if not path.is_file():
        return []
    try:
        packed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    rows = packed.get("items") if isinstance(packed, dict) else packed
    if not isinstance(rows, list):
        return []
    return [row for row in rows if isinstance(row, dict)]


def _save(cwd: str, rows: list[dict[str, Any]]) -> None:
    path = _path(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".alignments.{os.getpid()}.json")
    tmp.write_text(json.dumps({"items": rows}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def list_alignments(cwd: str, uri: str = "") -> list[dict[str, Any]]:
    want = str(uri or "").strip()
    rows = _load(cwd)
    if not want:
        return rows
    return [
        row for row in rows
        if want in (str(row.get("source_uri") or ""), str(row.get("target_uri") or ""))
    ]


def save_alignment(cwd: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
    body = body or {}
    src = str(body.get("source_uri") or "").strip()
    tgt = str(body.get("target_uri") or "").strip()
    rel = str(body.get("relation") or "skos:relatedMatch").strip()
    if not src or not tgt:
        return {"error": "NO_ENDS"}
    if rel not in RELATIONS:
        rel = "skos:relatedMatch"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    try:
        conf = float(body.get("confidence") or 1)
    except (TypeError, ValueError):
        conf = 1.0
    conf = max(0.0, min(conf, 1.0))
    row = {
        "id": str(body.get("id") or uuid.uuid4()),
        "source_uri": src,
        "source_label": str(body.get("source_label") or src),
        "target_uri": tgt,
        "target_label": str(body.get("target_label") or tgt),
        "relation": rel,
        "predicate_uri": rel if "://" in rel else f"http://www.w3.org/2004/02/skos/core#{rel.split(':')[-1]}",
        "confidence": conf,
        "provenance": str(body.get("provenance") or ""),
        "source": str(body.get("source") or "workspace"),
        "reviewer": str(body.get("reviewer") or ""),
        "created_at": str(body.get("created_at") or now),
        "updated_at": now,
    }
    rows = [item for item in _load(cwd) if str(item.get("id") or "") != row["id"]]
    rows.append(row)
    _save(cwd, rows)
    try:
        from semantica.ontology import OntologyEngine
        import graph_store
        engine = OntologyEngine(store=graph_store.open_store(cwd))
        engine.create_alignment(src, tgt, row["predicate_uri"])
    except Exception:
        pass
    return row


def delete_alignment(cwd: str, ident: str) -> dict[str, Any]:
    ident = str(ident or "").strip()
    if not ident:
        return {"error": "NO_ID"}
    rows = _load(cwd)
    keep = [row for row in rows if str(row.get("id") or "") != ident]
    if len(keep) == len(rows):
        return {"error": "NOT_FOUND", "id": ident}
    _save(cwd, keep)
    return {"ok": True, "status": "deleted", "id": ident}


def _tokens(text: str) -> set[str]:
    blob = str(text or "").lower().strip()
    parts = {part for part in re.split(r"[\s:/#_\-]+", blob) if len(part) >= 2}
    if len(blob) >= 2:
        for i in range(len(blob) - 1):
            parts.add(blob[i:i + 2])
    return parts


def suggest_alignments(cwd: str, concepts: list[dict[str, Any]], args: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    args = args or {}
    try:
        threshold = float(args.get("threshold") or 0.5)
    except (TypeError, ValueError):
        threshold = 0.5
    try:
        limit = max(1, min(int(args.get("limit") or 20), 80))
    except (TypeError, ValueError):
        limit = 20
    src_ont = str(args.get("source_ontology_uri") or "").strip()
    tgt_ont = str(args.get("target_ontology_uri") or "").strip()
    rows = [row for row in concepts if isinstance(row, dict)]
    out: list[dict[str, Any]] = []
    for i, left in enumerate(rows):
        a = str(left.get("id") or "")
        al = str(left.get("label") or left.get("content") or a)
        ascheme = str((left.get("properties") or {}).get("scheme_uri") or (left.get("properties") or {}).get("inScheme") or "")
        if src_ont and ascheme and ascheme != src_ont:
            continue
        atok = _tokens(al)
        if not a or not atok:
            continue
        for right in rows[i + 1:]:
            b = str(right.get("id") or "")
            if not b or a == b:
                continue
            bl = str(right.get("label") or right.get("content") or b)
            bscheme = str((right.get("properties") or {}).get("scheme_uri") or (right.get("properties") or {}).get("inScheme") or "")
            if tgt_ont and bscheme and bscheme != tgt_ont:
                continue
            btok = _tokens(bl)
            if not btok:
                continue
            score = len(atok & btok) / max(len(atok | btok), 1)
            if score < threshold:
                continue
            out.append({
                "source_uri": a,
                "source_label": al,
                "target_uri": b,
                "target_label": bl,
                "relation": "skos:closeMatch" if score < 0.99 else "skos:exactMatch",
                "score": round(score, 4),
                "label_similarity": round(score, 4),
                "embedding_similarity": None,
                "reason": "label",
            })
    out.sort(key=lambda row: float(row.get("score") or 0), reverse=True)
    return out[:limit]
