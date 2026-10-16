---
cursor:
  subagentId: "bc-62d6616b-be0f-54d0-bf50-984545b748e1"
---

# Wave 2 · Spec 02 审查（bridge + askAiForResult）

**审查对象**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` `main` @ `b9b9b11`（含 `901adee` `3427e76` `0847eb7` `9c51a59` `4f5ceb8`；前置 `4a9879f` `b2d1a1a` 仍在祖先链上）。

**结论：合并保留**

---

## 提交与范围

| SHA | 说明 |
|---|---|
| `901adee` | `runtime/fde-x-dsh-bridge/lib/tools.js`：`registerTools`（lan-assist 形态）+ 7×`fde_*`；`index.js` `inject: ['webServer','tools']` |
| `3427e76` | `runtime/routes/bridge.mjs`、`005_ai_results.sql`、`bridge.test.mjs`；`server.mjs` 在 Origin 写闸**之前** dispatch `/api/v1/bridge/*` |
| `0847eb7` | `ensurePresets()` + `runtime/presets/{fde-app-builder,fde-briefing}/` |
| `9c51a59` | `src/lib/ask-ai.ts`、`json-schema-lite.ts`；`events`/`runtime-api.getAiResult` |
| `4f5ceb8` | `fde-ask-dev.ts` + `main.tsx`（`import.meta.env.DEV` 才挂 `window.__fdeAsk`） |
| `b9b9b11` | `AI.tsx`：`subscribeAskAiNotice` → 既有 `statusBanner` 琥珀条 + `sessionId` 时「打开会话」 |

---

## 代码核对（规格 §3–§8）

| 检查项 | 结论 | 依据 |
|---|---|---|
| 7× Host `fde_*` + token handshake | **已对** | `tools.js` `callBridge` → `x-fde-bridge-token`；`bridge.mjs` `verifyBridgeToken` |
| BFF：`/bridge/*` token 闸；`GET /ai/results/:id` Origin 路由段 | **已对** | `server.mjs` L910–917 vs L939–944；`handleAiResultGet` |
| `005_ai_results.sql` | **已对** | 与规格 §5 DDL 一致 |
| `ensurePresets` 存在则不覆盖；`FDE_PRESET_SYNC=force` | **已对** | `presets.mjs` L15–26 |
| `askAiForResult`：preset→新会话、`[fde-request:id]`、事件+轮询、`schema_mismatch` | **已对** | `ask-ai.ts` |
| `window.__fdeAsk` 仅 dev | **已对** | `fde-ask-dev.ts` L9–11 |
| `server.mjs` bridge 段 | **已对** | 仅 `import` + `ensureBridgeToken` + `handleBridgeRoutes`/`handleAiResultGet` 分派 |
| 超时黄条 §8 | **已对** | `ask-ai.ts` L159–162 文案；`b9b9b11` `AI.tsx` L584–631 展示 + 按钮 |
| `4a9879f` / `b2d1a1a` | **已对** | `git merge-base --is-ancestor` 通过 |
| `fde_context_get` 全量上下文 | **仍差（非本波阻断）** | `bridge.mjs` `buildMinimalContext`：`im`/`biz`/`apps` 占位，待规格 07 |

---

## 验证

| 步骤 | 做了什么 | 看到什么 |
|---|---|---|
| `npx tsc -b --pretty false` | 当前 `b9b9b11` | 退出 0 |
| `node --test runtime/tests/bridge.test.mjs` | 单元 | 4/4 通过 |
| `node runtime/smoke.mjs` | 合约 | `status: ok`，迁移含 `005` |
| 伪造 token | `POST :4319/api/v1/bridge/submit-result` + `x-fde-bridge-token: forged` | **401** `bridge_unauthorized` |
| 合法 token `bridge/context` | 读 `~/.dsh-fde-peer/run/bridge.token` | **200** `workspace`/`tasks` JSON |
| Peer presets | `GET :4319/api/v1/ai/presets`；`ls ~/.dsh-fde-peer/.agent-presets` | 列表含 `fde-app-builder`、`fde-briefing`；磁盘同名目录 |
| Peer 健康 | `GET :4319/health` | `ai-runtime` **healthy**（pid 54406，`dshHome` peer） |
| Playwright 5175 | Chrome `executablePath`；`/ai` 截图 | 见 `media/wave2-02-review/` |
| §9.2 会话内 `fde_context_get` | 未在 DSH 轨迹人工点验 | **未对** |
| §9.3 `window.__fdeAsk` 30s 真提交 | `__fdeAsk` → `promptAi` | `{ok:false,error:"会话写锁由工作台 DSH 页占用…"}`，未走到超时黄条路径 |
| §9.4 `preset:'fde-app-builder'` | 未跑 | **未对** |
| §9.6 5174 IM 回归 | 遵守不重启 5174/4318 | **未测**截图 |
| 主栈 4318 bridge | 未重启 Ace 主 `pnpm dev` | Host 工具/BFF 新路由需重启后才与 `main` 一致（peer 已验） |

截图目录：`files/media/wave2-02-review/`（`02-ai-connected.png` 绿条已连接；`03-ask-timeout-banner.png` 为写锁失败态，**非**超时琥珀条）。

---

## Must-fix（合并前）

无。`b9b9b11` 已补齐 §8；其余 **未对** 项为环境/人工验收缺口，不回滚。

## 建议跟进（非 must-fix）

1. Ace 本机：重启主 runtime（4318）后于 5174 复验 bridge 与 Host 工具。
2. 5175 在 DSH 输入框无写锁时重跑 §9.3–9.4（`__fdeAsk` / `fde_submit_result`）。
3. 设置 → AI 核心 → Agent 预设 UI 截图补 §9.1（API 已证明两枚 preset 存在）。

---

## 需要 Ace 决定

无。
