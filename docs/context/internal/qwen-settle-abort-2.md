---
cursor:
  subagentId: "bc-09089f6d-b15d-5020-b347-bc2d40ac271d"
---

# Qwen 重打「停用客户…」· a886ff32 只读审（bc8e60a3）

对照：[qwen-settle-abort.md](./qwen-settle-abort.md)（上一枪 `fa50fe73`）、[biz-app-production-land.md](../docs/biz-app-production-land.md)。只读；未改代码。`FDE_DSH_HOME` = `~/.dsh-fde-x`；工作区 `scene-39` 检出 **`a886ff32`**。

**日志（fdex 工作区、该句 mtime 最新、与截图工具链一致）：**

`~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-bc8e60a3-5df1-44f0-870b-af35515839d7/session.v3.jsonl.zstd`

模型：`Qwen/Qwen3.8-27B`（seq 16 `assistant/message`）。turn 1 仅用户句「停用客户还有哪些没关的工单？」（seq 8）。

---

## 结论（四条，据 jsonl）

### 1. `Error: tool call aborted` 掐的是哪一次 tool

| 项 | 判定 |
|---|---|
| **tool 名** | **`biz_preview`** |
| **seq** | **`tool/call` seq 39** → **`tool/result` seq 40**（`sourceEventSeqs: [39]`） |
| **是否 QUERY_SETTLED 正常回执** | **否**。整段 jsonl **`QUERY_SETTLED` / `querySettledRepeat` 出现 0 次**；seq 40 仅有 `error: { name: "AbortError", code: "ABORTED" }` 与可见文案 `Error: tool call aborted`（`isError: true`），**无**带 `QUERY_SETTLED` 的 JSON 工具结果。 |
| **是否 plugin-leftover** | **是**。seq **42** `turn/end`：`{ kind: "aborted", reason: { kind: "plugin-leftover" } }`，与 land 4.1.3 leftover cancel 口径一致。 |
| **耗时** | seq 39→40：**219 ms**（未像 seq 34→35 首枪 preview **699 ms** 那样跑完连接器 21 行）。 |

同回合**已成功**的首枪 preview：seq **34→35**，`ok:true`，`sheet.hitTotal:21`，`querySettled:true`，speak「共 21 条，本页 20 条」，首行 **TK20260623126**（与右表 21 条一致）。

### 2. 本回合有没有 `search_text`；没有的原因

| 项 | 判定 |
|---|---|
| **有没有 `search_text` tool/call** | **没有**。turn 1 在 user seq 8 之后，`tool/call` 仅 **`route_intent`（17）**、**`biz_describe`×2（18、27）**、**`biz_preview`×2（34、39）**。 |
| **原因** | **模型未调用**（首跳直接 route + describe + preview，与截图一致）。**不是** land 4.1.3「已结算后 `search_text` → `notePostSettledHopTool` / cancelLeftover」路径：该路径前提是先出现已结算 hop 的 **`search_text` tool/call**，本日志中 **0 次**。catalog「结算后勿再 preview/search_text」仅影响模型/tool 选择，**不能解释「从未出现 search_text call」**——根因是 **Qwen 本回合没选 search_text**（对比 `fa50fe73` 同句在 seq **26** 曾调 `search_text`）。 |

### 3. overlay 是否 **a886ff32**

| 检查 | 结果 |
|---|---|
| scene-39 `git rev-parse HEAD` | **`a886ff3288b32a8ca02bcc971335efcd9cc12282`** |
| `~/.dsh-fde-x/vendor/dsh-lan-assist/{query-settle.mjs,session-round.js,tools.js,index.js}` ↔ `runtime/vendor-overlays/dsh-lan-assist/*` | **SHA256 逐对相同**（例：`query-settle.mjs` = `8c160727…`） |

**是**：现网 vendor overlay 与 scene-39 检出 **a886ff32** 字节一致（收键语义见 land.md：`utterance + targetKind + page`，不含 `from`/where 变参）。

### 4. 相对上一枪 **fa50fe73**：还剩几枪全量 preview

上一枪（`qwen-settle-abort.md`）：同句 **3 次** connector 级 `ok:true` 全量 21 行（seq **34 / 41 / 48**），第 **4** 枪 preview（seq **52→53**）abort。

本枪 **bc8e60a3**：

| 指标 | fa50fe73 | bc8e60a3 |
|---|---|---|
| 成功全量 preview（21 行、`ok:true`） | **3 枪** | **1 枪**（seq 34→35） |
| preview 尝试总数 | 4（第 4 abort） | 2（第 2 abort） |
| 首枪 settle 后再成功的全量 preview | **2 枪** | **0 枪** |

**相对 fa50：成功全量 preview 少 2 枪（3→1）**；首枪结算（seq 35 内 `querySettled:true`）之后，**不再有多余成功全量 preview**，第二枪 seq 39 在 **219 ms** 内 **AbortError + plugin-leftover** 结束回合。

seq 39 参数相对 seq 34：`speech` 被模型改成 **`停用客户还有哪些没关的工单？TK20241215682`**（乱码单号后缀），`where`/`from`/`steps` 形状也变；**未**在日志中形成 `QUERY_SETTLED` 文本，abort 表现仍同 fa50：**leftover cancel，而非闸的 JSON 回执**。

---

## 时间线（turn 1，相对 user seq 8）

| Δs | seq | 事件 |
|---|---|---|
| 0 | 8 | 用户句 |
| +44.8 | 17–20 | `route_intent` + `biz_describe`（并行） |
| +335.2 | 27–28 | 第二次 `biz_describe`（step 3；seq 23–25 有 `llm/retry` 空档） |
| +385.1 | 34–35 | 首枪 `biz_preview` → **21 行**，`querySettled:true` |
| +445.3 | 39–40 | 第二枪 `biz_preview` → **AbortError** |
| +445.3 | 42 | `turn/end` **plugin-leftover** |

jsonl 口径 user seq 8 → `turn/end`：**445.6 s**（含 retry 空档）；fa50 同口径 **156.5 s**。用户口述约 2m25 与 bc8e jsonl 总时长不一致，**以 jsonl 时间戳为准**。

---

## 与 land / 上一审交叉

- land：**同句同型同页**第二次现查应 `QUERY_SETTLED` + 4.1.3 leftover；本枪日志仍 **0 次 `QUERY_SETTLED` 字符串**，第二枪为 **AbortError**。
- 相对 **4966f68d 时代 fa50**：变参多枪全量 preview 收敛为 **1 枪全量 + 1 枪 abort**，但未达到 land 手打验收「表上台后一两句内自然结束、无第二遍 preview 尝试」。
- plan 4.5 第 1 条：交集 **仍过**（21 条 / inactive∩未关）；**收口仍不过**（第二枪 preview + aborted end）。

---

*只读审：subagent `bc-09089f6d-b15d-5020-b347-bc2d40ac271d`，2026-09-26。*
