# 小模型怎么才能精准操作业务数据

对照：[WHERE_UNBOUND 为什么误触](where-unbound-root.md)、[同一句 Qwen 和 grok 各走哪](qwen-vs-grok-same-query.md)、[现查 where 按格子收](expense-pending-unbound-plan.md)、[项目上下文](project-context.md) 决策 15 / 22、[同一职责不并排](../principles/one-authority-no-copies.md)。

点头之前不改。

## 先说清楚标准

不是让 27B 学会 `replay`、拆问、读源码。那是 grok 的逃命，和建词表+图的理由反着来。

**过关：** 小模型只说原话、只打正式 `biz_preview` / `biz_write`，同一句在 Qwen 和 grok 上得到同一张对的表（或同一格未绑的结构化下一问）。不许 `WHERE_UNBOUND` 套成「没连业务」。不许人手写 `replay` + code 才出数。

本句验收：「停用客户还有哪些没关的工单？」→ 停用（暂停合作）客户的未关工单交集，现网曾是 21 行 / 14 家，行数跟现网走。Qwen 新会话一遍过，不用掐停。

## 现在差在哪（不是「再改一刀枚举」就完）

三层，少一层都会把恢复丢回模型：

1. **绑定权威裂了。** 写值已按格子（照写 / 枚举 / 指向另一行）。现查/找行仍能把已成形的枚举整格扔掉；口语「停用」对不上 label「暂停合作」/ code `inactive` 就 terms 空，第一跳 `WHERE_UNBOUND`。sheet 上的 hop 计划来自 enrich，lookup 不认。见 [where-unbound-root.md](where-unbound-root.md)。
2. **执行不认计划账。** 闸只看 `clues.terms`。计划在 `hopWhere` / `steps` 上也当没绑上。hop 第一跳死了，第二跳不走。
3. **回执没有下一步。** `speakLookup` 不读 lookup.hint，非 `NOT_FOUND` 一律「没连业务」。小模型只会重试原话。

不久前改写入、标 where-by-cell，是对的方向，收的是另一本账。这三层没并成一份权威，所以你会觉得「刚改过，还是不行」。

[expense-pending-unbound-plan.md](expense-pending-unbound-plan.md) 仍有效：现查 where 按格子收，不要外键一支拍板。**不够：** 「枚举已对上 schema 选项」在本句上会漏掉词表同义（停用 ≠ 暂停合作）。本篇补上同义、hop 认计划、回执说哪一格。不另起第三套绑定。

## 收成什么样

一份权威，词表 + 图 + schema，不写死客户 / 工单 / 停用 / 待审。

### 1. 现查、找行、写值同一套格子

谁留下 where / 找行条件，只按这一格（与写入 `bindSpokenCells` 同义，不是再抄一份）：

- **照写 / 文本列：** 点了列名就留下，去这一格现网值里比。
- **枚举：** 对上 **schema 的 code 或 label，或词表这一字段的 say / 别名**，且唯一，就留下 schema 那个选项。0 或多：这一格未绑，其它格不动。
- **指向另一行：** 才走外键收口。收到 id 才当已绑；没收到就这一格未绑，不得整段清空别人。

外键收口留下当投影（口语名字 → id）。能单独否决整句现查的「没 id 就全部 terms 不要」清掉。见已批方向：[expense-pending-unbound-plan.md](expense-pending-unbound-plan.md)。

**原话进绑定，不让模型 JSON where 覆盖 enrich。** 槽位 enrich 是口语的权威；模型自带的 `where` / `from` 只当线索。Qwen 写 `not: ["已关闭"]` 不得把 enrich 出的 `inactive` + `not resolved/closed` 冲掉。

### 2. hop 认计划账，第一跳一格未绑不得冒充整句没绑

- 闸仍在：声称要筛选、**没有任何一格成形**，禁止整表 `:list`。
- `WHERE_UNBOUND` 只表示「列名没对上，或一格都没成形」。hopWhere / steps 里已经成形的枚举或外键，必须拿去打对应那一跳的 `:list`。
- 第一跳某一格未绑：这一跳按未绑处理（结构化下一问，或按已成形的格查），**不要**把整句收成 `WHERE_UNBOUND` 再套「没连业务」。第二跳该走仍走。
- 系统自己走完「客户（已绑的停用义）→ 未关工单」。不要把拆问、`replay`、手写 code 留给模型。

### 3. 回执说哪一格，禁止谎称没连业务

- `speakLookup` **读** `found.hint` / 未绑格。`WHERE_UNBOUND` 不得落到「没连业务」。
- 「没连业务」只留给 `NO_CONNECTOR`。
- 未绑时回执带：哪一型、哪一字段、口语是什么、schema 上有哪些选项（来自词表+schema，不写死）。小模型下一动是改这一格或等人选，不是空转思考。

### 4. 明确不做

- 不教模型用 `replay: true`，不把 replay 当产品正路（调试口可留）。
- 不写死「停用 → 暂停合作 / inactive」。同义只来自该字段词表 + schema。
- 不取消 `WHERE_UNBOUND`（取消会整表倒出）。
- 不另做待审特赦、停用特赦、Qwen 专用 prompt。
- 不把家目录换回 `~/.dsh`。
- 不并排第三套「lookup 里再猜一次 terms」。

## 会不会搞坏现有可用的

决策 22。改的是绑定谁拍板、hint 说什么，不是拆掉已通的单对象现查和外键 hop。

必须还在：

- 「恒通的工单」这类口语外键 → 收成客户 id，打工单 `:list`。
- 单对象、label 与 schema 一致的枚举现查（「待审的费用报销」在格子收口后应出表，不是旧工单）。
- 新建 / 改行确认过账（写入格子已收的，不许回退成只吐 id）。
- 没绑上外键：这一格未绑，不得无 filter 整表。

风险：词表别名过宽会绑错枚举——只许**该字段**的 say/选项，唯一才绑；0 或多停在这一格，不猜。

## 你怎么验

点头落地后，**Qwen3.8-27B 新开会话**（不要用 grok 代打）：

1. 「停用客户还有哪些没关的工单？」→ 交集未关工单，不是 36+166 两张无关表，不是 `WHERE_UNBOUND`，左边不空转。现网行数跟当时库走。
2. 「待审的费用报销」→ `biz_expenses:list`，`status=待审`，右边是这些行。
3. 「恒通电子有哪些工单？」→ 仍是该公司工单，不是整表、不是闸。
4. 用问题描述删仍能对上那一行，不是 `WHERE_UNBOUND`，hint 不是「没连业务」。
5. 随便新建/改一行仍是 preview → 确认 → 一条变更（旧写路径还在）。

1 不过 = 本篇没过。只过 2–5 不算达到小模型标准。

## 落地

已按本文执行。结果见 [小模型业务格子落地](small-model-biz-ops-land.md)。本地 `cursor/one-bind-biz-path-1410`（`5c8e2230`），未推远程。单测过（聚焦 120）；现网没打到（核心 SIGKILL，4318 未接通）。enrich 补了一格：口语 seed 从 `口语` 行落到已点名的型字段，与 lookup/写值同一套 `enumHits`。
