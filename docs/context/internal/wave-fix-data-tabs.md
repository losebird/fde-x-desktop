---
cursor:
  subagentId: "bc-90599925-64fb-57e1-963d-1c7de6fc3bbe"
---

# Wave：业务应用子 Tab 不得误开改行预览

## 问题（Ace）

在「业务应用」里点 **应用** 或 **操作控制** 无法留在对应子页，会被拉回 **业务记录** 并弹出改行预览抽屉。截图：[ace-tabs-open-preview.png](../media/ace-tabs-open-preview.png)。

根因：`0d07ca9` 在 `Data.tsx` 增加的 `useEffect` — 只要 data 面板为 `full`/`half` 且 session 里仍有 `peekBizPendingSheet()`，就把 `activeDataSubview` 强制设为 `records`。用户切 Tab 后 `RecordsPanel` 重新挂载 → `hydrateFromPending` → `applyPendingSheet` 再次 `setDrawer`。

## 改动

| 文件 | 行为 |
|------|------|
| `src/pages/Data.tsx` | 删除上述 force-tab `useEffect` 及 `dataPanelState` / `peekBizPendingSheet` 依赖 |
| `app.ts` / `biz-records-auto-open.ts` | **未改**；新 AI preview 仍经 `focusBizRecordsPanel()` 切到 records 并开面板 |
| `RecordsPanel.tsx` | **未改**（bc-fabca561 负责返回等） |

## 对照表

| 项 | 预期 | 改后（源码） | 实测 |
|----|------|--------------|------|
| 点 应用 / 操作控制 切子视图 | `setActiveDataSubview` 生效 | 无 force-tab 覆盖 | **现网未测** |
| 切离 业务记录 时预览抽屉 | 关闭或离开（Unmount） | `RecordsPanel` 卸载 | **现网未测** |
| 新 AI biz preview | 仅此时自动 records + 抽屉 | `onBizSheetPending` → `focusBizRecordsPanel` | **现网未测** |
| 有 pending 时手动点 业务记录 | 仍可 hydrate 预览 | `RecordsPanel` 原逻辑 | **未对**（未重跑） |

## 提交

- `1452e52` — `fix(web): Data tabs must not open biz preview`（`main`）

## 验证建议

1. 有待确认改行时：点 **应用** → 应见应用概览，无右侧预览抽屉。
2. 同态点 **操作控制** → 应见操作控制面板。
3. IM 新发改行 preview → 应自动切 **业务记录** 并开抽屉（与 `0d07ca9` 意图一致）。
