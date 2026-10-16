---
cursor:
  subagentId: "bc-98dc6bef-21b8-5143-ad05-d2bf9f36ef44"
---

# 重载核心缺陷修复 · scene-39 验过

提交：`7e63e4fd`

## 改动

| 文件 | 内容 |
|------|------|
| `scripts/runtime-port.mjs` | 共享 TCP 探活（监督 / Vite .middleware 同一套） |
| `scripts/dev.mjs` | 复用监督补 `portWatch`（口死娃活 → SIGKILL）；`runtimeSupervisorNudge` + Vite IPC；`FDE_SKIP_RUNTIME_SPAWN=1` 避免双监督 |
| `vite.config.ts` | 口不通时 `POST /api/v1/ai/reload` → `process.send({ type: 'fde-runtime-restart' })` |
| `src/lib/runtime-api.ts` | 浏览器重载走同源 `/api/v1/ai/reload`（能打到 Vite 兜底） |

## 复验（本机 2026-09-25）

1. 清孤儿 14216/20250，重启 `pnpm dev`（tmux `fde-dev-verify`）。
2. `5174/health`、`4318/health` → 200。
3. **口已死**：`kill -9` runtime → `POST 5174/api/v1/ai/reload`（带 Origin）→ `200 {"restarting":true}` → 约 0.6s 后 health 200 → `POST connect` → `connected: true`（pid 1520）。
4. 仅一条 `runtime/server.mjs` LISTEN 4318。

未推远程。
