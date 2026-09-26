---
cursor:
  subagentId: "bc-6762ce14-7aea-5d27-ad96-81cb07c05d93"
---

# Qwen 重打「停用客户…」· 21 行对了但业务记录 Tab 未开（bc8e60a3）

对照：[biz-app-production-land.md](../docs/biz-app-production-land.md)、[hop-sheet-stuck-plan.md](../docs/hop-sheet-stuck-plan.md)、[qwen-settle-abort-2.md](./qwen-settle-abort-2.md)。只读；未改代码、未推远程。`FDE_DSH_HOME` = `~/.dsh-fde-x`；scene-39 `losebird/fde-x-desktop` 检出 **`8a73914d`**。

**日志（该句 mtime 最新）：**

`~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-bc8e60a3-5df1-44f0-870b-af35515839d7/session.v3.jsonl.zstd`

模型：`Qwen/Qwen3.8-27B`。会话 id：`session-bc8e60a3-5df1-44f0-870b-af35515839d7`。工作区：`/Users/zxz/Documents/ai-project/fdex测试`。

---

## 结论（四条）

### 1. `biz_preview` 是否成功、`hitTotal`、QUERY_SETTLED / leftover

| 项 | 判定 |
|---|---|
| **首枪 `biz_preview`（seq 34→35）** | **成功**。工具 JSON `ok: true`，`listed: true`；`sheet.hitTotal: 21`，`sheet.querySettled: true`，`rows` 20 行；speak「这张单共 21 条，本页 20 条…」。与 hop 交集语义一致。 |
| **第二枪 `biz_preview`（seq 39→40）** | **未成功回执**。seq 40 工具正文仅 `Error: tool call aborted`（24 字节）；seq 42 `turn/end` → `plugin-leftover`。 |
| **jsonl 内 `QUERY_SETTLED` 文本** | **首枪工具结果中无** `QUERY_SETTLED` / `querySettledRepeat` 字符串（首枪是正常现查回执，不是重复结算 JSON）。**第二枪**也未落下带 `QUERY_SETTLED` 的 JSON，而是 **AbortError**。 |
| **闸 `pendingSheet`（现网 `state.json`）** | **仍持有首枪表**：`hitTotal: 21`，`querySettled: true`；尾部带 `querySettledRepeat: true`、`error: "QUERY_SETTLED"`、`at: 1790399581495`（与第二枪 seq 40 同毫秒），说明结算闸在重复 preview 路径上打了标，但 **会话工具面**仍是 abort。 |
| **本回合 `search_text`** | **0 次**（与 [qwen-settle-abort-2](./qwen-settle-abort-2.md) 一致）。 |

### 2. pending / 官方表 SSE；RecordsPanel 是否 apply

| 项 | 判定 |
|---|---|
| **BFF `biz.sheet.pending`** | **有 emit**。`runtime/data/fde-workstation.sqlite` → `outbox_events`：`ts=1790399522587`（本地 **2026-09-26 13:12:02**），`event_type=biz.sheet.pending`，`source=round-end`，`session_id=session-bc8e60a3-…`，payload 顶层 `rows=20`，含完整 `sheet`。距首枪工具结果 `1790399521777` 约 **810 ms**。 |
| **同会话第二条 pending SSE** | **无**（outbox 仅此一条 `biz.sheet.pending`）。13:13 leftover 与 13:28 助手长文表 **未再 emit**。 |
| **`biz_surfaces`** | `bsurf_d7bca3fefcb841369cdbea9bd8d8fa2d`，`created_at` 对齐 **13:12:02**，`kind=工单`，`row_count=20`，`session_id` 一致。 |
| **emit 路径（代码）** | AI `biz_preview` **不**走 `POST /biz/preview` 即时 emit；`startLanAssistStateWatch` 盯 `officialRoundSheet` 指纹变 → `emitBizSheetPending(..., source='round-end')`；`prepareSurface` 写 surface 时 **`emitEvent: false`**（`server.mjs` 3185–3198）。 |
| **RecordsPanel `applyPendingSheet`** | **浏览器侧未取证**（无 DevTools）。磁盘侧：**pending 已在 BFF/闸**；若客户端曾收 SSE，应按 `RecordsPanel.tsx` 1213–1235 行 `remember` + `applyPendingSheet`（`source !== 'lan-assist'` 才处理）。 |

### 3. 产品是否「现查成功自动打开业务记录」；本次卡在哪

| 项 | 判定 |
|---|---|
| **是否有自动开 Tab** | **有**。`src/lib/biz-records-auto-open.ts`：`biz.sheet.pending` → `rememberBizPendingSheet` + 若非 `activeDataSubview === 'operations'` 则 `focusBizRecordsPanel()`；`main.tsx` / `IMScreen.tsx` 均订阅。`focusBizRecordsPanel`（`app.ts` 621–643）把 **`data` 面板 full、`activeDataSubview` → `records`**，其它 full/half 面板收为 tab。 |
| **与 leftover 关系** | **首枪 emit 在 13:12:02**；**leftover 在 13:13:01**（seq 40/42）。leftover **不撤销**已写入 outbox / `pendingSheet` 的首枪表。 |
| **与用户截图（约 13:27，右侧设置/AI 核心）** | **磁盘已证 13:12 应触发一次自动开业务记录**（round-end SSE）。人眼 13:27 仍在设置页 ⇒ **卡在前端导航/事件消费链**（未收到或未执行 `focusBizRecordsPanel`，或之后又回到设置），**不是**「闸没查到 21 行」或「BFF 完全没 emit」。助手 seq 51（**13:27:58**）用 **Markdown 复述 21 张工单**，与右栏未开表 **同时成立**——表在闸里、对话里，不在人所见的业务记录视图。 |
| **RecordsPanel 未挂载时** | 同事件若 `RecordsPanel` 未挂载，依赖 `rememberBizPendingSheet` + 打开 records 后 `useEffect`/`GET /biz/pending-sheet` hydrate（`RecordsPanel.tsx` 1132–1180）。**未现场验证** apply 是否被 `sheetBelongsToSession` / kind 映射挡掉（参见 [sheet-apply-miss.md](./sheet-apply-miss.md)）。 |

### 4. overlay SHA

| 项 | 值 |
|---|---|
| scene-39 `git rev-parse HEAD` | **`8a73914d9b0877da1c086aaf9dfeffddc83d31dc`**（`fix(query-settle): bind settled hop key to user utterance`） |
| `~/.dsh-fde-x/vendor/dsh-lan-assist/{query-settle.mjs,session-round.js,tools.js,index.js,write.js}` ↔ `runtime/vendor-overlays/dsh-lan-assist/*` | **SHA256 逐对相同**（例：`query-settle.mjs` = `de2ed9f57e945e44e202d720c87ec873064b7ad4a850f2c99ae751bf8e481332`） |

---

## 时间线（相对 user seq 8，`1790399135947` ≈ 13:05:35）

| 本地时刻 | seq / 事件 | 说明 |
|---|---|---|
| 13:05:35 | 8 | 用户「停用客户还有哪些没关的工单？」 |
| 13:12:01 | 34→35 | 首枪 `biz_preview` → **21 行** |
| **13:12:02** | **outbox** | **`biz.sheet.pending` / `biz_surfaces`**（round-end） |
| 13:13:01 | 39→40、42 | 第二枪 preview **abort** + `plugin-leftover` |
| 13:27:58 | 51、53 | 助手长文 **21 张表**（无新 preview）；turn 2 结束 |

文件 mtime **13:27:58** 对应助手收尾，不是首枪现查时刻。

---

## 代码锚点（自动开 Tab / apply）

- **Emit：** `runtime/routes/biz.mjs` `emitBizSheetPending`；`runtime/lan-assist-state-watch.mjs` `processOfficialSheet` → `source: 'round-end'`。
- **自动开 Tab：** `src/lib/biz-records-auto-open.ts` `onBizSheetPending`（忽略 `source === 'lan-assist'` 仅；**不忽略** `round-end`）。
- **Apply：** `src/components/biz/RecordsPanel.tsx` `applyPendingSheet`、`useEvents(['biz.sheet.pending'], …)`（同样忽略 `lan-assist`）。
- **结算 leftover：** `runtime/vendor-overlays/dsh-lan-assist/tools.js` `noteToolSheet` + `plugin-leftover` cancel；`session-round.js` `isSettledQueryRepeatLeftover` / `closeRound`。

---

## 与 land / hop-sheet 文档

- [biz-app-production-land.md](../docs/biz-app-production-land.md)：首枪现查应 `querySettled`、重复 preview 走 leftover；本日志 **首枪 1 次成功全量、第二枪 abort**，符合「少打」方向，但 **第二枪仍无 QUERY_SETTLED JSON 进 tool/result**（与 land 4.1.3「先 materialize 再 cancel」的验收点仍有差距）。
- [hop-sheet-stuck-plan.md](../docs/hop-sheet-stuck-plan.md)：「查到了就上台」；本次 **服务端已上台（pending + SSE）**，**UI 未跟到业务记录 Tab**（人停在设置/AI 核心）。

---

## 未证 / 需 DevTools 才能钉死

- 浏览器是否收到 `evt`（`outbox_events.id` 未在本报告展开）、`focusBizRecordsPanel` 是否执行。
- `activeAiSessionId` 与 `session-bc8e60a3` 是否一度不一致导致 `sheetBelongsToSession` 挡 apply。
