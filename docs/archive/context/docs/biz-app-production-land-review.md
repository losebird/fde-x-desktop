---
cursor:
  subagentId: "bc-8f518d3e-e60f-582b-90b6-bb449ef5e559"
---

# 第一刀落地只读审（scene-39 / losebird/fde-x-desktop）

**检出：** `71c43570`（叠 `17a62b30` 刷新 GET + `2316d753` 过审批 where + 结算链）。分支 `cursor/approve-batch-where-9c38`，scene-39。`FDE_DSH_HOME` → `~/.dsh-fde-x`。**只读；未改代码、未推远程。**

对照：[biz-app-production-land.md](biz-app-production-land.md)「14:33 红字」、[internal/qwen-records-tab-miss.md](../internal/qwen-records-tab-miss.md)（第二枪 jsonl 无 `QUERY_SETTLED` 文本）。

---

## 结论（07fb1595 · defer leftover cancel · 五必核）

**有条件收下。** 对准 14:33：`71c43570` 叠 `queueMicrotask(cancel)` 仍让 `plugin-leftover` 在 `biz_preview` **return 之后、DSH `dispatchToolBody` 收尾之前**就 abort（`~/.dsh-fde-x` 里 `dsh-tools`：`bodyInvoked` 且 `signal.aborted` → `toolAbortedResult`，成功 JSON 被换成 `AbortError`）；结算闸/state 里已有 `QUERY_SETTLED` 与 transcript 红字并存。本刀 `tools.js` 只 `scheduleLeftoverCancel`（写 Map，**不调** `agent.cancel`）；`index.js` 在 **`session/event` 的 `tool/result`** 上 `flushLeftoverCancel`；`session-round` 给 `closedBy:leftover` / official leftover 补 `settledRepeatFrom`；`tools.js` 再兜底 `materializeSettledRepeat(result)`。对「第二枪 lone `biz_preview`」自造 cancel 而言，**能保证** payload 先按成功路径 materialize、且在 cancel 前走完 dispatch 的 `isAborted` 检查；`tool/result` 事件在 `session.append` 之后同步派发，flush 不应再吃掉当枪 JSON。**不能宣告** 14:33 jsonl 已复验；单测未接真 Harness；`search_text` 仍在 `tool/call` **即时** `cancelLeftover`；并行多工具时任意先到的 `tool/result` 会提前 flush（非本案主路径）。

**DSH 会不会在 tool 函数 return 之前就因本 overlay 的 cancel 写下 AbortError？** — **本刀的 `plugin-leftover` 路径：不会。** execute 返回前只登记 Map。但若 **`scheduleLeftoverCancel` 未注入**（旧 `index`），`tools.js` 仍 `void cancelLeftover`，race 仍在。若 **别的** cancel（用户、`search_text` 的 `tool/call`、同 step 并行工具触发的提前 flush）在 execute 完成前 abort，DSH 仍会 `toolAbortedResult`——那不是本刀声称修的槽。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 第二枪 `biz_preview` transcript 是否应先有 `QUERY_SETTLED` JSON 而非 lone `AbortError` | **机制上应对（未 jsonl 证）。** 去掉 execute 内/旁的 microtask cancel；cancel 挪到当枪 `tool/result` 之后。对照 DSH：`appendToolResult` 在 dispatch 成功且未因 abort 覆写后才 append。 |
| 2 | `scheduleLeftoverCancel` / `flushLeftoverCancel` 是否真「等 tool/result」 | **是（硅基读码）。** Map 登记 → `tool/result` handler → `cancelLeftover`（`keepInbox: true`）。**不是**等 jsonl fsync，是等 session append 事件。 |
| 3 | `closedBy:leftover` 再 `noteToolSheet` 是否仍带 `settledRepeatFrom` | **是。** `session-round.js` 两处分支补字段；单测 `roundsClosed` 第三次 `noteToolSheet` 断言 `settledRepeatFrom`。 |
| 4 | 设置/操作记录子页成功现查 round-end 是否拉记录 | **是（`src/` 静态）。** `shouldFocusBizRecordsForPending`：`现查` + `shouldStageRoundEndPending` 则无视 `operations`；`RecordsPanel` SSE 同规则。**需刷新 5174**，重载核心不刷 Vite。 |
| 5 | 结算键 / 批 where / land 回归 | **未动键与 write 批。** 本机 land 清单 **150/150 pass**（+2：defer-cancel 静态、`现查` focus 静态）。 |

**拒收理由（若坚持）：** 无 14:33 同级 jsonl；或要求单测必须 Harness 断言 `tool/result.content` 含 `QUERY_SETTLED` 字符串（现仅 `readFileSync` 匹配符号）；或并行多 `biz_preview` 也必须零 AbortError。

*本节只读审：subagent `bc-0d2b395c-feeb-550f-a3d1-de28f43a4061`，2026-09-26；commit `07fb1595`，scene-39，`FDE_DSH_HOME` → `~/.dsh-fde-x`；未改代码、未推远程。*

---

## 结论（71c43570 · round-end apply · 五必核）

**有条件收下。** 对准 qwen-records-tab-miss：成功 `round-end` pending 在客户端统一经 `shouldStageRoundEndPending` 才 `remember`/`apply`；`biz-records-auto-open` 与已挂载 `RecordsPanel` 的 SSE 路径在 `activeDataSubview !== 'operations'` 时均调 `focusBizRecordsPanel()`（含人在设置/AI 核心）。新句 `isNewSpokenUtterance` 清 `operationKindViewRef` / `appliedSheetFpRef`，且 `shouldSkipCoveringPending` 对新句返回 false（单测工单→费用）。**未动** runtime `query-settle.mjs` / `write.js` 批 where；**不能宣告** bc8e60a3 已闭环——无 jsonl/DevTools 复验；`17a62b30` 的 `handed`、GET 不读 `listBeforeWrite`、hall 脏表 hydrate 风险仍在。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 成功现查是否 stage + focus 业务记录（含人在设置） | **是（硅基 + 双通道）。** `shouldStageRoundEndPending`：`现查` 且 `rows>0` 或 `querySettled`；写预览需 `preview_id` 且有行。`biz-records-auto-open`：stageable 才 `rememberBizPendingSheet` + 非 operations 则 focus。`RecordsPanel` SSE：`shouldStage` 通过后 `remember`、会话对齐则 `applyPendingSheet`，且 **`activeDataSubview !== 'operations'` 时 focus**（补「Panel 已挂载但人在设置」）。**缺口：** 未证明浏览器收到 evt；`sheetBelongsToSession` / kind 解析仍可能挡 apply（miss 文档未证项）。 |
| 2 | 同会话新一句是否换表、不 hold 旧工单 | **大体是。** `applyPendingSheet` 入口：`isNewSpokenUtterance` 清侧栏 kind 闩与指纹，避免 `shouldHoldSideKindView` 继续 hold 上一句 populated 表。单测：停用客户工单表 → 待审费用报销，`shouldSkipCoveringPending` 为 false。**残留：** 同 speech 仅改 where/hop 字面仍可能被 hold/覆盖逻辑挡住（非本刀目标）。 |
| 3 | `TOO_MANY` / `ok:false` 是否仍不上台 | **是。** `isFailedRoundEndSheet` 认 `ok===false` 与 `error==='TOO_MANY'`；`rememberBizPendingSheet`、`applyPendingSheet`、`hydrateFromPending`、`useEvents` 均 gate。`biz-records-auto-open` 失败 sheet 直接 return，不 remember、不开 Tab。与 `2316d753` runtime 拒 official 一致，客户端不再缓存脏行。 |
| 4 | 是否改结算键或写批 where | **否。** `git show 71c43570` 仅 `src/*` + `biz-pending-stage.test.mjs`；`runtime/vendor-overlays/dsh-lan-assist/{query-settle.mjs,write.js}` 无 diff。 |
| 5 | 回归 146 是否含上一刀测试 | **是（本机 148/148）。** land 清单 8 文件 + 注明 `connected-kind`：`biz-pending-stage` 2 例 + 全套含 `write-batch-where`、`session-round`、`biz-query-settle` 等 → **148 pass**（`connected-kind.test.mjs` 14 例，land 写 146 为计数漂移）。 |

**拒收理由（若坚持）：** 要求 bc8e60a3 级 jsonl + 截图证明 focus；或要求本刀同时修 `handed`/GET `listBeforeWrite`（属 17a62b30 范围，本 commit 未碰 runtime）。

*本节只读审：subagent `bc-5cf20b28-a6b8-5fb3-9009-330bbd56774a`，2026-09-26；commit `71c43570`，`FDE_DSH_HOME` → `~/.dsh-fde-x`。*

---

## 结论（17a62b30 · 业务记录刷新 · 五必核）

**有条件收下。** 对准 [qwen-refresh-empty](../internal/qwen-refresh-empty.md)：`session-round` 在 `closeRound` 晋升新 official 且 `roundOfficialKey` 变化时 **`handed=false`**，同会话第二句换型关回合可再 `emit:true`（单测 `KindOne`→`KindTwo`）；`biz.mjs` GET pending-sheet 在 `sheetForOfficialGet` 为空时回退 **`sheetForPendingGet(pendingSheet, lastEmitted, sessionId)`**（`connected-kind.mjs` 已有命名会话与 cover 规则）。**未动** `query-settle.mjs`、`isEligibleRoundSheet` 的 `ok:false` 拒收、过审 where 批限。**不能宣告** fa50fe73 级 Ace 重载 + 跨会话 hall 污染已闭环：GET **不读** `listBeforeWrite`；`gate.shouldKeepPopulatedListSheet` 仍可能让新现查写不进 `pendingSheet`；land 回归清单 **未含** `biz.test.mjs`（该文件仍断言「不得调用 `sheetForPendingGet`」，与本 commit **冲突**，全跑则 11/12）。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 同会话第二句换型现查，关回合是否再 emit `biz.sheet.pending` | **是（硅基）。** `roundOfficialKey(kind\|action\|speech\|where\|rows\|firstNo)` 变则清 `handed`；`emit = official && !handed`。`session-round.test.mjs`「next send replaces…」显式 `assert.equal(closed.emit, true)`。首句同型重复仍继承 `handed`（未改）。 |
| 2 | GET 刷新能否拿到 96 待审现查（`hitTotal`/结算） | **部分。** 仅当闸内 `pendingSheet`（或 BFF `lastEmitted`）已是 **本 `sessionId`** 的成功现查快照时，`sheetForNamedSession` 能喂出表（本页 20 行 + sheet 上 `hitTotal` 字段若存在）。**不**回退 `listBeforeWrite`（qwen 取样里 96 行在那、hall `pendingSheet` 仍是别会话过审脏表时 GET 仍为 **null**）。无 jsonl / 无 BFF 重载手打复验。 |
| 3 | `TOO_MANY` / `ok:false` 是否仍不进 official / 不上台 | **是。** 本 commit 未碰 `isEligibleRoundSheet`；`write-batch-where.test.mjs` 仍断言 `candidate===null`、`closeRound.emit===false`。 |
| 4 | 会否 hydrate 上一句/别会话旧表 | **跨会话：大体挡。** `sheetForPendingGet` + `sheetForNamedSession` 拒异 `sessionId` hall。**同会话/同 hall 残留：** 仍可能用 **旧 `pendingSheet`**（写过审预览、`shouldKeepPopulatedListSheet` 挡掉新现查覆盖时）；GET **不**按 `ok:false` 过滤 hall 表——`TOO_MANY` 现路径空行，但历史脏行或未清 hall 仍可能上台。与 qwen 文档「加剧对话有数、表没有/表不对」同类风险未在本刀消掉。 |
| 5 | land 回归是否含 `write-batch-where`、结算未改坏 | **是（清单内）。** 本机 `node --test`：`biz-query-settle`、`write-hop-actions`、`slots-enrich`、`where-by-cell`、`write-confirm-collapse`、`write-batch-where`、`session-round` → **132/132 pass**。`query-settle.mjs` diff 相对 `2316d753` 为 0。 |

**拒收理由（若坚持）：** 要求冷 GET 必读 `listBeforeWrite` 或必须 fa50fe73 jsonl 复验；或要求 `biz.test.mjs` 全绿才算回归（需改测试契约，本审未改代码）。

*本节只读审：subagent `bc-30ace66e-982f-5264-beb1-645a03286496`，2026-09-26；commit `17a62b30`，`FDE_DSH_HOME` → `~/.dsh-fde-x`。*

---

## 结论（2316d753 过审批 where · 五必核 · 决策 22）

**有条件收下。** 对照 [internal/qwen-pending-approve-miss.md](../internal/qwen-pending-approve-miss.md) 根因：写批在 `finishStructured` 里用 `rows.length`（连接器未过滤全表，再 `slice(0, BATCH_LIMIT)`）触发 **TOO_MANY**，并把脏 `matches` 升格为回合候选 → round-end **emit 脏过审表**。`2316d753`（分支 `cursor/approve-batch-where-9c38`，scene-39）在批限前用 `sheetWhereFromPlan` + `bindWhereKeys` + `rowsMatchingWhere(allRows, …)` 收敛；成功批预览发 `preview_id` 且 `matches` 仅为命中集；`TOO_MANY` 时 `refuse` + **空 `matches`**，`withSheet` 把 `ok:false`/`error` 打进 sheet；`isEligibleRoundSheet` 拒 `ok:false` → 不进 `officialRoundSheet`、关回合 `emit:false`（单测断言）。**未动** `query-settle.mjs` / `settledHopKey`（决策 22 现查结算键仍仅 `plan.action === '现查'` 时建键）。**不能宣告 Ace bc8e60a3 手打闭环**：无重打 jsonl；句一业务记录自动刷新仍属 pending/SSE 消费链，本 commit 不碰。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 句二场景：96 待审 + 计划/参数带 where 时，过审批是否不再误 **TOO_MANY**、有令牌、行全待审 | **是（硅基 + 与 miss 参数对齐的代码路径）。** `write-batch-where.test.mjs`：216 行混合目录、连接器**不**按 where 过滤，`preview({ action:过审, batch:true, where:待审, speech:都过一下 })` → `ok`、`pv_*`、`rows.length===96`、status 全 `pending`。生产路径与 miss 一致：模型 `biz_preview` 仍带 `where=待审` 时，即使 `enrich` 抹掉 step.where，`stampRecoveredWhereOnPlan` 从 `recovered`/`spec.where` 补回再过滤。 |
| 2 | **TOO_MANY** / 其它 `ok:false` 失败 sheet 是否不再进 officialRound / emit | **是。** 旧行为删：`matches: rows.slice(0,100)`。现 `TOO_MANY` 回执 `matches:[]` + `sheet.ok=false`；`isEligibleRoundSheet` 首行拒 `ok:false`；`noteToolSheet` + `closeRound` 单测：`candidate===null`、`emit===false`。 |
| 3 | 「都过一下」**无 where** 时 `stampRecoveredWhereOnPlan` 是否误造 where 或搞坏无 where 现查 | **现查：不碰。** 函数对 `action==='现查'` 直接 return，且仅在 `previewBiz` 写路径、`!replaying` 调用。**无 where：** `incoming` 空则 return，**不会**从 `listBeforeWrite` 偷 where。残留风险：模型第二枪**既不传** `where`、enrich 也不留 where 时，批写仍对连接器全表做 `hitRows=rows`（与改前同族），需模型或槽位继续带 where——miss 案工具参数**有** where，本刀覆盖该案，不覆盖「纯口语续批、参数也丢 where」。 |
| 4 | land 回归清单是否跑过、结算键是否被改 | **跑过。** 本机 `node --test`：`biz-query-settle`、`write-hop-actions`、`slots-enrich`、`where-by-cell`、`write-confirm-collapse`、`write-batch-where` → **111/111 pass**。`git diff 8a73914d..2316d753`：`query-settle.mjs` **0 行**；`session-round.js` 仅 `isEligibleRoundSheet` 增 `sheet.ok === false` 拒收。 |
| 5 | 硬编码待审 / 费用报销 | **生产 overlay 无。** `write.js` / `where-pass.js` / `session-round.js` 未出现「待审」「费用报销」。单测用泛型 `kind:单据` + vocab clue「待审」，非业务名写死。 |

**拒收理由（若坚持）：** 无 Qwen jsonl 复验；或要求「口语续批、零 where 参数」也必须继承上一枪现查 where（本刀未读 `listBeforeWrite`，`stamp` 只认 `spec`/`recoverWriteIntent` 副本上的 where）。

*本节只读审：subagent `bc-85b9a1c0-4521-5a80-a1fb-0f3d1904246b`，2026-09-26；commit `2316d753`，`FDE_DSH_HOME` → `~/.dsh-fde-x`。*

---

## 结论（8a73914d · 四必核）

**有条件收下。** 本 commit 对准 abort-2 已证伪点：`settledHopKey` 曾用 `ctx.speech`（模型 `biz_preview.speech` 乱加 `TK…` 后缀）→ store **未命中** → 日志无 `QUERY_SETTLED`、leftover 仍 **AbortError**。现键优先 `userSpeech`/`utterance`，`write.js` 收键显式传 `userSpeech`；`session-round` 在 settled-repeat leftover 时带出 `settledRepeatFrom`；`tools.js` 在 cancel 前用其 `materializeSettledRepeat` 再 `JSON.stringify`。本地 `node --test runtime/tests/biz-query-settle.test.mjs` → **10/10 pass**（含新用例 `settled hop key uses user utterance not model speech suffix`）。**仍不能宣告 plan 4.5 / land 手打过线**：未重打 Qwen jsonl；plan 4.4「改绑定仍多步」与 land 决策 22 窄键张力未变。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 键是否 **用户句** 而非模型 `speech` | **是。** `query-settle.mjs`：`userSpeech \|\| utterance`，仅空才回退 `ctx.speech`；`write.js` `settledHopKey({ userSpeech, speech: plan.speech, … })`；`tools.js` `previewBiz` 传 `userSpeech: lastUserSpeech(exec)`（与 `rememberUserSpeech` 链一致）。单测断言 garbled `speech` 与 plain **同键**。 |
| 2 | 模型 `speech` 加 TK 后缀第二次现查是否 **QUERY_SETTLED** | **是（硅基）。** 同 session 首枪 `ok` 后，`preview({ …, speech: garbled })` → `error/querySettledRepeat === QUERY_SETTLED`，`speak` 非空；不依赖 `from`/where 变参进键。 |
| 3 | leftover 是否 **先落 JSON** 还是仍只 AbortError | **应先落 JSON（实现已补链）。** `noteToolSheet` → `settledRepeatFrom` → `toolResult = materializeSettledRepeat(…)` → `payload = JSON.stringify(toolResult)` → 再 `queueMicrotask(cancel)`。单测对 `leftover.settledRepeatFrom` 与第三次 preview 均断言 `QUERY_SETTLED`。**无 bc8e60a3 级 jsonl 复验**；若 `userSpeech` 会话侧为空且仅模型 garbled 句，仍可能回退 `ctx.speech` 老路径。 |
| 4 | 翻页 / 写 / 换句 / 换型 / UNBOUND 是否仍多步 | **是（未回退）。** 既有单测仍 pass：`page:2`、过审 preview、`different hop bind key`、`WHERE_UNBOUND`/`replay` 不 settle；换句改键、换型改 `targetKind`、翻页改 `page`。同句同型同页改 where/from/steps **仍拒**（land 决策 22，非本 commit 范围）。 |

**若拒收：** 仅当坚持「无 Qwen jsonl 不得收」或 plan 4.1.2 字面宽键——与本审「以 land.md + abort-2 根因为准」冲突。

**相对 a886ff32：** +3 行键、`write.js` 传 `userSpeech`、`session-round.settledRepeatFrom`、`tools.js` cancel 前物化；abort-2 所述 miss 键问题在此 commit 闭合。**相对 4966f68d：** 4.1.3 判定未删，leftover 出口补 JSON。下文 §1–§5 含历史 4966f68d/a886ff32 细节；**键与 leftover 物化以本节为准。**

*本节只读审：subagent `bc-733b8ac5-6da2-5a79-b535-4025adef584a`，2026-09-26。*

---

## 结论（a886ff32 收键 · 五必核 · 存档）

**有条件收下（已被 8a73914d 取代：键 miss / jsonl 无 QUERY_SETTLED）。** 对准 qwen-settle-abort 根因：同句 intersection 三次全量现查因 `from`/`where` 字面不同键；本刀把键收成 **原话 + 目标型 + 页码**，`write.js` 在 `previewStructured` 前命中 store 即 `materializeSettledRepeat`；`tools.js` 先 `JSON.stringify(result)` 再 `queueMicrotask` cancel，重复枪应能先看到 `QUERY_SETTLED` JSON。本地 `biz-query-settle.test.mjs` **9/9 pass**（含 from 三连变体）。**仍不能宣告 plan 4.5 过线**：本审未重打 Qwen；plan 4.1.2/4.4 写的「已绑 where/关系」与 land 窄键有张力——**同句同型同页、真改 hop 绑定**会被当成重复现查拒掉；`lookupNo` 已出键，同句补单号可能被误锁。

| # | 必核项 | 判定 |
|---|--------|------|
| 1 | 三种 `from` 变体第二次起是否 `QUERY_SETTLED`、不再 `previewStructured` | **是。** 单测 `repeat 现查 after ok table: model from/where shape changes still QUERY_SETTLED`；闸在 `settledQueries.get` 命中后直接 `return materializeSettledRepeat(cached)`，不进入连接器。 |
| 2 | UNBOUND / 翻页 / 写令牌 / replay / **换目标型** 是否仍允许多步 | **换型、翻页、过审、replay、UNBOUND：是**（`targetKind` / `page` 进键；`replaying`/`picked` 不建键；`previewSettledLookup` 否 UNBOUND/columnMiss/裸 ask）。**同句同型改 where/from/steps 字面：否**（与 plan 4.4「改绑定仍多步」冲突，但与 land 决策 22 / 停 Qwen 变参一致）。leftover cancel 仍不拦翻页/写预览（4966f68d 单测未删）。 |
| 3 | defer cancel 是否先落 `QUERY_SETTLED` JSON，还是仍只 `AbortError` | **应先落 JSON。** `payload = JSON.stringify(result)` → `noteToolSheet` → 再 `queueMicrotask(deferCancel)` → `return payload`。修复的是「同枪结果被 cancel 吃掉」；下一枪若模型仍乱打，仍可能 `plugin-leftover` + AbortError，但第 2–4 枪应带 `QUERY_SETTLED` 文本。**无 session jsonl 复验。** |
| 4 | 键是否锁死「同句先错型再改型」 | **否。** `settledHopKey` 仍含 `targetKind`；改 `kind` 即新键。错绑未结算（UNBOUND/replay）不写 store。 |
| 5 | 硬编码 | **未见。** 无 21/工单/停用业务名；仅固定中文 `SETTLED_REPEAT_NOTE`。 |

**拒收理由（若坚持 plan 4.1.2 字面「型+已绑 where/关系」进键）：** 本 commit 故意删掉 steps/where/from/lookupNo——与 4966f68d 审阅 §2 表格已不一致，以 land.md 为准则收，以 plan 字面则拒。

**相对 4966f68d：** 键语义收窄 + cancel 时序；4.1.3 session-round 路径未动。下文 §1–§5 除键表格外为历史 4966f68d 记录，键行为以 **8a73914d 本节** 为准。

---

## 1. 4.1.3 实现核对

### 1.1 `session-round.js`

- **`isSettledQueryRepeatLeftover(candidate, incoming)`：** 要求 `candidate.querySettled === true`、现查、无写 `preview_id`；`incoming.querySettledRepeat === true` 或 `incoming.error === 'QUERY_SETTLED'` → leftover。
- **`noteToolSheet`：** 在通用 `isLeftoverAfterCandidate` 之前单独分支（355–357），避免「重复 settled 表仍有行」绕开「prev 有行 incoming 0 行」那条旧逻辑。
- **`isPagedLookupContinuation`：** 同 action 现查、均无 preview_id、`incoming.page > candidate.page` → **不算** leftover（244 行）。
- **`notePostSettledHopTool`：** 仅 `search_text`；open round + `candidate` 为已结算现查 → leftover cancel。其它工具名直接 `process: true`、不 cancel。

### 1.2 `tools.js`（`biz_preview`）

- 合并 `result.querySettledRepeat` / `QUERY_SETTLED` 到 sheet 再 `noteToolSheet`。
- `outcome.cancel` 时优先 `exec.agent.cancel`，否则 `rounds.cancelLeftover`。

### 1.3 `index.js`

- `tool/call` + `search_text` → `notePostSettledHopTool` → `cancelLeftover`（带 1500ms 同 session 去抖）。

### 1.4 `query-settle.mjs`（本 commit 小改）

- `materializeSettledRepeat` 在 sheet 上同步打 `querySettledRepeat` + `error: QUERY_SETTLED`，与顶层 result 一致，供 round 判定。

---

## 2. 结算键（4.4 · 仍适用 567d5baa 闸侧）

| 场景 | 行为 |
|------|------|
| 同 session + 同 bind 再打现查 | 连接器拒 + `QUERY_SETTLED`；round **cancel**（4966f68d） |
| 改 where / speech / steps / from、下一页 | 键变或 page 进键 → 允许；单测覆盖 page / 不同 speech |
| 过审/改/删 preview | 有 `preview_id`，不写 settle store；不触发 settled-repeat leftover |
| `columnMiss` / 裸 `askAction` | `previewSettledLookup` false → 不写 store（单测） |
| `replay: true` + steps | 不建 settledKey；二次 replay 非 `QUERY_SETTLED`（单测） |
| `picked: true` | `write.js` 不建键（1698）；**无 noteToolSheet 单测** |

**风险（未因 4966f68d 消除）：** 多条 `listed && ambiguous` 仍可能 `querySettled: true`，同 bind 二次 preview 会被闸拒 + agent cancel；若产品认为「待选不算结算」，应走 `picked` 或改 bind——与 567d5baa 审阅相同。

---

## 3. 单测（`runtime/tests/biz-query-settle.test.mjs`）

本地：`node --test runtime/tests/biz-query-settle.test.mjs` → **10 pass**（8a73914d）。

| 用例 | 锁什么 |
|------|--------|
| speakObjectSetTotal / speakLookup | N 用 hitTotal |
| 同 hop 二次 preview | `QUERY_SETTLED` |
| page:2、过审 | 非 `QUERY_SETTLED` |
| 不同 bind speech | 键不同、可再查 |
| **4966f68d** repeat preview + noteToolSheet | `cancel` + `plugin-leftover` |
| **4966f68d** page / 过审 + noteToolSheet | `cancel !== true` |
| **4966f68d** search_text + notePostSettledHopTool | cancel |
| columnMiss / ask / where 变键 / UNBOUND / replay | 不 settle 或不禁二次 |

**仍缺：** `picked: true`；`hitTotalState: 'unknown'|'incomplete'` 与是否写 store；E2E agent 环。

---

## 4. 与 land.md / plan 4.5

- **4.1.3：** 硅基实现与文案一致；不再只靠 catalog 软约束停环（catalog 跟句仍在，作双保险）。
- **4.4 ok-but-wrong：** where/hop 变更仍允许多步；只禁同绑定再打一遍 + 结算后 search_text 拖回合。
- **4.5：** 本审**未**重跑全量 runtime 测试，**未**手打 Qwen。开第二刀前仍应按 plan 第 1–4 条自测；第 1 条才是 4.1.3 的最终验收。

---

## 5. 硬编码 / 环境

- settle + round 路径无工单/21/待审/停用字面分支；单测 ParentA/ChildB 为 hop 夹具。
- `FDE_DSH_HOME` 默认 `~/.dsh-fde-x`，与 plan §10 一致。

---

*审阅：subagent `bc-8f518d3e-e60f-582b-90b6-bb449ef5e559`，只读，2026-09-26。*
