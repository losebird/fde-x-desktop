---
cursor:
  subagentId: "bc-12016ed2-8e3b-5d9d-b430-4bac0813d279"
---

# 单发布表审查

对照 `docs/biz-sheet-single-writer-plan.md`。提交 `ac3f281be43163320d980a629259df2558015257`（`cursor/approve-batch-where-9c38`）。只读，未改产品代码。

**结论：有条件收下**

条件：合格预览会立刻写入 `officialRoundSheet`，右栏、SSE、`GET pending` 读的是这一张，也没有把 GET/SSE 合并加回去。但 `closeRound` 在 `turn/end` 仍把 `candidate` 或 `weak` 写进 `official`，不经过 `canPublishSheet`。没有合格候选时，未过滤的 `weak` 会在回合结束变成右栏那张表。收法第一句「不等 turn/end 二次升格」因此没钉死。换型失败时，芯片仍会把本地表画上屏幕。

落地自述写「哪条行为没保住：无」。下面两条对不上。

## 一张表

做实的是读路径和合格预览的那一次发布。`gate.js` 不在这 11 个文件里。发布挂在包装后的 `secretary.previewBiz` 返回之后，不是闸函数体内。

| 收法 | 结果 | 符号 |
|---|---|---|
| 合格预览成功即写入 `officialRoundSheet` | 做了 | `index.js:secretary.previewBiz` 调 `session-round.js:publishOfficial` → `publishInto` 写 `round.official`。`index.js:attachOfficial` 把 `servedSheet` 放进 `officialRoundSheet` |
| 同一句、同一型、同一页不发第二次 | 做了 | `session-round.js:roundOfficialKey` 末段是 `sheetPage`。`publishInto` 在 `publishedKey` 相同处返回 |
| `ok:false`、`TOO_MANY` 不发布 | 发布口做了 | `session-round.js:canPublishSheet`；`write.js:withSheet` 把 `ok:false` 留在表上；`biz.mjs:emitBizSheetPending` 同样拒这两类 |
| `servedSheet` 不再拿 `kindFocus`、开放回合 `candidate` 冒充 | 做了 | `session-round.js:servedSheet` 只返回 `round.official`。`utteranceSheetPaints` 已删 |
| 右栏 / SSE / GET 只读这一张 | 做了 | `biz.mjs` GET `/api/v1/biz/pending-sheet` 只取 `state.officialRoundSheet`，`sheetForOfficialGet(handed, null, …)`。`lan-assist-state-watch.mjs:officialFromState` 只取 `officialRoundSheet`。`RecordsPanel` 的 `useEvents(['biz.sheet.pending'])` 在事件自带 `sheet` 时只 `applyPendingSheet` |
| `pendingSheet` 不再当右栏真值 | GET 做了 | GET 不读 `pendingSheet`。`biz.mjs` POST `/preview/dismiss` 仍用 `hall.pendingSheet` 补 `preview_id`，不把这张表当响应正文 |
| 不等 `turn/end` 二次升格 | 没做实 | `session-round.js:closeRound` 在回合仍开时执行 `round.official = round.candidate \|\| round.weak`，没有 `canPublishSheet`。`index.js` 的 `turn/end` 仍调用 `closeRound`。无候选时，`noteToolSheet` 放进 `weak` 的未过滤表现查会在这里变成 `official`，随后 `servedSheet` 和 watch 把它送上右栏。`emitBizSheetPending` 不拦未过滤表 |

`tools.js:biz_preview` 先走包装后的 `previewBiz`（已发布），再 `noteToolSheet` → `publishInto`。同一键第二次会被 `publishedKey` 挡下。挡不住的是上面的 `closeRound`。

`session-round.js:focusKindSheet` 仍写 `kindFocus`。全仓库没有别的读点把它送进右栏。

## 方案里会碰坏的行为

| 行为 | 结果 | 符号 |
|---|---|---|
| 翻页再查 | 保住 | `session-round.js:roundOfficialKey` 含 `sheetPage`。`src/lib/biz-list-query.ts:sheetRowsFingerprint` 含 `page`。`runtime/biz/sheet-fingerprint.mjs:pendingSheetWatchFingerprint` 含 `page`。`RecordsPanel.tsx:turnHitPage` 仍 `bizPreview({ page })` |
| 第二句换表 | 保住 | `src/lib/connected-kind.ts:shouldSkipCoveringPending` 在 `isNewSpokenUtterance` 为真时返回 false。去重键含 `speech`。`emitBizSheetPending` 不再用这道闩挡第二句 |
| TOO_MANY 不上台 | 保住 | `write.js:refuse` 给出 `ok:false`。`canPublishSheet` 与 `isEligibleRoundSheet` 都拒。`src/lib/biz-pending-stage.ts:isFailedRoundEndSheet` 认 `TOO_MANY`。UI 预览只在 `preview.published === true` 时 `recordSurfaceFromPreview` |
| 确认入账 | 保住 | `biz.mjs:capturePendingSheet` 读 `state.officialRoundSheet`，按 `preview_id` 对上才返回 |
| 回退两步 | 保住 | `biz.mjs` POST `/api/v1/biz/rollback/preview` 调 `/preview`。包装后的 `previewBiz` 对合格表 `publishOfficial`。确认写仍走 `capturePendingSheet`。右栏不是靠 `RecordsPanel.applyPendingSheet` 接这条响应 |
| 取消预览还原 | 保住 | `index.js` 包装 `dismissWrite`，用还原后的 `pendingSheet` 调 `republishAfterDismiss`。`biz.mjs` dismiss 再读 `officialRoundSheet` 并 `emitBizSheetPending`。`RecordsPanel.tsx:dismissPreviewDrawer` / `restoreRecordsList` 仍先画本地 `displayBeforeWriteRef`，闸的再发布在其后 |
| 现查 0 行上台 | 保住 | `isEligibleRoundSheet` 在 `querySettled === true` 时放行 0 行。`src/lib/biz-session-sheet.ts:rememberBizPendingSheet`、`src/lib/biz-list-query.ts:shouldRejectEmptyIncomingSheet`、`shouldSkipCoveringPending` 对已结算 0 行现查不再拒绝覆盖 |
| 刷新后仍是这张 | 保住 | GET 只返回发布表加独立 `writePreview`。`pendingBySession` 只在内存。`src/lib/runtime-api.ts:getBizPendingSheet` 把 `sheet` 与 `writePreview` 分开交回 |
| 写令牌抽屉 | 保住 | `biz.mjs` 已无 `projectWriteConfirm`。GET 的 `writePreview` 与 `data.sheet` 并列。`emitBizSheetPending` 把令牌放在事件的 `writePreview`。`RecordsPanel.tsx:writeTokenBlocksDrawer` 用 `writePreviewRef`，不并进列 |
| 跨对象 hop | 成功路径保住，失败路径没保住 | `index.js:focusOperationKind` 换型走 `previewBiz` 再发布；同型直接交回已发布表。`biz.mjs` `/focus-kind` 仅 `published === true` 才 emit。`RecordsPanel.tsx:selectKind` 在 `bizFocusKind` 失败且不是对端芯片时调用 `applyLocal`，`applySheet` 盖住当前行。点击时已把 `operationKindViewRef` 设成新型，`shouldHoldSideKindView` 会挡随后到来的官方表 |

## GET / SSE 合并

没有加回。

- `lastEmittedPendingBySession`、`peekLastEmittedPending`、`releaseLastEmittedConfirm` 不在 `biz.mjs`。
- GET 把 `null` 传给 `runtime/biz/connected-kind.mjs:sheetForOfficialGet`。`sheetForPendingGet`、`sheetAfterCancelCover` 还在该文件里，路由不调用。
- `emitBizSheetPending` 不再用内存表盖写，也不把令牌并进 `sheet`。`recordSurfaceFromPreview` 仍把 `hallSheet` 放进调用参数，函数不读它。
- 事件带 `sheet` 时，`RecordsPanel` 不再在 `applyPendingSheet` 之后 `hydrateFromPending`。事件没有 `sheet` 时仍会 `hydrateFromPending`。那是空事件回读，不是两张表并成一张。

## 语义图、手册、知识库、流程

这刀没动。提交只有业务记录这一路的 11 个文件。

- 语义图：`src/pages/Memory.tsx`、`runtime/vendor-overlays/dsh-lan-assist/semantic.js` 不在提交里。`index.js` 的 diff 只加了预览发布、取消再发布、`focusOperationKind`。
- 手册 / 知识库：`session-round.js:notePostSettledHopTool` 仍导出，函数体不在 diff。`search_text` 的停环没改。
- 流程：`src/pages/Plan.tsx` 与计划工作流路由不在提交里。
