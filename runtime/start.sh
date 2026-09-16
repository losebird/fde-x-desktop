#!/bin/sh
cd "$(dirname "$0")/.."
export FDE_DSH_BIN="${FDE_DSH_BIN:-/opt/homebrew/bin/dsh}"
export FDE_AI_WORKSPACE="${FDE_AI_WORKSPACE:-$PWD}"
export FDE_RUNTIME_PORT="${FDE_RUNTIME_PORT:-4318}"
export FDE_RUNTIME_HOST="${FDE_RUNTIME_HOST:-127.0.0.1}"
exec node runtime/server.mjs
