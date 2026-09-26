---
cursor:
  subagentId: "bc-0be03ef5-36b4-521e-b1e4-8bb052755e50"
---

## 改动

- `7ac54bc` feat(runtime): context pack route + bridge context — `buildContextPack`、`POST /api/v1/context/pack`、`fde_context_get` 桥接
- `3d62ffb` feat(runtime): memory writer on events + write log + whitelist ops — 含 writer、009 迁移、dsh-core 白名单、corpus 路由与单测、web 上下文包/芯片/IM·早报/Files 摄取（提交顺序因 index.lock 与并行 agent 合并为一包）
- `52e40a4` feat(web): open-ref jumps; memory results 打开来源/问 AI
- `a19bed7` fix(im): 先例 uses real precedent search

`git diff --stat`（相对 `b9b9b11`）：runtime 新增 context-pack、writer、corpus、009；`server.mjs` 挂载与 `im.message.sent` / `operation.executed`；前端 `context-pack.ts`、`ContextChips`、`open-ref`；IM/Briefing/askAi 接线；Memory 抽屉与 ⌘K；Files「摄取此目录到记忆」。未改 `Memory.tsx` 六画布布局；未改 `Data.tsx`（规格 §7 业务交给 AI 留给 05）。

## 验证

| 步骤 | 做了什么 | 看到什么 | 截图 |
|---|---|---|---|
| `node --test` context-pack / memory-writer / corpus | 跑三份单测 | 8/8 通过 | — |
| `node runtime/smoke.mjs` | 自起 BFF 4398 | `status: ok`，迁移含 009 | — |
| `curl 4319` `POST /api/v1/context/pack` | peer BFF，semantic 未就绪场景 | `ok:true`，`warnings` 含 `memory_find_failed`，`workspace` 仍有 | — |
| `npx tsc -b` | 全量类型检查 | **失败**：`SpecEditor.tsx` 既有 `JsonValue` 错误（非 07 改动文件） | — |
| Playwright 5175 §9 | 安装缺失 chromium | **未跑**：`ms-playwright` 浏览器未安装 | `media/wave3-07/` 目录已建，无 PNG |
| 主栈 5174 回归 | 未杀 `pnpm dev` | 未截图 | 现网未测 |

降级：`memory_engine_not_ready` / find 失败时上下文包仍返回 workspace；writer `semanticOs` 失败只 `warn`（单测 `semantic failure does not throw`）。

**需要 Ace：** 改动了 `runtime/*.mjs` 后请重启 peer/主栈 BFF（4319/4318）使 writer 与 corpus 路由生效；可选 `npx playwright install` 后补 §9 截图。

## 未做到 / 偏离规格

- 规格 §10 七提交拆分为 4 个 commit（并行 agent 抢锁导致 web 与 corpus 与 writer 同提交）。
- `Data.tsx`「业务记录交给 AI」、计划「整理待办」未接（按任务说明跳过）。
- Playwright 人工验收清单 §9.1–8：**现网未测**（无浏览器截图）。
- `tsc` 全绿：**仍差**（`SpecEditor.tsx` 既有错误）。

## 需要 Ace 决定

- 是否在 04 修 `SpecEditor.tsx` 后再跑全量 `tsc`。
- peer 栈回收后是否由 Ace 补跑 Playwright 并更新 `media/wave3-07/`。
