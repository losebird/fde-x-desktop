---
cursor:
  subagentId: "bc-fabca561-bc6a-5630-b79f-bdb66a0a5460"
---

# Wave: 业务记录「返回」恢复列表快照

## 症状

- 顶栏「返回」在来源条可见时点击无效果或仍停留在单行/改行 sheet。
- 与会话浮现历史下拉无关（保留为同会话 sheet 切换器）。

## 根因（fdex `RecordsPanel.tsx`）

1. **快照被覆盖**：`setListRestore(captureListRestore())` 条件为 `rows.length > 0`。已在单行预览态时，再次 `applyPendingSheet` / `loadSurface` / 重复 pending 事件会用**当前单行**覆盖原先多行列表快照，「返回」只能还原成同一行。
2. **恢复读 state**：`restoreRecordsList` 仅读 `listRestore` state；与 ref 不同步时存在边界风险。
3. **恢复后立刻清空 pending**：成功恢复后仍 `clearBizPendingSheet()` 会抹掉刚写回的列表 sheet（已改为仅未恢复时 clear）。

## 修复

| 项 | 行为 |
|----|------|
| `listRestoreRef` + `commitListRestore` | state 与 ref 同步 |
| `shouldSaveListRestore` / `maybeSaveListRestore` | 仅在离开多行列表（`rows.length > 1` 且 post-action/变窄）或首次变窄时捕获；已有快照时禁止用单行覆盖 |
| `restoreRecordsList` | 从 ref 恢复 rows/columns/page/drafts/sourceLabel，并 `rememberBizPendingSheet(snap.sheet)` |
| `handleRecordsBack` | 顶栏「返回」专用；恢复后关 drawer、dismiss preview，**不**在已恢复路径上 `clearBizPendingSheet` |
| `dismissPreviewDrawer` | 仍委托 `handleRecordsBack`（抽屉关闭同逻辑） |

捕获点：`applyPendingSheet`、`runPreview`、`loadSurface`（替换原 `previewId && action !== '现查' && rows.length > 0` 块）。

## 明确未做（Ace 追加）

- **未改** `Data.tsx`：无 force 业务记录 / pending 开 drawer；应用/操作控制 tab 切换问题留给其他 agent。
- **未改** `biz-records-auto-open.ts`、catalog、打包。

## 验证

- `RecordsPanel.tsx` lint：无新增问题。
- 现网 UI：未测。

## Commit

`fix(web): restore records list on 返回` — `main` `e9050ec`（WorkBuddy scene-39，本地无 origin remote）
