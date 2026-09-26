---
cursor:
  subagentId: "bc-9afab3df-cc61-56e8-8576-215fcac49d95"
---

# 操作记录 trace 抽屉 · 验证（2026-09-18）

## 文件 SHA-256

| 文件 | SHA-256 |
|------|---------|
| `runtime/routes/biz.mjs` | `2284afa4da499ac32f0dd03667d1a0c05d876f904b3020e48492090140553e26` |
| `src/components/biz/OperationRecordPanel.tsx` | `9853e5071a10a2149243a1c2f628c360523347801cfa30afa39fa16112b2d34d` |

## 硬编码 none（操作记录相关）

- `OperationRecordPanel`：无写死 `工单`/`客户`/`receipt` 业务型；`RECORD_ACTION_ALIASES` 仅把 `record.*` 机读码映射为闸口语（与 BFF `resolveGateAction` 同集）。
- 列表/抽屉展示：`listBizKinds` 词表 `label` + `formatSheetCellDisplayValue`（列 `enums`）展示状态等，不甩 `processing` 裸码。
- BFF：`SPOKEN_META_KINDS = receipt|compensate` 为 lan-assist `speakReceipt` 元型，非业务 kind 白名单；回退 kind 走 `resolveAuditBizKind`（trace → audit → 词表字段打分），不写死某一业务型名。

## 回退失败根因

1. **表象**：确认回退后红字类似 `receipt没登记。词表和连接器都要有…`（lan-assist `UNKNOWN_KIND`）。
2. **原因**：`biz_write` 落审计时优先用了 `written.kind`；过账成功响应里 `kind` 来自 `speakReceipt()` 的 **`receipt` 元型**，不是 sheet 上的业务型（如词表里的「工单」）。
3. **修复**：
   - 写审计：`effectiveBizKind(sheet.kind, body.kind, written.kind)`，sheet 优先。
   - 列表/回退：`enrichTraceRowsAsync` + `resolveAuditBizKind`：meta kind 时用 trace 行 + 审计 `columns`/`changes` 与词表字段匹配推断（需 catalog 可用）。
   - 闸门保留：推断不出且仍非词表 kind 时，回退 preview 返回 `rollback_unsupported`，不绕过词表+连接器。

## UI

- 默认主区仅「操作历史」列表（无右侧整页 Trace 详情）。
- 点一条 → 右侧 `DrawerShell`「操作 trace」：时间/来源/动作/对象/变更/回执/审查 corpus/回退。
- 「审查 corpus」：`runtimeApi.fetchCorpus`，面板内空态/错误（如「暂时读不出原文」），不 `target=_blank` 裸 JSON。

## 截图

- `media/operation-history-list.png`
- `media/operation-trace-dialog.png`
- `media/corpus-review-readable.png`

## 现网

Playwright 在 `127.0.0.1:5174` 实测：`dialogOpened: true`；corpus 按钮后无整页 `{ok:false,corpus_unavailable}` JSON（面板内可读提示）。
