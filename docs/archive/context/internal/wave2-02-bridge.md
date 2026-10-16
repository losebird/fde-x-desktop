---
cursor:
  subagentId: "bc-ea9c0f11-8898-598a-a4a4-cc563038f9c9"
---

# Wave 2 · Spec 02（bridge + askAiForResult）

## 改动

| 提交 | SHA | 说明 |
|---|---|---|
| `feat(bridge): fde_* host tools + token handshake` | `901adeebab300e0fb04fedc30170237c21bf22c3` | `runtime/fde-x-dsh-bridge/lib/tools.js` + `index.js` 注册 7 个 `fde_*` 工具；`inject` 含 `tools` |
| `feat(runtime): bridge routes + ai_results` | `3427e76d27ab2de9e63beb90bc1900bb7260ff3b` | `runtime/routes/bridge.mjs`、`005_ai_results.sql`、`bridge.test.mjs`；`server.mjs` 在 Origin 闸前 dispatch bridge |
| `feat(runtime): ensure fde-app-builder/fde-briefing presets` | `0847eb7ae4a5c53b3f9525a5621b811b43e35067` | `ensurePresets()` + `runtime/presets/{fde-app-builder,fde-briefing}/` |
| `feat(web): askAiForResult primitive` | `9c51a59ec1591a6ffb76d0cb403eab9fb0d734b2` | `src/lib/ask-ai.ts`、`json-schema-lite.ts`；`events.ts` 增 `ai.result.ready` + `waitForFdeEvent`；`runtime-api.getAiResult` |
| `chore(web): dev-only window.__fdeAsk` | `4f5ceb8566b41d43e5285fbba3f9497c07252211` | `src/lib/fde-ask-dev.ts` + `main.tsx` |

`git diff --stat`（相对 `901adee^..4f5ceb8`）：bridge/runtime/web 共 17 文件，约 +1.5k 行（含两份 standard `agent.cordis.yml` 拷贝）。

## 验证

| 步骤 | 命令 / 操作 | 结果 |
|---|---|---|
| 类型 | `npx tsc -b --pretty false` | 退出 0 |
| 语法 | `node --check runtime/routes/bridge.mjs` | 通过 |
| 单元 | `node --test runtime/tests/bridge.test.mjs` | 4/4 通过 |
| 合约 | `node runtime/smoke.mjs` | `status: ok`，迁移含 `005` |
| 伪造 token | `curl -X POST http://127.0.0.1:4319/api/v1/bridge/submit-result -H 'x-fde-bridge-token: forged' …`（peer 重启后） | **401**，`error: bridge_unauthorized` |
| Peer 集成 | 重启 `fde-peer-dev` tmux → `GET :4319/health` | 200；迁移 5=`005_ai_results.sql` |
| Preset 落盘 | `ls ~/.dsh-fde-peer/.agent-presets` | 含 `fde-app-builder`、`fde-briefing` |
| Playwright 5175 | `/tmp/node_modules/playwright` headless | **未跑**：本机缺 `ms-playwright` chromium（`npx playwright install` 未执行） |
| 规格 §9 人工 2–4 | 会话内 `fde_context_get` / `window.__fdeAsk` 真 AI | **未对**：peer 栈 `ai-runtime` adapter `unavailable`（本机未发现 DSH）；未测 409 类冲突 |
| 5174 回归 | 未重启主栈 4318 | **未测**截图（遵守不杀 `pnpm dev`）；需 Ace 重启主 runtime 后 bridge 才生效于 4318 |

## 未做到 / 偏离规格

- **未对**：§9 Playwright 逐步截图（浏览器二进制缺失）。
- **未对**：§9.2–9.4 依赖 live DSH 工具调用与 `__fdeAsk` 30s 端到端（peer 核心未连接）。
- **仍差**：`askAiForResult` 超时黄条仅写入 `getAskAiNotice()` 状态，**AI 页尚未订阅展示**（无 restyle 前提下未改 `AI.tsx`）。
- **仍差**：`fde_context_get` 仅最小 `workspace`/`tasks` 包；`im`/`biz`/`apps` 为占位说明，非规格 07 完整包。
- **说明**：主栈 5174/4318 未重启；peer 4319 已用新代码验收 token。主栈需重启后 Host 工具与 BFF 路由才一致。

## 需要 Ace 决定

- 无（若要先验 §9，请在本机 DSH 可用时于 5175 重跑 `window.__fdeAsk` 与会话内 `fde_context_get`）。

## 命令摘录

```bash
cd /Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation
npx tsc -b --pretty false
node --test runtime/tests/bridge.test.mjs
node runtime/smoke.mjs
curl -s -w '\n%{http_code}\n' -X POST http://127.0.0.1:4319/api/v1/bridge/submit-result \
  -H 'content-type: application/json' -H 'x-fde-bridge-token: forged' \
  -d '{"requestId":"x","kind":"json","data":{},"workspaceCwd":"/tmp"}'
# → {"ok":false,"error":"bridge_unauthorized",...} 401
```
