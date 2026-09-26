---
cursor:
  subagentId: "bc-e662aac5-0917-5a0e-95aa-353135fc7357"
---

# Ace 重载后「待审费用报销」现查成功 · 业务记录刷新空表（≈14:11）

对照 [qwen-pending-approve-miss](./qwen-pending-approve-miss.md)、[qwen-records-tab-miss](./qwen-records-tab-miss.md)。scene-39 分支 `cursor/approve-batch-where-9c38` @ `2316d753`；`FDE_DSH_HOME` = `~/.dsh-fde-x`。**未推远程。**

## 会话与证据

| 项 | 值 |
|---|---|
| 重打会话（费用报销句） | `session-fa50fe73-c560-4820-97ac-34169020d64a` · `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/…/session.v3.jsonl.zstd`（mtime ≈14:12） |
| 同工作区旧会话 | `session-bc8e60a3-…`（13:39 现查 96 待审 + 13:42 过审 TOO_MANY 脏表） |
| 现查工具回执（fa50fe73 seq 66） | `ok:true`，`kind=费用报销`，`action=现查`，`hitTotal=96`，`querySettled=true`，本页 20 行 |
| outbox `biz.sheet.pending`（fa50fe73） | **仅** 12:49 工单现查 20 行；**无** 14:11 费用报销 round-end |
| `~/.dsh-fde-x/lan-assist/state.json`（取样时刻） | `officialRoundSheet` **null**；`pendingSheet` = bc8e60a3 **过审** 100 行（`hitTotal` 空）；`listBeforeWrite` = **现查** 20 行、`hitTotal=96`、`querySettled=true` |

## 结论：是不是 2316d753「误杀」成功现查？

**否。** `2316d753` 在 `isEligibleRoundSheet` 增加的 `sheet.ok === false` 只挡 **写预览失败**（如 `TOO_MANY` 空 `matches`），与 fa50fe73 seq 66 成功现查无关。单测 `write-batch-where` 仍要求成功 where 收敛的 96 行过审预览可上台，TOO_MANY 不得成为 official。

本次空表主因是 **上台 / hydrate 链**，不是把成功现查标成 `ok:false`：

1. **`session-round` 的 `handed` 闩**  
   同会话第二句 eligible 表（工单现查 → 费用报销现查）回合结束时，`startRound` 继承 `handed:true`，`closeRound` 里 `emit = official && !handed` → **不再发** `biz.sheet.pending`，与 outbox 缺 14:11 费用报销事件一致。`officialRoundSheet` 在进程内仍会换成新表，但 **无 SSE / 无 BFF `lastEmitted` 刷新**。

2. **GET `/api/v1/biz/pending-sheet` 冷启动**  
   只拼 `officialRoundSheet` + 进程内 `lastEmittedPendingBySession`。Ace / BFF 重载后两者皆空时，即 **返回 `sheet:null`**，RecordsPanel `hydrateFromPending` 清空行 → UI「当前型还没有可展示的行」、总数未知；**未**回退闸内 `pendingSheet` / `listBeforeWrite`（后者磁盘上仍有 96 待审现查快照）。

3. **与 2316d753 的叠加（bc8e60a3）**  
   过审 TOO_MANY 后 `ok:false` 不再进 official 是对的；但若内存 official 为空且 `lastEmitted` 也冷，刷新同样空表。hall `pendingSheet` 仍可能留着 **别会话** 的过审脏表，加剧「对话有数、表没有」。

## 修复（本 commit）

| 文件 | 改动 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/session-round.js` | 回合关闭晋升新 `official` 且身份键变化时 **`handed=false`**，同会话新一句现查/写预览可再 `round-end` emit |
| `runtime/routes/biz.mjs` | GET pending-sheet：official 为空时用 **`sheetForPendingGet(pendingSheet, lastEmitted, sessionId)`** 回退闸内表 |
| `runtime/tests/session-round.test.mjs` | 第二句换型关闭回合 **`emit:true`** |

## 单测

`node --test`：`biz-query-settle`、`write-hop-actions`、`slots-enrich`、`where-by-cell`、`write-confirm-collapse`、`write-batch-where`、`session-round` — **132 pass / 0 fail**。

## 代码锚点

- `session-round.js`：`roundOfficialKey`、`closeRound` emit / `handed`
- `biz.mjs`：GET `/api/v1/biz/pending-sheet`
- `RecordsPanel.tsx`：`hydrateFromPending` → `getBizPendingSheet`
- `lan-assist-state-watch.mjs`：`officialFromState` → `processOfficialSheet`（仅 fingerprint 变时 emit）
