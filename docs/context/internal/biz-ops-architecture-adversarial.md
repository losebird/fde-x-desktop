---
cursor:
  subagentId: "bc-ec9cab12-bce5-5e4a-9450-242921c62fb1"
---

# 「操作业务系统数据」架构页对抗审查

对照：`docs/biz-app-architecture.md`（2026-09-26）。产品：`/Users/zxz/WorkBuddy/2026-09-08-20-34-42/scene-39-personal-workstation`（`origin` → fde-x-desktop），分支 `cursor/approve-batch-where-9c38`，`HEAD` `07fb1595`。

真值三套、九份副本、一句到记录主链在架构页层面与代码一致；下列按用户可触能力逐项只标缺口。

| 项 | 判定 | 架构页覆盖（入口 / 副本 / 真值） | 证据符号 |
|---|---|---|---|
| 现查 | **写了** | 入口：左侧 AI `biz_preview` → `recoverWriteIntent` → `previewStructured` → `previewBiz`；副本：`pendingSheet` / SSE / GET pending / `rows`；真值：连接器行只读，不经 `biz_write_audit` | `runtime/vendor-overlays/dsh-lan-assist/write.js:recoverWriteIntent`、`previewStructured`；`tools.js`（`biz_preview`）；`src/components/biz/RecordsPanel.tsx:applyPendingSheet` |
| 翻页 | **写漏了** | 页只出现在结算键排除（「翻页…不进这把键」），未写业务记录底栏「上一页/下一页」入口、`turnHitPage`→`bizPreview({ page })`、结算键含 `page`（`settledHopKey`） | `src/components/biz/RecordsPanel.tsx:turnHitPage`、`displayPage`；`runtime/vendor-overlays/dsh-lan-assist/query-settle.mjs:settledHopKey` |
| 跨对象 hop | **写漏了** | 未写 `steps` / `from` / `hopWhere`、hop 侧型视图、`noteToolSheet` 同回合多跳；九份副本表未点 hop 与 `kindFocus` / 侧栏型切换关系 | `src/components/biz/RecordsPanel.tsx:hopBind`；`src/lib/biz-list-query.ts:shouldHoldSideKindView`、`operationBundlesAlign`；`runtime/vendor-overlays/dsh-lan-assist/session-round.js:servedSheet` |
| 新建 | **写了** | 与改/删/过审同链 `preview`+`preview_id`；入账仅 `POST /biz/write`；副本写预览走 `listBeforeWrite`+令牌 | 架构 §一句；`src/components/biz/RecordsPanel.tsx:runPreview`（`新建`）；`runtime/vendor-overlays/dsh-lan-assist/gate.js:stashListBeforeWrite` |
| 改行 | **写了** | 同上；右栏行内 `runPreview('改行', …)` | `RecordsPanel.tsx:runPreview`、`EditableSheetCell`；`write.js:previewStructured` |
| 删除 | **写了** | 同上（行内动作经 `currentKindCan`） | `RecordsPanel.tsx:rowActions`→`runPreview`；架构 L55「删」 |
| 过审 | **写了** | 同上 | `RecordsPanel.tsx:isApprovePreviewSheet`；`write.js`（`recognized.action === '过审'`） |
| 批量 where 与条数上限 | **写了** | 「批量先按 where 再比 100 条」、`TOO_MANY` 不收 candidate、前端不 stage | `write.js`（`sheetWhereFromPlan`、`BATCH_LIMIT`、`refuse('TOO_MANY')`）；`runtime/vendor-overlays/dsh-lan-assist/plan.js:BATCH_LIMIT`；`src/lib/biz-pending-stage.ts:isFailedRoundEndSheet` |
| 确认入账 | **写了** | 业务记录确认 → `bizWrite` → `/biz/write` → `insertBizWriteAudit`；真值：连接器 + 审计表 | 架构 §操作记录；`RecordsPanel.tsx:confirmWrite`；`runtime/routes/biz.mjs`（`source === 'workstation'`、`insertBizWriteAudit`） |
| 回退 | **写漏了** | 只写「操作记录点回退」走同一 `bizWrite`，未写 `/biz/rollback/preview`、`rollback_of_trace_id`、两步预览再写 | `src/components/biz/OperationRecordPanel.tsx:openRollback`、`confirmRollback`；`runtime/routes/biz.mjs`（`/api/v1/biz/rollback/preview`） |
| 取消预览 | **写漏了** | 仅 `listBeforeWrite`「撤预览时用来还原」；未写 `POST /biz/preview/dismiss`→`dismissWrite`/`/write/cancel`、`dismissBizPreviewId`、`cancelAi({ kind: 'records-cancel' })` 与 `dismissedPreviewIds` | `runtime/routes/biz.mjs`（`/api/v1/biz/preview/dismiss`）；`runtime/vendor-overlays/dsh-lan-assist/gate.js:dismissWrite`；`src/lib/biz-session-sheet.ts:dismissBizPreviewId`；`RecordsPanel.tsx:dismissPreviewDrawer`、`abortLeftoverAskTurn` |
| 写令牌 | **写了** | 写预览存 `listBeforeWrite`+令牌；结算键排除「写令牌」 | 架构 L46、L57；`gate.js:commitWrite`（`opts.gate.tokens`）；`src/lib/write-confirm.ts`（`writeToken`） |
| 结算 QUERY_SETTLED | **写了** | `recoverWriteIntent` 后同句同型同页已结算 → `QUERY_SETTLED`；键：原话+型+页 | 架构 L44、L57；`query-settle.mjs:materializeSettledRepeat`、`settledHopKey`；`write.js`（`querySettled`） |
| leftover 停环 | **写了** | `turn/end` 后等 tool/result 再 `plugin-leftover cancel` | 架构 L49-50；`runtime/vendor-overlays/dsh-lan-assist/index.js:scheduleLeftoverCancel`；`session-round.js:noteToolSheet`（`cancelKind: 'plugin-leftover'`） |
| 右栏上台与类型芯片 | **写漏了** | 有 `shouldStage`/`applySheet`、`kindFocus` 盖住 official、屏幕 `rows`「不要盖住当前表」；未写业务记录型芯片 UI（`selectKind`、`kindChip*`、`operationKindViewRef`）与 `shouldHoldSideKindView` / `shouldSkipCoveringPending` 分工 | `src/lib/biz-pending-stage.ts:shouldStageRoundEndPending`；`RecordsPanel.tsx:selectKind`、`applyPendingSheet`；`src/lib/biz-list-query.ts:kindChipConditionLabels`；`connected-kind.ts:shouldSkipCoveringPending` |
| 空表 | **写漏了** | 未写「有 `querySettled`、0 行仍可上台」、空表文案/不 stage 失败 sheet、GET 与右栏空态 | `biz-pending-stage.ts:shouldStageRoundEndPending`（`querySettled`）；`RecordsPanel.tsx`（`paginatedRows.length === 0`、`staleHint`）；`session-round.js`（现查 0 行与 `querySettled` 升格规则） |
| 操作记录列表与审计 | **写了** | `GET /biz/traces` 合并 lan-assist 轨迹与 `biz_write_audit`（按 `trace_id`） | 架构 §操作记录；`runtime/routes/biz.mjs:enrichTraceRows` |
| execute 绕过审计 | **写了** | `POST /operations/:id/execute` live 直 `/write`，不进 `biz_write_audit`；`src/` 无 UI | 架构 L80；`runtime/server.mjs`（`executeOperationLive`）；`runtime/db.mjs:executeOperationLive`（无 `insertBizWriteAudit`） |
| 模型直写被拒 | **写错了** | 页写「模型直接写会被 **403**」；模型走 `biz_write` 工具时多在闸内 `commitWrite` 返回 `NEED_WORKSTATION_CONFIRM`（非 HTTP 403）。403 主要是 BFF `POST /biz/write` 且 `source !== 'workstation'` | `gate.js:commitWrite`（`NEED_WORKSTATION_CONFIRM`）；`tools.js`（`biz_write`→`commitWrite`）；`biz.mjs`（`biz_write_forbidden` 403） |
| 手册和 search_text 不进写闸 | **写漏了** | 概念对（「手册、记忆、search_text 不在三套真值」「进不了写闸」），未点名只读工具 `biz_describe`/`describeBiz` 与 `search_text` 注册路径；未写结算后 `search_text` 触发 `notePostSettledHopTool` / leftover | 架构 L35；`tools.js:biz_describe`；`catalog.js`（`search_text`）；`session-round.js:notePostSettledHopTool`；`index.js`（`toolName === 'search_text'`） |

## 写对了且无需展开

- 三 Tab：`src/pages/Data.tsx`（`overview` / `records` / `operations`）与架构 §三页一致。
- 连接器真值 vs `business_apps` 物化表 vs `biz_write_audit` 分工与架构 §三套真值一致。
- 失败 `TOO_MANY` 不上台：`shouldStageRoundEndPending` / `isFailedRoundEndSheet` 与架构 L52-53 一致。

## 方法

只读 grep/读文件；未改产品代码、未改架构页、未提交。
