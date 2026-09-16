#!/bin/sh
cd "$(dirname "$0")/.."
# FDE_DSH_BIN 由 runtime/config.mjs 解析；此处仅透传显式覆盖
export FDE_AI_WORKSPACE="${FDE_AI_WORKSPACE:-$PWD}"
export FDE_RUNTIME_PORT="${FDE_RUNTIME_PORT:-4318}"
export FDE_RUNTIME_HOST="${FDE_RUNTIME_HOST:-127.0.0.1}"
exec node runtime/server.mjs
