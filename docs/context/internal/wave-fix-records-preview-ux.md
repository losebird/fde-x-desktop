---
cursor:
  subagentId: "bc-c117962c-7c27-5626-9382-1da0f1b8bcc6"
---

# Wave：业务记录表分页 + 预览人话化

## 问题（Ace 拒收）

`RecordsPanel` 表格像 debug dump（ISO 日期、技术 key），预览抽屉直接 `JSON.stringify(sheet)`，改行只能点按钮进 JSON，无分页。见 `media/ace-records-json-preview.png`。

## 改动

| 区域 | 之前 | 之后 |
|---|---|---|
| 表格 | 原始 cell 字符串 | `sheet.columns` 中文列头；日期 `formatSheetCellValue`；点击单元格内联编辑后再点改行 |
| 分页 | 无 | 仅本 sheet：`PAGE_SIZE=10`，上一页/下一页 |
| 预览抽屉 | raw JSON | `BizPreviewDrawer`：动作中文、字段中文名、原值→新值 / 将删除 / 将过审 / 新建字段；隐藏 preview_id 与 schema |
| 新建 | 空 input 直 preview | 列字段表单 →「预览新建」→ 抽屉 → `biz_write` |
| 过账 | `bizWrite(preview_id)` | 不变，仍须抽屉确认 |

## 文件

- `src/lib/biz-sheet-display.ts` — 列/行归一化、日期格式化、预览摘要构建
- `src/components/biz/BizPreviewDrawer.tsx` — 人话预览抽屉
- `src/components/biz/RecordsPanel.tsx` — 分页、内联编辑、接线

## 验证

| 步骤 | 结果 |
|---|---|
| `npx tsc -b --pretty false` | 通过 |
| `node --test runtime/tests/biz.test.mjs` | 9/9 通过 |
| 5174 UI / Ace 复验 | **未测** |

## 约束遵守

- 未新增 module/route；未 packaging；未动 IMScreen auto-open
- 未 `git add -A`；未 `biz_write` 绕过 preview；无硬编码 工单/2026
- 仍只展示 AI 浮现 sheet（决策 1），未恢复 catalog 浏览

## Commit

`fix(web): paginate records and humanize preview`（`cursor/fix-records-preview-ux-bcc6`）

已上 main `e214ffb`
