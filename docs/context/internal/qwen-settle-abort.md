---
cursor:
  subagentId: "bc-61eca0fd-c2fb-58b3-9456-fbcadeac45f1"
---

# Qwen 第一刀 4.5 第 1 条手打 · 结算 / abort 只读审

对照：[biz-app-production-plan.md](../docs/biz-app-production-plan.md) §4.5 第 1 条、[biz-app-production-land-review.md](../docs/biz-app-production-land-review.md)（4966f68d / 4.1.3）。只读；未改代码、未推远程。`FDE_DSH_HOME` = `~/.dsh-fde-x`。

**日志（Ace 本次枪，mtime 最新、单用户句、时长与截图一致）：**

`~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-fa50fe73-c560-4820-97ac-34169020d64a/session.v3.jsonl.zstd`

（解压读 `session.v3.jsonl`；工作区 `fdex测试1`，模型 `Qwen/Qwen3.8-27B`，仅 turn 1。）

---

## 结论（四条）

### 1. plan 4.5 第 1 条：**没过**（交集对，收口与停 preview 不对）

| 子项 | 判定 | 依据 |
|------|------|------|
| 仍是停用客户 ∩ 未关工单（交集） | **过** | seq **34** `ok:true`，`sheet.hitTotal:21`，`hopWhere` 客户 `inactive`，首行 **TK20260623126**；右表 21 条 / 第 1–2 页与日志一致。 |
| 表上台后一两句内 `turn/end` | **没过** | 用户 seq **8** → `turn/end` seq **55** 历时 **156.5s（≈2m36s）**；首枪 preview 在 **+95.4s**（seq 33–34），之后仍有 step 4–6 与多枪 preview。 |
| 不要两遍同款 `biz_preview` | **没过** | 同句同 hop 语义下 **3 次** connector 级 `ok:true` 全量回表（seq **34 / 41 / 48**），speak 均为「共 21 条，本页 20 条…」；第 4 枪 seq **52** 被 abort。 |
| 自然结束 | **没过** | `turn/end` seq **55** 为 `kind: aborted`，`reason.kind: plugin-leftover`，非 completed。 |

相对旧枪 `session-84613257`（552s、无 `turn/end`）：**时长明显缩短且回合已结束**，但 **4.5 文案仍属失败**——不能据此开第二刀。

### 2. `Error: tool call aborted`：**plugin-leftover 的 `agent.cancel`，不是连接器查挂**

| 证据 | 内容 |
|------|------|
| seq **53** `tool/result` | `error: { name: "AbortError", code: "ABORTED" }`，可见文案 `Error: tool call aborted`（`isError: true`）。 |
| seq **55** `turn/end` | `{ kind: "aborted", reason: { kind: "plugin-leftover" } }` — 与 land-review 4.1.3「`exec.agent.cancel({ kind: 'plugin-leftover' })`」一致，**不是** `reason.kind: user` 的手动停。 |
| 同回合前序 preview | seq **34 / 41 / 48** 均为 `ok:true`、同一 21 行交集；**无** `ok:false` 连接器错误。 |
| **`QUERY_SETTLED`** | 整段 jsonl **0 次**出现 `QUERY_SETTLED` / `querySettledRepeat`（对 seq 41/48/53 全文检索）。abort **不是**「闸拒重复 preview 的正常 JSON 回执」，而是 **硅基环被 cancel 打断**（与 4966f68d 设计在「命中 repeat + noteToolSheet cancel」路径一致，但本枪 repeat 闸未在日志里留下 QUERY_SETTLED 字符串）。 |

### 3. 为何首枪 21 行后还能再打 preview？

**根因：结算键未拦住「同款 hop、不同请求形状」——不是 overlay 没加载。**

`settledHopKey`（`query-settle.mjs`）把 **`speech` + `targetKind` + `page` + `lookupNo` + `steps/listWhere/hopWhere` + 请求体 `from`** 打进键。本枪三次成功 preview 的 **tool 参数不同**，闸侧 **三次都走完整现查并 `querySettled:true`**，**从未** materialize `QUERY_SETTLED`：

| 次序 | seq | 请求差异（相对 settledHopKey） | 结果 |
|------|-----|--------------------------------|------|
| 1 | **33→34** | `from.where.values`: `["停用","inactive"]` | 写 settle store（键 A）；21 行。 |
| 2 | **40→41** | `from.where.values`: 仅 `["停用"]`（键 B ≠ A） | 再查 21 行，**非** QUERY_SETTLED。 |
| 3 | **47→48** | **无 `from`**，仅 `speech`+`patch`（键 C） | 再查 21 行，**非** QUERY_SETTLED。 |
| 4 | **52→53** | 与 seq **47** 的 arguments JSON **字节级相同** | **193ms** 后以 AbortError 结束；仍 **无** QUERY_SETTLED 文本。 |

**关于「补单号 / TK202412156682」：** jsonl 中 **无** `lookupNo`、**无** `TK202412156682` 的 `biz_preview`。seq **39** 助手片段是 **坏掉的 tool XML**（含 `TK20241215682` 拼写），**不是** 一次成功的单号 preview。截图里的「像查 TK」来自模型乱码，**不是** 换 bind 查单号的 tool 结果。

**1.5s 去抖：** `index.js` `cancelLeftover` 仅在同 session **1.5s 内重复 cancel** 时跳过。本枪 `search_text` 在 **+20s**（seq 26，**首枪 preview 之前**），与 seq 52 abort **无关**；abort 时刻也不符合「去抖导致该 cancel 却没 cancel」——而是 **cancel 已发生并体现为 plugin-leftover turn/end**。

**顺序：** 用户描述「先 search_text 再 biz_describe」与日志一致（seq **26→27** 在 seq **33** preview 之前）；**结算后** 未再出现 `search_text`（land-review #2 在本枪首跳路径上 **未触发**）。

### 4. 现网 overlay 是否含 **4966f68d** 行为：**是（文件级已对齐）**

| 检查 | 结果 |
|------|------|
| 工作台检出 | `git rev-parse HEAD` → **`4966f68d46888bd5d49740f809dbaaf9379747a5`** |
| 三份路径字节一致 | `runtime/vendor-overlays/dsh-lan-assist/{session-round.js,tools.js,index.js,query-settle.mjs}` ↔ `~/.dsh-fde-x/vendor/dsh-lan-assist/*` ↔ `git show 4966f68d:…` 的 **SHA256 相同**（例：`session-round.js` = `b4c5611c…`） |
| 手打时刻核心 | `GET /api/v1/ai/status`：`connected:true`，`pid:90957`，`startedAt: 2026-09-26T04:47:29Z`（约 **12:47**），早于会话 mtime **12:50:40** |

**结论：** 现网跑的是 **4966f68d 的 overlay 源码**；本枪失败 **不能** 用「未重载 / 旧 overlay」解释，而是 **键粒度 + 模型变参 + repeat 路径未在 jsonl 留下 QUERY_SETTLED** 与 **仍多枪全量 preview** 的组合。

---

## 时间线（turn 1，相对用户 seq 8）

| Δs | seq | 事件 |
|----|-----|------|
| 0 | 8 | 用户：「停用客户还有哪些没关的工单？」 |
| +20 | 26–28 | `search_text` → `biz_describe` |
| +95 | 33–34 | 第 1 枪 `biz_preview` → **21 行**，`querySettled:true` |
| +118 | 40–41 | 第 2 枪 preview（`from` 仅「停用」）→ 再 21 行 |
| +134 | 47–48 | 第 3 枪 preview（无 `from`）→ 再 21 行 |
| +156 | 52–53 | 第 4 枪 preview → **AbortError** |
| +156 | 55 | `turn/end` **plugin-leftover** |

---

## 与 land-review 的交叉

- land-review 有条件收下 **4966f68d 实现 + 单测**；并写明 **plan 4.5 Qwen 手打未做** 则整包不能宣告过线。
- 本枪证明：**agent cancel / plugin-leftover 能在现网触发并结束回合**；但 **4.5 第 1 条仍失败**——重复 preview 未被 `QUERY_SETTLED` 收口（日志 0 次），且 **不是**「表上台后一两句内 completed end」。

---

*只读审：subagent `bc-61eca0fd-c2fb-58b3-9456-fbcadeac45f1`，2026-09-26。*
