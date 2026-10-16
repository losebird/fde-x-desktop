# Qwen 查「停用客户未关工单」为何一直思考、两次 WHERE_UNBOUND

## 结论（先读）

**不是「没连业务」。是工具闸 `WHERE_UNBOUND` 把跨对象现查拦住了；Qwen 在同一输入下打了两次，拿到同一条确定性回执，于是多步空转，你在第 3 轮手动停了。**

- **工具真问题**：`biz_preview` → `lookup.js` 在「模型/槽位仍带着 where，但绑定后的 `clues.terms` 为空」时固定回 `WHERE_UNBOUND`，**不打**带条件的 `:list`。
- **模型也添乱**：Qwen 第一下 `biz_preview` 的 `where` 形状不对（见下）；第二下只留 `speech`，槽位又从原话 enrich 出同一套 hop，**回执仍相同**。
- **同会话 grok**：**同一句、同构 hop**（`from` + `inactive` + `not resolved/closed`）也会 `WHERE_UNBOUND`；但 grok 会**拆开**先 `status=inactive` 查客户、再查未关工单，能出数。不是「只有 Qwen 会挂」。
- **硅基 developer / 推理档**：**与本条无关**。本日志里 Qwen 请求头只有 `provider: sili`、`model: Qwen/Qwen3.8-27B`，**没有** `reasoningEffort`；会话能正常调工具，不是 400/developer 那条线。

---

## 证据来源（本机，不猜）

| 项 | 值 |
|---|---|
| 会话 | `session-d65062ff-c374-4394-81be-c656e44acfff` |
| 工作区 | `/Users/zxz/Documents/ai-project/fdex测试` |
| 日志 | `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-d65062ff-c374-4394-81be-c656e44acfff/session.v3.jsonl.zstd` |
| 用户话 | turn 3 · seq 51：`停用客户还有哪些没关的工单？` |
| 结束 | turn 3 · seq 76：`turn/end` · `reason: user`（手动停） |

---

## 1. `WHERE_UNBOUND`：绑不上还是 Qwen 参数错？

**两层都要算：Qwen 第一下参数错；槽位 enrich 后计划看起来对了，lookup 仍拒。**

### Qwen 实际发出的参数（seq 65）

```json
{
  "kind": "工单",
  "action": "现查",
  "speech": "停用客户还有哪些没关的工单？",
  "where": [{ "keys": ["状态"], "not": ["已关闭"] }],
  "from": {
    "kind": "客户",
    "relation": "工单",
    "where": [{ "keys": ["状态"], "values": ["停用"] }]
  }
}
```

问题点：

- 工单侧：`keys` 只有泛化「状态」；`not` 应是布尔 + 枚举 value，不是 `["已关闭"]` 这种数组。
- `from.relation` 是口语关系名，不是 schema 外键列名（后面 enrich 会改成 steps/hopWhere，但 lookup 仍可能卡在子条件绑定）。

### 工具回执（seq 66）—— enrich 后的计划 vs 结果

回执 `ok: false`，`error: "WHERE_UNBOUND"`。`sheet` 里已经带上 enrich 后的 hop（说明**不是**「完全没 enrich」）：

- `hopWhere` / `from`：`客户` · `status` = **停用**
- `where` / 第二步：`工单` · `status` **not** `resolved` / `closed`
- `steps`：`客户 → 工单`
- 但 **`listed: false`，`rows: []`** —— 没有成功列出目标工单表

闸的代码语义（`lookup.js` 695–702）：**传入的 `where` 非空，绑定流水线结束后 `clues.terms` 为空** → `WHERE_UNBOUND`（hint 包装成「这张单现在查不到。没连业务…」——文案容易误导，**不是** connector 掉线）。

**哪一格被扔掉（根因落点）**：

- 客户「停用」在 **sheet 元数据**里还在（enrich 写入 `hopWhere`/`steps`）。
- 本轮 **lookup 拒查**时表体为空，符合 **hop 第二跳之前或第二跳上「工单 status 条件」绑定后 terms 归零** 的路径（与 [hop-sheet-stuck-root.md](hop-sheet-stuck-root.md) 里「条件被关系绑定丢掉 → WHERE_UNBOUND、不打 tickets:list」同类；本 session 是 Qwen 路径，且 **listed:false**）。
- 工单侧 enrich 用的是 **`not` + `resolved`/`closed`**（seq 66 sheet），与口语「没关」在槽位里常见的 **closed 枚举取反** 一致；若 schema/枚举与这对 code 对不齐，**整段 term 会在绑定阶段被清空**，触发 `WHERE_UNBOUND`。
- Qwen 第一下的 **`not: ["已关闭"]`** 是模型 JSON 形状错误；即便 enrich 改成 `resolved`/`closed`，**仍可能**在绑定阶段挂掉——所以不是「纯模型乱填、工具没问题」，而是 **工具对「跨对象 + 否定状态」这条路径仍会一口咬死**。

---

## 2. 为什么连打两遍还是同一句？

| 次序 | seq | 调用 | 结果 |
|---|---|---|---|
| 1 | 65 → 66 | 带错形 `where` + `from` 的 `biz_preview` | `WHERE_UNBOUND`，空表 |
| 2 | 70 → 71 | 只剩 `kind/action/speech`（无 where） | **同一条** `WHERE_UNBOUND`，`sheet` 上 hop/where 与 seq 66 **同构** |

原因：

1. **槽位**会从同一句 `speech` 再次 enrich 出同一 hop（测试里这句固定走 `客户 inactive + 工单未关`，见仓库 `runtime/tests/slots-enrich.test.mjs`）。
2. **工具**对同一 enrich 结果 **确定性** 回 `WHERE_UNBOUND`（不是 UI 随机文案）。
3. **模型**在 seq 69 仍继续 `biz_preview`，属于 **收到同一错误后的重试**，不是闸「只允许说这一句」。

turn 3 步数（日志）：step1 `biz_describe`×2 → step2 preview → step3 preview → step4 未再成功出表即 **user abort**（`sessionStats` 该轮多步 + 长 decode，表现为「一直思考」）。

---

## 3. 同一句 grok 会不会过？

**同会话 turn 4（`继续`）有对照。**

- **同构 hop**（seq 101 → 102）：`inactive` + `not: [resolved, closed]` + `from 客户` → **`WHERE_UNBOUND`**（与 Qwen 同类）。
- **拆开查**（同轮后面）：
  - seq 128：`客户` · `where status=inactive` → **ok，36 行**（`hitTotal` 36）
  - seq 129：`工单` · `where status not resolved/closed` → **ok，166 行**
- 另有 seq 136：`customerId` 精确查工单 → 可过。

所以：**不是 grok 魔法懂业务，是 grok 在收到 `WHERE_UNBOUND` 后换了策略（拆两步、用英文 code/id）**；Qwen 两轮都卡在「一次带 hop 的 preview」，没有换路。

---

## 4. 与硅基 developer / 推理档

| 问题 | 本 session |
|---|---|
| `reasoningEffort` / Off / High | Qwen 请求头 **无此字段**（seq 53、63） |
| `developer` 致 400 | **未发生**；工具调用与回执正常 |
| 硅基 400 文档 | 见 [siliio-qwen-400.md](siliio-qwen-400.md)，**别和本条混读** |

---

## 给 Ace 的一句话

**工具坏了（hop/状态条件绑定 → `WHERE_UNBOUND`）为主；Qwen 错参 + 同 speech 重试导致「同句两遍」和长时间思考。换 grok 不保证一次 hop 就过，但同会话里能拆开查出来。与推理档无关。**

---

## 相关（未改产品，仅定位）

- 闸语义：`runtime/vendor-overlays/dsh-lan-assist/lookup.js`（`WHERE_UNBOUND`）
- 同类现象：[expense-pending-miss-root.md](expense-pending-miss-root.md)、[hop-sheet-stuck-root.md](hop-sheet-stuck-root.md)
- 本机 overlay `relation-bind.js` 已是 where-by-cell 版（SHA `5dedf220…`，与 checkout 一致）；**仍拦住了本句 hop**。
