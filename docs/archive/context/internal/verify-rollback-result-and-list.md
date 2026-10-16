---
cursor:
  subagentId: "bc-90395b4e-50d9-5040-8bb4-2ac649dcda06"
---

# 回退提示与列表变更 · 验证

## 根因（仍无桌面提示）

| 假设 | 结论 |
|------|------|
| 成功路径未 set | `confirmRollback` 会 set；问题不在这里 |
| 提示被刷新清掉 | `refresh()` 不清 feedback |
| 点列表「回退」 | 列表无回退键，只有 trace「回退」+ 确认「确认回退并写回」 |
| **预览 SSE 切页** | `biz.sheet.pending` → `focusBizRecordsPanel()`，操作记录面板卸载，toast 来不及看见；并弹出业务记录「改行确认」 |

## 修复

- 操作记录页签打开时 **不** 因 pending sheet 自动切到业务记录（`biz-records-auto-open.ts`）。
- 固定 `role=alert` 桌面 toast（`z-[100]`），确认写回后立即显示成功/失败。
- 回退写回后 `bizDismissPreview`，避免残留预览抽屉。
- 回退写回审计 `action=回退`，`canRollbackAudit` 排除回退；原 trace `rolled_back`；新行 tag「已完成」。
- 列表副标题用 `changes` + 列 enum 展示 `字段：原→新`。

## 截图

- [rollback-result-toast.png](../media/rollback-result-toast.png) — toast 文案：`已回退并写回。`
- [operation-list-with-diff.png](../media/operation-list-with-diff.png) — 列表含 →：yes

## 自动化读图

```json
{
  "toastVisible": true,
  "toastText": "已回退并写回。",
  "listHasArrowDiff": true,
  "listSample": "回退 · 工单 · TK20250211633 | 9/18 17:38:53 · 工作台 · 工单状态：新建→处理中 | 工作台 | 已完成 | 改行 · 工单 · TK20250211633 | 9/18 17:28:05 · 工作台 · 工单状态：处理中→新建",
  "rollbackRowNotCan": true,
  "ok": true
}
```
