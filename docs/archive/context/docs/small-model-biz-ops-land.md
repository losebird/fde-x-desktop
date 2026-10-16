---
cursor:
  subagentId: "bc-a3cc32f5-5f74-59a9-b1f9-467117231410"
---

# 小模型业务格子：已按方案落地

对照 [小模型怎么才能精准操作业务数据](small-model-biz-ops-plan.md)、[现查 where 按格子收](expense-pending-unbound-plan.md)。本地分支 `cursor/one-bind-biz-path-1410`（`5c8e2230`），未推远程。家目录仍是 `~/.dsh-fde-x`。

## 结论

现查 / 找行 / 写值 / enrich 共用同一套格子（`enumHits`）。枚举对上 schema 的 code/label，或**该字段**词表 say/别名且唯一，才留下 schema 选项；外键没收到 id 只丢这一格。口语 seed 挂在 `口语` 行上，enrich 也会扫到已点名的型，不再只认型自己的 clues。模型 JSON where 只当文本线索，冲不掉已成形的 hop。第一跳认 `steps`/`hopWhere` 里已成形的条件。`speakLookup` 读真实 hint；`WHERE_UNBOUND` 不再说成没连业务。闸还在：一格都没成形禁止整表 list。

验收句「停用客户还有哪些没关的工单？」在单测里：口语「停用」→ schema code `inactive`（label「暂停合作」），型上没有 clues 也能绑，不是 `WHERE_UNBOUND`。现网没打到——本机 AI 核心仍是 SIGKILL，4318 `connected: false`。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/vocab/spoken.js` | 词表 seed 并入口径；enrich 和 bind 读同一份，不再各抄一份 |
| `runtime/vendor-overlays/dsh-lan-assist/relation-bind.js` | `enumHits` 认该字段 say/别名；唯一才绑。`unboundWhereSpeak` 说哪一型、哪一字段、口语、选项 |
| `runtime/vendor-overlays/dsh-lan-assist/lookup.js` | `bindClueEnums` 走同一套 `enumHits`。`WHERE_UNBOUND` 用真实 hint |
| `runtime/vendor-overlays/dsh-lan-assist/slots.js` | enrich 用 `enumHits`；口语行 clues 落到已点名的型字段；`fillEmptyWhere` 以 hits 为准 |
| `runtime/vendor-overlays/dsh-lan-assist/write.js` | 第一跳 where 认 hop 计划；`WHERE_UNBOUND` 按这一跳说，不整句套没连业务 |
| `runtime/vendor-overlays/dsh-lan-assist/probe.js` | overlay 唯一 `speakLookup`：读 `found.hint`；「没连业务」只留给 `NO_CONNECTOR` |

测试：`runtime/tests/where-by-cell.test.mjs`、`slots-enrich.test.mjs`、`write-hop-actions.test.mjs`。

## 删了什么

- slots 里那份 `vocabWithSpoken` 副本（改成读 `vocab/spoken.js`）
- lookup `bindClueEnums` 里只对 schema code/label 的第二套枚举映射
- slots `resolveClueValuesForField` 里另一套 schema/clue 枚举对照（改成调用 `enumHits`）
- `WHERE_UNBOUND` 写死的「筛选条件没对上词表列名…」套话（改成按格生成）
- `speakLookup` 把非 `NOT_FOUND` 一律说成「没连业务，不能装成已查待办」
- 第一跳 `probe({...spec}` 把子级 where / related 漏到父级的那截

外键收口留下当投影。没有待审/停用特赦。没有第三套 lookup 再猜 terms。

## 单测

过：`where-by-cell`、`slots-enrich`、`write-hop-actions`、`write-patch-relation`、`hop-plan`、`column-value-match`（120 项，含下面通用项）。

补的通用项（产品代码没有业务专名）：

1. 词表别名枚举：口语 say 对不上 schema label 时，唯一 code 才留下；values 对上多个选项则这一格未绑。
2. 口语行 clues 也能绑：型上没有 field clues 时，spoken-row say 仍落到唯一 schema 选项。
3. 外键未绑不得整表：原 `where-by-cell` 仍过。
4. hop 计划能 list：父级别名枚举绑上后打 list，子级带 related 再 list，不是 `WHERE_UNBOUND`。
5. hint 不谎称没连业务：`WHERE_UNBOUND` 读 hint；`NO_CONNECTOR` 才说没连业务。

另：词表 seed「停用」+ schema `inactive` /「暂停合作」绑成 `inactive`（型 clues 空也行）；模型 `not: ['shut']` 冲不掉 enrich 的 hop。

本仓库 `leftover-catalog-refuse`「spoken leftover still binds…」在改前 HEAD 已失败（`NO_CONNECTOR`），不是这刀引入。`records-align` 三条 UI 源码断言、`write-name-identity`「rewrite 成交…」也未纳入本刀（后者字段名 `状态` 对不上词表 key `status`，mock 行仍是 `inactive`）。对照 HEAD 复跑，仍同样失败。

## 现网

没打到。`GET /api/v1/ai/status`：`connected: false`，`lastError`「AI 服务意外退出：signal SIGKILL」。没有重载核心、没有换家目录、没有推远程。下次核心起来会按 overlay 覆盖 vendor；新开会话用原话打 `biz_preview` 即可，不必 `replay`。
