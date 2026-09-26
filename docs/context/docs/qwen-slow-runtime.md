# Qwen3.8-27B 测试为什么特别慢（根因）

## 结论（给 Ace）

1. **慢在硅基上的 Qwen 单步推理，不是闸、不是 biz 工具。**「停用客户…」整回合 **9 分 12 秒**（552s）里，**LLM 往返约 550s（99.5%）**；`biz_preview` / `route_intent` / `biz_describe` 合计 **约 2.4s**。第一次带 `hitTotal:21` 的现查在 **+104s** 就回来了，后面又白等多分钟。
2. **查完还转，是因为 agent 不收口，不是 UI 漏结束。** 表已在 step2 出齐；step3–4 又 **两次同款 `biz_preview`**（各 ~0.25s），step3 单独 **~282s 纯等模型**（日志里整步才落一条 `assistant/message`，中间无 `tool/call`），step5 再 **~132s** 无工具才 `turn/end`。
3. **不是上下文顶满、不是 turn1 排队 429。** turn1 无 `llm/retry`；同会话后面 turn5/7 才有硅基 **429 RATE_LIMIT**。turn1 时窗远未满（会话末 `surfaceTokens` ~85k / 262k 是后面多轮堆出来的）。
4. **和同句 grok 比：Qwen 更慢在「少数几步巨长 reasoning」+「查完还多步」；grok 更慢在「步数爆炸」。** grok turn2 **901s / 47 步**，但单步 LLM 多数 **5–25s**；**21 行首次出现在 +864s**。Qwen **5 步、+104s 就有 21 行**，用户体感久转主要来自 **+104s→+552s 这段模型空转与多步环**。

---

## 日志来源

| 句 | 模型 | 会话 | 日志 |
|---|---|---|---|
| 停用客户还有哪些没关的工单？ | sili · Qwen3.8-27B | `session-84613257-…` turn **1** = **552.3s** | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-84613257-63ba-483e-bbc5-3143f9a2c947/session.v3.jsonl.zstd` |
| 待审的费用报销 | Qwen 新会话 | `session-dd2a5aec-…` turn1 **120.2s** | 同目录 `session-dd2a5aec-…/session.v3.jsonl.zstd` |
| 待审的费用报销（同会话后期） | 同上 | `session-84613257-…` turn **6** **244.0s** | 同上 846 日志 |
| 停用客户（对照） | grok-4.6 | `session-634e9ae1-…` turn **2** **901.3s** | 同目录 `session-634e9ae1-…/session.v3.jsonl.zstd` |

工作区：`/Users/zxz/Documents/ai-project/fdex测试`。

---

## 1. 停用客户 9:12 — 时间拆账

相对 turn1 `turn/start`（seq 5）：

| 相对时间 | 事件 | 墙钟含义 |
|---:|---|---|
| +25s | step1 结束：`route_intent` + `biz_describe` | 模型 ~25s（reasoning ~1.2k 字）+ 工具 ~0.1s |
| +76s | step2 内模型出参 | 本步模型 ~**76.6s**（reasoning ~6.8k 字） |
| **+104s** | **第一次 `biz_preview` 回执，`hitTotal:21`** | 现查 **~1.9s** |
| **+282s** | step3 才出现下一条 assistant | 本步 **~282s 全是等模型**（reasoning ~4k 字），然后又一次 `biz_preview` **~0.25s** |
| +34s | step4 | 模型 ~34s + 重复 preview ~0.23s |
| +132s | step5 | 模型 ~**132s**，无工具 |
| **+552s** | `turn/end` completed | — |

**首 token / 长 reasoning：** session.v3 **没有流式 chunk**；一步只记一条 `assistant/message`，故「step 起点 → 该条 assistant」= **整步 provider 往返**（含排队+reasoning+decode，日志拆不开）。上表即实测拆账。

| 类别 | 秒数 | 占比 |
|---|---:|---:|
| 模型各步合计 | **~550** | **99.5%** |
| 工具合计 | **~2.4** | 0.5% |

---

## 2. 每个工具墙钟（停用 turn1）

| step | 工具 | 墙钟 |
|---:|---|---:|
| 1 | `route_intent` | 55ms |
| 1 | `biz_describe` | 50ms |
| 2 | **`biz_preview`（验收句）** | **1859ms** |
| 3 | `biz_preview`（补查，同 21 条表） | 249ms |
| 4 | `biz_preview`（再补查） | 231ms |

`search_text` **未调用**（`route_intent` 只建议，未执行）。

---

## 3. 硅基：排队？流式停？

| 项 | turn1 停用 | 说明 |
|---|---|---|
| `llm/retry` / 429 | **无** | 10 次 retry 在同会话 **turn5、turn7**（写回后长上下文），不是这句 |
| step 内无 tool 的长洞 | **有**（step3 **282s**、step5 **132s**） | 洞在 **等整步 LLM 完成**，不是 biz 挂起 |
| 流式 | **日志不可证** | `assistant/attempt` 的 `stream` 为空；不能区分「排队」vs「慢 decode」，只能确定 **瓶颈在 sili 往返** |

---

## 4. 查完后还有几步、为什么不 end？

| step | 模型在干什么 | 是否推进答案 |
|---|---|---|
| 3 | 长 reasoning + 按单号再问 + `biz_preview` | **否**（仍 20 行/总量 21） |
| 4 | 再 reasoning + 工单详情 preview | **否** |
| 5 | 长 reasoning，**无 tool** | 才收口 |

**根因：** 小模型在 **已现查成功** 后仍 **枚举/补第 21 条 / 单号确认**，agent 环继续跑；**不是** `turn/end` 丢失，是日志里 **直到 step5 才 completed**。

---

## 5. 待审的费用报销

| 会话 | 总时长 | 结构 |
|---|---:|---|
| `dd2a5aec` 新会话 | **120s** | step1 ~20s + step2 ~19s + **`biz_preview` ~0.23s** + step3 **~81s** 收尾 → completed |
| `84613257` turn6 | **244s** | step1 **~66s** + preview **~0.5s** + step2 **~177s** 长 reasoning → completed |

闸侧已是 **现查 / 待审 where**（见 [speech-action-authority-land.md](speech-action-authority-land.md)）；慢仍 **几乎全在 LLM**，不是报销闸。

---

## 6. 和同句 grok：慢在哪一层？

| 维度 | Qwen turn1 | grok turn2 |
|---|---|---|
| 回合总时长 | **552s** | **901s** |
| **首次 `hitTotal:21`** | **~104s** | **~864s** |
| 单步 LLM | 经常 **30–280s** | 多数 **5–25s**（少数 60–156s） |
| 工具 | 4× `biz_preview`，**<3s** | 40+× `run_code` 内 preview，**~49s** 合计 |
| agent 环 | **5 步**，查完后 **3 步冗余** | **47 步** 试参才 `replay` 成功 |

**一句话：** grok 赢在 **单步快**，输在 **步数多**；Qwen 赢在 **步少、更早出表**，输在 **几步极长 reasoning + 查完不收口**。都不是「工具或闸把 turn1 拖成 9 分钟」。

---

## 给 Ace 的一句话

**9 分 12 秒 ≈ 硅基 Qwen 五步推理占了 9 分半，现查 2 秒就 21 行了；后面 7 分钟是模型在 step3/4/5 长想 + 重复 preview 才 end，不是闸、不是排队（这句没 429）、也不是上下文爆掉。**

---

## 相关（未改产品）

- [qwen-turn-not-end.md](qwen-turn-not-end.md) — 同一停用会话「右边 21 行左边仍转」
- [qwen-vs-grok-same-query.md](qwen-vs-grok-same-query.md) — 同句路径对照
- [speech-action-authority-land.md](speech-action-authority-land.md) — 待审现查验收
