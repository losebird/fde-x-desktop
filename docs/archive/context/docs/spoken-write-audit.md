# 口语进库：增删改审还缺哪一层

人不会记 `assignee` / `customerId`。话里的人名、客户名、编号、状态，必须经 **词表 + 图 + schema** 收成机器值，再进预览令牌和过账。处理人 bigint 只是这一层漏了的第一枪。

对照 [增删改审手测集](biz-write-eval.md)、[增删改审交互](biz-write-interaction-audit.md)。

## 现网已经炸过的

| 口语 | 打进的列 | 库要什么 |
|---|---|---|
| `ace` / `acee` / `zxz` | 工单 `assignee` | `users.id` |
| 南京智航交通科技有限公司 | 工单 `customer` | `biz_customers.id` |
| `CUST-016` | 工单 `customer` | 同上（按编号） |

现网没有 integer/uuid/enum 的 PG 原文。优先级「高」→ `high` 已经走枚举绑定。

## 槽怎么归类（40 个可写型）

不是字段中文名清单，是 schema 的类：

1. **m2o**（处理人、客户、部门、仓库、供应商、商品、报销人、审批人、经办人…）→ 目标表 id。词表「关联列」只写了 customer/supplier/contact/owner/assignee/warehouse，其余只靠 schema。
2. **select / 枚举**（状态、优先级、客户等级…）→ schema code。过审整条链写死中文「已过」，不走这层。
3. **where 定位**（改行/删除/过审找哪一行）→ 关系键上的值仍可能是人名/客户名。
4. **数字 / 日期 / 布尔** → `shapePatch` 末尾原样写入；现网还没炸过，先不发明「三千」「明天」的解析器。

## 已挂上（等你复测）

DSH 已换成 **23047**，4318 / 5174 没动。overlay 含 `relation-bind.js`。

- 凡 schema 关系槽：按 `target` 用名称/编号/用户名收成 id；解析失败不把口语写入 FK。
- 预览令牌存 id，抽屉仍显示你说的话。
- 过审下一状态从该型 schema 枚举收，不写死「已过」。
- where 里的关系值与 patch 同一套收口。
- 「关联列」白名单不再当真理。

数字/日期/布尔口语（「三千」「明天」）仍原样进列，现网还没炸过，没发明解析器。

查的是 [Audit spoken write bindings](bc-a47e7a35-04d1-59c4-84bf-4ceebca26f22)、[Audit schema write slots](bc-41384c33-bd2e-5d2c-9b13-5cf8e315c0b0)、[Audit live write type errors](bc-edc90c96-37e8-5c27-8ace-e045359e874e)；修并挂上的是 [Fix spoken write bindings](bc-4b8b26f8-d45d-5e6b-b98a-887476c61512)、[Apply spoken write overlay](bc-633608b2-9c46-57e2-b527-6725b2243159)。
