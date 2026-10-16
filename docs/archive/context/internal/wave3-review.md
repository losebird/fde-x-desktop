---
cursor:
  subagentId: "bc-15edf17a-8fbb-5fb3-b242-42112f990330"
---

# Wave 3 审查（规格 04 + 07）

审查根：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`main` 至 `27d0072`）。只读代码，未提交。未停 5174/4318 上的 `pnpm dev`；仅 `curl` 健康检查。

## 对照摘要（完成定义 §5）

| 维度 | 04 声明式应用 | 07 记忆连接层 |
|---|---|---|
| 提交拆分 | 6 个 commit（`6fd4f4d`…`27d0072`），与规格 §12 条数不完全一致但关切齐全 | 4 个 commit（`7ac54bc`…`a19bed7`），web/writer/corpus 有合并提交 |
| `tsc` | 已对：`npx tsc -b --pretty false` 退出 0（本审查复跑） | 同上 |
| 自动化单测 | 已对：`runtime/tests/apps.*.test.mjs` **37/37**；`apps.spec` 内 **22** 个 `test()` | 已对：context-pack + memory-writer + corpus **8/8** |
| `smoke.mjs` | 已对：退出绿（`catchAllGone` 等） | 同上（同一次 smoke） |
| 人工 + 截图 | **未对**：Playwright/chromium 未实测（见下） | **未对**：同上 |
| BFF 现网 | 4318/4319 均 **200** `/health`；4319 fixture CRUD 见下 | `POST /api/v1/context/pack` 200，`warnings: memory_engine_not_ready`（peer semantic 未就绪，符合降级） |

### 健康检查（审查时刻）

| 端口 | HTTP | 备注 |
|---|---|---|
| **4318**（主栈 BFF） | **200** | `state: healthy`；04 agent 曾误杀过，**当前未掉** |
| **4319**（peer BFF） | **200** | 未重启 peer；apps/context 路由可用 |

### 4319 fixture CRUD（审查复跑）

`runtime/apps/fixtures.mjs` → `POST /api/v1/apps` → `activate` → `POST …/visit` → `GET` 列表：`201/200/201/200`，`total: 1`。

---

## 规格 04 · 代码核对

| 检查项 | 结论 | 证据 |
|---|---|---|
| schema / validator | 已对 | `runtime/apps/spec.mjs` |
| materializer + `execControlledDdl` | 已对 | `runtime/apps/materialize.mjs`，`runtime/db.mjs` |
| CRUD + routes | 已对 | `runtime/routes/apps.mjs`，`runtime/apps/records.mjs` |
| actions (set/biz) | 已对 | `runtime/apps/actions.mjs`；**agent** BFF `501` `agent_action_deferred`（`routes/apps.mjs` L328–332） |
| bridge `app-spec-submit` / records | 已对 | `runtime/routes/bridge.mjs` L169+ |
| `server.mjs` 仅分派 | 已对 | import `handleAppsRoutes` + `if (await handleAppsRoutes(...))`（L78、L966–973）；与 07 的 `handleContextPackRoute` / `handleCorpusRoute` / `startMemoryWriter` 并存 |
| 渲染器五件 + Runtime | 已对 | `src/components/apps/Spec{Table,Form,Detail,Kanban,Stat}.tsx`，`AppRuntime.tsx` |
| Wizard + SpecEditor | 已对 | `AppCreateWizard.tsx`（`askAiForResult`）；`SpecEditor.tsx`（422 `errors` 不抛） |
| `Data.tsx` 三 Tab | 已对 | `src/pages/Data.tsx` L132–134：应用 / 业务记录 / 操作控制 |
| 07 挂载未删 | 已对 | `server.mjs` L80–82、L105、L952–964 |
| skill + APPS 文档 | 已对 | `runtime/presets/fde-app-builder/skills/fde-app-spec/SKILL.md`，`docs/APPS.md` |
| Wave2 修复未回滚 | 已对 | `4a9879f` plan 同源代理（`runtime-api.ts` `planRequest`）；`b2d1a1a` EventSource `/api/v1/events`；`b9b9b11` `AI.tsx` + `ask-ai.ts` notice |

### 04 · 仍差 / 偏离

- **未对**：规格 §11 人工 1–10（5175 Playwright + 截图）。`/tmp/node_modules/playwright` CLI 存在；本机 **ms-playwright 浏览器目录为空**，未跑 UI。
- **仍差**：`kind: agent` 行内动作无前端 `askAiForResult` 接线（`src/components/apps/` 无 `agent` 处理）；BFF 明确 defer 到前端，属规格允许路径但未闭环。
- **已摸过**：非 `fde-app/v1` 应用仍走 `AppDraftEditor`（`Data.tsx` L405–411），与规格「改造」并存，可接受。

### 04 · 判决：**需小修**

**Must-fix（合并前建议）**

1. 补 **agent 动作**前端路径，或文档化「本版仅 set/biz」并在 spec 校验默认不生成 agent 动作 — 涉及 `src/components/apps/SpecTable.tsx` / `SpecDetail.tsx` 与 `ask-ai.ts`（若做 UI）。
2. 补规格 §11 **人工验收证据**（Playwright + `media/` 或协调器约定豁免写明原因）。

**非阻塞**

- 提交条数 vs 规格 §12（已交付能力）。
- peer 上多份 `supplier-visits` 草稿（`wave3-04-apps.md` 已提）。

---

## 规格 07 · 代码核对

| 检查项 | 结论 | 证据 |
|---|---|---|
| `buildContextPack` BFF | 已对 | `runtime/context-pack.mjs`，`runtime/routes/context.mjs` `POST /api/v1/context/pack` |
| bridge `fde_context_get` | 已对 | `runtime/routes/bridge.mjs` `sub === 'context'` |
| 前端 pack + chips | 已对 | `src/lib/context-pack.ts`，`src/components/ai/ContextChips.tsx` |
| `askAiForResult` 默认 pack | 已对 | `src/lib/ask-ai.ts` L141–146 |
| memory writer + 009 | 已对 | `runtime/memory/writer.mjs`，`runtime/migrations/009_memory_write_log.sql`，`startMemoryWriter` in `server.mjs` |
| semantic 白名单 ops | 已对 | `runtime/dsh-core.mjs` L737–740 等 |
| corpus 回读 | 已对 | `runtime/routes/corpus.mjs` |
| IM 先例真搜 | 已对 | `IMWorkspace.tsx` L1179–1207 + `im-ai.ts` L136 |
| Files 摄取 | 已对 | `src/pages/Files.tsx` L779–792 |
| Memory 打开来源 / 问 AI | 已对 | `Memory.tsx` `openRef` + `promptAi`；`CommandPalette.tsx` |
| `open-ref` | 已对 | `src/lib/open-ref.ts` |
| 中文 cwd `?cwd=` | 已对 | `dsh-core.mjs` `semanticCwd`：非 ASCII 只 `url.searchParams.set('cwd')`，ASCII 才 `x-dsh-cwd` |
| `Memory.tsx` 六画布 restyle | 已对（静态） | 未改画布结构；仅抽屉/结果区行为 |
| `Data.tsx` 业务记录交给 AI | **未做**（与 agent 报告一致） | `Data.tsx` 无 `buildContextPack` |
| Plan 整理待办 context | **未做** | `Plan.tsx` 无 `buildContextPack`（留给波次 4/03 补尾） |
| `im.message.sent` / `operation.executed` | 已对 | `server.mjs` emit；`writer.mjs` 订阅 |

### 07 · 仍差 / 偏离

- **未对**：规格 §9 人工 1–8 + 5174 IM 回归截图（Playwright）。
- **仍差**：规格 §4.3 列举的 **业务记录「交给 AI」** 未接（明确留给 05/波次 4 可接受，但相对 07 正文仍标红）。
- 提交合并（`3d62ffb`）相对 §10 七提交 — 流程偏离，无功能回滚。

### 07 · 判决：**需小修**

**Must-fix（合并前建议）**

1. 在 **波次 4（05）** 或跟票中接 `Data.tsx` 记录行 `buildContextPack(['workspace','biz','memory'], entity)` + `ContextChips` — `src/pages/Data.tsx`（记录视图区）。
2. 补 §9 人工验收或书面豁免（Playwright/chromium）。

**非阻塞**

- `Plan.tsx` 整理待办 context（规格 03 补尾）。
- peer semantic 未就绪时 `memory_engine_not_ready` 警告（行为正确）。

---

## Cross-cut：ask-ai / bridge / server

| 项 | 结论 |
|---|---|
| 路由打架 | **未发现**：`ask-ai.ts` 浏览器侧 `buildContextPack` + `promptAi`；BFF `context/pack` 与 `bridge …/context` 共用 `context-pack.mjs`；apps 在独立 `routes/apps.mjs` |
| Wave2 commits | **未回滚**：`4a9879f`、`b2d1a1a`、`b9b9b11` 仍在 `main` 历史且代码仍在 |

---

## 总表（协调器）

| 规格 | 判决 | 自动化 | 现网 BFF | 人工 UI |
|---|---|---|---|---|
| **04** | **需小修** | 绿 | 4318/4319 绿；4319 CRUD 绿 | 未对 |
| **07** | **需小修** | 绿 | 4318/4319 绿；context pack 绿 | 未对 |

## 审查命令（可复现）

```bash
cd "/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation"
npx tsc -b --pretty false
node --test runtime/tests/apps.*.test.mjs
node --test runtime/tests/context-pack.test.mjs runtime/tests/memory-writer.test.mjs runtime/tests/corpus.test.mjs
node runtime/smoke.mjs
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4318/health
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4319/health
```
