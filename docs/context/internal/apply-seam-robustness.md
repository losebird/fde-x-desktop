---
cursor:
  subagentId: "bc-1244abbc-ca7f-5cdc-a4ba-cb13b06f5c00"
---

# apply 缝加固审计（`5e37f0b6`）

对照：`internal/sheet-apply-fix.md`、`docs/spoken-write-empty-panel.md`、`internal/sheet-apply-miss.md`。只审仓内现状，未改产品、未 reload。

## 总判

对 **18:02 那一类**（闸里已有 `preview_id` + `rows>0` 写预览，`kind=工单` 但 catalog 只有 `Ticket`+aliases 映射失败 → `applyPendingSheet` false → GET 再清表 → 已选 kind 不再 hydrate）：**够壮**。

**仍脆**（会再空或长期无行，但不是同一 triple 根因）：

1. `activeAiSessionId` / `sheet.sessionId` 一刻不一致 → SSE 与 `tryApply` 仍丢（`RecordsPanel.tsx` 973、1064、1181；`biz-session-sheet.ts` 51–58）。
2. `applyPendingSheet` 其它 silent false：`shouldSkipCoveringPending` / `shouldRejectIncomingCovering` / `shouldBlockIncomingSheetForHistoryPin` / `shouldHoldSideKindView`（非写预览 hold）等（977–989）。
3. `isBizPreviewDismissed`（`biz-session-sheet.ts` 66–69）或 GET 抛错 → `hydrateFromPending` catch 静默 false（1084–1085），仅无表、无强制 staleHint。
4. **无单测**覆盖 1–3（见 §6）。

---

## 逐条标准

### 1. catalog 对不上「工单」时，有 `preview_id` 且 `rows>0` 的写预览仍能画上

**够**

| 位置 | 说明 |
|------|------|
| `RecordsPanel.tsx` 206–208 | `isWritePreviewSheet`：`preview_id` 且非现查 action |
| `RecordsPanel.tsx` 962–970 | `resolveConnectedKind` 为空时，仅当 **非** `isWritePreviewSheet && rows>0` 才 `return false`；否则保留 sheet 自带 `kind`（如 `工单`）继续 `applySheet` |
| `connected-kind.ts` 150–169 | 映射失败返回 `''`（`Ticket`+aliases 未命中 `工单` 时即此路径） |

前提：后续闸未挡（session、covering、pin 等）。对 `pv_11a0…` 主因链，本条已闭合。

### 2. apply 失败不得 `clearDisplayedForSession` 清成空表

**够**（针对「闸有 sheet、apply false 后再清表」）

| 位置 | 说明 |
|------|------|
| `RecordsPanel.tsx` 1118–1129 | GET 后有 sheet、`sheetBelongsToSession`、未 dismiss：`apply` false 时 **`setStaleHint` + return**，不再 `clearDisplayedForSession` |
| `RecordsPanel.tsx` 1131 | 仅无 sheet / 不属于会话 / 已 dismiss 等才再 clear |
| `RecordsPanel.tsx` 1111–1114 | 有 cache pending 时先 apply 并 **return**，不因 apply 成败再走 1117 clear |

说明：会话切换且无 cache 时仍会在 GET 前 `clearDisplayedForSession`（1117），属换会话清屏，不是「apply 失败清表」。

### 3. round-end `biz.sheet.pending` 之后会再 GET；已选 kind 不再跳过

**够**

| 位置 | 说明 |
|------|------|
| `RecordsPanel.tsx` 1165–1184 | `remember` → `applyPendingSheet` → **`void hydrateFromPendingRef.current(incomingSurfaceId)`**（cache → GET → tryApply） |
| `RecordsPanel.tsx` 1059–1087 | `hydrateFromPending` 统一 GET + `rememberBizPendingSheet` |
| `RecordsPanel.tsx` 1157–1163 | `surfaces` effect：**已删除** `if (kind) return` 与仅现查的 `peekListPendingSheet`，改为 `hydrateFromPending` |
| `biz-records-auto-open.ts` 22 | 仅保留 `biz.sheet.pending` 自动开面板；**已删** `ai.tool.finished` → GET |

### 4. `sheetBelongsToSession` 仍会不会把同会话事件丢掉

**够**（同会话不丢；跨会话仍丢，设计未改）

| 位置 | 说明 |
|------|------|
| `biz-session-sheet.ts` 51–58 | 仅当 `sessionId` 非空且与 `sheet.sessionId` 不等才 false |
| `RecordsPanel.tsx` 1176–1181 | SSE 可给 sheet 打 `eventSessionId` |
| `RecordsPanel.tsx` 973、1064 | apply / hydrate 同规则 |

风险在 **liveSid 与 sheet 不一致**（未钉死），不是函数误伤同会话。

### 5. 现查空表、问卡、历史 pin 是否被兜底误伤（决策 22）

**够（静态）** — 未见故意破坏；**未手测决策 22 全路径**

| 路径 | 判定 | 证据 |
|------|------|------|
| 现查 | 未放宽 catalog 挡非写预览 | `965–967` 仅 `gatedWrite` 绕过映射；现查仍须 `resolveConnectedKind` 成功 |
| 现查 + 已选 kind | 可能 **变好** | `1157–1163` 写预览也能 hydrate；不再只 `peekListPendingSheet` |
| 问卡（常无 `preview_id`） | 映射失败仍 false | 与补丁前相同，非本次误伤 |
| 历史 pin | 挡法保留 | `978–979`、`1060`、`1171–1172`、`1198`；`records-align.test.mjs` 40–46 |
| 删 `ai.tool.finished` | 行为变：预览成功 **不再** 靠 tool-finish 上表/开面板 | 与 `sheet-apply-fix` 意图一致；round-end `biz.sheet.pending` 仍为收束 |

### 6. 单测是否盖住 1–3

**没有**

- `runtime/tests/records-align.test.mjs` 对 `RecordsPanel` 多为 **源码形态**断言（如 `resolveConnectedKind`、`shouldRejectIncomingCovering`），**无** `gatedWrite`、`hydrateFromPending` GET、apply 失败后不清表、或 `Ticket`/`工单` 映射失败写预览上表。
- 全仓 `*.test.*` 未命中 `gatedWrite` / `hydrateFromPending` 行为测。

---

## `5e37f0b6` 变更摘要

- `applyPendingSheet`：catalog 映射失败 + 写预览 gate（`RecordsPanel.tsx` 965–970）。
- `hydrateFromPending`：GET、`remember`、失败 `staleHint`（1059–1087）。
- session GET：apply 失败不清表（1118–1129）。
- `biz.sheet.pending`：补 `hydrateFromPending`（1184）。
- surfaces：全量 hydrate（1157–1163）。
- 移除 `RecordsPanel` / `biz-records-auto-open` 的 `ai.tool.finished` 链。

`resolveConnectedKind` 实现仍在 `connected-kind.ts` 150–169（`biz-session-sheet.ts` 仅 `sheetBelongsToSession`）。
