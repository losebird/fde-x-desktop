---
cursor:
  subagentId: "bc-5534931f-b638-513d-9394-2dd4f339060e"
---

# Wave: records preview cancel + list back

## 改动

| 区域 | 行为 |
|------|------|
| `BizPreviewDrawer` | 页眉「关闭」、页脚「取消」；`onClose` 仅关抽屉，不过账 |
| `RecordsPanel` | 非「现查」预览前 `captureListRestore()`；取消/返回 `dismissPreviewDrawer` 恢复 rows/columns/page/draftEdits/sourceLabel 并回写 kind 快照 |
| `confirmWrite` | 成功仍 `bizWrite`；`setListRestore(null)` 保留预览行 |

## 未动

- `biz-records-auto-open.ts`（0d07ca9 自动打开记录页）
- 路由 / catalog / `biz_write` 取消路径

## 验证

- `pnpm exec tsc --noEmit` 通过
- 现网 UI：未测

## Commit

`fix(web): cancel biz preview and return to records list` on `main`（本地）
