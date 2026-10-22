#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PATH="/usr/local/bin:$PATH"
export PATH
NODE=${NODE_EXECUTABLE:-node}
exec "$NODE" "$HERE/scripts/install-release.js" "$HERE"
