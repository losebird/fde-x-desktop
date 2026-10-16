---
cursor:
  subagentId: "bc-10bfede1-b210-51c1-a107-ab3b0ea3a024"
---

# Wave 4 · 规格 04 agent 行内动作

源码：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation` · commit `55777a5`

## 改动

- **BFF**：`POST …/actions/:name` 在 `kind: agent` 时返回 `200` + `{ step: 'agent', jobs: [{ rid, preset, prompt, writeBack? }] }`；`renderRowTemplate` / `buildAgentActionJobs` 在 `runtime/apps/actions.mjs`（`$field` 替换，与 biz map 一致）。
- **前端**：`src/lib/app-agent-action.ts` 对 jobs 串行 `askAiForResult`（`context: ['workspace','apps']`，`preset` 开新会话）；`writeBack` 时展示「AI 建议」+「写入」/「取消」后 `patchAppRecord`。
- **接线**：`SpecTable`（多选行）、`SpecDetail`（当前行动作按钮）。

## 验证

| 项 | 结果 |
|---|---|
| `npx tsc -b --pretty false` | 已对 · 退出 0 |
| `node --test runtime/tests/apps.actions.test.mjs` | 已对 · 5/5（含 agent 模板/jobs） |
| `node --check` actions.mjs / routes/apps.mjs | 已对 |
| 现网 DSH / 5174 agent 动作点击 | **未对** · 未接 Live AI；主栈 `runtime/routes/apps.mjs` 改动需 Ace **重启主栈** 后 4318 才返回 jobs 而非 501 |
| 规格 §11 Playwright 人工 | **未对**（继承 wave3-review） |

## 对照（wave3 must-fix 1）

| 项 | 母体（规格 04 §7–8） | fdex |
|---|---|---|
| agent 动作 | `askAiForResult` + writeBack 人确认 PATCH | `app-agent-action.ts` + SpecTable/SpecDetail |
| BFF agent | 执行器描述为前端 AI | 由 501 defer 改为返回 jobs 载荷 |

## 未做到 / 仍差

- **未对**：端到端 Live AI（DSH 锁或未重启 BFF 时无法验收完整 loop）。
- **仍差**：`kind: biz` 表格动作仍只调 API、未接 preview sheet（本票范围外）。
- **已摸过**：无 `writeBack` 的 agent 动作仅发 AI、不写行（符合 §7 无 writeBack 语义）。

## 需要 Ace 决定

- 重启主栈以加载 `apps.mjs` agent 分支（若尚未重启）。
