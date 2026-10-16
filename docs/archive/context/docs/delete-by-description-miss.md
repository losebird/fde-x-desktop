---
cursor:
  subagentId: "bc-0e2331f9-2d06-52d0-8a61-2e91f8d99dea"
---

# 按问题描述删工单，为什么对上「胡文」0 条

会话 `session-5910c15c-599e-4673-ba7b-cf159e5ea7e3`，工作区 `/Users/zxz/Documents/ai-project/fdex测试`。日志 `~/.dsh-fde-x/sessions/--Users-zxz-Documents-ai-project-fdex~6D4B~8BD5--/session-5910c15c-599e-4673-ba7b-cf159e5ea7e3/session.v3.jsonl.zstd`。闸是 00:38 拉起的 DSH `86898` 装进去的 `~/.dsh/vendor/dsh-lan-assist`（00:38:47）。只查因，未改产品，未重启 5174，未 reload。请求字节未证；下面的收口是同一套词表、图关系和 schema 重放出来的计划。

人话（seq 388）：把问题描述是“客户胡文今天12点电脑故障紧急保修，现在已处理完成”的那笔工单删除。

## 根本原因

请求里的键已经对上列。`resolveShapeKey('问题描述')` 和 `resolveShapeKey('description')` 都收到 schema 列 `description`（标题「问题描述」）。这条 where 在对键之前就被丢掉了。

口语收条件只扫枚举标签和词表线索，不把「字段标题 + 后面的原文」收成 where。这句对工单的命中只有两条：引号里的「故障」→ 工单类型 `incident`，「紧急」→ 优先级 `urgent`。「问题描述」和那整句都不在命中里。

模型 where 要留下，值必须已经在这份命中里（`modelWhereAgreed`，`slots.js` 1111–1123）。它比较的是值，不是键对不对得上列。整句不是 `incident` 也不是 `urgent`，整条 where 被扔掉，到不了 `bindWhereKeys` / `resolveShapeKey`（`where-pass.js` 277–284）。后面查的是枚举和客户名称，不是问题描述。

## 1. 工具参数里整句在 where，没有 no

模型第一次 `biz_preview`（seq 394）是 `action=现查`，没有 `no`。`speech` 是整句人话。`where` 一条：键 `description` 和「问题描述」，值是引号里那句，没有句末的「。」。

第三次（seq 410）才把 `action` 写成 `删除`，`where` 和 `speech` 仍是这整句，仍然没有 `no`。中间那次（seq 402）另加了从联系人、客户出发的 `from`，值也还是这整句。

工具参数没有把整句收成「胡文」。收成「胡文」发生在闸里。

## 2. 闸把现查盖成删除，整句 where 被丢掉，no 变成「胡文」

词表里工单的 `can` 有现查、改行、删除、新建。`recoverWriteIntent` 按口语动作表先碰到「删除」（`slots.js` 1683、1799–1801），人话里有这个词，就把模型的「现查」盖成删除。重放：两次工具动作收出来都是 `action=删除`。

整句 where 在这里被 `modelWhereAgreed` 丢掉，原因见上面。词表 `fields` 只有单号和状态，自由文本标题不会从人话里再长出一条 where。

留下的筛选来自引号里的枚举字，不是问题描述：

- 「故障」对上 schema「工单类型」的故障，值 `incident`，等值。
- 「紧急」对上 schema「优先级」的紧急，值 `urgent`，等值。

`leftoverNameIdentity`（`slots.js` 1166–1187）把剥完词表、型名、枚举之后剩下的名字收成「胡文」。动作已是删除，不是现查，`attachSpeechIdentity` 1259 那条「现查不把名字塞进 no」走不到，1262 行把 `no` 写成「胡文」。

图上工单这条概念自带关系 `{from:客户, to:工单, field:customer}`。人话里有「客户」，`relatedKindChain` 把链排成客户再工单。客户这一步 where 是空的，`no` 是「胡文」。联系人没有这条边。重放计划：`no=胡文`，`from.kind=客户`，工单 where 只剩类型和优先级。问题描述不在计划里。

## 3. 0 条查的是客户名称包含「胡文」，不是问题描述

多步时先查链头（`write.js` 1167–1178）。链头是客户，`no` 是「胡文」，where 空。`probeOne` 在有 where 时才把 rest 清掉（`lookup.js` 655–657）；这里 where 空，`mergeClues` 把 rest 留成「胡文」。

客户 schema 的名称列是 `name`，标题「客户名称」。`identityNameKeys` 认 `name`/`title`，也认标题里带「名称」的列，所以扫的是这一列。`nameCluePath`（`lookup.js` 1710–1715）对这个 rest 用 `$includes`，不是等值。

库：`biz_customers.name` 包含「胡文」是 0 行。链在客户这里停住，工单上那两条类型/优先级等值没有发出去。问题描述列这次没有被查。

回执用的是链尾的型名加工单，rest 用的是客户这次的「胡文」（`write.js` 1190，`probe.js` 78–84）。所以人看到的是「工单这边对不上「胡文」，0 条，不是没去查。」查过的是客户名称，0 条是真的。

## 4. 库里有这句描述，但不是等值，也挂不上这个客户

`biz_tickets` 里有两行，描述等于「客户胡文今天12点电脑故障紧急保修，现在已处理完成。」（多一个句号）：

| id | 工单编号 | 标题 | 工单类型 | 优先级 | 状态 | 客户外键 | 联系人外键 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `384417162657792` | 空 | 电脑故障紧急保修 | `incident` | `urgent` | `resolved` | 空 | 空 |
| `384428688605184` | 空 | 电脑故障紧急保修 | 空 | `urgent` | `resolved` | 空 | 空 |

描述等于人话那句、不带句号：0 行。描述包含人话那句：就是上面 2 行。标题包含「胡文」：0 行。

联系人表有两行姓名「胡文」（`371712740425752`、`371712742522903`）。词表没有联系人到工单的边，这两张工单的联系人外键也是空的。图关系字段是 `customer`，这两张的客户外键同样是空的，就算客户名称对上了，也走不到这两行。这次客户名称已经是 0，后面的跳没有发生。

工作区 `graph.json` 没有这两个 id，也没有这句描述。`388468591099904` 只出现在一张过账记忆卡片里。`search_text`（seq 404）第一条是本轮 seq 388 这句删除请求，后面是别的会话摘要，没有这两张单当时的记录。

## 5. 没发删除牌，是 0 行就停，右边那张是上一张页

父级 0 行走 `refuse('NOT_FOUND')`（`write.js` 1191–1194），在发牌之前返回。删除牌要一行才发（1426），或者一批而且行数大于 0（1382–1395）。这次匹配集是 0，两种都发不出 `preview_id`。

动作已经被收成删除，空的现查不会走 `settledList` 那种 `querySettled` 空表。`shouldKeepPopulatedListSheet`（`gate.js` 244）在上一张有行、这次 0 行、又不是已结算的现查时，留着上一张。工具结果里的 `sheet` 因此仍是 `388468591099904`：标题「测试新增功能」，客户武汉光谷生物，联系人马浩然，`speech` 是「打开工单 388468591099904」，`at` 是 `1790268397028`，早于这句人话 `1790268807412`。`preview_id` 空，`canWrite` 假。seq 405、406、411 回的是同一张、同一个 `at`。现网 `pendingSheet` 现在还是这一张。

[records-panel-decisions.md](records-panel-decisions.md) §12 是对上多条才停下来选。这次匹配集是 0，挑选没有发生。若按问题描述包含去对，库里是上面那 2 行，那才会落到 §12；这次的查询没有走到那里。

## 对照

[create-write-three-upstream.md](create-write-three-upstream.md) 里，where 收口后一条 term 都不剩会 `WHERE_UNBOUND`。这次不是那条：模型 where 被枚举命中换掉了，换完还有类型和优先级，只是查之前先死在客户名称上。无筛选现查去掐回执，也不是这次；这次是 0 行删预览盖不住已有行。

[spoken-write-audit.md](spoken-write-audit.md) 把 where 当改行/删除的定位。这句的定位 where 在绑定前被换掉，剩下的名字走了身份列的包含，没有走问题描述。

怎么收：[按列去库里匹配](delete-by-description-plan.md)。
