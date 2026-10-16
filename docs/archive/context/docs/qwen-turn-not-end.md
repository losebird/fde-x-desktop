# Qwen 验收句：右边 21 行已出，左边仍转、回合不收

## 结论

1. **`biz_preview` 已成功。** 本会话 turn 1 · seq 28（`~/.dsh-fde-x/sessions/.../session-84613257-.../session.v3.jsonl.zstd`）回执 `ok: true`、`listed: true`，`sheet.hitTotal: 21`、`pageSize: 20`、`pageFull: true`；第一跳 `hopWhere` 为 `status=inactive`，工单侧 `not resolved/closed`，`from.rows` **14** 家暂停合作客户。与 [同句 grok 21 行 join](qwen-vs-grok-same-query.md) 同一语义，不是旧稿里的 `WHERE_UNBOUND` 双表，也不是 36+166 拆开全集。右边 **21** 就是这次 hop 交集总量（当前页 20 行 + 总量 21）。

2. **成功之后模型没有打 `search_text`，也没有别的图检索回执。** 整段日志工具只有：`route_intent`、`biz_describe`、三次 `biz_preview`（seq 28 / 32 / 38）。`route_intent` 在 seq 20 返回 `{"intent":"查询","tool":"search_text"}`，但 **`search_text` 从未被调用**。preview 返回后（seq 29 `step/end`），step 3 起模型长 reasoning、又两次按单号补查 `biz_preview`，回执仍是同一页 20 行、`hitTotal` 仍 21——工具都有回执，**不是工具挂起**。

3. **回合不收，是因为 agent 环仍在跑、没有 `turn/end`，不是 UI 漏推结束。** 日志在 seq 30 `step/start`（step 3）之后 **约 282s** 才有 seq 31 首条 assistant（projcache 里 `openStep` step 3、`firstTokenTime: null` 与之一致）。这段时间 **没有** `tool/call`，只有 **Qwen 在 step 3 上长时间 decode reasoning**（逐步枚举 20 张工单）。用户看到的「转了 3 分多钟」与 **step 3 首 token 延迟**对齐。截 log 时已到 step 5 `step/start`，仍 **无** `turn/end`——属于 **模型继续多步 tool loop + 长思考，未收工**，不是 leftover 闸、也不是「turn/end 丢了 UI 才转」。

4. **与 one-bind 是同一条现查线；拖死的是 preview 成功之后的 agent 行为，不是绑定又走记忆/深度检索。** seq 28 走 enrich + hop 计划（`inactive` + 未关工单），正是 [小模型格子落地](small-model-biz-ops-land.md) 要过的路径；**不是** grok 那次的 `replay: true` 旁路。`route_intent` 指向的 **图查询**（`search_text`）与右侧业务表 **并行存在于系统提示里**，但本回合 **实际只走了 biz 线**；左侧「深度搜索」观感来自 **回合仍开 + 意图被标成「查询」/ 长 reasoning 步**（本机源码未检到该四字串；以会话日志为准：**无 `search_text` 执行**）。

---

## 会话与对照

| 项 | 值 |
|---|---|
| 模型 | `sili` · `Qwen/Qwen3.8-27B` |
| 会话 | `session-84613257-63ba-483e-bbc5-3143f9a2c947` |
| 工作区 | `/Users/zxz/Documents/ai-project/fdex测试` |
| 用户句 | turn 1 · seq 9：「停用客户还有哪些没关的工单？」 |
| 日志 | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-84613257-63ba-483e-bbc5-3143f9a2c947/session.v3.jsonl.zstd`（同目录下 **mtime 最新**、含该验收句的一条） |
| 业务页状态 | `~/.dsh-fde-x/lan-assist/state.json` · `sessionId` 同上 · `hitTotal` 21 · `hopWhere` inactive |

相对 [qwen-vs-grok-same-query.md](qwen-vs-grok-same-query.md) 里 Qwen **失败**会话（`session-d65062ff…`）：本次 **绑定已过关**，卡点从「闸 + 误导 hint」变成 **「21 条只返 20 行/pageFull」后小模型补第 21 条 + 极长 reasoning，回合不收**。

---

## 1. 第一次 `biz_preview` 是不是这次 21 行交集？

**是。**

- **调用** seq 27：`kind=工单`、`action=现查`、`speech` 为原句；模型还带 `from`（客户 `状态=停用`）、`patch.status.not=已关闭`（one-bind 下 enrich 仍收成计划里的 `inactive` / not closed，未被整句 `WHERE_UNBOUND`）。
- **回执** seq 28：`ok: true`，`matches` 20 行，`sheet.hitTotal: 21`，`sheet.from.rows: 14`，`hopWhere` 含 `inactive`。
- **Speak** 仍是「最近一页 20 条…」——**总量 21 在 sheet**，与 grok 成功段 `hitTotal: 21` 一致。

---

## 2. 成功之后还调了什么？有没有回执？

| seq | 阶段 | 动作 | 回执要点 |
|---|---|---|---|
| 20 | step 1 | `route_intent` | `intent=查询`，建议工具 `search_text`（**未再执行**） |
| 21 | step 1 | `biz_describe` | 型目录 |
| 28 | step 2 | **`biz_preview`（验收句）** | **成功，21 总量** |
| 31–33 | step 3 | 长 reasoning + `biz_preview`（`TK20241215682 这张是哪家的？`） | `ok: true`，仍 20 行列表，`hitTotal` 21 |
| 36–38 | step 4 | reasoning + `biz_preview`（`工单 TK20241215682 的详情`） | 同上 |
| 40 | — | `step/start` step 5 | 日志截断处；**仍无 `turn/end`** |

**没有** `search_text` / `lineage` / `run_code`。semantic-os `extract-jobs.json` **无**本会话 id。

---

## 3. 为什么回合不 end？

按时间戳（毫秒）：

| 事件 | time | 相对 step 3 起点 |
|---|---|---|
| seq 28 `tool/result`（preview 成功） | 1790354093473 | — |
| seq 30 `step/start` step 3 | 1790354093495 | 0s |
| seq 31 `assistant/message` | 1790354375706 | **+282s（≈4.7min）** |
| seq 32–33 又一次 preview | +4ms / +249ms | 有回执 |

**分类：**

- **不是** 工具挂起（每次 `biz_preview` ~200–300ms）。
- **是** preview 已交表之后，**下一步 LLM 请求长时间无首 token**（step 3 reasoning 极长），随后 **多步 biz_preview 仍不收口**。
- **不是** `plugin-leftover` / 闸拒查（第一次 preview 已 `ok: true`）。
- **不是** 仅 UI 未收 `turn/end`：日志本身 **没有** `turn/end` / `reason: completed`。

projcache（`storages/session_projcache/sessions/session-84613257-….json`）与之一致：`turnBoundary.lastTurn: 1`，`sessionStats.openStep: { turn: 1, step: 3, firstTokenTime: null }`（写 cache 时仍卡在 step 3 首 token 前或等价开步状态）。

---

## 4. one-bind 同线，还是另一条路拖死？

| 路径 | 本回合是否发生 | 与「21 行」关系 |
|---|---|---|
| **one-bind hop 现查**（enrich → `inactive` + 未关工单） | **是**（seq 28） | **右边 21 的来源** |
| **`replay: true` + 手写 steps**（grok 成功旁路） | **否** | — |
| **`search_text` / 图「深度检索」** | **仅 route 建议，未调用** | 与 21 行表 **无因果** |
| **preview 后补单号 / 补第 21 条** | **是**（seq 32、38） | 同一张 21 总量表上重复 list，**不推进 turn/end** |

**一句话：** 绑定与 hop **已按 one-bind 一次打穿**；回合不收是 **Qwen 在已出表后仍长思考 + 追第 21 条的多步 agent 环**，不是现查又掉回 `WHERE_UNBOUND`，也不是记忆检索挂住。

---

## 给 Ace 的一句话

**这次 Qwen 不是「查不到」——seq 28 已是停用客户未关工单 21 条（14 家 inactive）；左边久转是因为 preview 交表后 step 3 等了 ~4.7 分钟才出 reasoning，又连着打单号 preview，日志里始终没有 `turn/end`，且全程没真跑 `search_text`。**

---

## 相关（未改产品）

- [小模型怎么才能精准操作业务数据](small-model-biz-ops-plan.md)
- [同一句 Qwen 和 grok 各走哪](qwen-vs-grok-same-query.md)
- [小模型业务格子落地](small-model-biz-ops-land.md)
