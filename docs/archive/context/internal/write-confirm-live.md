---
cursor:
  subagentId: "bc-94f53eba-0e68-5c30-ba2e-5307448bd7a5"
---

# 现网新建三次确认 — 只查因（Ace 手测）

对照 [double-confirm-plan.md](../docs/double-confirm-plan.md)。**未改产品、未 reload、未动 5174/4318、未再点过账。**

## 钉死的会话

| 项 | 值 |
|---|---|
| 会话 | `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90` |
| jsonl | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90/session.v3.jsonl.zstd` |
| 工作区（闸 `pendingSheet`） | `/Users/zxz/Documents/ai-project/fdex测试` |
| 新建原话（turn 3） | 新增一笔工单，标题是测试新增功能，优先级是高，负责人是 ace |
| 闸时间线 | `~/.dsh-fde-x/lan-assist/state.json` → `letters[]` |
| BFF outbox | `runtime/data/fde-workstation.sqlite` → `outbox_events`（`event_type=biz.sheet.pending`） |
| 成功过账审计 | 同库 `biz_write_audit`（**仅 HTTP 200 成功写入**；USED/EXPIRED 不进表） |

## 你对号入座的三张（本次「新建」主路径）

计划里三种假说，本次手测 **不用猜**：

| 你看见的 | 钉死结果 |
|---|---|
| **第一张**，点了（可能已写库） | 令牌 **`pv_5348ce5fe857e9df`**。闸 **18:36:46**「写口回了」；`biz_write_audit` **`trace_759402d11f5c45d99a9b26e32b0e9aae`**（工单·新建·`workstation`），变更与预览一致（标题/优先级/处理人）。**BFF 200**（审计存在即成功链路过）。 |
| **马上第二张**，点了报已经用过 | **仍是同一枚 `pv_5348`**，不是第二枚令牌。闸 **18:36:54**「写口拒了 · **USED**」。**BFF 非 200**（闸拒写；UI 走 400 类失败，不进 `biz_write_audit`）。距成功约 **7.8s**。 |
| **左边现查完第三张** | turn 4 秘书在 **wrote follow-up** 后又走出 **`biz_preview` 新建** 链，最终 round-end 推出 **`pv_e34436d10b24df3d`**（**18:38:45** outbox）。中间还有 **`pv_ef66…` / `pv_73ce…` / `pv_90fc…`** 仅在闸发令牌、**无**对应 `biz.sheet.pending` outbox。符合计划第 3 条：**过账后的现查回合里又落成新建写预览**，不是 hydrate 单独复活第一张。 |

结论：**第二张 = 同令牌重复确认（USED）**；**第三张 = wrote 之后秘书轮又发新建预览（新令牌）**。

## 每一次「抽屉可开」的写预览令牌（时间序）

说明：

- **source**：右栏 `RecordsPanel` 主要认 BFF 的 `biz.sheet.pending`（记为 **SSE**）与 `GET pending-sheet`（记为 **hydrate**）。闸里 `letters`「预览令牌」早于或与 outbox 对齐。无 outbox 的行标 **follow-up（闸/工具）**——可能只靠 hydrate 读到 `officialRoundSheet` / `pendingSheet`，是否一定弹抽屉取决于指纹与 `shouldOpenWritePreviewDrawer`，但令牌已发出、表意上仍是「可确认写预览」。
- **BFF 200**：仅统计 **`POST /api/v1/biz/write` 成功**（有 `biz_write_audit` 行）。**USED / EXPIRED** 记 **否（400 类）**。未点击记 **—**。
- **USED**：闸 `letters` 或第二次点对同一 `preview_id` 的语义。

### 同会话、与本次手测相邻（18:33–18:39）

| 时刻 (UTC+8) | `preview_id` | source | 抽屉可开 | 令牌 USED | BFF 200 |
|---|---|---|---|---|---|
| 18:33:30 | （上一跳 `pv_11a0e67b3cf004df` 类过期） | hydrate / 旧 lastEmitted | 可能 | 已 EXPIRED | 否（EXPIRED） |
| 18:33:40 | `pv_bdf14a3458ef9ab7` | **ui**（`POST /api/v1/biz/preview` → `recordSurfaceFromPreview`，**不在 jsonl**） | 是 | — | **18:33:43 是**（`trace_d048562c…`，`record_no` 落库 **388438736044032**；审计 `session_id` 空） |
| 18:35:28 / **18:35:36** | **`pv_5348ce5fe857e9df`** | 闸令牌 / **SSE round-end** | **是（第一张）** | 第一次点后 **是** | **18:36:46 是**（`trace_759402d…`） |
| **18:36:54** | **`pv_5348ce5fe857e9df`**（同枚） | **hydrate**（`lastEmitted` 仍带 `canWrite` 的写预览） | **是（第二张）** | 点击后 **USED** | **否** |
| 18:37:05 | `pv_ef66a4adfc44b299` | follow-up（turn 4 工具 `biz_preview`） | 可能 | — | — |
| 18:37:16 | `pv_73ce1365ac63685e` | follow-up（秘书改口现查前后） | 可能 | — | — |
| 18:37:46 | `pv_90fc48c271b4ef60` | follow-up | 可能 | — | — |
| 18:38:23 / **18:38:45** | **`pv_e34436d10b24df3d`** | 闸令牌 / **SSE round-end** | **是（第三张）** | — | —（本轮未再点确认） |

### 同会话更早（易与 hydrate 叠在一起，非 turn 3 原话）

| 时刻 | `preview_id` | source | 备注 |
|---|---|---|---|
| 18:02:16 / 18:02:30 | `pv_11a0e67b3cf004df` | 工具预览 / SSE round-end | turn 2 口语新建；**18:33:30** 闸 **EXPIRED** |
| 17:10:07 / 17:10:20 | `pv_91f89f9474bcd4fc` | SSE round-end | 更早一轮新建预览 |

## 证据摘录

### jsonl（turn 3 → 4）

- **18:35:28** `tool/result`：`preview_id=pv_5348ce5fe857e9df`，`action=新建`。
- **18:36:46** 用户消息（空文本，多为 wrote follow-up / 手点确认后的回合拼接）。
- **18:37:05** 起：秘书「库已改上」→ 现查/回执工具 → 又出现多枚 `pv_ef66…`、`pv_73ce…`、`pv_90fc…`、`pv_e344…`。

### 闸 `letters`（与上表对齐）

```text
18:35:28  预览令牌 · 工单 标题 · pv_5348ce5fe857e9df
18:36:46  写口回了 · 库里已改上：工单 标题。将名称改为 测试新增功能…
18:36:54  写口拒了 · USED
18:37:05  预览令牌 · 工单 标题 · pv_ef66a4adfc44b299
…
18:38:23  预览令牌 · 工单 标题 · pv_e34436d10b24df3d
```

### `outbox_events`（`biz.sheet.pending`，本 session）

| 时刻 | `preview_id` | `source`（payload） |
|---|---|---|
| 18:02:30 | `pv_11a0e67b3cf004df` | round-end |
| 18:35:36 | `pv_5348ce5fe857e9df` | round-end |
| 18:38:45 | `pv_e34436d10b24df3d` | round-end |

（`pv_bdf14…` 的 outbox **`source=ui`**，`session_id` 为空，与 jsonl 无工具行一致。）

### `biz_write_audit`（本窗口）

| 时刻 | trace_id | action | session_id | 含义 |
|---|---|---|---|---|
| 18:33:43 | `trace_d048562c300b40b19356ab22229aeb6f` | 新建 | （空） | 与 `pv_bdf` UI 预览过账一致 |
| 18:36:46 | `trace_759402d11f5c45d99a9b26e32b0e9aae` | 新建 | `session-0b9d3ea9-…` | **`pv_5348` 第一次确认** |

## 根因（对齐 double-confirm-plan 准备怎么改）

1. **写成功后 UI 仍可能拿同一枚写预览再开抽屉（第二张）**  
   - 闸在成功写后把 `pendingSheet` 清掉（单行新建 → `null`，`gate.js` 488–490）。  
   - 但 BFF **`lastEmittedPendingBySession` 仍保留 `pv_5348` + `canWrite:true`**，直到下一次 `emitBizSheetPending`。  
   - `GET pending-sheet` 走 `sheetForOfficialGet`：**优先返回带 `preview_id` 的 lastEmitted 写预览**（`runtime/biz/connected-kind.mjs` `isHumanWritePreview` / `sheetForOfficialGet`）。  
   - `RecordsPanel` 在 SSE 后还会 **`hydrateFromPending`**（`1165–1184`），成功过账后 `loadSurfaces` 等也会再 hydrate → **同一 `preview_id` 再进 `shouldOpenWritePreviewDrawer`**。  
   - 第二次点击：闸令牌已消费 → **USED**（符合「误点第二下才该看到」的文案，但 **正常路径不该再出现可点确认**）。

2. **wrote 之后秘书轮又落成新建预览（第三张）**  
   - 成功写触发 `followup.roundClose='wrote'`（`gate.js` 508–521）。  
   - turn 4 模型先回执/现查，仍多次 `biz_preview` **新建**（`pv_ef66` → `pv_73ce` → `pv_90fc` → `pv_e344`），与助理文案「刚才那次被闸当成新建了，改成现查」一致。  
   - round-end 指纹变化后 **SSE 推出 `pv_e344`** → 第三张确认。对应计划 **「过账后的现查就是现查」** 尚未满足。

3. **同会话噪音（非主因，但会干扰 hydrate）**  
   - turn 2 的 `pv_11a0` 在 **18:33:30 EXPIRED**；**18:33:40** 另有 UI 预览 `pv_bdf` 并成功写库。说明同一会话里 **lastEmitted / 多枚令牌** 叠在一起，会加重「刚写完又看见确认」的错觉。

## 与计划「收成什么样」的差距

| 契约 | 本次现网 |
|---|---|
| 一句新建只一张确认 | **否**：`pv_5348` 成功后 hydrate/SSE 缓存又露出同枚；wrote 后又出 `pv_e344` |
| 点一次成功即关抽屉、不再确认 | **否**：7.8s 内同枚可再点（USED） |
| 现查不再开确认过账 | **否**：现查回合仍产出新建预览 outbox |

## 复现核对命令（只读）

```bash
# 闸时间线
rg 'pv_5348|pv_e344|写口' ~/.dsh-fde-x/lan-assist/state.json

# outbox
sqlite3 runtime/data/fde-workstation.sqlite \
  "SELECT datetime(ts/1000,'unixepoch','localtime'), json_extract(payload_json,'$.sheet.preview_id'), source
   FROM outbox_events WHERE event_type='biz.sheet.pending'
   AND session_id='session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90' ORDER BY ts;"

# 审计
sqlite3 runtime/data/fde-workstation.sqlite \
  "SELECT datetime(written_at/1000,'unixepoch','localtime'), trace_id, action, record_no, session_id
   FROM biz_write_audit WHERE written_at BETWEEN 1790245900000 AND 1790246300000;"
```

---

**状态**：只读审计完成；未改代码。下一步若改，应按 [double-confirm-plan.md](../docs/double-confirm-plan.md) 四条（写成功收令牌 + 失效 BFF lastEmitted、同一 opening 不留死令牌、wrote 后现查禁止新建预览、不拆 round-end）实施，不在本文件展开补丁。
