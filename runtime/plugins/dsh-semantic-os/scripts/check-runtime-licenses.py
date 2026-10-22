"""Fail runtime publication on missing or release-blocked license metadata."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DENY = ("AGPL", "SSPL", "BUSINESS SOURCE LICENSE", "COMMON CLAUSE")
REVIEW = ("GPL", "LGPL", "MPL", "EPL", "CDDL")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: check-runtime-licenses.py INVENTORY")
    doc = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    missing = []
    denied = []
    review = []
    for row in doc.get("distributions", []):
        name = row.get("name") or "(unknown)"
        value = " ".join([row.get("license") or "", row.get("licenseExpression") or "", " ".join(row.get("licenseClassifiers") or [])]).strip().upper()
        value = re.sub(r"\s+", " ", value)
        if not value or value in {"UNKNOWN", "NONE"}:
            missing.append(name)
        if any(token in value for token in DENY):
            denied.append(f"{name}: {value}")
        elif any(token in value for token in REVIEW):
            review.append(f"{name}: {value}")
    report = {"missing": missing, "denied": denied, "manualReview": review}
    print(json.dumps(report, indent=2))
    if missing or denied or review:
        raise SystemExit("runtime license policy requires resolution before publication")


if __name__ == "__main__":
    main()
