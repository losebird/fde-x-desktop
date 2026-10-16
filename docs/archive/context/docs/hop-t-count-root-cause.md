# hop / `{{t()}}` 条数根因（只查因）

依据：2026-09-24 对 Noco `13000` 重打 `meta.count`；证据见 [hop-t-count-queries](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/internal/hop-t-count-queries.md)。评测口径见 [biz-data-eval](/cursor/stores/bc-aea46619-2327-43a7-a094-57e6e76a7d7e/files/docs/biz-data-eval.md)。

## 结论摘要

| 现象 | 根因 |
|---|---|
| 闸 386 / 2088 / 800 vs 现网 385 / 2085 / 798 | **两套库数口径**：闸用下游 FK `$notEmpty`；现网 hop 用 **上游主键分批 `$in` 求和**。差掉的行 FK 仍非空，但指向的 **上游单在 `biz_purchase_orders` / `biz_tickets` 已不存在**。 |
| Ace 明细 **599** vs 闸 **2088** | **数错 collection**：599 是 **`biz_purchase_orders` 订单主表**全表数，不是 `biz_purchase_order_items` 明细。 |
| Departments → Users 闸 **12** vs 现网 **0** | 闸 **12 = 部门全表**，不是 Users 边；连接器 **`departmentsUsers` 为 0**，现网 0 正确。 |
| Roles / Users 闸 **0** vs 现网 14/8 | 闸对 m2m **写死 0**；`rolesUsers` 实际 **15** 条。与 hop 三问无关，属另一条评测线。 |

## hop 差 1 / 2 / 3：具体少了哪几行、为什么 hop 没带

现网 hop 只会用 **当前能列出的上游 id** 去滤下游。下列行 `purchaseOrderId` / `ticketId` **有值**，但上游 get 不到，故 **不会进入任何 `$in` 批**，从 hop 合计里掉出去；`$notEmpty` 闸仍计入。

### 采购收货单（−1）

- **RC20250401397**（id `371712935460925`）
- `purchaseOrderId = 371712904003616`，`purchaseOrder` 关联为 null，订单表无此 id。

### 采购订单明细（−3）

- 明细 id：`371712904003617`、`371712904003618`、`371712904003619`
- 均挂 **同一** 缺失订单 `371712904003616`（与上列收货单同源数据问题）。

### 工单处理记录（−2）

- 日志 id：`371713520566302`、`371713526857752`
- 共用 `ticketId = 371713516371970`，工单表无此 id（`ticket` append 为 null）。

**不是** ±1 凑数、不是批 `$in` 随机丢 id（同一缺失 PO 一次丢 1 张收货 + 3 行明细，逻辑一致），而是 **悬挂外键 + hop 只认现存上游行**。

## 386 / 2088 / 800 官方表是否可信

对 **子表边** `purchaseOrder` / `ticket`：`$notEmpty` 与下游全表 count **一致**（386 / 2088 / 800），作「该边有 FK 的行数」仍成立。

同一句「采购订单的…」在图上还有 **父侧** 边 `receipts` / `items`；闸若对齐那条边，库数是 **385 / 2085**，与现网 hop **相同**。文档里写的 386 / 2088 对应 **子表 FK 边** case，不是父表 o2m 边。

## 2088 与 599

- **2088** → `biz_purchase_order_items`
- **599** → `biz_purchase_orders`（供应商的采购订单等用例闸也是 599）

若预览结果种类或页脚落在主表，会出现「明细只有 599」——**对象数错**，不是明细表只有 599 行。

## Departments → Users 的 12

- 部门全表 **12**
- `members` / `owners` 的 through **`departmentsUsers`：0**
- Users 上 **`mainDepartmentId` 非空：0**

官方 **12** 是把 **部门张数** 当成了「部门的用户」库数；现网 **0** 与连接器一致，不是边对了但字段全空。

## 建议验收时怎么数（本刀不改产品）

1. 先确认 **哪条已发布边**（`purchaseOrder` vs `items` / `receipts`）。
2. 库数：下游 resource + 该边 FK 的 `$notEmpty` `meta.count`。
3. 与现网对比时，再用 **上游 id 分批 `$in` 合计** 预期 hop；若仍差，按上文表查悬挂 FK 行。
