#!/bin/sh
# One-command install into the local DSH web profile.
set -eu

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "先装 $1，再跑这一条。" >&2
    exit 127
  fi
}

need dsh
need pnpm

SPEC="${1:-github:losebird/dsh-lan-assist}"
echo "装进 web profile：$SPEC"
dsh plugin --profile web add "$SPEC"
echo
echo "装好了。整进程重启后再硬刷新："
echo "  dsh --profile web --host 127.0.0.1 --port 3080"
echo "用 dsh --profile web --dump-config 应能看到 id: dsh-lan-assist"
