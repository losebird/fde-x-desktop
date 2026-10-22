#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
mkdir -p "$root/dist" "$root/.tmp-npm/cache" "$root/.tmp-npm/logs"
npm pack \
  --cache "$root/.tmp-npm/cache" \
  --pack-destination "$root/dist"
ls -lh "$root/dist"/dsh-lan-assist-*.tgz
