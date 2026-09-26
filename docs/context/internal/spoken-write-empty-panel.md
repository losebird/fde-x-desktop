---
cursor:
  subagentId: "bc-b22bee18-866d-5176-b735-ece0fe7fbdfd"
---

# 口语进库后右栏空表 · `pv_11a0e67b3cf004df`（只查因）

对照：[spoken-write-fix.md](./spoken-write-fix.md)、[sheet-apply-miss.md](./sheet-apply-miss.md)、[empty-records-panel.md](./empty-records-panel.md)、[clipboard-bff-restart.md](./clipboard-bff-restart.md)。**未改产品、未 reload、未动 5174/4318、未点过账。**

## 钉死事实（服务端）

| 项 | 值 |
|----|-----|
| Session | `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90` |
| 令牌 | `pv_11a0e67b3cf004df` |
| `GET /api/v1/biz/pending-sheet` | `kind=工单` `action=新建` `rows=1` `canWrite=true` `sessionId` 已打戳 |
| `GET /api/v1/im/state` | `pendingSheet` / `officialRoundSheet` 同为该令牌，1 行 |
| outbox | `2026-09-24T10:02:30`（+8 **18:02:30**），`source=round-end`，payload 含完整 `sheet` |
| `biz_surfaces` | `row_count=1`，`created_at` ≈ 18:02:30 |
| jsonl 工具结果 | `18:02:16` 已有同形 `sheet.rows`；**无** `ai.tool.*` outbox 行 |

同会话第一轮预览 `pv_91f89f9474bcd4fc`（17:10 outbox）与本次 **speech / rows / columns / changes / canWrite / sessionId** 结构一致，仅 `previewId` 不同。

---

## 1. pending sheet：口语进库前 vs 后（闸 → 右栏）

对 **RecordsPanel 实际消费的** `sheet`（outbox / GET / `im.state`），不是 lan-assist 内存里的 `token`：

| 维度 | 17:10 `pv_91…` | 18:02 `pv_11a0…` | 结论 |
|------|----------------|------------------|------|
| `kind` / `action` | 工单 / 新建 | 同左 | 无差 |
| `sessionId` | 同会话 | 同左 | 无差 |
| `rows` | 1 行，`assignee: ace` 等 | 同左 | 无差 |
| `canWrite` | true | true | 无差 |
| `columns` / `changes` / `where` / `speech` | 同句口语 | 同左 | 无差 |
| payload 顶层 `patch` | **无**（未进 emit sheet） | **无** | 无差 |
| `workspace` | `""` | `""` | 无差 |

**git `c184266b` 改的是闸内 `bindWritePatch` / `stripRelationKeys` / `shapePatch` / `approveNextStatusCode`：** 过账用 `token.patch` 与 where 关系绑定；**`packSheet` → `officialRoundSheet` → `emitBizSheetPending` 推给 BFF 的 sheet 形状未变**。本次 jsonl 里工具层 `patch` 仍含口语 `assignee:"ace"`（与进库前一致），右栏吃的 `rows[].fields` 仍是口语展示值。

**和「以前右栏有表」不矛盾：** 17:10 同会话、同话术已走过一轮；闸里两张 preview 对右栏是 **同一张表的两次令牌**，不是「进库后 sheet 变空」。

---

## 2. `applyPendingSheet`：对这张 sheet 会走的 `false`

锚点：`src/components/biz/RecordsPanel.tsx` `applyPendingSheet`（约 959–1047）。  
输入即 GET 返回的 `pv_11a0` sheet：`rows.length===1`，`preview_id` 有，`action===新建`，`kind===工单`。

在 **`displayedRowCountRef === 0`**（Ace 看见的表体空）前提下，按代码顺序：

| 行 | 条件 | 对本次 sheet |
|----|------|----------------|
| 965–967 | `kindCatalog` 非空且 `resolveConnectedKind` 失败且非 gated write | **否** — `isWritePreviewSheet` + `incomingSheetRowCount>0` 走 gated write，不因型映射失败而 `false` |
| **973** | `liveSessionIdRef` 非空且 `!sheetBelongsToSession(next, liveSid)` | **是（若右栏 `activeAiSessionId` 与 `session-0b9d3…` 不一致）** — SSE 入口 1181 同样静默 `return`，不调用 apply |
| 975 | 无行且无 kind | **否** |
| 976 | `shouldSkipCoveringPending(displayed, incoming)` | **仅当** `displayedSheetRef` 里仍有 **上一轮同 speech、且有行** 的 sheet 时 `true` → `false`；会 **挡掉第二次 apply**，但应 **保留旧行**，单独难以解释「表体全空」（除非中间又被 `clearDisplayedForSession` 清过 `rows`） |
| 977 | `shouldRejectIncomingCovering` | **否** — `displayedRowCount<=0` 时函数直接 `false` |
| 978–979 | history pin | 无 pin 证据则 **否** |

若 **973 不成立** 且事件到达，应落到 `applySheet` → `setRows(1)`。Ace **round-end 后仍空** 且磁盘 sheet 完好 ⇒ 更可能是 **(A) 事件未进 apply（973/1181 会话闸）** 或 **(B) session 切换/GET 时 `applyPendingSheet` 曾 `false` 触发 `clearDisplayedForSession`（1085–1131），表体被主动清空且 **round-end 后无二次 GET**（[sheet-apply-miss.md](./sheet-apply-miss.md) 假设 5）。

**不是** `c184266b` 的 `stripRelationKeys` / `displayPatch` 字段导致 `applyPendingSheet` 早退：那些字段 **不在** emit 的 `sheet` 里。

---

## 3. `c184266b` 是不是右栏空的引入点？

| 改动 | 影响右栏 `sheet`？ | 影响 apply？ |
|------|-------------------|-------------|
| `relation-bind.js` + `bindWritePatch` → 失败时 `stripRelationKeys` | **否**（仅 `token.patch` / 过账） | **否** |
| `shapePatch` / `resolveRelatedId` | 展示仍 `displayPatch`；本次 assignee 仍在 `rows` | **否** |
| `lookup` `bindWhereRelationTerms` | 现查 where，非本次新建 emit | **否** |
| `packSheet` / `officialRoundSheet` watch | **diff 未改** | **否** |

**结论：** 右栏空 **不是** `c184266b` 把 pending sheet「裁成 0 行」或改掉 `canWrite` 引入的；与口语进库的 **时间耦合** 来自 **同一天加载 overlay（17:41 vendor + DSH 重连）+ 17:57 BFF 重启 + 18:02 第二轮同话术预览**，而不是 stripRelationKeys 直接打 apply。

---

## 4. BFF 重启（17:57）在因果里占几成

| 层 | 权重（叙事） | 说明 |
|----|--------------|------|
| **主因** | ~70% | 产品设计：右栏 **不读** jsonl/工具；写预览 **只** 在 `officialRoundSheet` 指纹变时 `round-end` emit（`lan-assist-state-watch.mjs`）；**无** round-end 后自动 `GET pending-sheet`；`ai.tool.finished` **未持久化**。左栏 18:02:16–28 已有表，右栏要等 18:02:30 事件 + apply 成功。 |
| **叠加** | ~25% | 17:57 4318 换新进程 → SSE 曾断、需重连；session effect 可能 **GET → apply 失败 → clearDisplayed**；与口语进库 **同天** 但 **不删闸里预览**（18:02 预览在 connect **之后**）。 |
| **c184266b sheet 形变** | ~0% | 见 §1、§3。 |
| **口语进库「刀」本身** | ~5% 标签 | 主要是 **换闸逻辑 + 运维动作（重连/重启）** 让 Ace 在 **第二轮** 撞上已知的 apply/事件裂缝，而非 packSheet 输出变了。 |

重启 **不是**「主因单独够用」：没有 round-end/apply 裂缝，重启 alone 不会制造「闸有 1 行、表体长期空」。重启 **放大** 事件与 GET 时序问题。

---

## 5. 给 Ace 的一句话因果（非清单）

以前你觉得右栏「跟着出表」，是因为左栏一说话，工具结果里 **已经带了整张 sheet**，人眼默认右边该同步。口语进库那天我们换了闸里写预览、重连了 DSH、又重启了 4318——**右栏吃的数据结构并没变**，但右栏 **从来只认** 后台晚一步推过来的 `biz.sheet.pending`，不认左边工具 JSON。这次闸里 **`pv_11a0` 预览是齐的**（GET、state、outbox 都是 1 行可写），空的是 **浏览器没把这张 sheet 画进 `rows`**：要么会话 id 在入口被挡掉，要么 apply 失败后被清空，而 **round-end 之后页面不会再主动拉一次 pending**。所以不是「进库把表裁没了」，是 **「左快右慢 + 只推一次、不补拉」** 的老缝，在同话术第二轮 + 重启后更容易踩中；**不是** 让你「再等 14 秒」就能当根因结案（你已否定），也 **不是** 立刻该上表改 UI 才能理解的闸数据问题。

---

## 代码锚点

- `applyPendingSheet` / SSE：`RecordsPanel.tsx` 959–1047，1165–1183  
- GET + clear：`1089–1133`  
- `sheetBelongsToSession`：`biz-session-sheet.ts` 51–58  
- `shouldSkipCoveringPending`：`connected-kind.ts` 291–317  
- `c184266b` `bindWritePatch`：`write.js` 1410–1435；新建 emit：`1108–1132`  
- round-end：`lan-assist-state-watch.mjs` `processOfficialSheet`
