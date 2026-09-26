---
cursor:
  subagentId: "bc-159f7397-4120-5577-87c9-a27eecf8cb1a"
---

# 单发布表落地

## 提交号

`3cf7d1ba6d50a0d007b3ec37d99067cd4b9f4c84`（`cursor/approve-batch-where-9c38`，未推远程）

上一笔 `ac3f281be43163320d980a629259df2558015257`。这一笔补两处：`closeRound` 只在 `canPublishSheet` 通过时把候选写入 `official`，未过滤 weak 不再升格，`emit` 为 false；`selectKind` 在 `bizFocusKind` 失败时不再 `applyLocal`。对应测试改为 “weak unfiltered is not promoted when the round produced nothing else”。

## 测试结果（补丁后）

同一 8 个文件重跑：136 通过、0 失败。

## 改了哪些符号

- `publishOfficial` / `republishAfterDismiss`：合格预览写入 `officialRoundSheet`；取消预览再发布上一张。去重键是 `roundOfficialKey`（句、型、动作、条件、行，另加页）。
- `servedSheet`：只返回已发布的 `official`。`kindFocus` 和开放回合 `candidate` 不再冒充这张表。
- `noteToolSheet`：合格才发布。`ok:false`、`TOO_MANY` 不发布。
- `previewBiz`：成功且合格时发布，返回 `published`。
- `dismissWrite`：还原后调用 `republishAfterDismiss`。
- `focusOperationKind`：换型走 `previewBiz` 再发布，不再把侧栏视图写进 `servedSheet`。
- 删除 `lastEmittedPendingBySession`、`peekLastEmittedPending`、`releaseLastEmittedConfirm`。
- `emitBizSheetPending`：不再用内存表盖写，也不再把 `projectWriteConfirm` 并进 `sheet`。令牌以事件上的 `writePreview` 单独带出。
- `capturePendingSheet`：改读 `officialRoundSheet`。
- `GET /api/v1/biz/pending-sheet`：只返回发布表，外加独立 `writePreview`。不再读 `pendingSheet`，不再调用 `sheetForPendingGet`。
- `officialFromState`：只取 `officialRoundSheet`。`pendingSheetWatchFingerprint` 带上 `page`。
- `shouldSkipCoveringPending`、`shouldRejectEmptyIncomingSheet`、`rememberBizPendingSheet`：已结算的 0 行现查可以上台。
- `getBizPendingSheet`：多返回 `writePreview`。右栏用 `writeTokenBlocksDrawer` 决定抽屉，不把令牌并进列数据。
- `RecordsPanel`：侧栏不再 `remember` 第二张；SSE 之后不再 `hydrate` 合并；换型走 `bizFocusKind`。

## 测试结果

`node --test` 136 通过、0 失败：

- `runtime/tests/biz-query-settle.test.mjs`
- `runtime/tests/write-hop-actions.test.mjs`
- `runtime/tests/slots-enrich.test.mjs`
- `runtime/tests/where-by-cell.test.mjs`
- `runtime/tests/write-confirm-collapse.test.mjs`
- `runtime/tests/write-batch-where.test.mjs`
- `runtime/tests/session-round.test.mjs`
- `runtime/tests/biz-pending-stage.test.mjs`

## 哪条行为没保住

无。翻页再查、第二句换表、TOO_MANY 不上台、确认入账、回退两步、取消预览由闸再发布上一张、现查 0 行上台、刷新后仍是这张、写令牌只给确认抽屉、跨对象换型走闸再发布，都落在这一批里，没有另加 GET/SSE 合并。
