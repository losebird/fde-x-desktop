# `tool call aborted` 根因（只查因，未改产品）

## 结论（给 Ace）

会话里反复出现的 **`Error: tool call aborted`**，配合 **`turn/end` → `reason: { kind: "aborted", reason: { kind: "user" } }`**，**不等于**你点了停止、又发了一句或手动停生成。

**真正发 abort 的是产品里多处主动调用的 `agent.cancel({ kind: 'user' })` / BFF `session/cancel`**，Harness 把这类取消**统一记账为 `user`**。最近一次（约 **16:01**，~174K tokens、~31s、**4 个并行 tool 同毫秒 abort**）的因果链已用 session jsonl 钉死。

---

## 1. 最近一次 abort：session 证据

| 项 | 值 |
|---|---|
| Session | `session-77396503-7612-415a-9948-70253301d733` |
| 工作区 | `/Users/zxz/Documents/ai-project/fdex测试` |
| 日志 | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-77396503-7612-415a-9948-70253301d733/session.v3.jsonl.zstd` |
| `turn/end` | seq **112**，`16:01:43.191`，`{"kind":"aborted","reason":{"kind":"user"}}` |

### 1.1 本轮没有第二条「真人 user」消息

Turn 3 里唯一的 `user/message`（seq **92**，`16:01:11`）来源是：

```json
"source": { "kind": "plugin", "plugin": "dsh-lan-assist" }
```

正文开头是 **`库里已改上。下面是现查到的现在值…`**（`briefFollowup` / `kind: 'wrote'`），由 **过账成功后的秘书 follow-up** 注入，不是聊天框里你又发了一句。

真人 user 在本会话里只有例如 **15:59:57「继续」**；**16:01 前没有新的 `source.kind === "user"` 消息**。

### 1.2 abort 前后 ~20 条事件（seq 92–112）

| seq | 时刻 | 类型 | 摘要 |
|---:|---|---|---|
| 92 | 16:01:11 | `user/message` | **plugin** follow-up（过账后写信指引） |
| 93–96 | 16:01:29–30 | assistant + tools | `biz_describe` + `biz_preview` + `biz_traces`（step 1，均成功） |
| 98 | 16:01:30 | `tool/result` | `biz_preview` 闸结果：**`action:"新建"`**、`preview_id: pv_c68a88264cf8da07`（模型参数写的是现查，闸落成新建预览） |
| 101–106 | 16:01:42–43 | step 2 并行 | `biz_preview`（现查单号）+ `biz_traces` + 2×`read` |
| 107–110 | 16:01:43.190–191 | `tool/result` | **四个同时** `AbortError` / `tool call aborted` |
| 112 | 16:01:43.191 | `turn/end` | `aborted` / **`user`** |

**没有** jsonl 里的 `disconnect`、`ai/connect` reload、SSE 断流、`stop` 类事件；abort 与 **step 2 第一批 tool 启动 ~200ms** 对齐。

### 1.3 四条同时 abort = 整步并行 cancel

Step 2 一次打出 **4 个 tool**；Harness 在 **取消 agent 本轮** 时会把**同一步里尚未结束的 tool** 一并标 `ABORTED`。因此看到 **2×read + biz_traces + biz_preview** 同毫秒 abort，说明的是 **「整轮 agent cancel」**，不是四个独立失败。

---

## 2. 谁 cancel？为何 DSH 写成 `user`？

### 2.1 Harness 语义

`turn/end.reason.reason.kind === "user"` 在 DSH 里表示 **cancel 请求的 kind 是 `user`**，**不是**「终端用户按了 UI 停止」的独立审计字段。

产品里凡调用：

```js
agent.cancel({ kind: 'user' }, { keepInbox: true })
```

或 BFF **`POST /api/v1/ai/sessions/:id/cancel`** → `session/cancel`，都会落成同一种 **`turn/end` 记账**。

### 2.2 路径 A（16:01 主因）：`session-round` leftover + `biz_preview` 工具尾钩

`runtime/vendor-overlays/dsh-lan-assist/tools.js`：`biz_preview` 返回后 `noteToolSheet()` 若 `outcome.cancel === true`，则：

```js
live.cancel({ kind: 'user' }, { keepInbox: true })
```

`session-round.js` 中 **`isLeftoverAfterCandidate(候选,  incoming)`** 在「本轮已有 **写预览/新建** 候选，又来 **现查**」时为 **true**（实测：候选 `action:新建` + 现查 `no:388419542908928` → **true**）。

**16:01 时间线：**

1. Turn 3 step 1 的 `biz_preview` 把 **新建写预览** 记成 round **candidate**（seq 98）。
2. Step 2 模型按 follow-up 去 **现查单号**（seq 103）。
3. 该次 `biz_preview` 完成时 `noteToolSheet` 判 **leftover 现查覆盖写轮** → **`cancel({ kind: 'user' })`** → 同 step 并行 **read/traces** 全部被掐。

这与 Ace「正在只现查单号、没点停」**一致**：abort 来自 **闸/轮次状态机**，不是停止键。

### 2.3 路径 B（右栏 / W1 同类）：`RecordsPanel.abortLeftoverAskTurn` → `cancelAi`

`src/components/biz/RecordsPanel.tsx`：当 **非现查写预览**（有 `preview_id`）进入 `applyPendingSheet` 时调用 `runtimeApi.cancelAi(sessionId)`，用于清掉上一轮残留的 Ask/思考。

- **会**在右栏收到 **新建/改行** pending 时触发；**不会**在纯现查预览上触发（`shouldCancelDshAfterWritePreview` 排除 `action === '现查'`）。
- 与路径 A **共用** Harness 的 **`user` abort 记账**。

W1（`session-7eaa79f6`）abort 前一步 `biz_preview` 结果同样是 **`action:新建`**（`pv_be623a9d4d2bf17f`），随后现查并行 abort——**同一 leftover/cancel 模式**，不能解读成 Ace 手动停生成。

### 2.4 路径 C：`cancelLeftover(sessionId)`（overlay 内）

`index.js` 的 `cancelLeftover` 在找不到 `cancel` 时也会 `abort()`；同样可能带 **`kind: 'user'`** 记账。本次 16:01 时间戳更符合 **路径 A**（与 `biz_preview` 完成同毫秒）。

---

## 3. 4318 / DSH connect、多进程、流中断？

| 怀疑 | 结论 |
|---|---|
| BFF **4318** reload / 探活 | jsonl **无**对应事件；abort 发生在 **单 session turn 内** tool 并行步 |
| **`ai/connect` / disconnect** | 本次 abort 窗口 **无** disconnect；`dsh-core` 的 `eventAbort` 是 **BFF→核心事件泵** 重连用，**不**解释 session 内 `turn/end user` |
| 多 DSH 进程抢 session | 未看到跨进程 cancel 证据；cancel 调用点均在 **lan-assist overlay + 右栏** |
| SSE 断流 | 无；tool 已发出并在 **200ms 内** 被 cancel |

---

## 4. 工作台前端：Tab、过账、pending、AbortController

| 行为 | 会不会掐正在跑的 chat tool？ |
|---|---|
| **切 Tab** | `AI.tsx` 里 `AbortController` 只包住 **bootstrap**（`connectAi` / list sessions），**不**绑在正在流的 prompt 上；**未见**切 Tab 直接 `cancelAi` |
| **确认过账** | 过账本身走 BFF write；成功后 **秘书 `followup`** 注入 plugin 消息（**开启新 turn**），不是 stop |
| **pending 刷新** | 写预览进右栏会走 **`abortLeftoverAskTurn` → `cancelAi`**（路径 B），可能掐 **同 session 仍在跑的轮次** |
| **AbortController（bootstrap）** | 仅组件卸载/重跑 bootstrap 时 abort **初始化 fetch**，**不是** 16:01 四 tool abort 的直接原因 |

---

## 5. 与 W1 文档的修正

`docs/biz-write-w1-root-cause.md` §3 把 abort 写成「**用户终止本轮（发新话/停生成）**」——**对 Ace 手测表述不准**。

更准确说法：

- **记账：** Harness **`user` = cancel kind**，含 **程序主动 cancel**。
- **机制：** 写预览 candidate + 后续 **现查** → `noteToolSheet` **leftover** → `cancel({ kind: 'user' })`（及/或右栏 `cancelAi`）。
- **独立问题：** 现查被 speech/闸绑成 **新建**（W1 seq 87/94）与 abort **同源不同相**，但都指向 **过账后 follow-up + 轮次状态**，不是「你没停却当你停了」。

---

## 6. 若要修（超出本次范围，仅记录方向）

1. **可观测性：** `turn/end` 区分 `user-ui` / `plugin-leftover` / `records-cancel` / `session-cancel`，不要共用 `kind: 'user'`。
2. **轮次：** 过账后 `wrote` follow-up 与 **新建误预览 candidate** 并存时，**现查单号** 不应触发 leftover cancel（或先 `closeRound` 再 follow-up）。
3. **右栏：** `abortLeftoverAskTurn` 与 secretary follow-up turn 的时序（避免 cancel 误伤正在执行的现查步）。

---

## 7. 关键代码锚点

- `runtime/vendor-overlays/dsh-lan-assist/tools.js` — `biz_preview` → `noteToolSheet` → `live.cancel({ kind: 'user' })`
- `runtime/vendor-overlays/dsh-lan-assist/session-round.js` — `isLeftoverAfterCandidate` / `leftoverQueryCoveringWrite`
- `runtime/vendor-overlays/dsh-lan-assist/gate.js` + `catalog.js` — 过账成功 `briefFollowup({ kind: 'wrote' })`
- `runtime/vendor-overlays/dsh-lan-assist/index.js` — `tryFollowup` → `agent.followup`（plugin user 消息）
- `src/components/biz/RecordsPanel.tsx` — `abortLeftoverAskTurn` → `runtimeApi.cancelAi`
- `runtime/server.mjs` — `POST .../cancel` → `session/cancel`

摘录见 Project store：`internal/tool-call-abort.md`。
