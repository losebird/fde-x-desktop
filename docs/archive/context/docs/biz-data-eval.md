# 业务数据评测

`main` @ `aee8655`（工作区 `/Users/zxz/Documents/ai-project/fdex测试`）。官方库数：hop = 下游 FK 落在现存上游主键（`relatedIdBatches` 分批 `$in`）；m2m = through 上**目标侧**去重行数（读 from 侧 `foreignKey` / `otherKey` / `sourceKey`，不是 through 全表）。362 条串行重打基线不变；本轮仅重算 Roles↔Users 两条边。

闸看计划是不是这条结构。现网看右边报出的命中条数是不是等于业务库 `meta.count` 单独数出来的条数。右边没有报出总数的，算没对上。五类分开，不合成一个百分比。

生成规则：

- 已发布的边，每条走一遍。85 条。
- 每个对象上的每个枚举词，各加一遍。220 条。
- 更长的对象名盖住更短的对象名，每一对走一遍。6 对。
- 同一个枚举词落在多个对象上，每一组走一遍。29 组。
- 连接器字段指向了对象，但已发布的图上没有这条边。22 对。没有把所有「没有边」的对象对都做一遍。

`{{t("Departments")}}`、`{{t("Users")}}`、`{{t("Roles")}}` 是已发布的对象名，留在集合里。

## 本轮收口

过程证据见 [official-count-rescore](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/official-count-rescore.md)。hop / `{{t()}}` 根因见 [hop / t() 条数](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/docs/hop-t-count-root-cause.md)。

1. **官方库数**：`internal/biz-data-eval-library-count.mjs`（生成闸与串行重打共用）。hop = 下游行 FK 落在**当前仍存在的上游主键**上（`relatedIdBatches` 分批 `$in` 求和）；m2m = 该边 `through` 行在**现存上游**键下，对**下游目标键**去重计数；边类禁止用源对象全表、FK `$notEmpty` 或 through 全表凑数。Roles↔Users 证据见 [roles-users-edge](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/roles-users-edge.md)。
2. **串行 362**：`internal/biz-data-eval-rescore-serial-run.mjs`，`CONCURRENCY=1`，未 reload，未动 5174/4318。

## 分数

| 类 | 用例 | 闸 | 现网 |
|---|---:|---:|---:|
| 已发布的边 | 85 | 85 | 85 |
| 每个对象上的枚举词 | 220 | 220 | 220 |
| 长对象名盖住短对象名 | 6 | 6 | 6 |
| 同一个枚举词落在多个对象上 | 29 | 29 | 29 |
| 字段指向了对象，图上没有这条边 | 22 | 22 | 22 |

长名 6 对、图上没边的 22 对，闸和现网都对上了时下面不写该类。条数写「库里 / 右边」。

## 已发布的边

自环（库数按边字段；现网 peer 仍可能只报主侧 total）：

- 员工档案 → 员工档案（`manager` / `subordinates`）。库 80 / 15（`managerId` 非空 / 去重上级）；现网两条常落在 15。
- {{t("Departments")}} → {{t("Departments")}}（`parent` / `children`）。库 11 / 4；现网页脚曾见 4 / 12。

hop（与现网 hop 一致，不再用悬挂 FK 的 `$notEmpty`）：

- 采购订单 → 采购收货单（`receipts` 或 `purchaseOrder`）。库里 **385**。
- 采购订单 → 采购订单明细（`items` 或 `purchaseOrder`）。库里 **2085**。
- 工单 → 工单处理记录（`ticket`）。库里 **798**。

`{{t()}}` 跨对象：

- {{t("Departments")}} → {{t("Users")}}（`members` / `owners` / `mainDepartment`）。库里 **0**（`departmentsUsers` 等 through 为 0）。
- {{t("Roles")}} → {{t("Users")}}。库里 **14**（`rolesUsers` 去重 `userId`），右边 **14**。
- {{t("Users")}} → {{t("Roles")}}。库里 **8**（`rolesUsers` 去重 `roleName`），右边 **8**。through 全表仍为 **15**（关联次数，不作库数）。

## 每个对象上的枚举词

串行 362 后闸与现网均为 220 / 220。

## 另外两类

长对象名盖住短对象名：6 条，闸 6，现网 6。

字段指向了对象、图上没有这条边：22 条，闸 22，现网 22。
