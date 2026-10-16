---
cursor:
  subagentId: "bc-63b38672-9319-55dd-983c-6936ce183465"
---

# 右栏 round-end pending 上表修复（`pv_11a0e67b3cf004df`）

对照：[sheet-apply-miss.md](./sheet-apply-miss.md)、[empty-records-panel.md](./empty-records-panel.md)。

## 钉死：`applyPendingSheet` 哪条分支挡了

| 分支 | 本次是否挡 | 证据 |
|------|------------|------|
| **catalog / `resolveConnectedKind`** | **是（首因）** | 闸 GET 返回 `kind:"工单"`、`rows=1`、`preview_id=pv_11a0e67b3cf004df`（4318 现网复验）。`applyPendingSheet` 在 `kindCatalog.length>0` 时若 `resolveConnectedKind('工单', catalog)===''` 则 **整段 `return false`**（原 968–975）。本地复现：`catalog=[{kind:'Ticket',aliases:['工单']}]` 时 resolve 为空；`catalog=[{kind:'工单'}]` 或 `catalog=[]` 则通过。与「BFF 已 emit、闸有行、表仍空」一致：**事件触达 remember，但画表被 catalog 映射挡掉**。 |
| **session / `sheetBelongsToSession`** | 未钉死 | 磁盘 session 一致；需 DevTools 才能证伪 runtime `activeAiSessionId` 分叉。 |
| **pin / `shouldBlockIncomingSheetForHistoryPin`** | 否 | 新建预览、无历史 pin 场景。 |
| **GET 后 `clearDisplayedForSession`** | **是（加重空表）** | `activeAiSessionId` effect：GET 有 sheet 但 `applyPendingSheet` false 时原逻辑 **再次 `clearDisplayedForSession()`**（1113–1125），把表清成「当前型还没有可展示的行」。 |
| **surfaces 种子 + `kind` 已选** | **是（兜底缺口）** | 原 1151–1177：`if (kind) return` 且只用 `peekListPendingSheet`（**过滤掉写预览**），round-end 后 **不再 GET**，写预览只能靠 SSE apply 一次成功。 |

**结论句：** `pv_11a0…` 主挡在 **`resolveConnectedKind` 在 catalog 非空时返回空**；叠加 **apply 失败后 clear 表** 与 **已选 kind 不再拉闸**，Ace round-end 后仍空。

## 改了什么（仓内）

1. **`applyPendingSheet`**：闸侧写预览（有 `preview_id` 且 `rows>0`）在 catalog 映射失败时 **仍用 sheet 自带 kind 画表**，不再 `return false`。
2. **`hydrateFromPending`**：统一「cache → **GET** → apply」；apply 仍失败时 **`setStaleHint`**，不清表。
3. **`biz.sheet.pending`**：remember 后先 apply，再 **`hydrateFromPending`（含 GET）**；round-end 收束仍只靠 BFF emit，**不在 `ai.tool.finished` 上表**。
4. **删掉** `RecordsPanel` / `biz-records-auto-open` 的 **`ai.tool.finished` → GET/apply**（Ace：一轮多 preview 不能预览成功立刻上表）。
5. **surfaces 浮现**：去掉 `if (kind) return` 与仅现查的 `peekListPendingSheet`，改为 **`hydrateFromPending`**。
6. **session 切换 GET**：apply 失败时 **不再 `clearDisplayedForSession`**，改为 staleHint。

文件：

- `src/components/biz/RecordsPanel.tsx`
- `src/lib/biz-records-auto-open.ts`

## 未动

- BFF `round-end` emit 路径（仍唯一 emit 收束点）。
- 5174 / 4318 进程、reload、过账、远程 push。
