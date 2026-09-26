---
cursor:
  subagentId: "bc-aea46619-2327-43a7-a094-57e6e76a7d7e"
---

# Wave: preview / write audit — changed fields only

## SHA

`0348f1afbf3f896e7cd08f7646a82e52c53e012e`

## only-changed-fields

**yes** — 5174 业务记录 改行 preview drawer showed 1 block (`处理人` 冯丽 → Δ…); no JSON dump; 取消/确认过账 present. Screenshot: `media/preview-changed-fields.png`.

## 已对

| 项 | 母体 / 实测 |
|---|---|
| BizPreviewDrawer 改行 | 仅 `buildPreviewFieldChanges` + `sheet.changes` + `patch` 回退；去掉整行 `summarizeRow` / 全列展示 |
| 改行 preview 请求 | `pickSheetRowPatch` 最小 `input`；空 patch 拦截 |
| 新建 preview | `pickFilledSheetInput` 仅非空字段 |
| `biz_write_audit.changes_json` | `write.js` `packSheet` 过滤 `from === to`；过账仍读 `sheet.changes` |
| 5174 改行抽屉 | Playwright `scripts/verify-preview-changed-fields.mjs`：`onlyChangedFields: true`，`changeBlocks: 1` |

## 仍差

| 项 | 说明 |
|---|---|
| 删除确认 | 最多 5 个非空字段标识，非 diff（未在本任务验收） |
| 过审确认 | 变更列表为空，仅 subtitle（符合「无字段变更」） |
| 无 `originalRow` 重开抽屉 | 依赖 `sheet.changes`；未单独 walk |

## 未对

无。

## 改动文件

- `src/lib/biz-sheet-display.ts`
- `src/components/biz/BizPreviewDrawer.tsx`
- `src/components/biz/RecordsPanel.tsx`
- `runtime/vendor-overlays/dsh-lan-assist/write.js`
