#!/bin/sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export PATH
NODE=${NODE_EXECUTABLE:-node}
"$NODE" "$HERE/scripts/install-release.js" "$HERE"
printf '\nSemantic OS installation completed. You can close this window.\n'
