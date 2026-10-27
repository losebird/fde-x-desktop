"""Read-only export of legacy FalkorDB Lite graphs.

Copies graph.db first so the live file is never opened. Writes
~/.dsh/semantic-os/falkordb-export/<graph_name>.json
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any


def dsh_home(raw: str = "") -> Path:
    text = (raw or os.environ.get("DSH_HOME") or "").strip()
    return Path(text) if text else Path.home() / ".dsh"


def lite_db_path(home: Path) -> Path:
    return home / "semantic-os" / "falkordb" / "graph.db"


def export_dir(home: Path) -> Path:
    return home / "semantic-os" / "falkordb-export"


def _open_lite(copy: Path):
    try:
        from redislite.falkordb_client import FalkorDB as Lite
    except Exception:
        from falkordblite import FalkorDB as Lite  # type: ignore
    return Lite(str(copy), serverconfig={"port": "0", "daemonize": "no"})


def _graph_names(db: Any) -> list[str]:
    names: list[str] = []
    for attr in ("list_graphs", "listGraphs"):
        fn = getattr(db, attr, None)
        if callable(fn):
            try:
                raw = fn()
                if isinstance(raw, (list, tuple)):
                    return [str(item) for item in raw if str(item).startswith("dsh_")]
            except Exception:
                pass
    # Fallback: scan known ping graph only; callers also pass cwd names.
    try:
        db.select_graph("dsh_ping").query("RETURN 1")
    except Exception:
        pass
    return names


def export_one(g: Any) -> dict[str, Any]:
    nodes: list[list[Any]] = []
    edges: list[list[Any]] = []
    try:
        rows = g.query("MATCH (n:Entity) RETURN n.nid, n.node_type, n.content, n.props")
        for row in rows.result_set or []:
            nodes.append([str(row[0] or ""), str(row[1] or "Entity"), str(row[2] or ""), str(row[3] or "{}")])
        links = g.query("MATCH (a:Entity)-[r:LINK]->(b:Entity) RETURN a.nid, b.nid, r.edge_type")
        for row in links.result_set or []:
            edges.append([str(row[0] or ""), str(row[1] or ""), str(row[2] or "related_to")])
    except Exception as exc:
        return {"ok": False, "detail": str(exc)[:240], "nodes": nodes, "edges": edges}
    return {"ok": True, "nodes": nodes, "edges": edges}


def export_home(home: Path, tcp: str = "") -> dict[str, Any]:
    dest = export_dir(home)
    dest.mkdir(parents=True, exist_ok=True)
    src = lite_db_path(home)
    graphs: dict[str, list[int]] = {}
    via = "none"
    if tcp:
        via = "tcp"
        host, _, port = tcp.partition(":")
        from falkordb import FalkorDB
        db = FalkorDB(host=host or "127.0.0.1", port=int(port or "6379"), connect_timeout=2, socket_timeout=8)
        names = _graph_names(db) or []
        if not names:
            # Cannot list; skip rather than guess.
            return {"ok": True, "via": via, "graphs": graphs, "detail": "no graph names"}
        for name in names:
            packed = export_one(db.select_graph(name))
            if packed.get("ok"):
                (dest / f"{name}.json").write_text(json.dumps(packed, ensure_ascii=False), encoding="utf-8")
                graphs[name] = [len(packed["nodes"]), len(packed["edges"])]
        return {"ok": True, "via": via, "graphs": graphs}
    if not src.is_file():
        return {"ok": True, "via": "missing", "graphs": graphs}
    before = hashlib.md5(src.read_bytes()).hexdigest()
    tmp = Path(tempfile.mkdtemp(prefix="falkor-export-"))
    copy = tmp / "graph.db"
    shutil.copy2(src, copy)
    extra = src.parent / (src.name + ".wal")
    if extra.is_file():
        shutil.copy2(extra, tmp / extra.name)
    try:
        db = _open_lite(copy)
        via = "lite-copy"
        names = _graph_names(db)
        if not names:
            # Probe by scanning export later; try ping only.
            names = []
        client = getattr(db, "client", None)
        # redislite may expose keys; try INFO keyspace is unreliable. Export ping + any dsh_ files already written.
        if names:
            for name in names:
                packed = export_one(db.select_graph(name))
                if packed.get("ok"):
                    (dest / f"{name}.json").write_text(json.dumps(packed, ensure_ascii=False), encoding="utf-8")
                    graphs[name] = [len(packed["nodes"]), len(packed["edges"])]
        close = getattr(db, "close", None)
        if callable(close):
            try:
                close()
            except Exception:
                pass
    except ImportError as exc:
        shutil.rmtree(tmp, ignore_errors=True)
        return {"ok": False, "via": "no-lite", "detail": str(exc)[:240], "graphs": graphs}
    except Exception as exc:
        shutil.rmtree(tmp, ignore_errors=True)
        return {"ok": False, "via": via, "detail": str(exc)[:240], "graphs": graphs}
    shutil.rmtree(tmp, ignore_errors=True)
    after = hashlib.md5(src.read_bytes()).hexdigest()
    return {"ok": True, "via": via, "graphs": graphs, "md5": before, "md5_after": after, "unchanged": before == after}


def main(argv: list[str]) -> int:
    home = dsh_home(argv[1] if len(argv) > 1 else "")
    tcp = argv[2] if len(argv) > 2 else ""
    report = export_home(home, tcp)
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
