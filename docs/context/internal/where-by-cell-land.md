---
cursor:
  subagentId: "bc-c7bb3400-34f1-5743-8202-70e7aab62254"
---

# 现查按格子收：已接上，未手证

本地 `ab36eeee`，分支 `cursor/where-by-cell-2254`（已推远程）。

现查、改行、删除、过审找行，和写入用同一套格子。照写和文本列留下，去这一格比。枚举对上 schema 选项才留下。只有指向另一行才收成 id。外键没对上，只这一格未绑，其它格还在。

`WHERE_UNBOUND` 仍是「列名没对上、不能整表现查」。已经成形的枚举或文本列不再被外键收口当成没对上列名。没有待审特赦。lookup 没有把空名单再猜回去。

浏览器里还没点过。

## 改了哪些文件

| 文件 | 做什么 |
|---|---|
| `runtime/vendor-overlays/dsh-lan-assist/relation-bind.js` | `schemaCellMode` 是留下这一格的那一处，写入和现查共用。`bindWhereRelationTerms` 只把口语外键收成 id。不是关系的 term 原样通过。枚举只留唯一 schema 选项。外键没收到 id，只丢掉这一格 |
| `runtime/tests/where-by-cell.test.mjs` | 先失败再过的四条，加已经过的两条 |

槽和按列去比仍负责从人话里提出 where。它们不再和外键收口并排否决同一份名单。

## 测试

`node --test runtime/tests/where-by-cell.test.mjs`：改之前 4 项失败、2 项过。改之后 6 项过。

失败的是：

- 「待审的费用报销」：`status=待审`，打到 `biz_expenses:list`，不是 `WHERE_UNBOUND`。`pending` / `submitted` 不进过滤。
- 问题描述那句：where 仍是 `description` 加那句，`text` 还在，现查会打到工单 list。
- 外键没对上、旁边还有 `status=待处理`：只丢掉客户这一格，list 仍带 `pending`，不带那句没对上的名字。
- 枚举：`紧急` 收成 `urgent`。`not-real` 留不住。槽里优先级仍要枚举命中。

本来就过、改完仍过：

- 「恒通」仍收成客户 id `99`。
- 只有一个没对上的外键：不打无筛选的工单 list。

同一批里 `column-value-match`、`write-patch-relation`、`slots-enrich`、`hop-plan`、`where-pass-labels`、`write-lookup-key`、`write-hop-actions`、`biz-where`、`nocobase-path` 过。

## overlay

只动了 `relation-bind.js`。没有 `POST /ai/reload`。没有重启 4318，没有动 5174。

`POST /api/v1/ai/disconnect` 然后 `POST /api/v1/ai/connect`，`Origin: http://localhost:5174`。旧 DSH **99009** 已退出。新 DSH **39066**，`startedAt` `2026-09-25T00:29:44.684Z`。BFF **46288** 仍听 4318。Vite **42443** 仍听 5174。

checkout overlay、`~/.dsh-fde-x/vendor/dsh-lan-assist`、`profiles/fde-x/node_modules/dsh-lan-assist`（链到 vendor，同一 inode）哈希一致。

| 文件 | SHA256 |
|---|---|
| `relation-bind.js` | `5dedf220396ab71377d7ee1f26eacda03f146798f64e1cb97ebc2c1efd912c16` |

## 手验怎么点

未手证。新开会话：

1. 「待审的费用报销」：打到 `biz_expenses:list`，`status=待审`。右边是待审这 97 行，不是上一张工单。
2. 用问题描述删那笔：where 是 `description` 加那句，不是 `WHERE_UNBOUND`，也不报对不上「胡文」。
3. 「恒通的工单」：仍收成客户 id。外键没对上：这一格未绑，不得倒成无筛选整表。旁边还有别的已成形条件时，那些条件还在。
