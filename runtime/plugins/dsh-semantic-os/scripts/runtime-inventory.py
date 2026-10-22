"""Write the installed runtime distribution and license inventory."""
from __future__ import annotations

import importlib.metadata
import json
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: runtime-inventory.py OUTPUT")
    rows = []
    for dist in importlib.metadata.distributions():
        meta = dist.metadata
        classifiers = [
            value.removeprefix("License :: ")
            for value in (meta.get_all("Classifier") or [])
            if value.startswith("License :: ")
        ]
        rows.append({
            "name": meta.get("Name") or "",
            "version": dist.version,
            "license": meta.get("License") or "",
            "licenseExpression": meta.get("License-Expression") or "",
            "licenseClassifiers": classifiers,
            "homePage": meta.get("Home-page") or "",
        })
    rows.sort(key=lambda row: row["name"].lower())
    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"schemaVersion": 1, "distributions": rows}, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
