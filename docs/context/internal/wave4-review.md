---
cursor:
  subagentId: "bc-707bc319-66a1-5c6c-8603-5d3c10c82b18"
---

# Wave 4 审查（Ace Mac · read-only）

**源码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` · 分支 `main` · 审查时间 2026-09-17  
**约束**：未 commit；未停 `pnpm dev` / 5174 / 4318；仅 curl 探活。

**子报告**：[`wave4-05-biz.md`](wave4-05-biz.md) · [`wave4-06-briefing.md`](wave4-06-briefing.md) · [`wave4-03-organize.md`](wave4-03-organize.md) · [`wave4-08-tools.md`](wave4-08-tools.md) · [`wave4-04-agent-actions.md`](wave4-04-agent-actions.md)

---

## 总判定（协调器用）

| 票 | 判定 | 一句话 |
|---|---|---|
| **05 业务记录** | **需小修** | 自动化与代码接点齐；规格 §8 人工 + 5174 现网未测。 |
| **06 早报** | **需小修** | 定义驱动 / 调度 / Skill / 无 BFF 出网已代码核实；MCP 全量与 Playwright 未对。 |
| **03 整理待办（尾）** | **合并保留** | drawer + 逐条「应用」+ 无自动 PATCH；全链路 AI 成功路径仍依赖 DSH。 |
| **08 MCP tools（尾）** | **需小修** | `[]` 非占位、单测绿；核心未连时现网投影未测。 |
| **04 agent 动作（尾）** | **需小修** | BFF `kind:agent` → jobs + 前端 `askAiForResult` 已落地；Live 端到端与主栈重启态未在本审查实测。 |

**跨票**：`4a9879f` / `b2d1a1a` / `b9b9b11` 均为 `HEAD` 祖先（未回滚）。`server.mjs` 已挂 `handleBizRoutes` / `handleBriefingRoutes` / `handleMcpRoutes` / `handleAppsRoutes` + `startBriefingScheduler`。

---

## 自动化验证（本审查实测）

| 项 | 结果 |
|---|---|
| `npx tsc -b --pretty false` | 退出 **0** |
| `node --check`（biz/briefing/mcp/apps/actions/run） | **通过** |
| `node --test` biz + briefing + mcp + apps.actions | **21/21** |
| `node runtime/smoke.mjs` | **ok**；`liveExecutionBlocked: false` |
| `curl` 4318/4319 `/health` | **200** |
| 4318/5174、4319/5175 前端根 | **200** |
| Playwright Chromium | **未对**（`ms-playwright/chromium_headless_shell` 不存在） |

### 样本 GET（4318，Origin 5174）

| 路径 | HTTP | 备注 |
|---|---|---|
| `/api/v1/biz/surfaces?workspace=/tmp` | 200 | `{ data: … }` |
| `/api/v1/biz/kinds?workspace=/tmp` | 503 体 | `lan_assist_unavailable`（核心未连，路由存在） |
| `/api/v1/briefing/definition?workspace=/tmp` | 200 | 含 `sections` / `schedule` / `sources` |
| `/api/v1/mcp/servers` | 200 | v2：`mcp:[]`，`connectors:[…]` |
| `/api/v1/biz/traces?workspace=/tmp`（4319） | 503 | 与 lan-assist 离线一致 |

---

## 05 · 业务记录（代码核对）

| 检查项 | 状态 | 证据 |
|---|---|---|
| `runtime/routes/biz.mjs` | 已对 | 自 `0b69af5` 起；`server.mjs` → `handleBizRoutes` |
| `/biz/kinds` → `/catalog` | 已对 | `biz.mjs` L124；`dsh-core.mjs` 白名单含 `/catalog`、`/traces` |
| `/biz/traces` | 已对 | `biz.mjs` L136+ |
| `/biz/surfaces` + `biz_surfaces` | 已对 | `010_biz_surface.sql`（仅元数据 `columns_json`，**无业务行缓存**） |
| `execute live` → `biz_write` | 已对 | `server.mjs` L2298+ `executeOperationLive`；smoke 非 501 |
| `RecordsPanel` + `ContextChips` | 已对 | `RecordsPanel.tsx` `buildContextPack` + `ContextChips` |
| `Data.tsx` 三 Tab | 已对 | `overview` / `records` / `operations` + `RecordsPanel` / `OperationControlPanel` |
| 规格 §8 人工 1–7 | **未对** | 子报告无 Playwright；本审查未 UI |
| 5174 回归 | **现网未测** | 仅 curl BFF |

**仍差**：lan-assist 在线下的 AI 浮现 / traces 200 / 行内改行抽屉 — 需 Ace 环境或 peer 已连核心后补截图。

---

## 06 · 早报（代码核对）

| 检查项 | 状态 | 证据 |
|---|---|---|
| 定义驱动 `Briefing.tsx` | 已对 | `definition` / `resultSections`；无 `scene#39` / 死「今日」按钮（仅文件头注释） |
| 无自动 `imSend` | 已对 | `Briefing.tsx` `imCompose`；`runtime/briefing/**` 无 `imSend` |
| BFF 不出网拉 mail/RSS | 已对 | `collectors.mjs` / `run.mjs` 无 HTTP 外拉；MCP 走 `askAiForResult` |
| `routes/briefing.mjs` + scheduler | 已对 | `scheduler.mjs` `TICK_MS=60_000`；`startBriefingScheduler` @ `server.mjs` L2575 |
| `fde-briefing` Skill | 已对 | `runtime/presets/fde-briefing/skills/fde-briefing/SKILL.md` |
| `BriefingSettingsDrawer` | 已对 | 子报告 `7a4e53a` |
| MCP/RSS 端到端、调度 2min 人工 | **未对** | 子报告 + 本审查 |
| Playwright §10 | **未对** | 无 Chromium |

---

## 03 · 整理待办（尾）

| 检查项 | 状态 | 证据 |
|---|---|---|
| 待办 Tab「整理待办」 | 已对 | `Plan.tsx` L312+ |
| `askAiForResult` + `TaskAdviceSchema` | 已对 | L124–236 |
| 抽屉 + 逐条「应用」 | 已对 | `applySuggestion` → `updateTask`；无批量自动 PATCH |
| AI 返回后 PATCH 成功 | **未对** | peer 核心未连；子报告有 toolbar/抽屉截图 |

**判定理由**：规格 §6 行为与禁区在代码层满足；缺的是 DSH 在线的 happy path，属环境而非回滚级缺陷。

---

## 08 · MCP tools 投影（尾）

| 检查项 | 状态 | 证据 |
|---|---|---|
| `tools: string[]`，无 `mcp__name` 占位 | 已对 | `mcp.mjs` `groupMcpToolsByServer`；rg 无 `mcp__name` |
| 未连核心 → `[]` | 已对 | curl 4318/4319；单测 `buildMcpServersV2` |
| 连核心 + patch 后真实工具名 | **现网未测** | `ai/status` 类路径显示未连 / 无 MCP 条目 |

---

## 04 · agent 动作（尾）

| 检查项 | 状态 | 证据 |
|---|---|---|
| BFF `kind:agent` 非 501 | 已对 | `routes/apps.mjs` L329–337 → `{ step:'agent', jobs }` |
| 前端 `askAiForResult` | 已对 | `app-agent-action.ts`；`apps.actions.test.mjs` 5/5 |
| Live 点击动作 + writeBack PATCH | **未对** | 需 DSH + 已激活 spec 应用；子报告注明主栈 runtime 改动可能需重启 |

**仍差（范围外本票）**：`kind:biz` 表格动作仍 preview intents API，未接 sheet UI（wave4-04 报告已标）。

---

## 提交与范围（main 顶）

Wave 4 相关 commit（节选）：`91c4ec6` 整理待办 · `17a36e2` MCP 投影 · `55777a5` agent 动作 · `553f387`…`2511f82` 早报 · `0b69af5`…`036afa2` 业务记录。

---

## 建议后续（非本审查动作）

1. **05 / 06**：5175 + lan-assist 或本地应用实体走一遍规格人工清单并落 `media/wave4-*`。
2. **08**：MCP 页配置 server → 重载核心 → curl `mcp/servers` 应见非空 `tools`。
3. **04**：确认 4318 进程已加载 `routes/apps.mjs` agent 分支后点一次 agent 动作。
4. 可选：`playwright install chromium` 后补 Playwright 回归。

---

## 需要 Ace 决定

- 无（均为验收排期 / 环境，无规格语义冲突需拍板）。
