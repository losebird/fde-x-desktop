---
cursor:
  subagentId: "bc-2378eed4-a4e5-555d-9ebc-9ea87df23aca"
---

# Wave：AI 现查后自动打开业务记录并渲染 pending sheet

## 问题（Ace）

AI 会话里现查成功（例：工单 7 行），但**业务记录**未自动打开；切到 Tab 后型芯片显示「工单」却 **0 行**，表体「当前型还没有可展示的行」。截图：[ace-records-empty-after-preview.png](../media/ace-records-empty-after-preview.png)。

根因（代码）：

1. `biz.sheet.pending` 只带 `rows: count`，不带行数据；`RecordsPanel` 未挂载时（仍在「应用」Tab 或面板关闭）会错过事件，挂载后也未主动拉 pending。
2. 无全局动作：`togglePanel('data')` + 切到「业务记录」子视图。
3. `hasSurfacedData` 仅凭 `biz_surfaces` 元数据即可进表壳，行未 hydrate 时出现 chip + 空表。

## 改动

| 区域 | 行为 |
|------|------|
| `IMScreen` | 订阅 `biz.sheet.pending` → `focusBizRecordsPanel()`；若有 `payload.sheet` 写入 session 缓存 |
| `app.ts` | `activeDataSubview` / `setActiveDataSubview` / `focusBizRecordsPanel`（浮窗 `data` 时 `focusFloating`，否则 `togglePanel('data','full')` + `records`） |
| `Data.tsx` | 子视图跟 store，不再仅用本地 `useState` |
| `biz-session-sheet.ts` | 会话内 pending sheet 内存（不持久化） |
| `RecordsPanel` | 事件/API/缓存三路 `applyPendingSheet`；挂载时 `hydrateFromPending`；空态仅当本 session 无 preview 行 |
| BFF emit | `lan-assist-state-watch.mjs`、`biz.mjs` 的 `biz.sheet.pending` 增加 `sheet: { rows, columns, … }` |

未做：全目录芯片、Tab 打开自动整表现查、改 4318 进程（runtime 源码已改，需 Ace 侧换核后 SSE 才带 `sheet` 体；前端仍走 `GET pending-sheet` + 缓存）。

## 对照表（本波）

| 项 | 规格 / 决策 | fdex（改后） | 实测 |
|----|-------------|--------------|------|
| AI 触及自动浮现 UI | 决策 1、`05` §6.1 | `focusBizRecordsPanel` on SSE | **现网未测**（5174） |
| 表体 = pending 行 | Ace 规则 | `applyPendingSheet` + pending-sheet | **现网未测** |
| 禁止 catalog browser | `wave-fix-records-surface` | 未恢复 `/biz/kinds` 芯片 | **已对**（源码，未重跑 CDP） |
| BFF SSE `sheet` 体 | 新 emit 字段 | `biz.mjs` + state-watch | **仍差** until runtime reload（未杀 4318） |

## 验证

- `node --test runtime/tests/biz.test.mjs` — 9/9 通过
- UI / Ace 截图路径：**未在本 worker 重验**

## Commit

`fix(web): open records panel with AI preview sheet`

## 文件

- `src/lib/biz-session-sheet.ts`（新建）
- `src/components/IMScreen.tsx`
- `src/store/app.ts`
- `src/pages/Data.tsx`
- `src/components/biz/RecordsPanel.tsx`
- `runtime/lan-assist-state-watch.mjs`
- `runtime/routes/biz.mjs`
