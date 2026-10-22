"""Workspace ontology versions via Semantica VersionManager. File-backed."""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from stores import read_node_rows

_VERSION_OK = re.compile(r"^[A-Za-z0-9._-]{1,32}$")


def _path(cwd: str) -> Path:
    return Path(os.path.realpath(cwd or "")) / ".dsh" / "semantic-os" / "ontology-versions.json"


def _load(cwd: str) -> dict[str, Any]:
    path = _path(cwd)
    if not path.is_file():
        return {}
    try:
        packed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return packed if isinstance(packed, dict) else {}


def _save(cwd: str, packed: dict[str, Any]) -> None:
    path = _path(cwd)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".ontology-versions.{os.getpid()}.json")
    tmp.write_text(json.dumps(packed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def _safe_version(raw: Any) -> str:
    text = str(raw or "").strip()
    return text if _VERSION_OK.match(text) else ""


def snapshot_structure(cwd: str) -> dict[str, list[str]]:
    rows, _st = read_node_rows(cwd)
    classes: list[str] = []
    properties: list[str] = []
    concepts: list[str] = []
    individuals: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        nid = str(row.get("id") or "").strip()
        ntype = str(row.get("type") or "")
        low = ntype.lower()
        if not nid:
            continue
        if low.startswith("skos:concept") and "scheme" not in low:
            concepts.append(nid)
        elif low in {"owl:class", "rdfs:class"} or low.endswith(":class"):
            classes.append(nid)
        elif "property" in low and (low.startswith("owl:") or low.startswith("rdfs:")):
            properties.append(nid)
        elif low in {"owl:namedindividual"}:
            individuals.append(nid)
    return {
        "classes": sorted(set(classes)),
        "properties": sorted(set(properties)),
        "concepts": sorted(set(concepts)),
        "individuals": sorted(set(individuals)),
        "axioms": [],
    }


def _as_entry(uri: str, rec: Any) -> dict[str, Any]:
    if isinstance(rec, dict):
        version = str(rec.get("version_id") or rec.get("version") or "")
        meta = rec.get("metadata") if isinstance(rec.get("metadata"), dict) else {}
        created = str(rec.get("date") or rec.get("created_at") or "")
        iri = str(rec.get("ontology_uri") or rec.get("ontology_iri") or uri)
        info = str(rec.get("version_info") or version)
    else:
        version = str(getattr(rec, "version", "") or "")
        meta = getattr(rec, "metadata", None)
        meta = meta if isinstance(meta, dict) else {}
        created = str(getattr(rec, "created_at", "") or "")
        iri = str(getattr(rec, "ontology_iri", "") or uri)
        info = str(getattr(rec, "version_info", "") or version)
    structure = meta.get("structure") if isinstance(meta.get("structure"), dict) else {}
    summary = rec.get("diff_summary") if isinstance(rec, dict) and isinstance(rec.get("diff_summary"), dict) else {
        "concepts": len(structure.get("concepts") or []),
        "classes": len(structure.get("classes") or []),
        "properties": len(structure.get("properties") or []),
    }
    return {
        "version_id": version,
        "ontology_uri": iri,
        "state": str((rec.get("state") if isinstance(rec, dict) else None) or meta.get("state") or "published"),
        "author": str((rec.get("author") if isinstance(rec, dict) else None) or meta.get("author") or "workspace"),
        "date": created,
        "diff_summary": summary,
        "metadata": meta,
        "version_info": info,
    }


def _items(packed: dict[str, Any], uri: str) -> list[dict[str, Any]]:
    rows = packed.get(uri)
    if isinstance(rows, dict) and isinstance(rows.get("items"), list):
        return [row for row in rows["items"] if isinstance(row, dict)]
    if isinstance(rows, list):
        return [row for row in rows if isinstance(row, dict)]
    return []


def _put_items(packed: dict[str, Any], uri: str, items: list[dict[str, Any]]) -> None:
    packed[uri] = items


def _manager(uri: str, items: list[dict[str, Any]]):
    try:
        from semantica.change_management.ontology_version_manager import OntologyVersion, VersionManager
    except Exception:
        return None

    mgr = VersionManager(config={"base_uri": uri})
    tracker = getattr(mgr, "progress_tracker", None)
    if tracker is not None:
        tracker.enabled = False
    for row in items:
        vid = _safe_version(row.get("version_id") or row.get("version"))
        if not vid:
            continue
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        if "structure" not in meta and isinstance(row.get("diff_summary"), dict):
            meta = {**meta, "structure": {
                "classes": [],
                "properties": [],
                "concepts": [],
                "individuals": [],
            }}
        rec = OntologyVersion(
            version=vid,
            ontology_iri=str(row.get("ontology_uri") or uri),
            version_info=str(row.get("version_info") or vid),
            created_at=str(row.get("date") or row.get("created_at") or ""),
            changes=list(row.get("changes") or []),
            metadata=meta,
        )
        mgr.versions[vid] = rec
        mgr.latest_version = vid
    return mgr


def list_versions(cwd: str, uri: str = "") -> list[dict[str, Any]]:
    want = str(uri or "").strip()
    packed = _load(cwd)
    if want:
        return [_as_entry(want, row) for row in _items(packed, want)]
    out: list[dict[str, Any]] = []
    for key, rows in packed.items():
        if isinstance(rows, list):
            out.extend(_as_entry(str(key), row) for row in rows if isinstance(row, dict))
        elif isinstance(rows, dict) and isinstance(rows.get("items"), list):
            out.extend(_as_entry(str(key), row) for row in rows["items"] if isinstance(row, dict))
    return out


def create_version(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    uri = str(args.get("uri") or args.get("ontology_uri") or "").strip()
    if not uri or len(uri) > 2000:
        return {"error": "NO_ONTOLOGY", "detail": "还没有词表可登记版本。"}
    packed = _load(cwd)
    items = _items(packed, uri)
    wanted = _safe_version(args.get("version") or args.get("version_id"))
    if not wanted:
        wanted = f"v{len(items) + 1}"
    if any(str(row.get("version_id") or "") == wanted for row in items):
        return {"error": "VERSION_EXISTS", "version_id": wanted}
    structure = snapshot_structure(cwd)
    ontology = {"uri": uri, "version": wanted}
    meta = {
        "structure": structure,
        "state": "published",
        "author": str(args.get("author") or "workspace")[:80],
    }
    try:
        mgr = _manager(uri, items)
        if mgr is None:
            raise RuntimeError("NO_SEMANTICA")
        rec = mgr.create_version(
            wanted,
            ontology,
            changes=list(args.get("changes") or []),
            metadata=meta,
        )
        entry = _as_entry(uri, rec)
    except Exception:
        from datetime import datetime, timezone
        entry = {
            "version_id": wanted,
            "ontology_uri": uri,
            "state": "published",
            "author": meta["author"],
            "date": datetime.now(timezone.utc).isoformat(),
            "diff_summary": {
                "concepts": len(structure.get("concepts") or []),
                "classes": len(structure.get("classes") or []),
                "properties": len(structure.get("properties") or []),
            },
            "metadata": meta,
            "version_info": wanted,
        }
    items.append(entry)
    _put_items(packed, uri, items)
    _save(cwd, packed)
    return {"ok": True, "version": entry, "versions": [_as_entry(uri, row) for row in items]}


def compare_versions(cwd: str, args: dict[str, Any] | None = None) -> dict[str, Any]:
    args = args or {}
    uri = str(args.get("uri") or args.get("ontology_uri") or "").strip()
    v1 = _safe_version(args.get("version1") or args.get("v1"))
    v2 = _safe_version(args.get("version2") or args.get("v2"))
    if not uri or not v1 or not v2:
        return {"error": "NO_VERSION"}
    items = _items(_load(cwd), uri)
    by_id = {str(row.get("version_id") or ""): row for row in items}
    if v1 not in by_id or v2 not in by_id:
        return {"error": "VERSION_MISSING", "version1": v1, "version2": v2}
    try:
        mgr = _manager(uri, items)
        if mgr is not None and v1 in mgr.versions and v2 in mgr.versions:
            diff = mgr.compare_versions(v1, v2)
            if isinstance(diff, dict):
                return {"ok": True, "via": "version-manager", **diff}
    except Exception as exc:
        return {"error": "COMPARE_FAILED", "detail": str(exc)[:240]}

    def ids(row: dict[str, Any], key: str) -> set[str]:
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        structure = meta.get("structure") if isinstance(meta.get("structure"), dict) else {}
        return {str(item) for item in (structure.get(key) or []) if item}

    a, b = by_id[v1], by_id[v2]
    return {
        "ok": True,
        "via": "structure",
        "version1": v1,
        "version2": v2,
        "classes_added": sorted(ids(b, "classes") - ids(a, "classes")),
        "classes_removed": sorted(ids(a, "classes") - ids(b, "classes")),
        "properties_added": sorted(ids(b, "properties") - ids(a, "properties")),
        "properties_removed": sorted(ids(a, "properties") - ids(b, "properties")),
        "concepts_added": sorted(ids(b, "concepts") - ids(a, "concepts")),
        "concepts_removed": sorted(ids(a, "concepts") - ids(b, "concepts")),
    }
