from __future__ import annotations

import atexit
import hashlib
import json
import os
import signal
import sys
import threading
import time
from pathlib import Path
from typing import Any

HOST = (os.environ.get("FALKORDB_HOST") or "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.environ.get("FALKORDB_PORT") or "6379")

_LITE_LOCK = threading.Lock()
_LITE_DB: Any = None
_LITE_PATH = ""
_LITE_ERROR: str = ""
_LITE_ATEXIT = False


def graph_name(cwd: str) -> str:
    key = os.path.realpath(cwd or "")
    return "dsh_" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def _dsh_home() -> Path:
    raw = (os.environ.get("DSH_HOME") or "").strip()
    return Path(raw) if raw else Path.home() / ".dsh"


def lite_db_path() -> Path:
    return _dsh_home() / "semantic-os" / "falkordb" / "graph.db"


def _import_lite_cls():
    try:
        from redislite.falkordb_client import FalkorDB as Lite
        return Lite
    except Exception:
        pass
    try:
        from falkordblite import FalkorDB as Lite  # type: ignore
        return Lite
    except Exception as exc:
        raise ImportError(f"falkordblite:{exc.__class__.__name__}:{exc}") from exc


def _lite_fail_detail(exc: BaseException) -> str:
    msg = str(exc) or exc.__class__.__name__
    low = msg.lower()
    if os.name == "nt":
        return ("这台 Windows 原生跑不了嵌入式图库。先试 Docker Desktop，再试 WSL。都没有才用文件备份。" + msg)[:240]
    if sys.platform == "darwin" and any(tok in low for tok in ("libomp", "openmp", "libgomp")):
        return "这台 Mac 缺 OpenMP（libomp）。装插件时会用 Homebrew 自动装；这次没装上，先用文件备份。"
    if sys.platform.startswith("linux") and any(tok in low for tok in ("libgomp", "openmp", "libomp")):
        return "这台 Linux 缺 OpenMP（libgomp）。装插件时会用系统包管理器自动装；这次没装上，先用文件备份。"
    return msg[:240]


_TCP_CACHE: dict[str, Any] | None = None
_TCP_CACHE_TS = 0.0
_TCP_TTL_SECONDS = 30.0


def _tcp_status() -> dict[str, Any] | None:
    global _TCP_CACHE, _TCP_CACHE_TS
    now = time.monotonic()
    if _TCP_CACHE is not None and (now - _TCP_CACHE_TS) < _TCP_TTL_SECONDS:
        return _TCP_CACHE
    try:
        from falkordb import FalkorDB
    except Exception:
        _TCP_CACHE = None
        _TCP_CACHE_TS = now
        return None
    try:
        db = FalkorDB(host=HOST, port=PORT, connect_timeout=2, socket_timeout=2)
        db.select_graph("dsh_ping").query("RETURN 1")
        _TCP_CACHE = {"ok": True, "via": "falkordb", "host": HOST, "port": PORT, "detail": ""}
    except Exception:
        _TCP_CACHE = None
    _TCP_CACHE_TS = now
    return _TCP_CACHE


def _open_lite() -> Any:
    global _LITE_DB, _LITE_PATH, _LITE_ERROR
    if _LITE_DB is not None:
        return _LITE_DB
    # A previous failed start is sticky for this process: falkordblite spins up
    # a redis-server whose startup can hang ~10s, and retrying every graph read
    # would stall every request. Fail fast and let the file backup serve.
    if _LITE_ERROR:
        raise RuntimeError(_LITE_ERROR)
    with _LITE_LOCK:
        if _LITE_DB is not None:
            return _LITE_DB
        if _LITE_ERROR:
            raise RuntimeError(_LITE_ERROR)
        Lite = _import_lite_cls()
        path = lite_db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            db = Lite(str(path), serverconfig={"port": "0"})
            db.select_graph("dsh_ping").query("RETURN 1")
        except Exception as exc:
            _LITE_ERROR = _lite_fail_detail(exc)
            raise
        _LITE_DB = db
        _LITE_PATH = str(path)
        _LITE_ERROR = ""
        _register_lite_shutdown()
        return _LITE_DB


_LITE_STOP_BOUND_SECONDS = 2.0
_UNREAD = object()


def _read_identity(pid: int):
    """(command line, start token), None if that pid is gone, or _UNREAD."""
    if os.name == 'posix' and os.path.isdir('/proc'):
        stat_path = f'/proc/{int(pid)}/stat'
        cmd_path = f'/proc/{int(pid)}/cmdline'
        try:
            stat = open(stat_path, encoding='utf-8').read()
            raw = open(cmd_path, 'rb').read()
        except FileNotFoundError:
            return None
        except OSError:
            return _UNREAD
        fields = stat[stat.rfind(')') + 2:].split()
        if not fields:
            return _UNREAD
        if fields[0] in ('Z', 'X'):
            return None
        cmdline = tuple(part.decode('utf-8', 'replace') for part in raw.split(b'\0') if part)
        # starttime is field 22, the 20th token after comm.
        if len(fields) <= 19 or not cmdline:
            return _UNREAD
        return (cmdline, fields[19])
    try:
        import psutil
    except ImportError:
        return _UNREAD
    try:
        proc = psutil.Process(int(pid))
        cmdline = tuple(proc.cmdline())
        if proc.status() == psutil.STATUS_ZOMBIE or not cmdline:
            return None if proc.status() == psutil.STATUS_ZOMBIE else _UNREAD
        return (cmdline, proc.create_time())
    except (psutil.NoSuchProcess, psutil.ZombieProcess):
        return None
    except (psutil.Error, OSError, ValueError):
        return _UNREAD


def _redis_mark(pid: int):
    mark = _read_identity(pid)
    if mark is None or mark is _UNREAD:
        return None
    return mark


def _same_redis(pid: int, mark) -> bool:
    if not pid or mark is None:
        return False
    current = _read_identity(pid)
    if current is _UNREAD:
        current = _read_identity(pid)
    return current == mark


def _signal_redis(pid: int, mark, sig: int) -> None:
    if not _same_redis(pid, mark):
        return
    os.kill(int(pid), sig)


def _wait_redis(pid: int, mark, bound: float) -> bool:
    deadline = time.monotonic() + bound
    while True:
        current = _read_identity(pid)
        if current is None:
            return True
        if current is not _UNREAD and current != mark:
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(0.05)


def close_lite() -> None:
    """Stop the embedded redis-server before the sidecar exits.

    db.close() drops the pidfile when another connection is open, and the
    daemonized server stays up. The pid, command line, and start time taken
    before close are the only identity a later signal is allowed to match.
    """
    global _LITE_DB, _LITE_PATH
    with _LITE_LOCK:
        db = _LITE_DB
        _LITE_DB = None
        _LITE_PATH = ""
    if db is None:
        return
    client = getattr(db, "client", None)
    pid = 0
    if client is not None:
        try:
            pid = int(getattr(client, "pid", 0) or 0)
        except (TypeError, ValueError):
            pid = 0
    mark = _redis_mark(pid) if pid else None
    closed = False
    closer = getattr(db, "close", None)
    if callable(closer):
        try:
            closer()
            closed = True
        except Exception:
            closed = False
    if not closed and client is not None:
        cleanup = getattr(client, "_cleanup", None)
        if callable(cleanup):
            try:
                cleanup()
            except Exception:
                pass
    if not _same_redis(pid, mark):
        return
    shutdown = getattr(client, "shutdown", None) if client is not None else None
    if callable(shutdown):
        try:
            shutdown(nosave=True, now=True, force=True)
        except Exception:
            pass
    if _same_redis(pid, mark):
        try:
            _signal_redis(pid, mark, signal.SIGTERM)
        except OSError:
            pass
    if _wait_redis(pid, mark, _LITE_STOP_BOUND_SECONDS):
        return
    try:
        _signal_redis(pid, mark, signal.SIGKILL)
    except OSError:
        pass
    _wait_redis(pid, mark, 0.5)


def _register_lite_shutdown() -> None:
    global _LITE_ATEXIT
    if _LITE_ATEXIT:
        return
    atexit.register(close_lite)
    _LITE_ATEXIT = True


def _lite_status() -> dict[str, Any]:
    try:
        _open_lite()
        return {
            "ok": True,
            "via": "falkordblite",
            "path": _LITE_PATH or str(lite_db_path()),
            "detail": "没 Docker，用官方嵌入式包开店",
        }
    except Exception as exc:
        return {"ok": False, "via": "", "detail": _lite_fail_detail(exc)}


def primary_status() -> dict[str, Any]:
    tcp = _tcp_status()
    if tcp:
        return tcp
    return _lite_status()


def _open_graph(cwd: str):
    if _tcp_status():
        from falkordb import FalkorDB

        return FalkorDB(host=HOST, port=PORT).select_graph(graph_name(cwd))
    return _open_lite().select_graph(graph_name(cwd))


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


def _node_pack(nid: str, node: Any) -> tuple[str, str, str, str]:
    if isinstance(node, dict):
        ntype = str(node.get("type") or node.get("node_type") or "Entity")
        content = str(node.get("content") or (node.get("properties") or {}).get("content") or nid)
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
    else:
        ntype = str(getattr(node, "node_type", None) or "Entity")
        content = str(getattr(node, "content", None) or nid)
        props = getattr(node, "properties", None) or {}
        if not isinstance(props, dict):
            props = {}
    clean = {str(k): v for k, v in props.items() if not str(k).startswith("_")}
    if not isinstance(node, dict):
        vf = getattr(node, "valid_from", None)
        vu = getattr(node, "valid_until", None)
        ts = getattr(node, "timestamp", None)
        if vf is not None and "valid_from" not in clean:
            clean["valid_from"] = vf
        if vu is not None and "valid_until" not in clean:
            clean["valid_until"] = vu
        if ts is not None and "timestamp" not in clean:
            clean["timestamp"] = ts
        extra = getattr(node, "properties", None) or {}
        if isinstance(extra, dict):
            for key in ("timestamp", "event_time", "valid_from", "valid_until"):
                if extra.get(key) is not None and key not in clean:
                    clean[key] = extra[key]
    else:
        for key in ("valid_from", "valid_until", "timestamp", "event_time"):
            if node.get(key) is not None and key not in clean:
                clean[key] = node.get(key)
    return nid, ntype, content, json.dumps(clean, ensure_ascii=False)


def _edge_pack(edge: Any) -> tuple[str, str, str]:
    if isinstance(edge, dict):
        src = str(edge.get("source_id") or edge.get("source") or "")
        tgt = str(edge.get("target_id") or edge.get("target") or "")
        et = str(edge.get("type") or edge.get("edge_type") or "related_to")
        return src, tgt, et
    src = str(getattr(edge, "source_id", None) or getattr(edge, "source", "") or "")
    tgt = str(getattr(edge, "target_id", None) or getattr(edge, "target", "") or "")
    et = str(getattr(edge, "edge_type", None) or getattr(edge, "type", "") or "related_to")
    return src, tgt, et


def _create_node(g: Any, nid: str, ntype: str, content: str, props: str) -> None:
    g.query(
        "CREATE (n:Entity {nid: $nid, node_type: $t, content: $c, props: $p})",
        {"nid": nid, "t": ntype, "c": content, "p": props},
    )


def _create_edge(g: Any, src: str, tgt: str, et: str) -> None:
    g.query(
        "MATCH (a:Entity {nid: $s}), (b:Entity {nid: $t}) "
        "CREATE (a)-[:LINK {edge_type: $e}]->(b)",
        {"s": src, "t": tgt, "e": et},
    )


ARCHIVE_ID_PREFIXES = ("session:", "file:", "mail:")
ARCHIVE_TYPES = frozenset({"Document", "document"})


def is_archive_node(nid: str, ntype: str = "") -> bool:
    """Diary / file / mail rows stay in the cabinet. Slim workbench saves must not delete them."""
    raw = str(nid or "")
    if raw.startswith(ARCHIVE_ID_PREFIXES):
        return True
    return str(ntype or "") in ARCHIVE_TYPES


def write_primary(graph: Any, cwd: str, replace: bool = False) -> dict[str, Any]:
    st = primary_status()
    if not st.get("ok"):
        return {**st, "wrote": 0}
    forget_node_rows(cwd)
    g = _open_graph(cwd)
    if replace:
        try:
            g.query("MATCH (n:Entity) DETACH DELETE n")
        except Exception:
            pass
    wanted_nodes: dict[str, tuple[str, str, str]] = {}
    for nid, node in _iter_nodes(graph):
        if not nid:
            continue
        _id, ntype, content, props = _node_pack(str(nid), node)
        wanted_nodes[_id] = (ntype, content[:20000], props)
    wanted_edges: set[tuple[str, str, str]] = set()
    for edge in _iter_edges(graph):
        src, tgt, et = _edge_pack(edge)
        if src and tgt:
            wanted_edges.add((src, tgt, et[:80]))

    have_nodes: dict[str, tuple[str, str, str]] = {}
    have_edges: set[tuple[str, str, str]] = set()
    try:
        rows = g.query("MATCH (n:Entity) RETURN n.nid, n.node_type, n.content, n.props")
        for row in rows.result_set or []:
            hid = str(row[0] or "")
            if hid:
                have_nodes[hid] = (str(row[1] or ""), str(row[2] or ""), str(row[3] or ""))
        links = g.query("MATCH (a:Entity)-[r:LINK]->(b:Entity) RETURN a.nid, b.nid, r.edge_type")
        for row in links.result_set or []:
            have_edges.add((str(row[0] or ""), str(row[1] or ""), str(row[2] or "")))
    except Exception:
        have_nodes, have_edges = {}, set()

    if not have_nodes and not have_edges:
        for nid, (ntype, content, props) in wanted_nodes.items():
            _create_node(g, nid, ntype, content, props)
        for src, tgt, et in wanted_edges:
            _create_edge(g, src, tgt, et)
        return {
            "ok": True, "via": st.get("via") or "falkordb",
            "wrote": len(wanted_nodes), "edges": len(wanted_edges),
            "mode": "full", "name": graph_name(cwd),
        }

    deleted = added = updated = 0
    for nid in list(have_nodes):
        if nid in wanted_nodes:
            continue
        ntype = have_nodes[nid][0] if have_nodes.get(nid) else ""
        if is_archive_node(nid, ntype):
            continue
        try:
            g.query("MATCH (n:Entity {nid: $nid}) DETACH DELETE n", {"nid": nid})
            deleted += 1
        except Exception:
            pass
    for nid, packed in wanted_nodes.items():
        ntype, content, props = packed
        if nid not in have_nodes:
            _create_node(g, nid, ntype, content, props)
            added += 1
        elif have_nodes[nid] != packed:
            g.query(
                "MATCH (n:Entity {nid: $nid}) SET n.node_type=$t, n.content=$c, n.props=$p",
                {"nid": nid, "t": ntype, "c": content, "p": props},
            )
            updated += 1
    for src, tgt, et in list(have_edges):
        if (src, tgt, et) in wanted_edges:
            continue
        src_type = have_nodes[src][0] if have_nodes.get(src) else ""
        tgt_type = have_nodes[tgt][0] if have_nodes.get(tgt) else ""
        if is_archive_node(src, src_type) or is_archive_node(tgt, tgt_type):
            continue
        try:
            g.query(
                "MATCH (a:Entity {nid: $s})-[r:LINK {edge_type: $e}]->(b:Entity {nid: $t}) DELETE r",
                {"s": src, "t": tgt, "e": et},
            )
        except Exception:
            pass
    for src, tgt, et in wanted_edges:
        if (src, tgt, et) not in have_edges:
            _create_edge(g, src, tgt, et)
    return {
        "ok": True, "via": st.get("via") or "falkordb",
        "wrote": len(wanted_nodes), "edges": len(wanted_edges),
        "added": added, "updated": updated, "deleted": deleted,
        "mode": "incr", "name": graph_name(cwd),
    }


def read_primary(cwd: str) -> tuple[Any | None, dict[str, Any]]:
    st = primary_status()
    if not st.get("ok"):
        return None, st
    from semantica.context.context_graph import ContextGraph

    g = _open_graph(cwd)
    counted = g.query("MATCH (n:Entity) RETURN count(n)")
    ncount = 0
    try:
        ncount = int((counted.result_set or [[0]])[0][0] or 0)
    except Exception:
        ncount = 0
    if ncount <= 0:
        return None, {**st, "empty": True, "nodes": 0}
    mem = ContextGraph()
    rows = g.query("MATCH (n:Entity) RETURN n.nid, n.node_type, n.content, n.props")
    for row in rows.result_set or []:
        nid = str(row[0] or "")
        if not nid:
            continue
        ntype = str(row[1] or "Entity")
        if is_archive_node(nid, ntype):
            continue
        content = str(row[2] or nid)
        extra = {}
        try:
            packed = json.loads(row[3] or "{}")
            if isinstance(packed, dict):
                extra = packed
        except Exception:
            extra = {}
        extra.pop("content", None)
        extra.pop("node_type", None)
        extra.pop("node_id", None)
        mem.add_node(nid, ntype, content=content, **extra)
    links = g.query(
        "MATCH (a:Entity)-[r:LINK]->(b:Entity) RETURN a.nid, b.nid, r.edge_type"
    )
    ecount = 0
    for row in links.result_set or []:
        src, tgt, et = str(row[0] or ""), str(row[1] or ""), str(row[2] or "related_to")
        if src and tgt and not is_archive_node(src) and not is_archive_node(tgt):
            try:
                mem.add_edge(src, tgt, edge_type=et)
                ecount += 1
            except Exception:
                pass
    return mem, {**st, "empty": False, "nodes": ncount, "edges": ecount, "name": graph_name(cwd)}


def _row_from_json_node(node: Any) -> dict[str, Any] | None:
    if not isinstance(node, dict):
        return None
    nid = str(node.get("id") or "")
    if not nid:
        return None
    ntype = str(node.get("type") or "Entity")
    raw_props = node.get("properties")
    props = dict(raw_props) if isinstance(raw_props, dict) else {}
    content = str(props.get("content") or node.get("content") or nid)
    for key in ("valid_from", "valid_until", "timestamp", "event_time"):
        if node.get(key) is not None and key not in props:
            props[key] = node.get(key)
    return {"id": nid, "type": ntype, "content": content, "properties": props}


_ROWS_CACHE: dict[str, tuple[float, list[dict[str, Any]], dict[str, Any]]] = {}
_ROWS_LOCK = threading.Lock()
_ROWS_TTL = 2.0


def forget_node_rows(cwd: str = "") -> None:
    key = os.path.realpath(cwd or "")
    with _ROWS_LOCK:
        if key:
            _ROWS_CACHE.pop(key, None)
        else:
            _ROWS_CACHE.clear()


def read_node_rows(cwd: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    cache_key = os.path.realpath(cwd or "")
    now = time.time()
    with _ROWS_LOCK:
        hit = _ROWS_CACHE.get(cache_key)
        if hit and now - hit[0] < _ROWS_TTL:
            return hit[1], hit[2]
    st = primary_status()
    if st.get("ok"):
        try:
            g = _open_graph(cwd)
            rows = g.query("MATCH (n:Entity) RETURN n.nid, n.node_type, n.content, n.props")
            out: list[dict[str, Any]] = []
            for row in rows.result_set or []:
                nid = str(row[0] or "")
                if not nid:
                    continue
                ntype = str(row[1] or "Entity")
                content = str(row[2] or nid)
                props: dict[str, Any] = {}
                try:
                    p = json.loads(row[3] or "{}")
                    if isinstance(p, dict):
                        props = p
                except Exception:
                    pass
                out.append({"id": nid, "type": ntype, "content": content, "properties": props})
            if out:
                packed = {**st, "nodes": len(out)}
                with _ROWS_LOCK:
                    _ROWS_CACHE[cache_key] = (time.time(), out, packed)
                return out, packed
        except Exception:
            pass
    path = Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "graph.json"
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            nodes = data.get("nodes") if isinstance(data, dict) else None
            out = []
            if isinstance(nodes, list):
                for node in nodes:
                    row = _row_from_json_node(node)
                    if row:
                        out.append(row)
            elif isinstance(nodes, dict):
                for nid, node in nodes.items():
                    row = _row_from_json_node(node)
                    if row:
                        if not row.get("id"):
                            row["id"] = str(nid)
                        out.append(row)
            return out, {**st, "nodes": len(out), "via": "graph.json"}
    except Exception:
        pass
    return [], st


def read_memory_card_rows(cwd: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    st = primary_status()
    if st.get("ok"):
        try:
            g = _open_graph(cwd)
            rows = g.query(
                "MATCH (n:Entity) WHERE n.node_type = '记忆卡片' "
                "RETURN n.nid, n.node_type, n.content, n.props"
            )
            out: list[dict[str, Any]] = []
            for row in rows.result_set or []:
                nid = str(row[0] or "")
                if not nid:
                    continue
                ntype = str(row[1] or "Entity")
                content = str(row[2] or nid)
                props: dict[str, Any] = {}
                try:
                    packed = json.loads(row[3] or "{}")
                    if isinstance(packed, dict):
                        props = packed
                except Exception:
                    pass
                out.append({"id": nid, "type": ntype, "content": content, "properties": props})
            return out, {**st, "nodes": len(out)}
        except Exception:
            pass
    rows, st = read_node_rows(cwd)
    cards = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        ntype = str(row.get("type") or "")
        props = row.get("properties") if isinstance(row.get("properties"), dict) else {}
        if ntype == "记忆卡片" or str(props.get("kind") or "") == "记忆卡片":
            cards.append(row)
    return cards, {**st, "nodes": len(cards)}


def read_nodes_by_id(cwd: str, ids: list[str]) -> dict[str, dict[str, Any]]:
    wanted = [str(nid or "").strip() for nid in ids if str(nid or "").strip()]
    if not wanted:
        return {}
    keep = set(wanted)
    st = primary_status()
    if st.get("ok"):
        try:
            g = _open_graph(cwd)
            rows = g.query(
                "MATCH (n:Entity) WHERE n.nid IN $ids RETURN n.nid, n.node_type, n.content, n.props",
                {"ids": list(keep)},
            )
            out: dict[str, dict[str, Any]] = {}
            for row in rows.result_set or []:
                nid = str(row[0] or "")
                if not nid:
                    continue
                props: dict[str, Any] = {}
                try:
                    packed = json.loads(row[3] or "{}")
                    if isinstance(packed, dict):
                        props = packed
                except Exception:
                    pass
                out[nid] = {"id": nid, "type": str(row[1] or "Entity"), "content": str(row[2] or nid), "properties": props}
            if out or not keep:
                return out
        except Exception:
            pass
    rows, _st = read_node_rows(cwd)
    return {str(row.get("id") or ""): row for row in rows if isinstance(row, dict) and str(row.get("id") or "") in keep}


def patch_node_props(cwd: str, nid: str, extra: dict[str, Any]) -> dict[str, Any]:
    nid = str(nid or "").strip()
    if not nid:
        return {"error": "NO_PATH"}
    extra = extra if isinstance(extra, dict) else {}
    st = primary_status()
    if not st.get("ok"):
        return {"error": "STORE_DOWN", **st}
    try:
        g = _open_graph(cwd)
        rows = g.query(
            "MATCH (n:Entity {nid: $nid}) RETURN n.nid, n.node_type, n.content, n.props",
            {"nid": nid},
        )
        found = list(rows.result_set or [])
        if not found:
            return {"error": "NO_PATH", "id": nid}
        row = found[0]
        ntype = str(row[1] or "Entity")
        content = str(row[2] or nid)
        props: dict[str, Any] = {}
        try:
            packed = json.loads(row[3] or "{}")
            if isinstance(packed, dict):
                props = packed
        except Exception:
            props = {}
        props.update({str(k): v for k, v in extra.items() if v is not None})
        g.query(
            "MATCH (n:Entity {nid: $nid}) SET n.node_type=$t, n.content=$c, n.props=$p",
            {"nid": nid, "t": ntype, "c": content, "p": json.dumps(props, ensure_ascii=False)},
        )
        _patch_graph_json(cwd, nid, extra)
        return {"ok": True, "id": nid, "via": "patch", "properties": props}
    except Exception as exc:
        return {"error": "PATCH_FAILED", "id": nid, "detail": str(exc)[:240]}


def _patch_graph_json(cwd: str, nid: str, extra: dict[str, Any]) -> None:
    path = Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "graph.json"
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    nodes = data.get("nodes") if isinstance(data, dict) else None
    changed = False
    if isinstance(nodes, list):
        for node in nodes:
            if isinstance(node, dict) and str(node.get("id") or "") == nid:
                props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
                props.update({str(k): v for k, v in extra.items() if v is not None})
                node["properties"] = props
                for key in ("valid_from", "valid_until"):
                    if key in extra:
                        node[key] = extra[key]
                changed = True
                break
    elif isinstance(nodes, dict) and nid in nodes and isinstance(nodes[nid], dict):
        node = nodes[nid]
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        props.update({str(k): v for k, v in extra.items() if v is not None})
        node["properties"] = props
        changed = True
    if not changed:
        return
    tmp = path.with_name(f".{path.stem}.{os.getpid()}.tmp{path.suffix}")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def insert_memory_card(cwd: str, nid: str, label: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    nid = str(nid or "").strip()
    label = str(label or "").strip()
    extra = extra if isinstance(extra, dict) else {}
    if not nid or not label:
        return {"error": "NO_PATH"}
    st = primary_status()
    if not st.get("ok"):
        return {"error": "STORE_DOWN", **st}
    props = {str(k): v for k, v in extra.items() if v is not None}
    props.setdefault("kind", "记忆卡片")
    props.setdefault("status", "起草")
    packed = json.dumps(props, ensure_ascii=False)
    try:
        g = _open_graph(cwd)
        found = g.query(
            "MATCH (n:Entity {nid: $nid}) RETURN n.nid",
            {"nid": nid},
        )
        if found.result_set:
            return {"ok": True, "id": nid, "status": "exists", "duplicate": True}
        _create_node(g, nid, "记忆卡片", label[:160], packed)
        source = str(props.get("source") or props.get("path") or "").strip()
        if source.startswith(("session:", "file:")):
            try:
                _create_edge(g, source, nid, "出自")
            except Exception:
                pass
        _insert_graph_json(cwd, nid, label[:160], props)
        return {"ok": True, "id": nid, "status": str(props.get("status") or "起草"), "via": "insert"}
    except Exception as exc:
        return {"error": "INSERT_FAILED", "id": nid, "detail": str(exc)[:240]}


def insert_edge(cwd: str, src: str, tgt: str, et: str) -> dict[str, Any]:
    src = str(src or "").strip()
    tgt = str(tgt or "").strip()
    et = str(et or "").strip()
    if not src or not tgt or not et:
        return {"error": "NO_PATH"}
    st = primary_status()
    if not st.get("ok"):
        return {"error": "STORE_DOWN", **st}
    try:
        g = _open_graph(cwd)
        found = g.query(
            "MATCH (a:Entity {nid: $s})-[r:LINK]->(b:Entity {nid: $t}) RETURN r.edge_type",
            {"s": src, "t": tgt},
        )
        for row in found.result_set or []:
            if str(row[0] or "") == et:
                _insert_edge_graph_json(cwd, src, tgt, et)
                return {"ok": True, "source": src, "target": tgt, "type": et, "duplicate": True, "via": "patch"}
        _create_edge(g, src, tgt, et)
        _insert_edge_graph_json(cwd, src, tgt, et)
        return {"ok": True, "source": src, "target": tgt, "type": et, "via": "insert"}
    except Exception as exc:
        return {"error": "INSERT_FAILED", "source": src, "target": tgt, "detail": str(exc)[:240]}


def _insert_edge_graph_json(cwd: str, src: str, tgt: str, et: str) -> None:
    path = Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "graph.json"
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(data, dict):
        return
    link = {"source": src, "target": tgt, "type": et}
    edges = data.get("edges")
    if isinstance(edges, list):
        if any(
            isinstance(row, dict)
            and str(row.get("source") or "") == src
            and str(row.get("target") or "") == tgt
            and str(row.get("type") or "") == et
            for row in edges
        ):
            return
        edges.append(link)
    else:
        data["edges"] = [link]
    tmp = path.with_name(f".{path.stem}.{os.getpid()}.tmp{path.suffix}")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def _insert_graph_json(cwd: str, nid: str, label: str, extra: dict[str, Any]) -> None:
    path = Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "graph.json"
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(data, dict):
        return
    node = {
        "id": nid,
        "type": str(extra.get("node_type") or extra.get("type") or "记忆卡片"),
        "content": label,
        "properties": dict(extra),
    }
    if extra.get("valid_from"):
        node["valid_from"] = extra.get("valid_from")
    nodes = data.get("nodes")
    if isinstance(nodes, list):
        if any(isinstance(row, dict) and str(row.get("id") or "") == nid for row in nodes):
            return
        nodes.append(node)
    elif isinstance(nodes, dict):
        if nid in nodes:
            return
        nodes[nid] = node
    else:
        data["nodes"] = [node]
    edges = data.get("edges")
    source = str(extra.get("source") or extra.get("path") or "").strip()
    if source.startswith(("session:", "file:")):
        link = {"source": source, "target": nid, "type": "出自"}
        if isinstance(edges, list):
            if not any(
                isinstance(row, dict)
                and str(row.get("source") or "") == source
                and str(row.get("target") or "") == nid
                for row in edges
            ):
                edges.append(link)
        else:
            data["edges"] = [link]
    tmp = path.with_name(f".{path.stem}.{os.getpid()}.tmp{path.suffix}")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, path)
    except OSError:
        try:
            if tmp.exists():
                tmp.unlink()
        except OSError:
            pass


def upsert_entity(cwd: str, nid: str, ntype: str, label: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    nid = str(nid or "").strip()
    ntype = str(ntype or "Entity").strip() or "Entity"
    label = str(label or nid).strip() or nid
    extra = extra if isinstance(extra, dict) else {}
    if not nid:
        return {"error": "NO_PATH"}
    st = primary_status()
    if not st.get("ok"):
        return {"error": "STORE_DOWN", **st}
    props = {str(k): v for k, v in extra.items() if v is not None}
    props.setdefault("node_type", ntype)
    packed = json.dumps(props, ensure_ascii=False)
    try:
        g = _open_graph(cwd)
        found = g.query("MATCH (n:Entity {nid: $nid}) RETURN n.nid", {"nid": nid})
        if found.result_set:
            _insert_graph_json(cwd, nid, label[:160], props)
            return {"ok": True, "id": nid, "duplicate": True, "via": "exists"}
        _create_node(g, nid, ntype, label[:160], packed)
        _insert_graph_json(cwd, nid, label[:160], props)
        return {"ok": True, "id": nid, "via": "insert"}
    except Exception as exc:
        return {"error": "INSERT_FAILED", "id": nid, "detail": str(exc)[:240]}


def read_edge_rows(cwd: str) -> list[dict[str, Any]]:
    st = primary_status()
    if st.get("ok"):
        try:
            g = _open_graph(cwd)
            rows = g.query("MATCH (a:Entity)-[r:LINK]->(b:Entity) RETURN a.nid, b.nid, r.edge_type")
            out: list[dict[str, Any]] = []
            for row in rows.result_set or []:
                src, tgt, et = str(row[0] or ""), str(row[1] or ""), str(row[2] or "related_to")
                if src and tgt:
                    out.append({"source": src, "target": tgt, "type": et})
            return out
        except Exception:
            pass
    path = Path(os.path.realpath(cwd)) / ".dsh" / "semantic-os" / "graph.json"
    try:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            edges = data.get("edges") if isinstance(data, dict) else None
            out = []
            if isinstance(edges, list):
                for e in edges:
                    if not isinstance(e, dict):
                        continue
                    src = str(e.get("source_id") or e.get("source") or "")
                    tgt = str(e.get("target_id") or e.get("target") or "")
                    et = str(e.get("type") or e.get("edge_type") or "related_to")
                    if src and tgt:
                        out.append({"source": src, "target": tgt, "type": et})
            return out
    except Exception:
        pass
    return []


VECTOR_ALGO = "tfidf-charwb-24-sparse-v1"
LEGACY_FAISS_NAME = "index.faiss"
_VECTOR_MEM: dict[tuple[str, str], tuple[Any, Any, list[str]]] = {}
_VECTOR_LOCK = threading.Lock()
_VECTOR_PENDING: dict[str, tuple[list[str], list[str]]] = {}
_VECTOR_RUNNING: set[str] = set()
_VECTOR_ERROR: dict[str, str] = {}


def vector_status() -> dict[str, Any]:
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer  # noqa: F401
        return {"ok": True, "via": "tfidf-sparse", "detail": ""}
    except Exception as exc:
        return {"ok": False, "via": "tfidf-sparse", "detail": str(exc)[:200]}


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


def _sparse_ready(dest: Path, meta: dict[str, Any] | None = None) -> bool:
    packed = meta if meta is not None else _read_vector_meta(dest)
    return (
        str(packed.get("algo") or "") == VECTOR_ALGO
        and (dest / "matrix.npz").is_file()
        and (dest / "tfidf.pkl").is_file()
        and (dest / "ids.json").is_file()
    )


def _drop_legacy_faiss(dest: Path) -> None:
    legacy = dest / LEGACY_FAISS_NAME
    try:
        if legacy.is_file():
            legacy.unlink()
    except OSError:
        pass


def _remember_vectors(cwd: str, digest: str, vec: Any, matrix: Any, ids: list[str]) -> None:
    root = os.path.realpath(cwd or "")
    stale = [key for key in _VECTOR_MEM if key[0] == root and key[1] != digest]
    for key in stale:
        _VECTOR_MEM.pop(key, None)
    _VECTOR_MEM[(root, digest)] = (vec, matrix, ids)


def _load_sparse_vectors(cwd: str) -> tuple[Any, Any, list[str]] | None:
    dest = vector_dir(cwd)
    meta = _read_vector_meta(dest)
    if not _sparse_ready(dest, meta):
        return None
    digest = str(meta.get("fp") or "")
    key = (os.path.realpath(cwd or ""), digest)
    hit = _VECTOR_MEM.get(key)
    if hit is not None:
        return hit
    import pickle
    from scipy.sparse import load_npz

    try:
        packed = json.loads((dest / "ids.json").read_text(encoding="utf-8"))
        ids = [str(item) for item in (packed.get("ids") or [])]
        vec = pickle.loads((dest / "tfidf.pkl").read_bytes())
        matrix = load_npz(dest / "matrix.npz")
    except Exception:
        return None
    if not ids or matrix.shape[0] != len(ids):
        return None
    _remember_vectors(cwd, digest, vec, matrix, ids)
    return vec, matrix, ids


def _write_sparse_index(dest: Path, cwd: str, ids: list[str], texts: list[str], digest: str) -> None:
    import pickle
    from scipy.sparse import save_npz
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), min_df=1)
    matrix = vec.fit_transform(texts)
    matrix = normalize(matrix, norm="l2", axis=1, copy=False)
    dest.mkdir(parents=True, exist_ok=True)
    suffix = f".{os.getpid()}.{threading.get_ident()}"
    tmp_matrix = dest / f".matrix{suffix}.npz"
    tmp_pkl = dest / f".tfidf{suffix}.pkl"
    tmp_ids = dest / f".ids{suffix}.json"
    tmp_meta = dest / f".meta{suffix}.json"
    try:
        save_npz(tmp_matrix, matrix)
        tmp_pkl.write_bytes(pickle.dumps(vec))
        tmp_ids.write_text(json.dumps({"ids": ids}, ensure_ascii=False), encoding="utf-8")
        tmp_meta.write_text(
            json.dumps({"fp": digest, "count": len(ids), "algo": VECTOR_ALGO}, ensure_ascii=False),
            encoding="utf-8",
        )
        os.replace(tmp_matrix, dest / "matrix.npz")
        os.replace(tmp_pkl, dest / "tfidf.pkl")
        os.replace(tmp_ids, dest / "ids.json")
        os.replace(tmp_meta, dest / "meta.json")
    finally:
        for tmp in (tmp_matrix, tmp_pkl, tmp_ids, tmp_meta):
            try:
                if tmp.exists():
                    tmp.unlink()
            except OSError:
                pass
    _drop_legacy_faiss(dest)
    _remember_vectors(cwd, digest, vec, matrix, ids)


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
    if _sparse_ready(dest, meta) and str(meta.get("fp") or "") == digest:
        return {**st, "count": len(ids), "skipped": True, "algo": VECTOR_ALGO}
    _write_sparse_index(dest, cwd, ids, texts, digest)
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
    ready = _sparse_ready(dest, meta)
    legacy = (dest / LEGACY_FAISS_NAME).is_file()
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


def search_vectors(cwd: str, query: str, limit: int = 8) -> list[dict[str, Any]]:
    if not str(query or "").strip():
        return []
    loaded = _load_sparse_vectors(cwd)
    if loaded is None:
        return []
    vec, matrix, ids = loaded
    try:
        import numpy as np
        from sklearn.preprocessing import normalize
    except Exception:
        return []
    try:
        q = vec.transform([query])
        q = normalize(q, norm="l2", axis=1, copy=False)
        scores = matrix.dot(q.T)
        if getattr(scores, "ndim", 1) == 2 and scores.shape[1] == 1:
            scores = scores.toarray().ravel()
        else:
            scores = np.asarray(scores).ravel()
    except Exception:
        return []
    if scores.size == 0:
        return []
    k = min(max(int(limit or 8), 1), scores.size)
    top = np.argpartition(scores, -k)[-k:]
    top = top[np.argsort(scores[top])[::-1]]
    out = []
    for pos in top.tolist():
        if pos < 0 or pos >= len(ids):
            continue
        score = float(scores[pos])
        if score <= 0:
            continue
        out.append({"id": ids[pos], "score": score})
    return out
