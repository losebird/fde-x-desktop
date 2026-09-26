---
cursor:
  subagentId: "bc-864198b7-ce90-5da7-9a00-ae7edc8025fb"
---

# Ace 手打「待审的费用报销」+「都过一下」未过（session-bc8e60a3）

只读；未改代码、未推远程。对照 [speech-action-authority-land.md](../docs/speech-action-authority-land.md)、[biz-app-production-land.md](../docs/biz-app-production-land.md)、[qwen-records-tab-miss.md](./qwen-records-tab-miss.md)。`FDE_DSH_HOME` = `~/.dsh-fde-x`；scene-39 `losebird/fde-x-desktop` 检出 **`8a73914d`**。

**会话（mtime 最新、同会话含两句）：**  
`~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-bc8e60a3-5df1-44f0-870b-af35515839d7/session.v3.jsonl.zstd`  
模型：`Qwen/Qwen3.8-27B`；工作区：`/Users/zxz/Documents/ai-project/fdex测试`。

---

## 结论

### 1. 句一「待审的费用报销」（应现查 + 待审 where，业务记录表应自动刷新）

| 项 | 判定 |
|---|---|
| **闸是否现查 + 待审 where** | **是**。seq 67 `biz_preview` 参数：`action=现查`，`where` 含 `status/状态=待审`；seq 68 工具 JSON `ok: true`，`action=现查`，`listed: true`，`where` 同上，`hitTotal=96`，`hitTotalState=known`，`querySettled=true`，本页 20 行且样例行状态均为 **待审**，`preview_id` 空，`canWrite=false`。 |
| **BFF 是否 emit `biz.sheet.pending`** | **是**。`runtime/data/fde-workstation.sqlite` → `outbox_events`：**2026-09-26 13:39:28**，`event_type=biz.sheet.pending`，`source=round-end`，`session_id=session-bc8e60a3-…`；payload `kind=费用报销`，`action=现查`，`rows=20`，`sheet.hitTotal=96`，`sheet.querySettled=1`。同会话 `biz_surfaces`：`bsurf_e61545f5…`，`费用报销`，`row_count=20`，时刻对齐 13:39:28。 |
| **为何人要手动刷新才看到新表** | **不是**闸没查、**不是**本句 `QUERY_SETTLED` / leftover 挡掉（turn 3 **completed**，无第二枪 preview）。磁盘已证 **round-end SSE 已写出**；与 [qwen-records-tab-miss](./qwen-records-tab-miss.md) 同类：**前端未消费或未 apply**（或仍展示 13:12 的 **工单** 表直到刷新）。本回合前 outbox 仍有 13:12 的工单 pending；若 `applyPendingSheet` / 自动开 Tab 未吃到 13:39 事件，人会一直看到旧表。**未**在本机开 DevTools 验证 `sheetBelongsToSession` / RecordsPanel 挂载。 |
| **querySettled leftover** | 本句 **仅一枪** preview，**无** `QUERY_SETTLED` 文本、无 `plugin-leftover`。`listBeforeWrite` 仍保留本枪现查表（96 待审、20 行缓存）。 |

### 2. 句二「都过一下」（应过审预览）

| 项 | 判定 |
|---|---|
| **是否走过审路径** | **是**。seq 80 `biz_preview`：`action=过审`，`where` 含 `待审`，`batch=true`（seq 85 第二枪参数相同）。 |
| **recoverWriteIntent / 口语** | 模型显式 `action=过审`；`spoken.json` 中「过一下」在过审 say，「都过一下」同时在列举 say（与 land 单测长句不同）。**jsonl 未落槽位调试字段**；以工具参数 + 回执 `action=过审` 为准。 |
| **TOO_MANY 第一枪（seq 81，≈13:42:32）** | **是**。`ok: false`，`error=TOO_MANY`，hint「一次最多改 100 条」。回执 `sheet.action=过审`，**约 100 行**；行状态 **混合**（regex 统计 JSON 内 `status`：已付款 78、已通过 58、待审 26、草稿 20…，**非**「仅待审」）。**无** `preview_id`。 |
| **是否把未过滤表 apply 到 pending** | **是**。outbox **13:42:32** 第三条 `biz.sheet.pending`：`action=过审`，`rows=100`，`hitTotal` 空；`~/.dsh-fde-x/lan-assist/state.json` → `pendingSheet`：`speech=都过一下`，`action=过审`，100 行，状态分布 已通过/已付款/草稿/待审混杂，`hitTotal`/`querySettled` 均为 null → 与 UI「AI拟改、总数未知」一致。`listBeforeWrite` 仍为句一现查（96 待审），未被覆盖。 |
| **第二枪（seq 86，≈13:45:07）** | 再次 **TOO_MANY**，同形态 sheet；turn 4 **completed**（seq 91 ≈13:49:33），与「13:41–13:45 还在转」时间窗一致。 |
| **querySettled 是否拒掉带 where 的第二枪** | **否**。`settledHopKey` / `previewSettledLookup` 仅在 `plan.action === '现查'` 时建键（`write.js` 1698–1711）；过审 preview **不走**结算重复闸。两枪过审失败原因均为 **TOO_MANY**，不是 `QUERY_SETTLED`。 |

**逻辑推论（有数字证据）：** 句一现查 `hitTotal=96`（待审）**小于** 100，若过审批处理在同一 where 上命中集应 ≤96，不应 TOO_MANY。实际 TOO_MANY 且行集全表混杂 ⇒ **过审列举路径未按 `where=待审` 收敛命中集**（或先拉全表再切片 `rows.slice(0, BATCH_LIMIT)`，`write.js` 1431–1434）。此为 **写批路径 / where 绑定** 问题，不是 query-settle leftover。

### 3. 与「原话定动作 + 查完结算」第一刀改动的因果关系

| 现象 | 因果 | 证据 |
|---|---|---|
| 句一应是现查而非过审 | **否（第一刀目标达成）** | seq 68 `action=现查`，无写令牌；符合 [speech-action-authority-land](../docs/speech-action-authority-land.md)。 |
| 句一 `querySettled` | **部分相关、非致因刷新失败** | `querySettled=true` 为 [biz-app-production-land](../docs/biz-app-production-land.md) 预期；本句无重复现查，**不解释**手动刷新。 |
| 句二应过审预览 | **否（未因第一刀改成现查）** | 两枪均为 `action=过审`；非 leftover 掉写动作。 |
| 句二 TOO_MANY + 脏表 + pending 污染 | **否 / 非第一刀引入** | land 写明第一刀 **未动** pending 合并与写批逻辑；TOO_MANY 来自既有 `BATCH_LIMIT` + `matches` 行数；state-watch 对 `pendingSheet` 指纹变更仍 **round-end emit**（13:42:32），放大 UI 错表。 |
| 业务记录不自动刷新 | **部分（同族、非第一刀独有）** | 13:39:28 已 emit；与 [qwen-records-tab-miss](./qwen-records-tab-miss.md) 同链（SSE → `applyPendingSheet` / `focusBizRecordsPanel`），第一刀未删 emit。 |

---

## 时间线（本地，摘自 jsonl `time` / outbox `ts`）

| 时刻 | seq / 事件 | 说明 |
|---|---|---|
| 13:38:55 | 59 | 用户「待审的费用报销」 |
| 13:39:27 | 67→68 | 现查成功，96 条待审，本页 20 |
| **13:39:28** | outbox | `biz.sheet.pending` 费用报销 **现查** 20 行 |
| 13:40:39 | 73 | turn 3 completed |
| 13:41:50 | 78 | 用户「都过一下」 |
| 13:42:32 | 80→81 | 过审 batch → **TOO_MANY** |
| **13:42:32** | outbox | `biz.sheet.pending` 费用报销 **过审** 100 行 |
| 13:45:07 | 85→86 | 第二枪过审 → **TOO_MANY** |
| 13:49:33 | 91 | turn 4 completed |

（同会话更早：13:05–13:12 工单现查 21 行 + 13:12 pending；13:13 第二枪工单 preview abort + leftover，见 [qwen-records-tab-miss](./qwen-records-tab-miss.md)。）

---

## 代码锚点（只读引用）

- **recoverWriteIntent：** `slots.js` 1960+；`write.js` 1600 `previewBiz` 入口。
- **querySettled / leftover：** `write.js` 1698–1711（仅现查键）；`session-round.js` `isSettledQueryRepeatLeftover`；`tools.js` `noteToolSheet` + `materializeSettledRepeat`。
- **TOO_MANY：** `write.js` 1431–1434，`matches: rows.slice(0, BATCH_LIMIT)`，`sheet.action` 为 `recognized.action`。
- **pending emit：** `lan-assist-state-watch.mjs` `processOfficialSheet` → `emitBizSheetPending(..., source='round-end')`；本 case 三次 outbox 均 `round-end`。
- **前端 apply（未现场验证）：** `RecordsPanel.tsx` `applyPendingSheet`；`biz-records-auto-open.ts` `onBizSheetPending`（忽略 `lan-assist`，**不忽略** `round-end`）。

---

## 未决 / 需后续（超出本报告只读范围）

- 过审 `batch` + `where=待审` 时连接器 / `finishStructured` 行集为何 >100 且未过滤（建议跟 `write.js` 1306+ `allRows` 与 hop where 传递）。
- 浏览器侧为何 13:39:28 SSE 未换表（DevTools EventSource + `GET /biz/pending-sheet` hydrate）。
- `TOO_MANY` 失败回执是否应写入 `officialRoundSheet` / emit pending（当前 13:42:32 已 emit 脏过审表）。
