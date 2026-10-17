#!/usr/bin/env bash
# Stage this checkout and connect dsh through the bundled Node and through Electron.
# HOME points at an empty temporary directory. The script does not read or print secrets,
# and it does not publish, sign, or notarize.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
LOG_DIR=$(mktemp -d "${TMPDIR:-/tmp}/fde-mac-check.XXXXXX")
PACK="$LOG_DIR/resources"
STATUS=0

say() { printf '%s\n' "$*"; }

finish() {
  if [ "$STATUS" -eq 0 ]; then
    say PASS
  else
    say FAIL
  fi
  say "logs: $LOG_DIR"
}
trap finish EXIT

export HOME="$LOG_DIR/home"
mkdir -p "$HOME"
export FDE_PACK_OUT="$PACK"
export FDE_DOWNLOAD_SEMANTIC_RUNTIME=0
export FDE_STAGE_DSH_FROM_NPM=1
export FDE_RESTAGE_DSH=1
unset FDE_RESOURCES FDE_APP_ROOT FDE_DSH_BIN FDE_DSH_HOME FDE_GATE_NODE FDE_GATE_ELECTRON

say "staging into $PACK"
if ! (cd "$ROOT" && node scripts/pack/stage.mjs >"$LOG_DIR/stage.log" 2>&1); then
  say "stage failed"
  STATUS=1
  exit 1
fi

NODE="$PACK/node/bin/node"
if [ ! -x "$NODE" ]; then
  say "bundled node missing"
  STATUS=1
  exit 1
fi
{
  node -v
  "$NODE" -v
} >"$LOG_DIR/node-version.txt"

run_gate() {
  local name="$1"
  shift
  say "connect via $name"
  if ! env "$@" node "$ROOT/scripts/pack/connect-gate.mjs" >"$LOG_DIR/$name.json" 2>"$LOG_DIR/$name.err"; then
    say "$name gate exited nonzero"
    STATUS=1
  fi
  if grep -q ERR_REQUIRE_ASYNC_MODULE "$LOG_DIR/$name.json" "$LOG_DIR/$name.err" 2>/dev/null; then
    say "$name contains ERR_REQUIRE_ASYNC_MODULE"
    STATUS=1
  fi
  if ! node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); if(!(d.ok&&d.health===200&&d.connected===true&&d.hasRequireAsync===false)) process.exit(1)' "$LOG_DIR/$name.json"; then
    say "$name did not connect"
    STATUS=1
  fi
}

run_gate bundled-node FDE_PACK_OUT="$PACK" FDE_GATE_NODE="$NODE" HOME="$HOME"

ver=$(node -p "const pkg=require('$ROOT/apps/desktop/package.json'); (pkg.devDependencies&&pkg.devDependencies.electron)||(pkg.dependencies&&pkg.dependencies.electron)||''")
ELEC=""
for candidate in \
  "$ROOT/apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" \
  "$ROOT/apps/desktop/node_modules/electron/dist/electron"
do
  if [ -x "$candidate" ]; then
    ELEC="$candidate"
    break
  fi
done

if [ -z "$ELEC" ]; then
  say "installing electron@$ver into the log directory"
  mkdir -p "$LOG_DIR/electron-pkg"
  if ! (
    cd "$LOG_DIR/electron-pkg"
    npm init -y >"$LOG_DIR/electron-install.log" 2>&1
    npm install --no-audit --no-fund "electron@$ver" >>"$LOG_DIR/electron-install.log" 2>&1
  ); then
    say "electron install failed"
    STATUS=1
  else
    for candidate in \
      "$LOG_DIR/electron-pkg/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" \
      "$LOG_DIR/electron-pkg/node_modules/electron/dist/electron"
    do
      if [ -x "$candidate" ]; then
        ELEC="$candidate"
        break
      fi
    done
  fi
fi

if [ -z "$ELEC" ]; then
  say "electron binary missing"
  STATUS=1
else
  run_gate electron \
    FDE_PACK_OUT="$PACK" \
    FDE_GATE_ELECTRON=1 \
    FDE_GATE_NODE="$ELEC" \
    HOME="$HOME"
fi

exit "$STATUS"
