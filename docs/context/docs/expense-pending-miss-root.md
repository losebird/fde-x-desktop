---
cursor:
  subagentId: "bc-a5e772af-cb8a-5f30-a6b3-e854f0a00a57"
---

# 待审费用报销没查出来：`待审` 已绑上状态枚举，关系绑定把这一格扔掉，库查询没发出

会话 `session-5910c15c-599e-4673-ba7b-cf159e5ea7e3`，turn 19。人话 seq 576，07:49:52：「待审的费用报销」。回合正常结束（seq 617，`completed`），没有 `session/cancel`，也没有 `plugin-leftover`。

根因在查询之前。五下 `biz_preview` 都把「待审」收成费用报销 `status=待审`（schema 枚举的 value 和 label 都是「待审」）。接着 `bindWhereRelationTerms` 只认外键关系上的名字，`status` 是 `select`，不是 `m2o`，这一格被整段丢掉。`lookup.js` 看到 where 还在、条件却空了，直接回 `WHERE_UNBOUND`，**没有打** `biz_expenses:list`。

右边还停在工单 `384417162657792`，是这一步的后果：0 行失败单过不了「空表换掉上一张」的闸，`pendingSheet` 留着 07:09:05 那张。库里待审报销有 97 行，不是没数据。模型说的「闸没换到报销页」只说了后半截。

回执里那句「没连业务，不能装成已查待办」是 `speakLookup` 对任何非 `NOT_FOUND` 错误的套话。同一会话 40 分钟前刚现查过这张工单，连接是通的。`lookup.js` 自己的 hint 是「筛选条件没对上词表列名」，没能送到界面上。

DSH **99009**，BFF **46288** 听 4318，Vite **42443** 听 5174。只读，没改产品。日志 `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-5910c15c-599e-4673-ba7b-cf159e5ea7e3/session.v3.jsonl.zstd`。

## 五下 biz_preview

模型参数里没有 `no`。回执五张是同一张旧表：`kind=工单`，`action=现查`，`no=384417162657792`，`preview_id` 空，`at=1790291345555`（07:09:05），`speech`「打开工单 384417162657792」，1 行，`querySettled=true`。错误都是 `ok: false`，`error: WHERE_UNBOUND`。没有 leftover cancel。

| seq | 时刻 | 请求 | 回执 |
|---:|---|---|---|
| 588→589 | 07:51:11 | `kind=费用报销` `action=现查` `speech=待审的费用报销` `where` keys `状态/status`，values `待审/pending/submitted` | `WHERE_UNBOUND`，旧工单，`preview_id` 空 |
| 593→595 | 07:51:19 | `kind=费用报销` `action=现查` `speech=现查待审的费用报销`，没有 where、没有 no | 同一张旧工单 |
| 600→602 | 07:52:38 | `kind=费用报销` `action=现查` `speech=现查费用报销` `from.kind=费用报销` | 同一张。人话更长，`pickHopSpeech` 把这句换成「待审的费用报销」 |
| 601→603 | 07:52:38 | `kind=费用报销` `action=过审` `speech=待审的费用报销` `where` values `submitted/pending/待审` | 同一张。过审走写预览那支，账本不记「空表未覆盖」 |
| 609→610 | 07:53:02 | `kind=费用报销` `action=过审` `speech=待审的费用报销`，没有 where | 同一张 |

账本三行，对上三下现查：07:51:12、07:51:19、07:52:38，都是「现查空表未覆盖 · 费用报销」。现网 `pendingSheet` 仍是这张工单。

用现网 schema（`status` interface `select`，枚举 value=label：草稿 / 待审 / 已通过 / 已驳回 / 已付款）把这五句重跑槽：进 `probe` 之前 where 都是 `keys: [状态, status]`，`values: [待审]`。`pending`、`submitted`、`open` 在枚举对齐时被丢掉，没进过滤。`bindWhereKeys` 把两个 key 收成 `status`。`bindWhereRelationTerms` 之后 terms 是 `[]`，于是 `WHERE_UNBOUND`。

## 丢掉的那一行

`relation-bind.js` 266–291。值不是纯数字，就只到 `m2o/o2o/belongsTo` 上去找 id。`status` 对不上 `relationSchemaField`（10–23 行，`select` 直接 null）。一个 id 都没有，290 行 `continue`，整段条件不进 `out`。

`lookup.js` 685–702 接着看：原来的 where 还非空，terms 已经空，又不是单号，就返回 `WHERE_UNBOUND`。这一支在 `:list` 之前。费用报销集合这次没被查。

`待审` 能绑上，是因为 schema 枚举和词表问句线索都有这个字。词表 `费用报销`（`biz_expenses`，`schema:ccf68f509408`）问句 say 含「待审 / 待处理 / pending」，values 里还有 `open`、`submitted`。对上枚举之后，真正留下的只有 `待审`。`modelWhereAgreed`（`slots.js` 1252）只留文本列，模型写的 `pending/submitted` 不会从那里再抄一份。

## 右边为什么还是那张工单

上一张是 turn 18 打开的：账本 07:09:05「现查进业务页 · 工单 384417162657792」。1 行，动作现查，`preview_id` 空。

`WHERE_UNBOUND` 在 `write.js` 1214–1229 不当成已结算的 0 行，也不走 `columnMiss`（那条只认文本列）。`missSpeak` 用 `speakLookup`（`probe.js` 89）把 hint 换成「这张单现在查不到。没连业务…」。

`gate.js` `shouldKeepPopulatedListSheet`：

- 200 行 `columnMiss` 才会换表。这次不是。
- 235–244 行要 `querySettled` 的现查空表才换。这次没标上。
- **245 行** `prevRows > 0 && nextRows === 0` 返回 true，留下旧表。

现查走 321–323 行，记下「现查空表未覆盖」，`pendingSheet` 不动，回执的 `sheet` 是大厅里这张工单（334 行）。过审不是现查，走 345–349 行，同一条 245 行，不记账，回执仍是这张。

按列去比那次改的「0 行换掉上一张」只覆盖 `columnMiss`。这次是枚举条件被关系绑定清空，没进那条。`leftover-catalog-refuse` 也没响：费用报销在目录里，错误不是 `NO_CONNECTOR`。

## 库里有待审

`biz_expenses.status` 存的就是中文，不是 `pending` / `submitted`。现查如果发出 `status=待审`，对得上 97 行。

| status | 行数 |
|---|---:|
| 已付款 | 362 |
| 已通过 | 242 |
| 待审 | 97 |
| 已驳回 | 55 |
| 草稿 | 42 |
| 已过 | 1 |

共 799 行。没有 `pending`，没有 `submitted`。例如 `EXP20251224598`，status `待审`。

## search_text 没用上

seq 579 `route_intent` 回了 `查询 → search_text`。seq 594 才打了一次，query「待审 费用报销 状态 submitted pending」。结果是图上的旧会话 Document、记忆卡片、词表概念（第一条是别的会话里的待审回款），不是 `biz_expenses`。模型自己下一句也改去 `biz_preview`。这条不决定右边那张表，也不决定 `WHERE_UNBOUND`。
