"""Copy installed license texts and validate reviewed license policy pins."""
from __future__ import annotations

import importlib.metadata
import json
import re
import shutil
import sys
from pathlib import Path

REVIEW_MARKERS = ("GPL", "LGPL", "MPL", "EPL", "CDDL")
DENY_MARKERS = ("AGPL", "SSPL", "BUSINESS SOURCE", "COMMON CLAUSE")


def normalize_name(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def license_value(dist: importlib.metadata.Distribution) -> str:
    meta = dist.metadata
    classifiers = [
        value.removeprefix("License :: ")
        for value in (meta.get_all("Classifier") or [])
        if value.startswith("License :: ")
    ]
    expression = meta.get("License-Expression") or ""
    short = meta.get("License") or ""
    if len(short) > 200 or "\n" in short:
        short = ""
    return " ".join([expression, *classifiers, short]).strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: collect-runtime-licenses.py POLICY OUTPUT_DIR")
    policy = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    reviewed = {normalize_name(name): rule for name, rule in (policy.get("reviewed") or {}).items()}
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    seen_review = set()
    unresolved = []
    denied = []
    for dist in importlib.metadata.distributions():
        name = normalize_name(dist.metadata.get("Name") or "")
        value = license_value(dist)
        upper = value.upper()
        if any(marker in upper for marker in DENY_MARKERS):
            denied.append(f"{name}=={dist.version}: {value[:200]}")
        requires_review = not value or any(marker in upper for marker in REVIEW_MARKERS)
        if requires_review:
            rule = reviewed.get(name)
            if not rule or rule.get("version") != dist.version:
                unresolved.append(f"{name}=={dist.version}: {value[:200] or 'missing metadata'}")
            else:
                seen_review.add(name)
        package_dir = output / f"{name}-{dist.version}"
        for file in dist.files or []:
            lower = str(file).lower()
            base = Path(lower).name
            if lower.endswith((".pyc", ".pyo")):
                continue
            in_license_dir = ".dist-info/licenses/" in lower
            named_notice = base.startswith(("license", "licence", "copying", "notice"))
            if not in_license_dir and not named_notice:
                continue
            source = Path(dist.locate_file(file))
            if source.is_file():
                package_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, package_dir / source.name)
    stale = sorted(set(reviewed) - seen_review)
    report = {"denied": denied, "unresolved": unresolved, "stalePolicy": stale, "reviewed": reviewed}
    (output / "review-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    if denied or unresolved or stale:
        print(json.dumps(report, indent=2))
        raise SystemExit("runtime license policy requires review")
    print(f"runtime license policy verified: {len(reviewed)} reviewed package(s)")


if __name__ == "__main__":
    main()
