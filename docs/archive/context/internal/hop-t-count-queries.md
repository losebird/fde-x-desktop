---
cursor:
  subagentId: "bc-cee6c60a-e268-54ad-b11d-c08ed6de33c5"
---

# hop / `{{t()}}` 条数 — 连接器查询证据

时间：2026-09-24。只读 `http://127.0.0.1:13000`，token 来自 `~/.dsh-fde-x/lan-assist/secrets.json` 的 `lookupToken`。未 reload，未动 5174/4318。

## 1. 官方表数字从哪来（评测闸）

来源：`internal/biz-data-eval-rescore-run.mjs` 的 `libraryCountFor`（与生成闸时一致）。

对已发布 **hop 边**、计数对象为下游 `objects.to` 时：

```js
const col = fkColumn(edgeField) // edgeField → `${edgeField}Id`（已是 Id 则不变）
return nocoMeta(resource, { [col]: { $notEmpty: true } })
```

即下游 collection 上 **该边 FK 列 `$notEmpty`** 的 `:list` **`meta.count`**（`page=1&pageSize=1`）。

`biz-data-eval.json` 里同一句「上游的下游」可能对应 **两条已发布边**（父表 o2m 名 vs 子表 belongsTo 名），闸数不同：

| 说法 | 图 field（from→to） | 下游 resource | 闸 filter（meta.count） |
|---|---|---|---|
| 采购订单的采购收货单 | `receipts`（在 PO 上） | `biz_purchase_receipts` | 走 `receipts` 时闸逻辑仍落到子表 FK；本条 case 的 `expected` 与 `receipts` 边对齐为 **385** |
| 采购订单的采购收货单 | `purchaseOrder`（在收货单上） | `biz_purchase_receipts` | `{ purchaseOrderId: { $notEmpty: true } }` → **386** |
| 采购订单的采购订单明细 | `items`（在 PO 上） | `biz_purchase_order_items` | 对齐 **2085** |
| 采购订单的采购订单明细 | `purchaseOrder`（在明细上） | `biz_purchase_order_items` | `{ purchaseOrderId: { $notEmpty: true } }` → **2088** |
| 工单的工单处理记录 | `ticket` | `biz_ticket_logs` | `{ ticketId: { $notEmpty: true } }` → **800** |

`biz-data-eval.md` 写的 386 / 2088 / 800 对应 **子表 FK `purchaseOrder` / `ticket` 边** 的 `$notEmpty` 闸，不是父表 `receipts` / `items` 那条边的 385 / 2085。

## 2. 本次重打的 meta.count（三种口径）

### 2.1 下游全表

| resource | meta.count |
|---|---:|
| `biz_purchase_receipts` | 386 |
| `biz_purchase_order_items` | 2088 |
| `biz_ticket_logs` | 800 |
| `biz_purchase_orders` | **599** |
| `biz_tickets` | 401 |
| `departments` | 12 |
| `users` | 14 |

### 2.2 已发布关系：子表 FK `$notEmpty`（= 闸口径）

| 下游 | filter | meta.count |
|---|---|---:|
| `biz_purchase_receipts` | `{ purchaseOrderId: { $notEmpty: true } }` | 386 |
| `biz_purchase_order_items` | `{ purchaseOrderId: { $notEmpty: true } }` | 2088 |
| `biz_ticket_logs` | `{ ticketId: { $notEmpty: true } }` | 800 |

与全表一致：三张下游表 **每一行 FK 都有值**。

### 2.3 hop：上游主键全集 `$in` 分批累加（= 现网 lookup 批 `$in`）

上游 id 列表：PO **599** 个（`biz_purchase_orders` 分页 `fields=id`）；工单 **401** 个（`biz_tickets`）。

分批规则：与 `lookup.js` `relatedIdBatches` 相同（filter URL 预算约 6000），对每批 `{ purchaseOrderId: { $in: [...] } }` / `{ ticketId: { $in: [...] } }` 取 `meta.count` 后 **求和**。

| 下游 | hop 分批 `$in` 合计 | 与 `$notEmpty` 差 |
|---|---:|---:|
| `biz_purchase_receipts` | **385** | −1 |
| `biz_purchase_order_items` | **2085** | −3 |
| `biz_ticket_logs` | **798** | −2 |

单次请求把 599 个 PO id 塞进一个 `$in` 会返回 HTML 错误页（URL/过滤器过大），**不能**用来当库数。

## 3. 差行定位（FK 有值，但上游表无此行）

### 3.1 采购收货单少 1 行

在 `{ purchaseOrderId: { $notEmpty: true } }` 全集里，`purchaseOrderId` **不在** 当前 `biz_purchase_orders` 的 599 个 id 中：

| id | receiptNo | purchaseOrderId | purchaseOrder append |
|---:|---|---:|---|
| 371712935460925 | RC20250401397 | 371712904003616 | `null`（`biz_purchase_orders:get` 亦无此 id） |

### 3.2 采购订单明细少 3 行

同上，三行都指向 **同一** 缺失 PO `371712904003616`：

| id | purchaseOrderId |
|---:|---:|
| 371712904003617 | 371712904003616 |
| 371712904003618 | 371712904003616 |
| 371712904003619 | 371712904003616 |

收货单 orphan 与这三条明细 **同 PO**，不是独立四单。

### 3.3 工单处理记录少 2 行

`ticketId` 有值但 **不在** 当前 `biz_tickets` 401 条内：

| id | ticketId | occurredAt / content | ticket append |
|---:|---:|---|---|
| 371713520566302 | 371713516371970 | 提交修复方案 | `null` |
| 371713526857752 | 371713516371970 | （同 ticketId） | `null` |

## 4. 2088 vs 599（数错对象）

- **2088**：`biz_purchase_order_items` 全表 / `purchaseOrderId $notEmpty`（明细行数）。
- **599**：`biz_purchase_orders` 全表（**采购订单**张数，与「采购订单明细」不是同一张 collection）。

Ace 业务系统若页脚 **599**，是把 **订单主表** 条数当成了「采购订单的采购订单明细」的命中数，不是 2088 闸少算了 1489。

## 5. Departments → Users 的「12」

| 查询 | meta.count |
|---|---:|
| `departments` 全表 | 12 |
| `departmentsUsers` 关联表全表 | **0** |
| `users` + `mainDepartmentId $notEmpty` | **0** |

图上边 `members` / `owners` 走 `departmentsUsers`；库中 **0 条关联**。评测 `expectedCount: 12` 与 **部门全表 12** 同数，不是 `users` 上该边 `$notEmpty` 或 junction 行数。现网 **0** 与连接器一致。

## 6. Roles / Users（对照，非 hop 三问）

| 查询 | meta.count |
|---|---:|
| `rolesUsers` 全表 | 15 |
| `users` 全表 | 14 |
| 闸 `column: m2m` | 硬编码 **0**（`libraryCountFor`） |

现网曾报 14 / 8 与 junction **15 链 / 14 个 user** 或整表 `users` 有关，不是「库 0」的 `$notEmpty` 口径。

---

复现脚本（本机）：`internal/hop-t-count-run.mjs`（需分批；勿对 599 id 单次 `$in`）。
