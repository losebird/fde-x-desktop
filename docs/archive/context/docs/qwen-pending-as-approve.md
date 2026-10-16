# 「待审的费用报销」为什么打成过审：根因（session-84613257 turn 2）

## 结论（先读这句）

**把现查收成过审的是 Qwen 自己在 `biz_preview` 里填的 `action=过审`，不是闸的 enrich / recoverWriteIntent / 词表 can 把现查改写的。**  
闸按模型动作走了批量过审预览（96 条、`pv_639e08fa009fe1dc`）。对象（费用报销 / `biz_expenses`）和待审集合语义没错，错在**动作槽**。

---

## 1. 模型 JSON vs 闸后处理

| 层级 | 会不会把「现查」改成「过审」 |
|---|---|
| 模型 tool 参数（seq 50） | **已是** `{"kind":"费用报销","action":"过审","speech":"待审的费用报销"}`，无 `where` |
| `enrichStructuredSlots` | **不改** `action`，只补 kind / where / from / steps |
| `recoverWriteIntent` | 仅在口语里命中 **动作 role** 且 kind 的 `can` 含该写动作时，才**覆盖**模型 action；或口语明确「列举/现查」且无写动作时，把错写的写动作**降回现查** |
| `recognize`（write.js） | **原样认** `plan.action`，不做「待审→过审」推断 |

本会话只有一枪 preview，回执 `action=过审` 与入参一致。模型 reasoning（seq 49）里曾想过 `现查` + `status=待审`，**最终 tool 仍选过审**——这是模型侧决策，不是闸事后改槽。

若要闸把过审拉回现查，需同时满足：`spokenListAction(userSpeech)==='现查'`、口语里无写动作、且模型 action≠现查。本句「待审的费用报销」**没有**「现查/列出/打开表」类问句动作线索（见下节词表），故 **recover 不会** 把已填的 `过审` 改成 `现查`。

---

## 2. 词表里「待审」是什么

（现网费用报销词表 `biz_expenses`，与 [expense-pending-miss-root.md](expense-pending-miss-root.md) 一致。）

| 绑定 | 含义 |
|---|---|
| 问句 / 字段 clues，`keys` → `status`（或「状态」），`say` / values 含 **待审** | **状态枚举**（与 schema 草稿/待审/已通过…对齐），不是动作 |
| kind 行 `can` | 含 **现查、过审** 等；表示「允许哪些 action」，不是说「待审二字=过审」 |
| 动作 role（`keys: action`） | 对应 **过审 / 改行 / 删除 / 新建** 的口语片段；**待审** 不在 WRITE_ACTIONS 里 |

因此：**「待审」在词表上是 status 筛选线索，不是过审动作的 say。**  
闸不会因为单独出现「待审」就把 action 设为过审；测试里「待审…**都过一下**」能 recover 成过审，靠的是 **批量写动作口语 + `can` 含过审**，不是「待审」三字本身（见 `runtime/tests/slots-enrich.test.mjs`「recoverWriteIntent prefers spoken write action…」）。

---

## 3. catalog / 系统提示有没有教「待审的 X = 过审」

**没有。**

- `biz_preview` 工具说明：`action` 拿不准用 **现查**；现查不发写令牌（`tools.js`）。
- 闸描述：只验证槽，**不理解原话**；过审走写预览、现查走 list。
- 产品文档 [qwen-pending-expense-intent.md](qwen-pending-expense-intent.md) 对照的验收句 2 明确要求 **现查 + status=待审**，与工具默认一致。

模型把「看待审报销」理解成「对待审这批做过审预览」，属于 **LLM 意图压缩**（把状态形容词+对象读成审批动作），不是 catalog 教反了。

---

## 4. 旧会话同一句是否也打过审

**是，但那是模型自己换枪，不是同一条根因链。**

会话 `session-5910c15c…` turn 19（[expense-pending-miss-root.md](expense-pending-miss-root.md)）：

- 前几枪模型填的是 **`action=现查`**（有的还带 `where`），闸因 **`status` 被 relation-bind 清空 → `WHERE_UNBOUND`**，没发出 `biz_expenses:list`，右边卡在旧工单。
- 同回合后面模型又打了 **`action=过审`**（seq 601、609，同 speech「待审的费用报销」），仍卡旧表，但说明 **同一句在旧会话里模型也会选过审**，通常是现查失败后的 retry，不是闸把现查改成过审。

**84613257 turn 2 不同点：** 连接器/绑定路径能过，**一枪过审就出了 96 行 + 预览令牌**；问题更纯粹——**第一枪动作就错了**，没有 WHERE_UNBOUND 这一层。

---

## 对照表（Ace 四问）

| 问题 | 答案 |
|---|---|
| 谁写的过审？ | **模型 tool JSON**；闸透传 |
| enrich/recover/can 改槽了吗？ | **本句没有**（待审→status 枚举；无「都过一下」类写口语） |
| 「待审」在词表？ | **状态枚举**，不是过审 say |
| 提示词教过审？ | **否**；教的是拿不准用现查 |
| 旧会话同句？ | **现查为主，后期模型也打过审** |

---

## 证据

- [qwen-pending-expense-intent.md](qwen-pending-expense-intent.md)：seq 50–51、`pv_639e08fa009fe1dc`、账本无「现查进业务页 · 费用报销」
- 源码：`slots.js` `recoverWriteIntent` / `enrichStructuredSlots`；`write.js` `recognize`；`tools.js` `biz_preview` 参数说明
- 日志：`session-84613257-…/session.v3.jsonl.zstd`（协调侧路径见 qwen-pending-expense-intent）

（只陈述根因，不改产品。）
