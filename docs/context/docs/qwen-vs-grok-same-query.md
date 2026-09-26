# 同一句「停用客户还有哪些没关的工单？」：Qwen3.8-27B vs grok-4.6

## 结论

1. **同一套闸**：两边都是 `biz_preview` → 同一 overlay 的 `WHERE_UNBOUND`；用户看到的 hint 都是 **「这张单现在查不到。没连业务，不能装成已查待办。」**（不是 connector 掉线文案）。
2. **grok 能「处理」= 在本会话 turn 2 末尾真查到了答案**：`hitTotal: 21`，用户可见回复列出 **21 张未关工单 / 14 家停用客户**（seq 506）。不是靠「拆成 36 个停用客户 + 166 张未关工单」糊弄——那两张表 **没有 join**，答不对原问。
3. **Qwen 处理不了 = 只打了两次同 speech 的 hop 现查，两次同一回执，用户 turn 3 手动停**（seq 76 `reason: user`）。**没拆问、没读源码、没 `replay`**。
4. **`clues.terms` 变空**：槽位 enrich 后 **sheet 上 hop/where 还在**（客户停用 + 工单 not resolved/closed）；是 **lookup 绑定流水线把 terms 滤没** 才闸，不是用户句没讲清。
5. **差距怎么分**：**闸对「跨对象 hop / 带否定状态」稳定拒查** 是共同前提；**恢复完全丢回模型**。grok 在错误 hint 下仍摸到 **`replay: true` + 显式 `steps`**；Qwen 没走到。判 **「模型恢复能力 + 误导 hint」为主**，不是「换大模型 hop 一次就过」，也不是「纯 Qwen 笨、工具无辜」。

---

## 对照会话（本机日志）

| 模型 | 会话 | 用户句位置 | 日志 |
|---|---|---|---|
| Qwen/Qwen3.8-27B | `session-d65062ff-c374-4394-81be-c656e44acfff` | turn 3 · seq 51 | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-d65062ff-…/session.v3.jsonl.zstd` |
| grok-4.6 | `session-634e9ae1-0589-4088-9778-8de789439f45` | turn 2 · seq 53 起 | 同目录 `session-634e9ae1-…/session.v3.jsonl.zstd` |

工作区均为：`/Users/zxz/Documents/ai-project/fdex测试`。

---

## 1. 工具 / 闸 / 错误 / 提示是否同一套？

**是（对 hop 失败路径而言）。**

| 项 | Qwen turn 3 | grok turn 2 |
|---|---|---|
| 工具 | 原生 `biz_describe` ×2 → `biz_preview` ×2 | 大量 `run_code` 内调 `tools.biz_preview`（仍走同一现查） |
| 错误码 | seq 66、71：`ok: false`, `error: "WHERE_UNBOUND"`, `listed: false`, `rows: []` | seq 72、81、213、353、378 等：同码；且 `hint` 文案一致 |
| 用户 hint | 「这张单现在查不到。没连业务，不能装成已查待办。」 | 同上（例如 seq 72 内嵌结果） |
| 底层语义 | overlay `lookup.js`：`where.length && !clues.terms.length` → `WHERE_UNBOUND`（源码里还有一句「筛选条件没对上词表列名…」，被上层包装成「没连业务」） | 同 overlay |

**差异不在闸，在调用方式**：grok 用代码反复试参、读仓；Qwen turn 3 **只有** describe + preview，没有 `run_code`。

---

## 2. grok 最后有没有查出「停用客户的未关工单」？

**有，且是 join 后的 21 行，不是只换策略转圈。**

- **失败段**：同一句 speech 的 hop / `from`+`where` / `steps` 多种组合 → **多次 `WHERE_UNBOUND`**（seq 72、81、213、353、378…）。此时 sheet 常 **仍挂着 turn 1 的 8 条故障工单**（`hitTotal: 8`, `listed: true`），容易让人以为「查到了」——其实是 **旧页 + 新查失败**。
- **成功段**：seq 491 → 493：`biz_preview` 带 **`replay: true`** + 显式 `steps`（客户 `status: inactive` → 工单 `status not resolved/closed`）→ **`ok: true`, `hitTotal: 21`**。seq 500→502 翻第 2 页，仍 21 总量。
- **用户可见结论**（seq 506）：表格列出 **21 张未关工单、14 家停用（暂停合作）客户**，并说明「只预览、不过账」。

**对照**：同工作区 Qwen 会话 **turn 4「继续」**里 grok 曾 **拆开** 查（seq 130 客户 36 行、seq 131 工单 166 行）——那是 **两张无关全集**，**不能**回答「停用客户还有哪些未关工单」。Ace 问的 grok 正例应以 **634e9ae1 turn 2 的 21 行** 为准。

---

## 3. Qwen 卡死的具体动作

| 问题 | 事实 |
|---|---|
| 是否同一句 speech 重试？ | **是**。seq 65 带错形 `where`+`from`；seq 70 **只剩** `kind/action/speech`，speech 仍是原句 → seq 66 与 71 **同一** `WHERE_UNBOUND` + 同构 sheet hop |
| 有没有拆问？ | turn 3 **没有**。未出现「先 inactive 客户、再未关工单」两次 preview |
| 有没有读源码？ | turn 3 **没有** `run_code` / grep / read。仅 `biz_describe`（seq 56–57）+ 上述两次 preview |
| 结束方式 | seq 76 `turn/end`，`reason: user`（手动停），不是模型收工 |

第一次参数错（`not: ["已关闭"]`、口语 relation）属实，但 **第二次只靠 speech enrich 后仍被同一闸打死**——所以「卡死」= **确定性失败 × 无换路**。

---

## 4. hop 之后 `clues.terms` 变空：模型没说清，还是系统吞条件？

**系统绑定阶段把可执行 terms 弄没了；enrich 认为条件是对的。**

Qwen seq 66 回执里 **sheet 已写入**（与 grok 失败形态同类）：

- `hopWhere`：客户 `status` = **停用**
- `where`：工单 `status` **not** `resolved` / `closed`
- `from` / `steps`：`客户 → 工单`
- 同时 **`ok: false`, `WHERE_UNBOUND`, `rows: []`, `listed: false`**

即：**计划/metadata 在 sheet 上，list 接口没打出去**。对应 `lookup.js`：传入 `where` 非空，绑定 + `termFitsCollection` 等滤完后 **`clues.terms.length === 0`** 即拒查。

口语「停用 / 没关」槽位 enrich **能**落到 inactive + not closed；**不是**「Qwen 没说明白所以没 enrich」。Qwen 第一下 JSON 形状错是 **额外** 问题，第二下 enrich 后 **仍** 同一闸。

---

## 5. 模型能力 vs 闸把恢复丢回模型

| 层 | 事实 |
|---|---|
| 闸 | 对「客户 inactive → 工单未关」hop **稳定** `WHERE_UNBOUND`；grok 前段也一样。**不是** grok 免闸 |
| hint | 统一说成「没连业务」，**不告诉** 可 `replay`、可拆 steps、enrich 与枚举「暂停合作」不一致等——**恢复信息为零** |
| grok | 多读源码/测试、试十几种参；最终 **`replay: true` 绕过 enrich** 才出 21 行（seq 490 自述：口语「停用」对枚举） |
| Qwen | 在 **同一误导 hint** 下 **重复同 speech preview**，无源码、无 replay、无拆问 → 用户停 |

**判断**：若只换 Qwen 不改进 hint/闸行为，**仍会大量挂在 hop**。若闸/fix 绑定让 hop 一次过，**小模型也可能一次过**。当前日志下：**共同闸 + 不对称恢复**；写「纯模型问题」或「纯工具问题」都不准。

---

## 给 Ace 的一句话

**同闸、同 `WHERE_UNBOUND`、同「没连业务」瞎 hint；grok 是摸到了 `replay`+`steps` 真查出 21 张，Qwen 是同句 preview 打两遍后你掐的——不是 grok  hop 免疫，也不是 Qwen 没连业务。**

---

## 相关（未改产品）

- [qwen-ticket-unbound-loop.md](qwen-ticket-unbound-loop.md) — Qwen 会话逐步
- [liveev-workbuddy-thought.md](liveev-workbuddy-thought.md) — grok 读多份 lookup 拷贝时的 reasoning（与「两旧版」猜测）
- 闸：`runtime/vendor-overlays/dsh-lan-assist/lookup.js`（`WHERE_UNBOUND`）
