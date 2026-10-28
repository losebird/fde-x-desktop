"""Import alignments.json into OntologyEngine. Idempotent."""
from __future__ import annotations

from pathlib import Path
from typing import Any


def migrate(cwd: str) -> dict[str, Any]:
    import graph_store
    from align import list_alignments

    dest = graph_store.oxigraph_dir(cwd)
    dest.mkdir(parents=True, exist_ok=True)
    marker = dest / ".migrated-070-align"
    if marker.is_file():
        return {"ok": True, "skipped": True}
    rows = list_alignments(cwd)
    imported = 0
    if rows:
        try:
            from semantica.ontology import OntologyEngine
            engine = OntologyEngine(store=graph_store.open_store(cwd))
            for row in rows:
                src = str(row.get("source_uri") or "")
                tgt = str(row.get("target_uri") or "")
                pred = str(row.get("predicate_uri") or "")
                if not src or not tgt or not pred.startswith(("http://", "https://")):
                    continue
                try:
                    engine.create_alignment(src, tgt, pred)
                    imported += 1
                except Exception:
                    pass
        except Exception as exc:
            return {"ok": False, "imported": imported, "detail": str(exc)[:200]}
    marker.write_text("1\n", encoding="utf-8")
    return {"ok": True, "imported": imported}
