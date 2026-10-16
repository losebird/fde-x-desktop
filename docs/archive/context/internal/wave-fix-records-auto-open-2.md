---
cursor:
  subagentId: "bc-b745996e-1673-5040-8cd8-059d717902c1"
---

# Wave 2：AI 现查后自动打开业务记录（修复 4d4f1c0 未生效）

## 根因（Ace 现网）

1. **SSE 工作区过滤丢事件**：`biz.sheet.pending` 以 `workspaceCwd: FDE_AI_WORKSPACE` 发出，前端 EventSource 带 `?workspace=<store.cwd>`。路径不一致时 `matchesWorkspaceFilter` 在服务端直接丢弃，**`focusBizRecordsPanel` 从未被调用**。
2. **`focusBizRecordsPanel` 非原子更新**：`setActiveDataSubview` 与 `togglePanel` 分两次 `set()`；业务应用已 `full` 且停在「应用」子 Tab 时，子视图切换可能被后续 panel 更新盖住。
3. **监听器挂载偏晚**：仅 `IMScreen` 内 `useEvents` 订阅；首屏 hydration 前到达的事件会错过（无模块级兜底）。
4. **轮询指纹过粗 + 间隔 3s**：`现查` 无 `preview_id` 时同型同行数不 re-emit；DSH 直调 `/preview` 仅依赖 state-watch，体感延迟大。

## 改动

| 文件 | 行为 |
|------|------|
| `runtime/routes/biz.mjs` | 抽出 `emitBizSheetPending()`；**envelope `workspaceCwd: null`** 保证所有 SSE 客户端收到；`recordSurfaceFromPreview` 支持 `emitEvent: false` 避免 watch 双发 |
| `runtime/lan-assist-state-watch.mjs` | 用共享 emit；指纹含 `previewId`/首行 `no`；轮询 **1s**；导出 `flushPendingSheet` |
| `runtime/server.mjs` | `onPendingSheet` 只持久化 surface（`emitEvent: false`） |
| `src/store/app.ts` | `focusBizRecordsPanel` **单次 `set()`**：`records` + 打开/置顶 `data` 面板 |
| `src/lib/events.ts` | `registerFdeEventListener()` 供非 React 订阅 |
| `src/lib/biz-records-auto-open.ts` | 模块级 `biz.sheet.pending` + `ai.tool.finished` 兜底（拉 `pending-sheet`） |
| `src/main.tsx` | 启动时 `ensureBizRecordsAutoOpen()` |
| `src/components/IMScreen.tsx` | 复用共享 handler |
| `src/pages/Data.tsx` | 面板打开且 session 有 pending 时强制切到「业务记录」 |

未改：`RecordsPanel` 表体/预览 UI；未杀 4318（runtime 源码变更需 Ace 侧 reload BFF 后 SSE 才带新 emit 语义）。

## 验证

- `node --test runtime/tests/biz.test.mjs runtime/tests/events.test.mjs` — 12/12 通过
- 现网 UI：未在本 worker 重跑 Ace 路径

## Commit

`fix(web): actually open records on AI biz preview`

## 已上 main

`0d07ca9` — `git checkout main && git cherry-pick 620ade6`，无冲突；`e214ffb`（RecordsPanel 分页/人性化预览）仍在历史中。
