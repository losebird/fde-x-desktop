---
cursor:
  subagentId: "bc-72cf2216-324f-5923-8be7-fcd67483ec16"
---

# 右栏空表 · `pv_11a8…` 新建预览未上屏（只查因）

对照：[增删改审交互审计](../docs/biz-write-interaction-audit.md)、[BFF 仅重启（clipboard）](./clipboard-bff-restart.md)。**未改产品、未 reload、未动 5174/4318、未点过账。**

## 结论（根因 + 人看见的因果）

| 问题 | 钉死的答案 |
|------|------------|
| 这次 `biz_preview` 有没有 `biz.sheet.pending` / SSE？ | **有，但晚于左栏约 14s**；**不是**工具返回当下。outbox 仅一条：`2026-09-24T10:02:30.249Z`（+8 → **18:02:30**），`source=round-end`，`previewId=pv_11a0e67b3cf004df`，`rows=1`，payload 含完整 `sheet`。 |
| 右栏为什么没 apply？ | **18:01–18:02 观察窗口落在事件发出之前**（工具 **18:02:16**，助手气泡收尾 **18:02:28**，SSE **18:02:30**）。此间右栏没有「即时」触发：`ai.tool.finished` **未进 outbox**（全库无 `ai.tool.*` 行），只能靠 **实时 SSE**；`GET /api/v1/biz/pending-sheet` 也不会在工具完成瞬间自动再拉（无 session 切换、无 `biz.sheet.pending`）。人看见：**左已有预览表/令牌，右仍是「当前型还没有可展示的行」+ 页脚「总数未知」+ 绿条「事务底座运行正常」**——与「闸里已有 1 行新建预览、但 UI 还没收到 round-end 事件」一致。 |
| 与 BFF 重启 / `ai/connect` 时序？ | **不是**「预览在重启前发出、重连把表清掉」。clipboard 重启 **~17:57** → `connect` DSH **26865**（**~17:58:20**）；本次预览在 **18:02:16**，**之后**。重连后 lan-assist **仍持有** pending/official（现网 `GET /api/v1/im/state` 与 `pending-sheet` 均为 1 行、`pv_11a0e67b3cf004df`）。重启带来的风险是 **17:57–17:58 SSE 断线 + 重连**；到 **18:02** 已 connected，**不能**用「重连抹掉已有预览」解释这次空表，主因是 **round-end 延迟 + 无工具完成事件持久化**。 |

**令牌核对：** 会话 jsonl 与 outbox 均为 **`pv_11a0e67b3cf004df`**（助手气泡 **18:02:28** 同文）；任务里的 `pv_11a8e676763cf00e` 与磁盘 **无匹配**，按 **`pv_11a0e67b3cf004df`** 结案。处理人字段为 **`ace`**（非 `acee`）。

---

## 会话与 jsonl

| 项 | 值 |
|----|-----|
| Session | `session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90` |
| 日志 | `/Users/zxz/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90/session.v3.jsonl.zstd` |
| 第二轮用户话 | `2026-09-24T10:01:35.257Z`（+8 **18:01:35**）— 与「新增…测试新增功能…ace」一致 |
| `biz_preview` 调用 | seq **77**，`2026-09-24T10:02:15.801Z`（**18:02:15**），`action=新建`，patch 含 title/priority/assignee |
| 工具结果 | seq **78**，`2026-09-24T10:02:16.398Z`，`ok:true`，`sheet.rows` **1 行**，`canWrite:true`，`sessionId` 已打戳 |
| 助手收束 | seq **83**，`2026-09-24T10:02:28.521Z` — 左栏「预览已出」文案 |

第一轮同会话 **17:10** 亦有 `biz_preview` → outbox `09:10:20` `pv_91f89f9474bcd4fc`（同模式）。

---

## 1. `biz_preview` → `biz.sheet.pending` / SSE

### lan-assist state（BFF `GET /api/v1/im/state`，调查时）

- `pendingSheet`：`工单` / `新建` / `pv_11a0e67b3cf004df` / **1 行** / `sessionId=session-0b9d3ea9-…`
- `officialRoundSheet`：同上（已升格为 round 官方表）

闸侧预览 **成功**；不是 EXPIRED、不是空 kind。

### BFF 事件总线（`outbox_events`）

`1790244100000–1790244160000` 窗口内 **仅**：

```text
2026-09-24 10:02:30 | biz.sheet.pending | round-end | previewId=pv_11a0e67b3cf004df | rows=1 | payload.sheet=有
```

- `workspace_cwd`：**NULL**（前端 workspace 过滤不挡）
- `session_id`：`session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90`
- **无**同窗口的 `ai.tool.called` / `ai.tool.finished`（且全库 **无任何** `ai.tool.*` 持久化行）

### 代码路径（为何晚、为何不是 tool 当下）

1. **AI `biz_preview` 不走** `POST /api/v1/biz/preview` → `recordSurfaceFromPreview(..., emitEvent:true)`（仅 UI 预览会立刻 emit）。
2. BFF `startLanAssistStateWatch` **只盯** `officialRoundSheet` 指纹（`lan-assist-state-watch.mjs`），变则 `emitBizSheetPending(..., source='round-end')`；`onPendingSheet` 写 `biz_surfaces` 时 **`emitEvent: false`**。
3. `biz_surfaces` 插入 `bsurf_432525ed81d742b5…`，`created_at=1790244150252`（≈ **18:02:30**，与 outbox 同拍），`workspace_cwd=scene-39-personal-workstation`。

**结论：** 本次 **有** `biz.sheet.pending` SSE（可回放），但 **在工具返回后 ~14s**，来源 **`round-end`**，不是「工具一返回就推 pendingSheet」。

---

## 2. 右栏为什么没 apply（排除表）

| 假设 | 本次证据 |
|------|----------|
| 闸没预览 / 没 pending | **否** — jsonl + `/state` + `pending-sheet` 均为 1 行 |
| 事件去了别的 session | **否** — sheet / outbox `session_id` 均为 `session-0b9d3ea9-…` |
| 重连后 SSE 没订上 | **次要** — 17:57–17:58 断线；18:02 已 connected；且 **18:02:30 前本来就没有该跳事件** |
| kind 空导致 `emitBizSheetPending` 早退 | **否** — 已发出，`kind=工单` |
| fingerprint 早退 / `shouldSkipCoveringPending` | **否** — outbox 已写入；新 BFF 进程 `lastEmitted` 为空 |
| pending 被 dismiss | **未证** — 无 cancel 写预览 turn；dismiss 需 sessionStorage 记 id |
| 空表盖住预览 | **表象** — `rows=[]` 空态文案；根因是 **未 apply**，不是 apply 后被空表现查覆盖（此窗口无第二条 pending） |
| `sheetBelongsToSession` 挡 SSE | **未证** — 需 UI `activeAiSessionId` 与上表不一致才会挡；jsonl 与左栏同会话，**若**右栏绑错 session 仍可能挡（现场未抓 DevTools） |

**右栏设计上的洞（与 [交互审计](../docs/biz-write-interaction-audit.md) / [对齐根因](../docs/records-align-root-cause.md) 一致）：**

- 文档写的「`pendingSheet` 1s watch → emit」与 **现网 watch 仅 `officialRoundSheet`** 不一致；AI 写预览 **依赖 round-end 延迟 emit**。
- `ai.tool.finished` → `hydrateFromPending` **不持久化**；SSE 断档或早于 emit 的肉眼窗口 → **右栏空**。
- 写预览 `packSheet` 无 `hitTotalState` → 页脚 **「总数未知」**（即使已 apply 也会这样）；本次空表时更像 **尚未 apply**。

---

## 3. BFF 重启 / `ai/connect` 时序

| 时刻（+8） | 事实 |
|------------|------|
| ~**17:57** | BFF **10640 → 26724**（[clipboard-bff-restart](./clipboard-bff-restart.md)）；4318 换新进程 |
| ~**17:58:20** | `POST /api/v1/ai/connect`；DSH **PID 26865**；`connected: true` |
| **18:01:35** | 同会话第二轮用户话（jsonl） |
| **18:02:16** | `biz_preview` 工具结果入闸 |
| **18:02:28** | 左栏助手确认预览（人此时最易看右栏） |
| **18:02:30** | 首条（且唯一）`biz.sheet.pending` 入 outbox / SSE |

**不是**「预览在重启前、重连清空」：** 预览在 connect 之后**；** 闸状态至今仍保留。重启相关的是 **事件通道在 17:57 曾断**；对 **18:02** 空表，主因是 **round-end 晚于左栏展示**，而非重连清表。

---

## 4. 人看见的因果（一句话）

左栏读的是 **工具 jsonl/气泡（18:02:16–28）**；右栏要等 **BFF `round-end` 的 `biz.sheet.pending`（18:02:30）** 或 **实时 `ai.tool.finished`（未持久化）** 才会 `applyPendingSheet`。在 **18:01–18:02** 看右栏，**事务底座正常、表体空、页脚总数未知**，是 **「闸里已有预览行，UI 事件还没到」** 的典型时间窗，而不是「没预览」或「重启把预览删了」。

---

## 5. 复现核对命令（只读）

```bash
# jsonl 令牌与时间
zstdcat …/session-0b9d3ea9-…/session.v3.jsonl.zstd | rg 'pv_11a0e67b3cf004df|biz_preview'

# 闸
curl -sS -H 'Origin: http://127.0.0.1:5174' \
  'http://127.0.0.1:4318/api/v1/biz/pending-sheet?sessionId=session-0b9d3ea9-00d4-42cc-9fe6-29d8a6651e90'

# SSE 是否发出
sqlite3 …/fde-workstation.sqlite \
  "SELECT datetime(ts/1000,'unixepoch'), event_type, source, json_extract(payload_json,'$.previewId') FROM outbox_events WHERE ts BETWEEN 1790244100000 AND 1790244200000;"
```
