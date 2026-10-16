---
cursor:
  subagentId: "bc-40c73890-62a4-55a4-9ab0-8cc0dab564d1"
---

# round-end 已 emit · 右栏仍未 apply（`pv_11a0…`）

对照：[empty-records-panel.md](./empty-records-panel.md)（**Ace 否定**「只是没等到 18:02:30」——round-end 后又等仍见「当前型还没有可展示的行」）。**只查因，未改产品、未 reload、未动 5174/4318、未点过账。**

## 钉死前提（服务端）

| 项 | 证据 |
|----|------|
| Session | `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90` |
| 预览令牌 | `pv_11a0e67b3cf004df`（jsonl / outbox / 现网 GET 一致） |
| `biz.sheet.pending` | outbox **唯一**相关行：`2026-09-24T10:02:30`（+8 **18:02:30**），`id=evt_0mufd571l_000000002`，`source=round-end`，`workspace_cwd=NULL`，payload 含 **完整 `sheet`**、`rows=1` |
| 闸 + GET | 调查时 `GET /api/v1/biz/pending-sheet?sessionId=…` → **1 行** `工单/新建`，`sessionId` 已打戳 |
| SQLite 浮现 | `biz_surfaces` `bsurf_432525ed81d742b5…`，`row_count=1`，`created_at` ≈ **18:02:30** |

**结论句：** 18:02:30 的 pending **已进 outbox（可 SSE 回放）**；Ace round-end 后仍空 ⇒ 问题在 **前端 apply 链**（未把 sheet 画进 `rows`），不是「BFF 没 emit」。

---

## Ace 观察 ↔ UI 状态（代码含义）

人看见：**表体**「当前型还没有可展示的行」、**页脚**「总数未知」、**绿条**「事务底座运行正常」。

- 绿条 = `Data.tsx` `AuthorityStrip`，`view === 'records'` 时显示 → **RecordsPanel 已挂载**，不是未开业务记录页。
- 表体空文案 = `paginatedRows.length === 0`（`RecordsPanel.tsx` ~2023），**不是**整页 `hasSurfacedData === false` 的大 Empty（那样是「还没有 AI 查过…」）。
- `hasSurfacedData` 可在 **`rows=[]`** 时为 true：例如 `surfaces.some(rowCount>0)`（~587–589）→ **SQLite 已有 1 行 surface 元数据，表体仍可空**。
- 页脚「总数未知」= `hitFooterText(listSheetMeta)` 在 **无 known hitTotal** 时固定文案（~104–112）；**成功 apply 新建预览**也常是「总数未知」（pack 无 `hitTotalState`），故 **不能单靠页脚区分「未 apply」与「已 apply 预览」**；与 **空 tbody** 联读 ⇒ **更像从未 `applySheet` 灌行**。

---

## 假设 1：前端没订上 SSE（BFF 重启后 EventSource 死、没重连）

| 子项 | 判定 | 证据 |
|------|------|------|
| BFF 17:57 重启断 SSE | **曾发生** | [clipboard-bff-restart.md](./clipboard-bff-restart.md)；重启后 outbox 首条 `im.unread.changed` **17:58:21** `evt_0mufczuq9_000000001` |
| 18:02:30 前 outbox 无 pending | **是** | `ts BETWEEN 17:58:21 AND 18:02:30` 仅 im.unread + 无 `biz.sheet.pending` |
| 18:02:30 后客户端「永远收不到」 | **不能只靠此结案 Ace 场景** | `src/lib/events.ts`：`onerror` → **指数重连** + **`/api/v1/events/recent` 每 15s 轮询**，轮询 **不依赖 `since`**，会把 recent 50 条再 `dispatchEvent` |
| 连接正常时 live 推送 | **应能收到** | `events.mjs` SSE 连接后 `subscribe` 实时写 envelope；18:02:30 之后 outbox **无更新事件**，不存在「since 跳过更新 id」导致 **第二条** 丢失 |
| 现场是否收到 | **未抓 DevTools** | 无法读 `sessionStorage['fde-x-events-since']` 是否已推进到 `evt_0mufd571l_…` |

**排除力度：** 若 Ace 在 **18:02:30 之后又等了明显超过一轮 poll（≈15s）** 仍空，**单独**「SSE 没订上且永远没轮询到」与现网代码 **不一致**（除非 apply 每次都被挡，见假设 3）。重启窗口 **17:57–17:58** 只解释 **18:02:30 之前** 的空表，**不能**作为 round-end 后仍空的 **唯一** 解释。

---

## 假设 2：`sheetBelongsToSession` / `activeAiSessionId` 丢同会话事件

| 子项 | 判定 | 证据 |
|------|------|------|
| 闸 / outbox session | **一致** | sheet、`session_id` 均为 `session-0b9d3ea9-…` |
| 左栏会话 | **一致** | jsonl 第二轮用户话、工具结果同 session（empty-records-panel §会话） |
| 代码挡法 | **条件成立才挡** | `sheetBelongsToSession`：仅当 `liveSessionIdRef`（= `activeAiSessionId`）**非空**且与 `sheet.sessionId` 不等才 false（`biz-session-sheet.ts` 51–58）；SSE 入口 `RecordsPanel.tsx` 1195–1196 |
| UI session 绑定 | **未现场取证** | `AI.tsx`：`activeAiSessionId` 来自 `chatId` 或 `storedActiveAiSessionId`（须在 `visibleSessions` 内）；DSH 线程与 store **理论上可短暂不一致** |

**排除力度：** **磁盘侧无 session 分叉证据**；**不能排除** runtime 一刻 `activeAiSessionId` 空/错导致 SSE/`GET` apply 被 drop。**未证伪，非首因候选里的「已钉死」项。**

---

## 假设 3：apply 进了又被空表/指纹/dismiss/闸挡掉或盖掉

| 子项 | 判定 | 证据 |
|------|------|------|
| `emitBizSheetPending` 早退 | **否（本次）** | outbox 已有行；BFF 新进程 `lastEmitted` 不挡历史 emit |
| `source === 'lan-assist'` 忽略 | **否** | outbox `source=round-end`；handler 只忽略 `lan-assist`（1183） |
| dismiss | **无书面证据** | 无 cancel 预览 turn；dismiss 需 `sessionStorage` `fde.biz.dismissedPreviewIds`（未读浏览器） |
| `applyPendingSheet` 静默 false | **机制成立** | 例如：`resolveConnectedKind` 在 **catalog 非空但映射失败** 时返回 `''` → **整次 false**（968–975）；`shouldSkipCoveringPending` / `shouldRejectIncomingCovering` / `historyPinnedSurfaceIdRef` / `shouldHoldSideKindView`（写预览 **不 hold**，455） |
| GET 后仍空 | **机制成立** | `activeAiSessionId` effect：`getBizPendingSheet` 若有 sheet 但 `applyPendingSheet` false → **`clearDisplayedForSession()`**（1113–1125），主动清 `rows`/`pending` |
| round-end 后 fingerprint 盖空表 | **次要** | 本次 incoming **1 行新建**；`shouldRejectEmptyIncomingSheet` 在 `displayedRowCount<=0` **不挡**（records-align-root-cause §3.1） |
| 成功 apply 却被「官方空表」盖住 | **不符合 Ace 联读** | 成功路径 `applySheet` 会 `setRows(normalizedRows)`（870）；不应长期 tbody 空而仅官方壳 |

**排除力度：** **与 Ace「round-end 后仍空」最一致**：事件或 GET **可能触达** `rememberBizPendingSheet`，但 **`applyPendingSheet` → `applySheet` 未成功**；且 GET 失败时会 **清空展示**。若轮询/SSE **重复 dispatch** 仍 false → **持续空表**（解释「又等一会仍空」）。

---

## 假设 4：人看的是「当前型」官方表，pending 抽屉/蓝条没开

| 子项 | 判定 | 证据 |
|------|------|------|
| 是否在 records 子页 | **是** | 绿条 AuthorityStrip 仅 `view==='records'` |
| 是否「只有官方表、没 pending UX」 | **部分不符** | 蓝条 `pendingText` 依赖 React `pending` state（1769–1773）；**仅 memory cache 有 sheet、未 apply** 时 **`pending` 可为 null** → **无「AI 拟改…」蓝条**，但 **仍可有型 chip**（`surfaces` / `surfacedKindChips`） |
| 写预览抽屉 | **未开 ≠ 未 apply** | 新建预览成功 apply 应 **主表 1 行 + 抽屉**（`shouldOpenWritePreviewDrawer`）；Ace 是 **主表空** → 不是「只开了抽屉、主表故意空」的正常成功态 |
| `selectKind` 看官方空壳 | **可加重空态** | 已选 `kind` 且无 hit 时 `setRows([])` + staleHint（1493–1495）；发生在 **apply 未灌行** 之后可 **维持**「当前型还没有可展示的行」 |

**排除力度：** **不是**「人故意只看官方表、预览其实在抽屉里」；更像是 **pending 未进入 `rows`/`pending` state**（apply 失败或未触发），**SQLite surface 元数据**让页仍像「有业务记录工作面」。

---

## 假设 5：`GET pending-sheet` 有行，但 round-end 后从不主动拉

| 子项 | 判定 | 证据 |
|------|------|------|
| round-end 后自动 GET | **无** | `hydrateFromPending` 仅 deps `[runtimeReady, workspaceCwd]`（1145–1148），**不因 round-end 再跑** |
| session 不变时 | **无二次 GET** | `activeAiSessionId` effect（1085–1127）只在 **session 切换** 时 `getBizPendingSheet` |
| `biz.sheet.pending` 带完整 sheet | **不依赖 GET** | handler 1184–1198 直接 `applyPendingSheet(stamped)` |
| payload 无 sheet 分支 | **会 GET** | 1222–1224 `hydrateFromPending()`；本次 payload **有 sheet** |
| surfaces 种子 effect | **有 GET 但易跳过** | 1151–1177：仅当 `surfaces.length>0` 且 **`!kind`** 才 GET；**已选当前型则 `if (kind) return`（1154）不再拉** |
| `ai.tool.finished` | **本次无效** | outbox **无任何** `ai.tool.*`；工具完成 **不会**触发持久化 hydrate |
| 18:02:30 前 GET 窗口 | **风险** | 官方/handoff 未完成时 GET 可能空或旧 official → apply 失败则 **clearDisplayed**；之后 **无 session 变化则不再 GET**，只能赌 SSE |

**排除力度：** **代码层钉死**：**round-end 没有「再拉一次 pending-sheet」的定时/事件钩子**；Ace 场景下 **兜底主要靠 SSE（或 15s poll 重放）+ apply 成功**。与假设 3 叠加 ⇒ **SSE/apply 一旦失败，会长期空表**（即使 GET 现在已有 1 行）。

---

## 综合结论（给协调器 / Ace）

1. **不以「再等 14 秒」结案** — 服务端 **18:02:30 已 emit**；Ace round-end 后仍空 ⇒ **前端未成功 apply**。
2. **首因链（机制 + 磁盘）**  
   - **(A) 设计上 round-end 后无 GET 兜底**（假设 5，代码钉死）。  
   - **(B) 触达后 `applyPendingSheet` 未把 sheet 画进 `rows`**，或 GET 路径 **apply 失败并 `clearDisplayed`**（假设 3，与 Ace 现象最一致）。  
   - **(C) `biz_surfaces.row_count=1` 可让页进入「有 surfaced 数据」壳层，**表体仍空**（假设 4 澄清，非「没预览」）。
3. **假设 1** 解释 **18:02:30 前** 空表；**单独**难以解释 round-end 后 **长时间**仍空（除非与 **3** 同现）。  
4. **假设 2** 缺 DevTools，**未排除**但 **无反证 session 分叉**。

---

## 只读复验命令

```bash
# outbox 令牌
sqlite3 …/runtime/data/fde-workstation.sqlite \
  "SELECT datetime(ts/1000,'unixepoch'), event_type, source, id FROM outbox_events WHERE id='evt_0mufd571l_000000002';"

# 闸 GET（与 RecordsPanel hydrate 同路由）
curl -sS -H 'Origin: http://127.0.0.1:5174' \
  'http://127.0.0.1:4318/api/v1/biz/pending-sheet?sessionId=session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90' \
  | rg 'pv_11a0e67b3cf004df|session-0b9d3ea9'

# 浮现元数据（无 rows，但 hasSurfacedData 可为 true）
sqlite3 …/runtime/data/fde-workstation.sqlite \
  "SELECT preview_id, row_count, datetime(created_at/1000,'unixepoch') FROM biz_surfaces WHERE preview_id='pv_11a0e67b3cf004df';"
```

## 关键代码锚点（仓内）

- SSE + apply：`src/components/biz/RecordsPanel.tsx` 1180–1227，`applyPendingSheet` 968–1052  
- GET + clear：`1085–1127`，1151–1177（`kind` 非空则不再 GET 种子）  
- Session 归属：`src/lib/biz-session-sheet.ts` 51–58  
- 事件重连/轮询：`src/lib/events.ts` 134–183，145–152  
- round-end emit：`runtime/lan-assist-state-watch.mjs` → `emitBizSheetPending`（outbox 已证实）
