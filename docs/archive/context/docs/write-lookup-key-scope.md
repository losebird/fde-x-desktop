---
cursor:
  subagentId: "bc-f9c44edc-5fa8-54eb-8870-1aacf34d450f"
---

# 过账再找行，打在哪一类

只读现网闸。未改产品，未重启 5174，未 reload。上一笔见 [alter-write-twenty-root.md](alter-write-twenty-root.md)。

现网 `write.js` / `lookup.js` / `resolve.js`：`~/.dsh-fde-x/vendor/dsh-lan-assist`、profile 同 inode、checkout overlay 同哈希。连接 dialect 是 nocobase，连接上的 `ticketField` 是空的。词表 40 个型（`GET /api/v1/biz/kinds`）。图的边不进查找键。

```
已对准的行，令牌 no
        │
        ├─ probe（写前放行，改行写后再读）
        │    长数字 → schema 主键界面（snowflakeId / uuid / nanoid）
        │    ∪ mapped.fields 里 schema 上有的列
        │    $or
        │
        └─ writeDest（改行 update、删除 destroy、过审 update）
             连接 ticketField，空则 mapped.fields 第一格
             单列等值，不加主键
```

`mapped.fields`：词表 `ticketField` 在前，再拼 `fields`，去掉形状词（单号、状态、行号、系统、环境、型）。第一格就是 filter。schema 只在 probe 里把主键界面加进 `$or`。`pickNo` 先读这些列，有值就当令牌 no；都空才退回行 id。

## 1. 新建

不要查找键。新建不 probe。`writeDest` 是 `POST :create`，没有 filter。令牌上的 no 不拿去找行。

## 2. 改行

filter 键：连接 `ticketField`，现网为空，所以是词表收成的 `mapped.fields` 第一格。行已经有主键、令牌 no 已经是主键时，仍然不用主键。

不限工单。40 个型里，3 个型的词表第一格与 schema 主键同名，filter 就是主键，这次落空打不中。其余第一格都不是主键：多数是业务号列，4 个型第一格是关系名（schema `m2o`，不是本行主键，也不是外键列名）。

落空要两件一起：第一格不是主键，而且这一格在行上是空的，`pickNo` 把 no 退成主键。probe 用主键对上，放行；update 用空列等主键，0 行；HTTP 仍 ok；只有改行再 probe，`patchApplied` 失败，红条是「业务回了，但字段还是旧的」。

现网空列：工单 3/402（含上一份那张），客户 2/302。客户词表有改行、删除，没有过审。客户这两行：契约会踩，审计里没有打到。其余标量查找列 0 空：列里有值时预览把 no 收成这一格，filter 对得上；列若为空契约会踩，现网未再打到。4 个关系名第一格：契约会踩，现网未再打到。

批量改行走另一支：写前不 probe，写后不读回，filter 仍是这一格。HTTP ok 就当成功，不出这句红条。这次不是批量。契约会踩，现网未再打到。

同一句红条也在业务号 look 上出现过（读回对不上即可，不要求查找列为空）。look 是长数字、且库里对得上的两条都在工单表。后一条没有请求字节。

## 3. 删除、过审

找行是同一套键：写前 probe 与 `writeDest` 的分叉，和改行一样。词表有这个动作才发牌，路径不按型分叉。

对不上时不是这句红条，也不是「找不到行」。主键 look 时 probe 对得上，确认前不会「点头前再查失败」，预览时也不会「业务系统里没有」。0 行 destroy / update 只要 HTTP ok 就当写完，没有 `patchApplied`。预览整段对不上才是「业务系统里没有」；确认前 probe 失败才是「点头前再查失败」。

审计里没有删除、没有过审。工单、客户的空列若走删除：契约会踩，现网未再打到。过审各型查找列现网没有空行：契约会踩，现网未再打到。

## 总答

整类里的三支：改行、删除、过审。新建不要查找键。

现网打出红条、且 look 是主键的，是工单改行（查找列为空）。客户有同样的空列，改行和删除契约会踩，过账未再打到。查找列已有值的型，预览会把 no 收成那一格，不走这次 0 行。词表第一格就是主键的 3 个型，filter 用的就是主键。

为什么、怎么收：[write-lookup-key-plan.md](write-lookup-key-plan.md)。
