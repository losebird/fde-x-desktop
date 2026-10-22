"""Stage the complete target-native CI Python prefix for a runtime package."""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: stage-python-runtime.py DEST")
    dest = Path(sys.argv[1]).resolve()
    source = Path(sys.prefix).resolve()
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(
        source,
        dest,
        symlinks=True,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "pip-cache"),
    )
    relative_exe = Path(sys.executable).resolve().relative_to(source)
    staged = dest / relative_exe
    if not staged.is_file():
        raise SystemExit(f"staged Python executable missing: {staged}")
    # The path is consumed by the runtime package builder in the next CI step.
    output = os.environ.get("GITHUB_OUTPUT")
    if output:
        with open(output, "a", encoding="utf-8") as handle:
            handle.write(f"python={staged}\n")
    print(staged)


if __name__ == "__main__":
    main()
