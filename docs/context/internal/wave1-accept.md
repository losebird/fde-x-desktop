---
cursor:
  subagentId: "bc-56477c6f-4435-55a2-a25f-ddb36b4a1f4e"
---

# Wave 1 验收（01/03 must-fix 后）

**代码根**：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`main`）  
**HEAD（含 must-fix）**：`5981ef5` `5f94271` `96fe7db` `0c1a6f4` `86f5136` + 更早 Wave 1 提交  
**验收时间**：2026-09-17  
**方式**：只读产品代码；未 commit；主栈 `pnpm dev` / 5174 / 4318 **未动**；peer **4319 曾回收一次**（accept 中断 4319 重连抽检，已 `nohup node runtime/server.mjs` 恢复，health 200）。

## 总裁决

| 规格 | 裁决 | 依据摘要 |
|------|------|----------|
| **01** 事件总线 | **需小修** | must-fix 六项代码 **已对**；id 仍 `evt_*`（不单独否 wave）；§8 人工未全绿（浏览器 EventSource 探针 error、无 `biz_describe`/跨栈 IM 实流）。 |
| **03** 计划 SQLite | **需小修** | must-fix `emit` + `Plan.tsx` useEvents **已对**；§8 仅部分（sqlite/API/周表头/工作流 Tab）；IM 摘待办、⌘K 高亮、UI 列表与 walk 不一致 **未对**。 |
| **08** preset + MCP | **需小修** | 自动化/smoke 绿；§7 部分截图（导入/预览/设置/MCP 两区）；§7.1 `fde-*`、Git clone、streamable-http 重载在线 **跳过/未对**。 |

**无一档建议「回滚重做」。**

---

## 1. Must-fix 代码核对（非报告）

| 项 | 规格 | fdex 出处 | 结论 |
|----|------|-----------|------|
| `ai.tool.*` emit | 01 | `runtime/ai-stream.mjs` L95、L109 `emit('ai.tool.called'|'ai.tool.finished'` | **已对** |
| lan-assist 指纹 emit | 01 | `runtime/lan-assist-state-watch.mjs` + `server.mjs` `startLanAssistStateWatch` | **已对** |
| `biz.write.done` | 01 | `server.mjs` ~L1773 | **已对** |
| IM/Briefing 事件 | 01 | `IMScreen.tsx` `useEvents(['im.unread.changed'])`；`Briefing.tsx` 订 `im.unread.changed` + `im.message.received`；**无** IM `setInterval` 主路径 | **已对** |
| 并行 `events.test` 稳定 | 01 | `runtime/events.mjs` `evt_${ts36}_${seq36}`；`events.test.mjs` 无 `concurrency:1` | **已对**（2×12/12） |
| `task.changed` → bus | 03 | `runtime/routes/plan.mjs` L122 `emit('task.changed', …)` | **已对** |
| Plan 订阅 | 03 | `src/pages/Plan.tsx` `useEvents` → `hydratePlan` | **已对** |
| 事件 id ULID | 01 §4.1 | 仍 `createEventId` → `evt_*`，非 ULID 字面 | **仍差**（按指派不否 wave） |

提交对应：`96fe7db` `5f94271` `5981ef5` `86f5136` `0c1a6f4`。

---

## 2. 自动化

| 步骤 | 命令 | 看到什么 |
|------|------|----------|
| TS | `npx tsc -b --pretty false` | 退出 0 |
| 单测 ×2 | `node --test` events+plan+presets+mcp（默认并行） | 12/12 + 12/12 |
| Smoke | `node runtime/smoke.mjs` | `status: ok`，迁移含 4、6 |
| 4319 health | `curl http://127.0.0.1:4319/health` | 200 |
| Plan 样例 | `GET …/plan/tasks?workspaceId=2adccbf8-…` | `{ ok:true, data:[…验收 A…] }` |
| Presets | `GET …/ai/presets`（connect 后） | 5 条，含 `w1-accept-demo` `source:user` |
| MCP v2 | `GET …/mcp/servers` | `{ mcp, connectors }` |
| SSE 直连 4319 | `curl -N -H Origin:5175 …/events?workspace=/tmp/ws` | `text/event-stream`，`: connected` + `id:`/`event:`/`data:` |
| SSE 经 5175 代理 | `curl -N http://127.0.0.1:5175/api/v1/events?…` | 同上，**200** |

---

## 3. 人工 / Playwright（5175）与 5174 回归

截图：`files/media/wave1-accept/` 与 `/tmp/fdex-w1-*.png`（同步拷贝）。

### 01 §8

| # | 做了什么 | 看到什么 | 截图 |
|---|----------|----------|------|
| 8.1 | 打开 `/ai`，connect，刷新 | Playwright 捕获一条 `/events` **status=403**；页内 `EventSource` 探针 `readyState:2 error`。同环境 **curl 经 5175/4319 SSE 200**。 | `01-ai-events-page.png` |
| 8.2 | 未跑 live `biz_describe` 工具流 | **未对**：无 DSH 侧完整 AI 回合 | — |
| 8.3 | 未做 5174→5175 IM 跨栈红点 | **未对**：无配对接发 + 对比截图 | — |
| 8.4 | 验收中 **kill 4319** 后 `node runtime/server.mjs` 拉起 | health 200；背景 `curl` SSE 日志有 `: connected`（非前端 5s 重连 UI 证据） | — |
| 8.5 | 5174 `/ai` 单张回归 | 已截图；4318 进程启动 **14:04**（晚于 `5981ef5` 14:00），相对不「陈旧 runtime」，但未逐条对照 IM 红点 | `5174-regression.png` |

### 03 §8（跳过 §8.7 整理待办 → 02）

| # | 做了什么 | 看到什么 | 截图 |
|---|----------|----------|------|
| 8.1 | `POST /plan/tasks` + 开计划面板 + `/plan` | sqlite `select title from tasks` → **验收 A**；GET API 有多条；Playwright **未稳定看到**列表/⌘K 命中（walk 时 store 探针 taskCount=0，疑面板 mount/时序，**未对** UI 清单字面） | `03-plan-*.png` |
| 8.2 | 顶栏切第二工作区再切回 | 切走未见「验收 A」；切回仍未见（与 8.1 UI 同源问题） | `03-plan-ws-switch-away.png` |
| 8.3 | 开 IM 找「摘成待办」 | **未对**：无选中消息/按钮不可见 | `03-im-panel.png` |
| 8.4 | 计划 → 日程 Tab | 表头含「周」等日期文案 | `03-plan-week-header.png` |
| 8.5 | 工作流 Tab | 「运行」存在（disabled 态 walk 记 `false`） | `03-plan-workflow-tab.png` |
| 8.6 | ⌘K 搜「验收」 | palette **未**命中验收 A | `03-cmdk-search.png` |

### 08 §7（跳过 §7.1 `fde-*`；Git 未开 `FDE_ALLOW_GIT_IMPORT`）

| # | 做了什么 | 看到什么 | 截图 |
|---|----------|----------|------|
| 7.1 | 设置 → AI 核心 → 预设列表 | 随包 4 条 + 来源 Tag；**无** `fde-app-builder`（依赖 02） | `08-settings-presets.png` |
| 7.2–3 | `/tmp/w1-accept-demo` 检查→导入 | 预览+导入截图；磁盘 `~/.dsh-fde-peer/.agent-presets/w1-accept-demo`；API 5 条含 `user` | `08-preset-import-preview.png` `08-preset-import-done.png` |
| 7.4 | Git Tab | 脚本未点到 Tab（超时）；**未对**单独 Git 提示截图 | — |
| 7.5 | 未测删 shipped 403 | **未对** | — |
| 7.6 | 打开 MCP 页 | 「MCP 服务器」「业务连接器」区可见 | `08-mcp-page.png` |
| 7.6 细项 | 未保存 streamable-http + 重载在线 | **未对** | — |
| 7.7 | 5174 设置/MCP 细 walk | 仅 `/ai` 回归一张 | `5174-regression.png` |

---

## 4. 仍差 / 未对（汇总）

- **01**：ULID 字面；§8.2–8.3 实流；浏览器 SSE 与 curl 不一致待 Ace/前端查（降级轮询可能已兜底）。
- **03**：§8.1/8.2/8.3/8.6 UI 证据不足；`整理待办` 仍 defer 02（**不算** wave 缺陷）。
- **08**：§7.1/7.4–7.5/7.6 重载实流；`runtime-api.ts` 提交历史与 §8 四提交交叉（wave1-review 已述）。

---

## 5. 需要 Ace

- 主栈 **4318** 若在 must-fix 前长期未重启：本次见 14:04 拉起，一般已含 `96fe7db+`；若 UI 行为仍旧，请自行重启 BFF。
- peer **5175** Vite 未回收；仅 4319 在验收中重启过。

---

## 6. 媒体与证据路径

- 报告：`internal/wave1-accept.md`
- 截图目录：`files/media/wave1-accept/`（14 张）
- Walk 日志：`/tmp/wave1-accept-walk-final.out`、`/tmp/wave1-accept-log.json`（若存在）
